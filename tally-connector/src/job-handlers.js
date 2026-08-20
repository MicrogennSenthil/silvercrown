/**
 * job-handlers.js — Handles each job type dispatched by the ERP.
 *
 * Direction guide
 * ───────────────
 * Tally → ERP  (export_voucher / export_sales / export_purchase)
 *   Connector pulls vouchers from Tally, sends them to ERP via
 *   POST /api/tally/connector/import, then marks the job complete.
 *   Handlers return { ok, count, importStatus } — NOT the raw vouchers —
 *   so the complete payload stays small and sensitive data is not echoed.
 *   The importToErp call is orchestrated in index.js (after the handler
 *   returns) to keep handlers testable without an ERP connection.
 *
 * ERP → Tally  (import_vouchers)
 *   ERP sends { params: { vouchers: [...] } }.  Connector POSTs each
 *   voucher into Tally and returns per-voucher results.  These do NOT
 *   call /api/tally/connector/import.
 *
 * Job types
 * ─────────
 *   test_connection    — ping Tally, return company list
 *   discover_masters   — fetch ledgers, voucher types, stock items
 *   import_masters     — ERP → Tally master acknowledgement
 *   import_vouchers    — ERP → Tally voucher push
 *   export_voucher     — Tally → ERP vouchers by date (all types)
 *   export_sales       — Tally → ERP sales vouchers
 *   export_purchase    — Tally → ERP purchase vouchers
 */

import { logger } from "./logger.js";
import { sendToTally, isTallyOfflineError, withBackoff } from "./tally-client.js";
import {
  buildCompanyDiscoveryXml,
  buildLedgerDiscoveryXml,
  buildVoucherTypeDiscoveryXml,
  buildStockItemDiscoveryXml,
  buildVoucherExportXml,
  buildVoucherImportXml,
} from "./xml-builder.js";
import {
  parseCompanyDiscovery,
  parseLedgerDiscovery,
  parseVoucherTypeDiscovery,
  parseStockItemDiscovery,
  parseVoucherExport,
  parseVoucherImportResponse,
} from "./xml-parser.js";

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Call Tally with exponential back-off on offline errors.
 * Uses host/port from the per-job runtime config (already merged with base).
 */
async function tallyCall({ host, port, xmlBody, backoff, signal }) {
  return withBackoff({
    fn: () => sendToTally({ host, port, xmlBody }),
    isTransient: isTallyOfflineError,
    initialMs: backoff.initialMs,
    maxMs:     backoff.maxMs,
    signal,
    label: "Tally HTTP request",
  });
}

// ─── EXPORT direction helpers ─────────────────────────────────────────────────

/**
 * Pull vouchers from Tally for the given date range and voucher types.
 * Stamps each voucher with company and financialYear from job params so the
 * ERP can upsert into the correct book.
 *
 * @param {object} opts
 * @param {object} opts.runtimeConfig  — per-job merged config (not the frozen base)
 * @param {object} opts.params         — job.params
 * @param {string[]} opts.voucherTypes — filter (empty = all)
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<object[]>}        — normalised voucher array (with company/financialYear)
 */
async function pullVouchersFromTally({ runtimeConfig, params, voucherTypes, signal }) {
  const { host, port, company: cfgCompany } = runtimeConfig.tally;
  // params.company overrides everything; then per-job connectorConfig.company; then env/file default
  const company = (typeof params.company === "string" && params.company.trim())
    ? params.company.trim()
    : cfgCompany;

  const financialYear = params.financialYear ?? null;

  if (!params.fromDate || !params.toDate) {
    throw new Error("params.fromDate and params.toDate are required for voucher export");
  }

  const xml = buildVoucherExportXml({
    fromDate: params.fromDate,
    toDate:   params.toDate,
    company,
    voucherTypes,
  });

  const raw = await tallyCall({ host, port, xmlBody: xml, backoff: runtimeConfig.backoff, signal });
  const vouchers = parseVoucherExport(raw);

  // Convert Tally's signed ledger-entry representation to the ERP's canonical
  // inbound shape before crossing the API boundary.
  return vouchers.map(v => ({
    externalId: v.externalId || v.remoteId || v.voucherKey || "",
    alterationId: v.alterationId || "",
    voucherType: v.voucherType || "",
    voucherNumber: v.voucherNumber || "",
    voucherDate: v.date,
    narration: v.narration || "",
    company: company ?? "",
    financialYear: financialYear ?? "",
    lines: (v.ledgerEntries || []).map(entry => ({
      ledgerName: entry.ledgerName || "",
      drCr: entry.isDeemed || Number(entry.amount) >= 0 ? "DR" : "CR",
      amount: Math.abs(Number(entry.amount) || 0),
      narration: v.narration || "",
      billAllocations: (entry.billAllocations || []).map(bill => ({
        billName: bill.name || "",
        billType: bill.billType || "New Ref",
        amount: Math.abs(Number(bill.amount) || 0),
      })),
      bankAllocations: entry.bankAllocations || [],
    })),
    bankAllocations: v.bankAllocations || [],
  }));
}

// ─── test_connection ──────────────────────────────────────────────────────────

export async function handleTestConnection({ runtimeConfig, params = {}, signal }) {
  const { host, port } = runtimeConfig.tally;
  const xml = buildCompanyDiscoveryXml();
  logger.info("[job] test_connection: pinging Tally...");
  const raw = await tallyCall({ host, port, xmlBody: xml, backoff: runtimeConfig.backoff, signal });
  const companies = parseCompanyDiscovery(raw);
  logger.info(`[job] test_connection: found ${companies.length} company(ies) in Tally`);
  return { ok: true, companies };
}

// ─── discover_masters ─────────────────────────────────────────────────────────

export async function handleDiscoverMasters({ runtimeConfig, params = {}, signal }) {
  const { host, port, company } = runtimeConfig.tally;
  const includeStock = params.includeStock !== false; // default true

  logger.info("[job] discover_masters: fetching ledgers...");
  const ledgerXml = buildLedgerDiscoveryXml(company);
  const rawLedgers = await tallyCall({ host, port, xmlBody: ledgerXml, backoff: runtimeConfig.backoff, signal });
  const ledgers = parseLedgerDiscovery(rawLedgers);
  logger.info(`[job] discover_masters: ${ledgers.length} ledger(s)`);

  logger.info("[job] discover_masters: fetching voucher types...");
  const vtXml = buildVoucherTypeDiscoveryXml(company);
  const rawVt = await tallyCall({ host, port, xmlBody: vtXml, backoff: runtimeConfig.backoff, signal });
  const voucherTypes = parseVoucherTypeDiscovery(rawVt);
  logger.info(`[job] discover_masters: ${voucherTypes.length} voucher type(s)`);

  let stockItems = [];
  if (includeStock) {
    logger.info("[job] discover_masters: fetching stock items...");
    const stXml = buildStockItemDiscoveryXml(company);
    const rawSt = await tallyCall({ host, port, xmlBody: stXml, backoff: runtimeConfig.backoff, signal });
    stockItems = parseStockItemDiscovery(rawSt);
    logger.info(`[job] discover_masters: ${stockItems.length} stock item(s)`);
  }

  // Return the complete master data for server upsert
  return {
    ok: true,
    company: company ?? null,
    ledgers,       // complete array — ERP upserts these
    voucherTypes,  // complete array — ERP upserts these
    stockItems,    // complete array (empty if includeStock=false)
    counts: {
      ledgers:      ledgers.length,
      voucherTypes: voucherTypes.length,
      stockItems:   stockItems.length,
    },
  };
}

// ─── import_masters ───────────────────────────────────────────────────────────
// Tally doesn't support generic ledger creation via standard HTTP/XML — that
// requires TDL.  We acknowledge receipt and advise.

export async function handleImportMasters({ runtimeConfig, params = {}, signal }) {
  logger.info("[job] import_masters: acknowledged (ledger create via XML requires TDL)");
  return {
    ok: true,
    message:
      "Master payload received. Ledger creation via standard Tally HTTP requires TDL " +
      "configuration. Contact your Tally admin to auto-create ledgers via TDL or " +
      "create them manually.",
  };
}

// ─── import_vouchers  (ERP → Tally) ──────────────────────────────────────────

export async function handleImportVouchers({ runtimeConfig, params = {}, signal }) {
  const { host, port, company: defaultCompany } = runtimeConfig.tally;
  const vouchers = params.vouchers ?? [];

  if (!Array.isArray(vouchers) || vouchers.length === 0) {
    return { ok: false, message: "No vouchers provided in params.vouchers" };
  }

  logger.info(`[job] import_vouchers: pushing ${vouchers.length} voucher(s) into Tally...`);

  const results = [];
  for (const voucher of vouchers) {
    // Voucher-level company > per-job config company > base config company
    const company = (typeof voucher.company === "string" && voucher.company.trim())
      ? voucher.company.trim()
      : defaultCompany;

    const normalizedVoucher = {
      ...voucher,
      company,
      remoteId: voucher.remoteId || (voucher.externalId ? `ERP:${voucher.externalId}` : null),
      date: voucher.date || voucher.voucherDate,
      ledgerEntries: Array.isArray(voucher.ledgerEntries)
        ? voucher.ledgerEntries
        : (voucher.lines || []).map(line => ({
            ledgerName: line.ledgerName,
            amount: line.drCr === "CR"
              ? -Math.abs(Number(line.amount) || 0)
              : Math.abs(Number(line.amount) || 0),
            narration: line.narration || voucher.narration || "",
            isParty: !!line.isParty,
            billAllocations: line.billAllocations,
          })),
    };
    const xml = buildVoucherImportXml(normalizedVoucher);

    try {
      const raw = await tallyCall({ host, port, xmlBody: xml, backoff: runtimeConfig.backoff, signal });
      const importResult = parseVoucherImportResponse(raw);
      const accepted = importResult.errorCount === 0
        && importResult.errors.length === 0
        && (importResult.created + importResult.altered) > 0;
      results.push({
        remoteId:      normalizedVoucher.remoteId ?? null,
        voucherNumber: voucher.voucherNumber ?? null,
        ok: accepted,
        ...importResult,
      });
      // Log counts only — not the voucher content
      logger.debug(
        `[job] import_vouchers: remoteId=${normalizedVoucher.remoteId} ` +
        `created=${importResult.created} altered=${importResult.altered} ` +
        `errors=${importResult.errors.length}`
      );
    } catch (err) {
      // Log error message — remoteId is a system identifier, safe to log
      logger.error(`[job] import_vouchers: error for remoteId=${normalizedVoucher.remoteId}: ${err.message}`);
      results.push({
        remoteId:      normalizedVoucher.remoteId ?? null,
        voucherNumber: voucher.voucherNumber ?? null,
        ok: false,
        created: 0, altered: 0, deleted: 0,
        errorCount: 1,
        errors: [{ msg: err.message, key: null }],
      });
    }
  }

  const totalCreated = results.reduce((s, r) => s + (r.created ?? 0), 0);
  const totalAltered = results.reduce((s, r) => s + (r.altered ?? 0), 0);
  const totalErrors  = results.reduce(
    (s, r) => s + Math.max(r.errorCount ?? 0, r.errors?.length ?? 0),
    0
  );

  return {
    ok:           results.length > 0 && results.every(result => result.ok === true),
    totalCreated,
    totalAltered,
    totalErrors,
    results,
  };
}

// ─── export_voucher / export_sales / export_purchase  (Tally → ERP) ──────────
//
// These handlers pull from Tally and return the vouchers in a _vouchers field
// so that index.js can (1) POST them to /api/tally/connector/import and then
// (2) mark the job complete with a summary result (no raw vouchers in /complete).
// The _vouchers field is stripped before the result is sent to /complete.

export async function handleExportVoucher({ runtimeConfig, params = {}, signal }) {
  logger.info(`[job] export_voucher: ${params.fromDate} – ${params.toDate}`);
  const vouchers = await pullVouchersFromTally({
    runtimeConfig,
    params,
    voucherTypes: params.voucherTypes ?? [], // empty = all types
    signal,
  });
  logger.info(`[job] export_voucher: pulled ${vouchers.length} voucher(s) from Tally`);
  return {
    ok:     true,
    count:  vouchers.length,
    _vouchers: vouchers, // used by index.js; stripped before /complete
  };
}

export async function handleExportSales({ runtimeConfig, params = {}, signal }) {
  const defaultSalesTypes = ["Sales", "Credit Note", "Sales Order"];
  const voucherTypes = params.voucherTypes ?? defaultSalesTypes;
  logger.info(`[job] export_sales: ${params.fromDate} – ${params.toDate}, types=${voucherTypes.join(",")}`);
  const vouchers = await pullVouchersFromTally({ runtimeConfig, params, voucherTypes, signal });
  logger.info(`[job] export_sales: pulled ${vouchers.length} sales voucher(s) from Tally`);
  return {
    ok:    true,
    count: vouchers.length,
    _vouchers: vouchers,
  };
}

export async function handleExportPurchase({ runtimeConfig, params = {}, signal }) {
  const defaultPurchaseTypes = ["Purchase", "Debit Note", "Purchase Order"];
  const voucherTypes = params.voucherTypes ?? defaultPurchaseTypes;
  logger.info(`[job] export_purchase: ${params.fromDate} – ${params.toDate}, types=${voucherTypes.join(",")}`);
  const vouchers = await pullVouchersFromTally({ runtimeConfig, params, voucherTypes, signal });
  logger.info(`[job] export_purchase: pulled ${vouchers.length} purchase voucher(s) from Tally`);
  return {
    ok:    true,
    count: vouchers.length,
    _vouchers: vouchers,
  };
}

// ─── Export job types that produce vouchers for ERP import ───────────────────

/** Job types whose result contains _vouchers to be sent to ERP import. */
export const EXPORT_JOB_TYPES = new Set([
  "export_voucher",
  "export_sales",
  "export_purchase",
]);

// ─── Dispatcher ──────────────────────────────────────────────────────────────

const HANDLERS = {
  test_connection:  handleTestConnection,
  discover_masters: handleDiscoverMasters,
  import_masters:   handleImportMasters,
  import_vouchers:  handleImportVouchers,
  export_voucher:   handleExportVoucher,
  export_sales:     handleExportSales,
  export_purchase:  handleExportPurchase,
};

/**
 * Dispatch a job to the appropriate handler.
 *
 * @param {object} job            — job object from ERP:
 *                                    { id, type, params, idempotencyKey, kind, connectorConfig }
 * @param {object} runtimeConfig  — per-job merged config (from makeTallyConfig)
 * @param {AbortSignal} [signal]
 * @returns {Promise<object>}     — result object; may contain _vouchers (internal only)
 */
export async function dispatchJob(job, runtimeConfig, signal) {
  const handler = HANDLERS[job.type];
  if (!handler) {
    logger.warn(`[job] Unknown job type: "${job.type}"`);
    return { ok: false, message: `Unsupported job type: ${job.type}` };
  }
  return handler({ runtimeConfig, params: job.params ?? {}, signal });
}
