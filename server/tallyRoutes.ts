/**
 * Tally Prime Integration — Express Routes
 *
 * Browser APIs:  /api/tally/*            — session auth + role_rights
 * Connector APIs: /api/tally/connector/* — Authorization: Bearer <token>
 *
 * role_rights modules:
 *   tally_integration         → dashboard (can_view)
 *   tally_configuration       → config r/w, token rotation (can_view, can_edit, can_create)
 *   tally_mapping             → mappings CRUD (can_view, can_create, can_edit, can_delete)
 *   tally_sync                → jobs, approve/reject/retry (can_view, can_create, can_approve)
 *   report_acc_profit_loss
 *   report_acc_ledger_report
 *   report_acc_outstanding
 *   report_acc_customer_receivable
 *   report_acc_supplier_payables
 *   report_acc_bank_reconciliation
 */

import type { Express, Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { requireAuth } from "./auth";
import { pool } from "./db";
import {
  ensureTallySchema,
  generateConnectorToken,
  verifyConnectorToken,
  checkTallyPermission,
  validateVoucherFields,
  validateVoucherBalance,
  resolveMappings,
  postInboundVoucher,
  enqueueExportJobs,
  auditLog,
  getActiveConfig,
  getConfigById,
  safeConfig,
  maybeScheduleSync,
  validateDate,
  validateDateOptional,
  type InboundVoucher,
} from "./tallyService";

// ─── Middleware: connector Bearer auth ────────────────────────────────────────

async function requireConnectorAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }
  const token = auth.slice(7).trim();
  if (!token) return res.status(401).json({ error: "Empty token" });
  try {
    const { valid, configId } = await verifyConnectorToken(token);
    if (!valid) return res.status(401).json({ error: "Invalid connector token" });
    (req as any).tallyConfigId = configId;
    next();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}

// ─── Browser permission middleware ────────────────────────────────────────────

function requireTallyRight(
  module: string,
  permission: "can_view" | "can_create" | "can_edit" | "can_delete" | "can_approve" | "can_export"
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    const ok = await checkTallyPermission(user, module, permission);
    if (!ok) return res.status(403).json({ error: `Permission denied: ${module}.${permission}` });
    next();
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const REPORT_DISCLAIMER =
  "This report is generated from ERP ledger data and is not a statutory filing. " +
  "Data origin and last Tally sync timestamps are shown where available.";

/** Parse and validate limit query param */
function parseLimit(q: any, def = 100, max = 500): number {
  return Math.min(Math.max(1, parseInt(q || String(def), 10) || def), max);
}

/** Validate a YYYY-MM-DD date string and throw 400 if invalid. */
function requireDate(s: string | undefined, field: string): string {
  const parsed = s ? new Date(`${s}T00:00:00Z`) : null;
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)
      || !parsed || isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== s) {
    throw Object.assign(new Error(`${field} must be a valid YYYY-MM-DD date`), { status: 400 });
  }
  return s;
}

// ─── Route registration ───────────────────────────────────────────────────────

export async function registerTallyRoutes(app: Express): Promise<void> {
  // DDL — throws on failure so startup is explicit
  await ensureTallySchema();

  // ════════════════════════════════════════════════════════════════════
  // CONNECTOR APIs
  // ════════════════════════════════════════════════════════════════════

  // ── Heartbeat ─────────────────────────────────────────────────────────────
  app.post("/api/tally/connector/heartbeat", requireConnectorAuth, async (req, res) => {
    try {
      const configId = (req as any).tallyConfigId as string;
      const { connectorId, version, tallyStatus, tallyError } = req.body;
      await pool.query(
        `UPDATE tally_config
         SET last_heartbeat_at=now(),
             connector_version=COALESCE($1, connector_version),
             last_tally_status=COALESCE($2, last_tally_status),
             last_tally_error=COALESCE($3, last_tally_error),
             updated_at=now()
         WHERE id=$4`,
        [version || null, tallyStatus || null, tallyError || null, configId]
      );

      // A live connector renews only its own leases. If it disappears, the
      // polling endpoint reclaims those leases after the expiry window.
      const instanceId = String(connectorId || "").trim();
      if (instanceId) {
        await pool.query(
          `UPDATE tally_sync_jobs
           SET leased_at=now(), updated_at=now()
           WHERE config_id=$1 AND status='leased' AND leased_by=$2`,
          [configId, instanceId]
        );
        await pool.query(
          `UPDATE tally_outbox
           SET leased_at=now(), updated_at=now()
           WHERE config_id=$1 AND status='leased' AND leased_by=$2`,
          [configId, instanceId]
        );
      }

      // Scheduled sync check
      await maybeScheduleSync(configId);

      await auditLog({
        configId,
        eventType: "heartbeat",
        actorType: "connector",
        description: `Heartbeat v${version || "?"}`,
      });

      // Return next config snapshot (host/port etc.) so connector can reconfigure
      const cfg = await getConfigById(configId, true);
      res.json({
        ok: true,
        serverTime: new Date().toISOString(),
        config: cfg
          ? {
              tallyHost: cfg.tally_host,
              tallyPort: cfg.tally_port,
              companyName: cfg.company_name,
              financialYear: cfg.financial_year,
              enableStockSync: cfg.enable_stock_sync,
            }
          : null,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Lease queued jobs ─────────────────────────────────────────────────────
  // Returns {id, type, params, idempotencyKey, kind} shape.
  // kind: 'sync_job' | 'outbox'
  // type: discover_masters | export_voucher (for inbound jobs)
  //       import_vouchers (for outbox → connector posts the voucher to Tally)
  app.get("/api/tally/connector/jobs", requireConnectorAuth, async (req, res) => {
    const client = await pool.connect();
    try {
      const configId = (req as any).tallyConfigId as string;
      const instanceId = String(req.query.instanceId || "connector");
      const limit = parseLimit(req.query.limit, 5, 20);

      await client.query("BEGIN");

      // Reclaim abandoned leases. Each expiry consumes one retry so a
      // permanently crashing payload eventually moves to failed instead of
      // blocking all future scheduled work forever.
      await client.query(
        `UPDATE tally_sync_jobs
         SET retry_count=retry_count+1,
             status=CASE WHEN retry_count+1 >= max_retries THEN 'failed' ELSE 'queued' END,
             completed_at=CASE WHEN retry_count+1 >= max_retries THEN now() ELSE completed_at END,
             error_message='Connector lease expired before completion',
             leased_at=NULL,
             leased_by='',
             updated_at=now()
         WHERE config_id=$1
           AND status='leased'
           AND leased_at < now() - interval '15 minutes'`,
        [configId]
      );
      await client.query(
        `UPDATE tally_outbox
         SET retry_count=retry_count+1,
             status=CASE WHEN retry_count+1 >= max_retries THEN 'failed' ELSE 'queued' END,
             error_message='Connector lease expired before completion',
             leased_at=NULL,
             leased_by='',
             updated_at=now()
         WHERE config_id=$1
           AND status='leased'
           AND leased_at < now() - interval '15 minutes'`,
        [configId]
      );

      // Load config once for params
      const cfgR = await client.query(
        `SELECT company_name, financial_year, tally_host, tally_port,
                enable_stock_sync
         FROM tally_config WHERE id=$1`,
        [configId]
      );
      const cfg = cfgR.rows[0] || {};
      const connectorConfig = {
        tallyHost: cfg.tally_host || "localhost",
        tallyPort: cfg.tally_port || 9000,
        company: cfg.company_name || "",
        financialYear: cfg.financial_year || "",
      };

      // Atomically lease inbound tally_sync_jobs
      const syncR = await client.query(
        `UPDATE tally_sync_jobs
         SET status='leased', leased_at=now(), leased_by=$1, updated_at=now()
         WHERE id IN (
           SELECT id FROM tally_sync_jobs
           WHERE config_id=$2 AND direction='inbound' AND status='queued'
           ORDER BY priority ASC, created_at ASC
           LIMIT $3
           FOR UPDATE SKIP LOCKED
         )
         RETURNING id, job_type, from_date::text, to_date::text, payload`,
        [instanceId, configId, Math.max(1, limit - 2)]
      );

      // Map job_type → connector 'type'
      const syncJobs = syncR.rows.map((row: any) => ({
        id: row.id,
        kind: "sync_job",
        type: row.job_type === "import_masters" ? "discover_masters"
            : row.job_type === "import_vouchers" ? "export_voucher"
            : row.job_type,
        params: {
          fromDate: row.from_date || null,
          toDate: row.to_date || null,
          company: connectorConfig.company,
          financialYear: connectorConfig.financialYear,
          includeStock: cfg.enable_stock_sync || false,
          ...(row.payload || {}),
        },
        idempotencyKey: row.id,
        connectorConfig,
      }));

      // Atomically lease queued outbox items
      const outboxR = await client.query(
        `UPDATE tally_outbox
         SET status='leased', leased_at=now(), leased_by=$1, updated_at=now()
         WHERE id IN (
           SELECT id FROM tally_outbox
           WHERE config_id=$2 AND status='queued'
           ORDER BY created_at ASC
           LIMIT $3
           FOR UPDATE SKIP LOCKED
         )
         RETURNING id, source_type, source_id, voucher_type, payload`,
        [instanceId, configId, Math.max(0, limit - syncJobs.length)]
      );

      const outboxJobs = outboxR.rows.map((row: any) => ({
        id: row.id,
        kind: "outbox",
        type: "import_vouchers",
        params: {
          vouchers: row.payload && row.payload.remoteId ? [row.payload] : [],
          sourceType: row.source_type,
          sourceId: row.source_id,
          voucherType: row.voucher_type,
          company: connectorConfig.company,
          financialYear: connectorConfig.financialYear,
        },
        idempotencyKey: `outbox:${row.id}`,
        connectorConfig,
      }));

      await client.query("COMMIT");
      res.json({ jobs: [...syncJobs, ...outboxJobs] });
    } catch (e: any) {
      await client.query("ROLLBACK");
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  // ── Complete a job ────────────────────────────────────────────────────────
  // Body: { result: { ok, summary?, error?, discoveredMasters?, vouchers? } }
  // kind is embedded in result or inferred from the job table.
  app.post("/api/tally/connector/jobs/:id/complete", requireConnectorAuth, async (req, res) => {
    try {
      const configId = (req as any).tallyConfigId as string;
      const jobId = String(req.params.id);
      const instanceId = String(req.query.instanceId || "connector");
      const { result } = req.body;
      if (!result) return res.status(400).json({ error: "result object required" });

      const ok = !!result.ok;
      const summary = String(result.summary || result.message || "");
      const errorMsg = String(result.error || result.importError || result.message || "");
      let kind = String(result.kind || "");
      if (kind !== "outbox" && kind !== "sync_job") {
        const outboxProbe = await pool.query(
          `SELECT 1 FROM tally_outbox WHERE id=$1 AND config_id=$2`,
          [jobId, configId]
        );
        kind = outboxProbe.rows[0] ? "outbox" : "sync_job";
      }

      if (kind === "outbox") {
        // Outbox completion
        const existing = await pool.query(
          `SELECT id, source_type, source_id, status, leased_by FROM tally_outbox
           WHERE id=$1 AND config_id=$2`,
          [jobId, configId]
        );
        if (!existing.rows[0]) return res.status(404).json({ error: "Outbox record not found" });
        if (existing.rows[0].status === "sent") return res.json({ ok: true, idempotent: true });
        if (existing.rows[0].status !== "leased" || existing.rows[0].leased_by !== instanceId) {
          return res.status(409).json({ error: "Outbox lease is not owned by this connector" });
        }

        if (ok) {
          const firstResult = Array.isArray(result.results) ? result.results[0] : null;
          const externalId = String(
            result.tallyGuid ||
            result.externalId ||
            firstResult?.guid ||
            firstResult?.remoteId ||
            ""
          );
          const externalRef = String(result.voucherNumber || firstResult?.voucherNumber || "");
          const sent = await pool.query(
            `UPDATE tally_outbox
             SET status='sent', sent_at=now(), error_message='',
                 leased_at=NULL, leased_by='', updated_at=now()
             WHERE id=$1 AND config_id=$2 AND status='leased' AND leased_by=$3
             RETURNING id`,
            [jobId, configId, instanceId]
          );
          if (!sent.rows[0]) return res.status(409).json({ error: "Outbox lease changed before completion" });
          // External ref
          if (externalId && existing.rows[0].source_id) {
            const tbl = existing.rows[0].source_type === "job_work_invoice"
              ? "job_work_invoices" : "goods_receipt_notes";
            await pool.query(
              `INSERT INTO tally_external_refs
                 (config_id, internal_table, internal_id, external_system, external_id, external_ref, synced_at)
               VALUES ($1,$2,$3,'tally',$4,$5,now())
               ON CONFLICT (config_id, internal_table, internal_id, external_system)
               DO UPDATE SET external_id=$4, external_ref=$5, synced_at=now()`,
              [configId, tbl, existing.rows[0].source_id, externalId, externalRef]
            );
          }
          await auditLog({
            configId, eventType: "export_sent", entityType: "tally_outbox", entityId: jobId,
            actorType: "connector", description: `Exported to Tally: ${externalRef || externalId}`,
          });
        } else {
          // Retry or fail
          const cur = await pool.query(
            `SELECT retry_count, max_retries FROM tally_outbox
             WHERE id=$1 AND config_id=$2 AND status='leased' AND leased_by=$3`,
            [jobId, configId, instanceId]
          );
          if (!cur.rows[0]) return res.status(409).json({ error: "Outbox lease changed before completion" });
          const rc = (cur.rows[0]?.retry_count || 0) + 1;
          const maxR = cur.rows[0]?.max_retries || 3;
          const newStatus = rc < maxR ? "queued" : "failed";
          await pool.query(
            `UPDATE tally_outbox
              SET status=$1, retry_count=$2, error_message=$3,
                  leased_at=NULL, leased_by='', updated_at=now()
              WHERE id=$4 AND config_id=$5 AND status='leased' AND leased_by=$6`,
            [newStatus, rc, errorMsg, jobId, configId, instanceId]
          );
        }
        return res.json({ ok: true });
      }

      // Default: sync_job completion
      const existing = await pool.query(
        `SELECT id, job_type, status, leased_by
         FROM tally_sync_jobs WHERE id=$1 AND config_id=$2`,
        [jobId, configId]
      );
      if (!existing.rows[0]) return res.status(404).json({ error: "Job not found" });
      if (existing.rows[0].status === "completed") return res.json({ ok: true, idempotent: true });
      if (existing.rows[0].status !== "leased" || existing.rows[0].leased_by !== instanceId) {
        return res.status(409).json({ error: "Job lease is not owned by this connector" });
      }

      const finalStatus = ok ? "completed" : "failed";
      const completed = await pool.query(
        `UPDATE tally_sync_jobs
         SET status=$1, completed_at=now(), result_summary=$2, error_message=$3,
             leased_at=NULL, leased_by='', updated_at=now()
         WHERE id=$4 AND config_id=$5 AND status='leased' AND leased_by=$6
         RETURNING id`,
        [finalStatus, summary, errorMsg, jobId, configId, instanceId]
      );
      if (!completed.rows[0]) return res.status(409).json({ error: "Job lease changed before completion" });

      // Update last Tally status on config
      await pool.query(
        `UPDATE tally_config
         SET last_tally_status=$1, last_tally_error=$2, updated_at=now()
         WHERE id=$3`,
        [ok ? "ok" : "error", ok ? "" : errorMsg, configId]
      );

      // Handle all connector discovery response shapes.
      const discoveredMasters = Array.isArray(result.discoveredMasters)
        ? result.discoveredMasters
        : [
            ...(Array.isArray(result.ledgers)
              ? result.ledgers.map((m: any) => ({
                  masterType: "ledger",
                  tallyName: m.name,
                  tallyGuid: m.guid || m.tallyGuid || "",
                  tallyGroup: m.parent || "",
                  extra: m,
                }))
              : []),
            ...(Array.isArray(result.voucherTypes)
              ? result.voucherTypes.map((m: any) => ({
                  masterType: "voucher_type",
                  tallyName: m.name,
                  tallyGuid: m.guid || m.tallyGuid || "",
                  tallyGroup: m.parent || "",
                  extra: m,
                }))
              : []),
            ...(Array.isArray(result.stockItems)
              ? result.stockItems.map((m: any) => ({
                  masterType: "stock_item",
                  tallyName: m.name,
                  tallyGuid: m.guid || m.tallyGuid || "",
                  tallyGroup: m.parent || "",
                  extra: m,
                }))
              : []),
          ];
      if (ok && discoveredMasters.length > 0) {
        for (const dm of discoveredMasters) {
          if (!dm.masterType || !dm.tallyName) continue;
          await pool.query(
            `INSERT INTO tally_discovered_masters
               (config_id, master_type, tally_name, tally_guid, tally_group, extra, last_seen_at)
             VALUES ($1,$2,$3,$4,$5,$6::jsonb,now())
             ON CONFLICT (config_id, master_type, LOWER(tally_name))
             DO UPDATE SET tally_guid=$4, tally_group=$5, extra=$6::jsonb, last_seen_at=now()`,
            [configId, dm.masterType, dm.tallyName, dm.tallyGuid || "",
             dm.tallyGroup || "", JSON.stringify(dm.extra || {})]
          );
        }
      }

      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Inbound voucher import ────────────────────────────────────────────────
  app.post("/api/tally/connector/import", requireConnectorAuth, async (req, res) => {
    try {
      const configId = (req as any).tallyConfigId as string;
      const { jobId, vouchers } = req.body as { jobId?: string; vouchers: InboundVoucher[] };

      if (!Array.isArray(vouchers) || vouchers.length === 0) {
        return res.status(400).json({ error: "vouchers array required" });
      }

      const cfgR = await pool.query(
        `SELECT company_name, financial_year FROM tally_config WHERE id=$1`,
        [configId]
      );
      const cfgRow = cfgR.rows[0];
      if (!cfgRow) return res.status(404).json({ error: "Config not found" });

      const results: { externalId: string; status: string; reason?: string }[] = [];

      for (const v of vouchers) {
        try {
          // Field validation
          const fieldErrs = validateVoucherFields(v);
          if (fieldErrs.length > 0) {
            results.push({ externalId: v.externalId || "(missing)", status: "rejected", reason: fieldErrs.join("; ") });
            continue;
          }

          // Company enforcement
          if (cfgRow.company_name && !v.company) {
            results.push({
              externalId: v.externalId, status: "rejected",
              reason: `Company is required; expected "${cfgRow.company_name}"`,
            });
            continue;
          }
          if (cfgRow.company_name && v.company &&
              v.company.toLowerCase() !== cfgRow.company_name.toLowerCase()) {
            results.push({
              externalId: v.externalId, status: "rejected",
              reason: `Company mismatch: expected "${cfgRow.company_name}", got "${v.company}"`,
            });
            continue;
          }

          // FY enforcement
          if (cfgRow.financial_year && !v.financialYear) {
            results.push({
              externalId: v.externalId, status: "rejected",
              reason: `Financial year is required; expected "${cfgRow.financial_year}"`,
            });
            continue;
          }
          if (cfgRow.financial_year && v.financialYear &&
              v.financialYear !== cfgRow.financial_year) {
            results.push({
              externalId: v.externalId, status: "rejected",
              reason: `Fiscal year mismatch: expected "${cfgRow.financial_year}", got "${v.financialYear}"`,
            });
            continue;
          }

          // Balance check (non-fatal — goes into conflict_reason)
          const balErr = validateVoucherBalance(v);

          // Check existing
          const existing = await pool.query(
            `SELECT id, status FROM tally_voucher_inbox WHERE config_id=$1 AND external_id=$2`,
            [configId, v.externalId]
          );

          if (existing.rows.length > 0) {
            const ex = existing.rows[0];
            if (ex.status === "posted") {
              results.push({ externalId: v.externalId, status: "skipped", reason: "Already posted" });
              continue;
            }
            // Update with latest alteration (re-opens for review)
            const { unmapped } = await resolveMappings(configId, v.lines || []);
            const conflict = [balErr || "", unmapped.length > 0 ? `Unmapped: ${unmapped.join(", ")}` : ""]
              .filter(Boolean).join("; ");
            await pool.query(
              `UPDATE tally_voucher_inbox
               SET alteration_id=$1, voucher_type=$2, voucher_number=$3, voucher_date=$4,
                   narration=$5, company=$6, financial_year=$7, checksum=$8,
                   raw_payload=$9::jsonb, status='review', conflict_reason=$10, updated_at=now()
               WHERE id=$11`,
              [v.alterationId || "", v.voucherType, v.voucherNumber, v.voucherDate,
               v.narration || "", v.company, v.financialYear || "", v.checksum || "",
               JSON.stringify(v), conflict, ex.id]
            );
            results.push({ externalId: v.externalId, status: "updated" });
            continue;
          }

          // New: resolve mappings to populate conflict_reason
          const { unmapped } = await resolveMappings(configId, v.lines || []);
          const conflictReason = [
            balErr || "",
            unmapped.length > 0 ? `Unmapped ledgers: ${unmapped.join(", ")}` : "",
          ].filter(Boolean).join("; ");

          await pool.query(
            `INSERT INTO tally_voucher_inbox
               (config_id, job_id, external_id, alteration_id, voucher_type, voucher_number,
                voucher_date, narration, company, financial_year, checksum, raw_payload,
                status, conflict_reason)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,'review',$13)`,
            [configId, jobId || null, v.externalId, v.alterationId || "",
             v.voucherType, v.voucherNumber, v.voucherDate,
             v.narration || "", v.company, v.financialYear || "",
             v.checksum || "", JSON.stringify(v), conflictReason]
          );

          // Financial imports always require an explicit user review action.
          results.push({ externalId: v.externalId, status: "queued_review" });
        } catch (inner: any) {
          results.push({ externalId: (v as any).externalId || "(missing)", status: "error", reason: inner.message });
        }
      }

      await auditLog({
        configId,
        eventType: "voucher_import",
        actorType: "connector",
        description: `Imported ${vouchers.length} voucher(s)`,
        meta: { jobId, count: results.length },
      });

      const acceptedStatuses = new Set(["updated", "skipped", "queued_review"]);
      const accepted = results.filter(r => acceptedStatuses.has(r.status)).length;
      const rejected = results.filter(r => r.status === "rejected" || r.status === "error").length;
      res.json({ ok: rejected === 0, accepted, rejected, results });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Bank recon from connector ─────────────────────────────────────────────
  app.post("/api/tally/connector/bank-recon", requireConnectorAuth, async (req, res) => {
    try {
      const configId = (req as any).tallyConfigId as string;
      const { records } = req.body as {
        records: Array<{
          bankLedgerName: string;
          statementDate: string;
          statementBalance: number;
          bookBalance?: number;
          externalId?: string;
          voucherNumber?: string;
          instrumentNumber?: string;
          transactionType?: string;
          allocationKey?: string;
          tallyData?: any;
        }>;
      };
      if (!Array.isArray(records)) return res.status(400).json({ error: "records array required" });

      let upserted = 0;
      for (let index = 0; index < records.length; index++) {
        const rec = records[index];
        if (!rec.bankLedgerName || !rec.statementDate) continue;
        const statementDate = validateDateOptional(rec.statementDate);
        const statementBalance = Number(rec.statementBalance);
        if (!statementDate || !Number.isFinite(statementBalance)) continue;
        const mapping = await pool.query(
          `SELECT internal_id FROM tally_mappings
           WHERE config_id=$1 AND tally_name=$2 AND mapping_type='bank' AND is_active=true LIMIT 1`,
          [configId, rec.bankLedgerName]
        );
        const internalGlId = mapping.rows[0]?.internal_id || null;
        const stmtBal = statementBalance;
        const bookBal = Number(rec.bookBalance) || 0;
        const diff = stmtBal - bookBal;
        const reconStatus = Math.abs(diff) < 0.01 ? "matched" : "unmatched";
        const allocationKey = rec.allocationKey || createHash("sha256")
          .update([
            rec.externalId || "",
            rec.bankLedgerName,
            statementDate,
            rec.instrumentNumber || "",
            index,
          ].join("|"))
          .digest("hex");

        await pool.query(
          `INSERT INTO tally_bank_recon
             (config_id, bank_ledger_name, internal_gl_id, external_id,
              voucher_number, instrument_number, transaction_type, allocation_key, statement_date,
              statement_balance, book_balance, difference, recon_status, tally_data, last_sync_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,now())
           ON CONFLICT (config_id, allocation_key)
           DO UPDATE SET
             internal_gl_id=EXCLUDED.internal_gl_id,
             external_id=EXCLUDED.external_id,
             voucher_number=EXCLUDED.voucher_number,
             instrument_number=EXCLUDED.instrument_number,
             transaction_type=EXCLUDED.transaction_type,
             statement_date=EXCLUDED.statement_date,
             statement_balance=EXCLUDED.statement_balance,
             book_balance=EXCLUDED.book_balance,
             difference=EXCLUDED.difference,
             recon_status=EXCLUDED.recon_status,
             tally_data=EXCLUDED.tally_data,
             last_sync_at=now(),
             updated_at=now()`,
          [
            configId, rec.bankLedgerName, internalGlId,
            rec.externalId || "", rec.voucherNumber || "",
            rec.instrumentNumber || "", rec.transactionType || "",
            allocationKey, statementDate, stmtBal, bookBal, diff, reconStatus,
            JSON.stringify(rec.tallyData || {}),
          ]
        );
        upserted++;
      }
      res.json({ ok: true, count: upserted });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ════════════════════════════════════════════════════════════════════
  // BROWSER APIs
  // ════════════════════════════════════════════════════════════════════

  // ── Dashboard ─────────────────────────────────────────────────────────────
  app.get(
    "/api/tally/dashboard",
    requireAuth,
    requireTallyRight("tally_integration", "can_view"),
    async (_req, res) => {
      try {
        const cfg = await getActiveConfig();
        const cid = cfg?.id || "none";

        const [jobs, inbox, outbox, mappings, recentAudit, recentJobs, lastSync] = await Promise.all([
          pool.query(
            `SELECT status, COUNT(*)::int AS count FROM tally_sync_jobs WHERE config_id=$1 GROUP BY status`,
            [cid]
          ),
          pool.query(
            `SELECT status, COUNT(*)::int AS count FROM tally_voucher_inbox WHERE config_id=$1 GROUP BY status`,
            [cid]
          ),
          pool.query(
            `SELECT status, COUNT(*)::int AS count FROM tally_outbox WHERE config_id=$1 GROUP BY status`,
            [cid]
          ),
          pool.query(
            `SELECT COUNT(*)::int AS total FROM tally_mappings WHERE config_id=$1 AND is_active=true`,
            [cid]
          ),
          pool.query(
            `SELECT event_type, description, created_at FROM tally_audit_log
             WHERE config_id=$1 ORDER BY created_at DESC LIMIT 15`,
            [cid]
          ),
          pool.query(
            `SELECT id, job_type, direction, status, result_summary, error_message,
                    created_at, completed_at
             FROM tally_sync_jobs WHERE config_id=$1
             ORDER BY created_at DESC LIMIT 10`,
            [cid]
          ),
          pool.query(
            `SELECT MAX(sync_at) AS last_sync_at FROM (
               SELECT MAX(completed_at) AS sync_at
               FROM tally_sync_jobs
               WHERE config_id=$1 AND status='completed'
               UNION ALL
               SELECT MAX(sent_at) AS sync_at
               FROM tally_outbox
               WHERE config_id=$1 AND status='sent'
             ) s`,
            [cid]
          ),
        ]);

        // Aggregate counts
        const jobMap: Record<string, number> = {};
        for (const r of jobs.rows) jobMap[r.status] = r.count;
        const inboxMap: Record<string, number> = {};
        for (const r of inbox.rows) inboxMap[r.status] = r.count;
        const outboxMap: Record<string, number> = {};
        for (const r of outbox.rows) outboxMap[r.status] = r.count;

        // Connector health (heartbeat age)
        const hbAt = cfg?.last_heartbeat_at ? new Date(cfg.last_heartbeat_at) : null;
        const hbAgeMs = hbAt ? Date.now() - hbAt.getTime() : null;
        const connectorOnline = hbAgeMs !== null && hbAgeMs < 5 * 60 * 1000; // < 5 min
        const processed = (inboxMap.posted || 0) + (outboxMap.sent || 0);
        const review = (inboxMap.review || 0) + (inboxMap.approved || 0) + (outboxMap.review || 0);
        const failed = (jobMap.failed || 0) + (outboxMap.failed || 0);
        const pending = (jobMap.queued || 0) + (jobMap.leased || 0)
          + (outboxMap.queued || 0) + (outboxMap.leased || 0);

        res.json({
          summary: {
            processed,
            review,
            failed,
            pending,
            mappings: mappings.rows[0]?.total || 0,
          },
          connector: {
            status: connectorOnline ? "Connected" : "Offline",
            connectorOnline,
            lastSeen: cfg?.last_heartbeat_at || null,
            tallyStatus: cfg?.last_tally_status || "unknown",
            tallyError: cfg?.last_tally_error || "",
            version: cfg?.connector_version || "",
          },
          lastSyncAt: lastSync.rows[0]?.last_sync_at || null,
          recentJobs: recentJobs.rows,
          connectorOnline,
          lastHeartbeatAt: cfg?.last_heartbeat_at || null,
          lastTallyStatus: cfg?.last_tally_status || "",
          lastTallyError: cfg?.last_tally_error || "",
          mappingsTotal: mappings.rows[0]?.total || 0,
          jobs: {
            queued: jobMap.queued || 0,
            leased: jobMap.leased || 0,
            completed: jobMap.completed || 0,
            failed: jobMap.failed || 0,
          },
          inbox: {
            review: inboxMap.review || 0,
            approved: inboxMap.approved || 0,
            posted: inboxMap.posted || 0,
            rejected: inboxMap.rejected || 0,
          },
          outbox: {
            queued: outboxMap.queued || 0,
            leased: outboxMap.leased || 0,
            sent: outboxMap.sent || 0,
            review: outboxMap.review || 0,
            failed: outboxMap.failed || 0,
          },
          recentActivity: recentAudit.rows,
        });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ── Config: read ──────────────────────────────────────────────────────────
  app.get(
    "/api/tally/config",
    requireAuth,
    requireTallyRight("tally_configuration", "can_view"),
    async (_req, res) => {
      try {
        const cfg = await getActiveConfig();
        res.json(safeConfig(cfg));
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ── Config: create / update (POST + PUT alias) ────────────────────────────
  const saveConfig = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const {
        companyName,
        displayName,
        tallyHost,
        tallyPort,
        financialYear,
        enableStockSync,
        stockSyncEnabled,
        importMastersEnabled,
        importMasters,
        importVouchersEnabled,
        importVouchers,
        exportSalesEnabled,
        exportSales,
        exportPurchasesEnabled,
        exportPurchases,
        syncIntervalMinutes,
        isActive,
        enabled,
      } = req.body;

      // Validation
      if (!companyName || typeof companyName !== "string" || !companyName.trim()) {
        return res.status(400).json({ error: "companyName is required and must be a non-empty string" });
      }
      const host = (tallyHost || "localhost").trim();
      if (!host) return res.status(400).json({ error: "tallyHost must not be empty" });
      const port = parseInt(String(tallyPort || "9000"), 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        return res.status(400).json({ error: "tallyPort must be a valid port number 1-65535" });
      }
      const interval = parseInt(String(syncIntervalMinutes || "0"), 10);
      if (isNaN(interval) || interval < 0 || interval > 10080) {
        return res.status(400).json({ error: "syncIntervalMinutes must be 0-10080" });
      }
      const fy = (financialYear || "").trim();
      if (fy && !/^\d{4}-\d{2,4}$/.test(fy)) {
        return res.status(400).json({ error: `financialYear format should be YYYY-YY or YYYY-YYYY, got "${fy}"` });
      }

      const existing = await getActiveConfig();
      let cfgId: string;

      if (existing) {
        await pool.query(
          `UPDATE tally_config SET
             company_name=$1, display_name=$2, tally_host=$3, tally_port=$4,
             financial_year=$5, enable_stock_sync=$6,
             import_masters_enabled=$7, import_vouchers_enabled=$8,
             export_sales_enabled=$9, export_purchases_enabled=$10,
             auto_approve_mapped=$11, sync_interval_minutes=$12,
             is_active=$13, updated_at=now()
           WHERE id=$14`,
          [
            companyName.trim(), (displayName || "").trim(), host, port,
            fy, !!(stockSyncEnabled ?? enableStockSync),
            (importMasters ?? importMastersEnabled) !== false,
            (importVouchers ?? importVouchersEnabled) !== false,
            !!(exportSales ?? exportSalesEnabled),
            !!(exportPurchases ?? exportPurchasesEnabled),
             false,
            interval,
            (enabled ?? isActive) !== false,
            existing.id,
          ]
        );
        cfgId = existing.id;
      } else {
        const r = await pool.query(
          `INSERT INTO tally_config
             (company_name, display_name, tally_host, tally_port, financial_year,
              enable_stock_sync, import_masters_enabled, import_vouchers_enabled,
              export_sales_enabled, export_purchases_enabled, auto_approve_mapped,
              sync_interval_minutes, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           RETURNING id`,
          [
            companyName.trim(), (displayName || "").trim(), host, port,
            fy, !!(stockSyncEnabled ?? enableStockSync),
            (importMasters ?? importMastersEnabled) !== false,
            (importVouchers ?? importVouchersEnabled) !== false,
            !!(exportSales ?? exportSalesEnabled),
            !!(exportPurchases ?? exportPurchasesEnabled),
            false,
            interval,
            (enabled ?? isActive) !== false,
          ]
        );
        cfgId = r.rows[0].id;
      }

      await auditLog({
        configId: cfgId,
        eventType: "config_change",
        actorType: "user",
        actorId: user?.id,
        description: `Config ${existing ? "updated" : "created"} for company "${companyName.trim()}"`,
      });

      const cfg = await getActiveConfig();
      res.json(safeConfig(cfg));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  };

  app.post(
    "/api/tally/config",
    requireAuth,
    requireTallyRight("tally_configuration", "can_edit"),
    saveConfig
  );
  app.put(
    "/api/tally/config",
    requireAuth,
    requireTallyRight("tally_configuration", "can_edit"),
    saveConfig
  );

  // ── Token rotation ────────────────────────────────────────────────────────
  const doRotateToken = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const cfg = await getActiveConfig();
      if (!cfg) return res.status(404).json({ error: "No active Tally configuration found" });

      const { plaintext, hash, hint } = generateConnectorToken();
      await pool.query(
        `UPDATE tally_config
         SET connector_token_hash=$1, connector_token_hint=$2,
             connector_token_rotated_at=now(), updated_at=now()
         WHERE id=$3`,
        [hash, hint, cfg.id]
      );

      await auditLog({
        configId: cfg.id,
        eventType: "token_rotate",
        actorType: "user",
        actorId: user?.id,
        description: `Connector token rotated (hint: ...${hint})`,
      });

      res.json({
        token: plaintext,
        hint,
        rotatedAt: new Date().toISOString(),
        warning: "Save this token now. It will not be shown again.",
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  };

  app.post(
    "/api/tally/config/rotate-token",
    requireAuth,
    requireTallyRight("tally_configuration", "can_create"),
    doRotateToken
  );
  // Compatibility alias
  app.post(
    "/api/tally/connector-token",
    requireAuth,
    requireTallyRight("tally_configuration", "can_create"),
    doRotateToken
  );

  // ── Test connection ───────────────────────────────────────────────────────
  app.post(
    "/api/tally/test-connection",
    requireAuth,
    requireTallyRight("tally_configuration", "can_view"),
    requireTallyRight("tally_sync", "can_create"),
    async (req, res) => {
      try {
        const cfg = await getActiveConfig();
        if (!cfg) return res.status(404).json({ error: "No active Tally configuration found" });
        // Enqueue a test_connection job so the connector can run it
        const r = await pool.query(
          `INSERT INTO tally_sync_jobs
             (config_id, job_type, direction, status, priority, created_by)
           VALUES ($1,'test_connection','inbound','queued',1,$2)
           RETURNING id`,
          [cfg.id, (req as any).user?.id || null]
        );
        res.json({ ok: true, jobId: r.rows[0].id, message: "Test connection job queued" });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ── Mappings: list ────────────────────────────────────────────────────────
  app.get(
    "/api/tally/mappings",
    requireAuth,
    requireTallyRight("tally_mapping", "can_view"),
    async (req, res) => {
      try {
        const cfg = await getActiveConfig();
        if (!cfg) return res.json([]);
        const mappingType = req.query.type as string | undefined;
        const r = mappingType
          ? await pool.query(
              `SELECT * FROM tally_mappings WHERE config_id=$1 AND mapping_type=$2 ORDER BY tally_name`,
              [cfg.id, mappingType]
            )
          : await pool.query(
              `SELECT * FROM tally_mappings WHERE config_id=$1 ORDER BY mapping_type, tally_name`,
              [cfg.id]
            );
        res.json(r.rows);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ── Mappings: create ──────────────────────────────────────────────────────
  app.post(
    "/api/tally/mappings",
    requireAuth,
    requireTallyRight("tally_mapping", "can_create"),
    async (req, res) => {
      try {
        const cfg = await getActiveConfig();
        if (!cfg) return res.status(404).json({ error: "No active Tally configuration" });
        const { mappingType, tallyName, tallyGuid, internalId, internalType, notes } = req.body;
        if (!mappingType || !tallyName)
          return res.status(400).json({ error: "mappingType and tallyName required" });

        // Validate internal entity exists
        if (internalId && internalType) {
          const tableMap: Record<string, string> = {
            general_ledger: "general_ledgers",
            sub_ledger: "sub_ledgers",
            party: "sub_ledgers",
            customer: "sub_ledgers",
            supplier: "sub_ledgers",
            bank: "general_ledgers",
            gst_ledger: "general_ledgers",
            round_off_ledger: "general_ledgers",
            freight_ledger: "general_ledgers",
            discount_ledger: "general_ledgers",
            ledger: "general_ledgers",
            stock: "products",
          };
          const tbl = tableMap[internalType];
          if (tbl) {
            const check = await pool.query(`SELECT id FROM ${tbl} WHERE id=$1`, [internalId]);
            if (!check.rows[0])
              return res.status(400).json({ error: `Entity ${internalType} id="${internalId}" not found` });
          }
        }

        // Prevent duplicate active mapping
        const dup = await pool.query(
          `SELECT id FROM tally_mappings
           WHERE config_id=$1 AND mapping_type=$2 AND LOWER(TRIM(tally_name))=LOWER(TRIM($3)) AND is_active=true
           LIMIT 1`,
          [cfg.id, mappingType, tallyName]
        );
        if (dup.rows[0])
          return res.status(409).json({ error: `Active mapping for "${tallyName}" (${mappingType}) already exists` });

        const r = await pool.query(
          `INSERT INTO tally_mappings
             (config_id, mapping_type, tally_name, tally_guid, internal_id, internal_type, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [cfg.id, mappingType, tallyName, tallyGuid || "", internalId || null, internalType || "", notes || ""]
        );
        res.json(r.rows[0]);
      } catch (e: any) {
        res.status(400).json({ error: e.message });
      }
    }
  );

  // ── Mappings: update ──────────────────────────────────────────────────────
  app.patch(
    "/api/tally/mappings/:id",
    requireAuth,
    requireTallyRight("tally_mapping", "can_edit"),
    async (req, res) => {
      try {
        const cfg = await getActiveConfig();
        if (!cfg) return res.status(404).json({ error: "No active Tally configuration" });
        const { tallyName, tallyGuid, internalId, internalType, notes, isActive } = req.body;
        // Scope to active config — prevent cross-config edit
        const r = await pool.query(
          `UPDATE tally_mappings
           SET tally_name=COALESCE($1, tally_name),
               tally_guid=COALESCE($2, tally_guid),
               internal_id=COALESCE($3, internal_id),
               internal_type=COALESCE($4, internal_type),
               notes=COALESCE($5, notes),
               is_active=COALESCE($6, is_active),
               updated_at=now()
           WHERE id=$7 AND config_id=$8
           RETURNING *`,
          [tallyName ?? null, tallyGuid ?? null, internalId ?? null,
           internalType ?? null, notes ?? null, isActive ?? null,
           req.params.id, cfg.id]
        );
        if (!r.rows[0]) return res.status(404).json({ error: "Mapping not found or belongs to different config" });
        res.json(r.rows[0]);
      } catch (e: any) {
        res.status(400).json({ error: e.message });
      }
    }
  );

  // ── Mappings: delete ──────────────────────────────────────────────────────
  app.delete(
    "/api/tally/mappings/:id",
    requireAuth,
    requireTallyRight("tally_mapping", "can_delete"),
    async (req, res) => {
      try {
        const cfg = await getActiveConfig();
        if (!cfg) return res.status(404).json({ error: "No active Tally configuration" });
        // Scope to active config
        const r = await pool.query(
          `DELETE FROM tally_mappings WHERE id=$1 AND config_id=$2 RETURNING id`,
          [req.params.id, cfg.id]
        );
        if (!r.rows[0]) return res.status(404).json({ error: "Mapping not found or belongs to different config" });
        res.json({ ok: true });
      } catch (e: any) {
        res.status(400).json({ error: e.message });
      }
    }
  );

  // ── Master options + discovered masters ───────────────────────────────────
  app.get(
    "/api/tally/master-options",
    requireAuth,
    requireTallyRight("tally_mapping", "can_view"),
    async (_req, res) => {
      try {
        const cfg = await getActiveConfig();
        const [gls, sls, taxes, products, voucherTypes, discovered] = await Promise.all([
          pool.query(`SELECT id, code, name, gl_type FROM general_ledgers WHERE is_active=true ORDER BY name`),
          pool.query(
            `SELECT sl.id, sl.code, sl.name, gl.name AS gl_name, gl.gl_type
             FROM sub_ledgers sl
             LEFT JOIN general_ledgers gl ON gl.id=sl.general_ledger_id
             WHERE sl.is_active=true ORDER BY sl.name`
          ),
          pool.query(`SELECT id, name, rate FROM tax_rates WHERE is_active=true ORDER BY name`),
          pool.query(`SELECT id, code, name FROM products WHERE is_active=true ORDER BY name LIMIT 500`),
          pool.query(`SELECT id, code, name FROM voucher_types WHERE is_active=true ORDER BY name`),
          cfg
            ? pool.query(
                `SELECT master_type, tally_name, tally_guid, tally_group, last_seen_at
                 FROM tally_discovered_masters WHERE config_id=$1
                 ORDER BY master_type, tally_name`,
                [cfg.id]
              )
            : Promise.resolve({ rows: [] }),
        ]);
        res.json({
          generalLedgers: gls.rows,
          subLedgers: sls.rows,
          taxRates: taxes.rows,
          products: products.rows,
          voucherTypes: voucherTypes.rows,
          discoveredMasters: discovered.rows,
        });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ── Sync: enqueue ─────────────────────────────────────────────────────────
  const doEnqueue = async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;
      const cfg = await getActiveConfig();
      if (!cfg) return res.status(404).json({ error: "No active Tally configuration" });

      const { jobType, fromDate, toDate } = req.body;
      const validTypes = ["import_masters", "import_vouchers", "export_sales", "export_purchases", "full"];
      if (!validTypes.includes(jobType)) {
        return res.status(400).json({ error: `Invalid jobType. Valid: ${validTypes.join(", ")}` });
      }

      // Voucher movement jobs always receive a bounded range. If the user leaves
      // it blank, default to the configured financial year (or the last 30 days).
      let fd = fromDate ? validateDateOptional(fromDate) : null;
      let td = toDate ? validateDateOptional(toDate) : null;
      const needsDates = jobType !== "import_masters";
      if (needsDates && !td) td = new Date().toISOString().slice(0, 10);
      if (needsDates && !fd) {
        const startYear = /^(\d{4})-\d{2,4}$/.exec(String(cfg.financial_year || ""))?.[1];
        if (startYear) {
          fd = `${startYear}-04-01`;
        } else {
          const fallback = new Date(`${td}T00:00:00Z`);
          fallback.setUTCDate(fallback.getUTCDate() - 30);
          fd = fallback.toISOString().slice(0, 10);
        }
      }
      if (fd && td && fd > td) {
        return res.status(400).json({ error: "fromDate must be on or before toDate" });
      }

      const isFull = jobType === "full";
      const jobsToCreate = isFull
        ? [
            ...(cfg.import_masters_enabled ? [{ type: "import_masters", dir: "inbound" }] : []),
            ...(cfg.import_vouchers_enabled ? [{ type: "import_vouchers", dir: "inbound" }] : []),
            ...(cfg.export_sales_enabled ? [{ type: "export_sales", dir: "outbound" }] : []),
            ...(cfg.export_purchases_enabled ? [{ type: "export_purchases", dir: "outbound" }] : []),
          ]
        : [{ type: jobType, dir: jobType.startsWith("export_") ? "outbound" : "inbound" }];
      const enabledByType: Record<string, boolean> = {
        import_masters: cfg.import_masters_enabled !== false,
        import_vouchers: cfg.import_vouchers_enabled !== false,
        export_sales: cfg.export_sales_enabled === true,
        export_purchases: cfg.export_purchases_enabled === true,
      };
      if (!isFull && !enabledByType[jobType]) {
        return res.status(400).json({
          error: `${jobType.replaceAll("_", " ")} is disabled in Tally configuration`,
        });
      }
      if (jobsToCreate.length === 0) {
        return res.status(400).json({ error: "No sync directions are enabled in Tally configuration" });
      }

      const created = [];
      for (const jt of jobsToCreate) {
        const r = await pool.query(
          `INSERT INTO tally_sync_jobs
             (config_id, job_type, direction, status, from_date, to_date, created_by)
           VALUES ($1,$2,$3,'queued',$4,$5,$6) RETURNING *`,
          [cfg.id, jt.type, jt.dir, fd, td, user?.id]
        );
        const job = r.rows[0];
        created.push(job);

        if (jt.dir === "outbound") {
          const prepared = await enqueueExportJobs(
            cfg.id,
            jt.type as "export_sales" | "export_purchases",
            job.id,
            fd,
            td
          );
          await pool.query(
            `UPDATE tally_sync_jobs
             SET status='completed', completed_at=now(), updated_at=now(), result_summary=$1
             WHERE id=$2`,
            [`Prepared ${prepared.queued} export(s); ${prepared.review} held for review`, job.id]
          );
        }
      }

      await auditLog({
        configId: cfg.id,
        eventType: "job_enqueue",
        actorType: "user",
        actorId: user?.id,
        description: `Enqueued ${jobType}`,
        meta: { jobType, fromDate: fd, toDate: td },
      });

      res.json({ ok: true, jobs: created });
    } catch (e: any) {
      const status = (e as any).status || 500;
      res.status(status).json({ error: e.message });
    }
  };

  app.post("/api/tally/sync/enqueue", requireAuth, requireTallyRight("tally_sync", "can_create"), doEnqueue);
  // Compatibility alias
  app.post("/api/tally/sync", requireAuth, requireTallyRight("tally_sync", "can_create"), doEnqueue);

  // ── Sync: jobs list ───────────────────────────────────────────────────────
  const doListJobs = async (req: Request, res: Response) => {
    try {
      const cfg = await getActiveConfig();
      if (!cfg) return res.json([]);
      const limit = parseLimit(req.query.limit, 100, 200);
      const r = await pool.query(
        `SELECT j.*, u.name AS created_by_name
         FROM tally_sync_jobs j
         LEFT JOIN users u ON u.id = j.created_by
         WHERE j.config_id=$1
         ORDER BY j.created_at DESC LIMIT $2`,
        [cfg.id, limit]
      );
      res.json(r.rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  };

  app.get("/api/tally/sync/jobs", requireAuth, requireTallyRight("tally_sync", "can_view"), doListJobs);
  // Compatibility alias
  app.get("/api/tally/jobs", requireAuth, requireTallyRight("tally_sync", "can_view"), doListJobs);

  // ── Inbox: list ───────────────────────────────────────────────────────────
  app.get(
    "/api/tally/inbox",
    requireAuth,
    requireTallyRight("tally_sync", "can_view"),
    async (req, res) => {
      try {
        const cfg = await getActiveConfig();
        if (!cfg) return res.json([]);
        const status = req.query.status as string | undefined;
        const limit = parseLimit(req.query.limit, 100, 500);
        const r = status
          ? await pool.query(
              `SELECT id, external_id, alteration_id, voucher_type, voucher_number, voucher_date,
                      narration, company, financial_year, status, conflict_reason, review_notes,
                      posted_voucher_mas_id, reviewed_at, created_at, updated_at
               FROM tally_voucher_inbox WHERE config_id=$1 AND status=$2
               ORDER BY created_at DESC LIMIT $3`,
              [cfg.id, status, limit]
            )
          : await pool.query(
              `SELECT id, external_id, alteration_id, voucher_type, voucher_number, voucher_date,
                      narration, company, financial_year, status, conflict_reason, review_notes,
                      posted_voucher_mas_id, reviewed_at, created_at, updated_at
               FROM tally_voucher_inbox WHERE config_id=$1
               ORDER BY created_at DESC LIMIT $2`,
              [cfg.id, limit]
            );
        res.json(r.rows);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ── Inbox: single ─────────────────────────────────────────────────────────
  app.get(
    "/api/tally/inbox/:id",
    requireAuth,
    requireTallyRight("tally_sync", "can_view"),
    async (req, res) => {
      try {
        const cfg = await getActiveConfig();
        if (!cfg) return res.status(404).json({ error: "No active Tally configuration" });
        const r = await pool.query(
          `SELECT * FROM tally_voucher_inbox WHERE id=$1 AND config_id=$2`,
          [String(req.params.id), cfg.id]
        );
        if (!r.rows[0]) return res.status(404).json({ error: "Not found" });
        const row = r.rows[0];
        const payload: InboundVoucher | null = row.raw_payload;
        let mappingStatus: any[] = [];
        if (cfg && payload?.lines) {
          const { resolved } = await resolveMappings(cfg.id, payload.lines);
          mappingStatus = resolved.map(({ line, glId, slId }) => ({
            ledgerName: line.ledgerName,
            mapped: !!(glId || slId),
            glId,
            slId,
          }));
        }
        res.json({ ...row, mappingStatus });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ── Inbox: approve ────────────────────────────────────────────────────────
  app.post(
    "/api/tally/inbox/:id/approve",
    requireAuth,
    requireTallyRight("tally_sync", "can_approve"),
    async (req, res) => {
      try {
        const user = (req as any).user;
        const inboxId = String(req.params.id);
        const cfg = await getActiveConfig();
        if (!cfg) return res.status(404).json({ error: "No active Tally configuration" });
        // Mark approved before posting (postInboundVoucher requires this status)
        const upd = await pool.query(
          `UPDATE tally_voucher_inbox
           SET status='approved', reviewed_by=$1, reviewed_at=now(), updated_at=now()
           WHERE id=$2 AND config_id=$3 AND status NOT IN ('posted')
           RETURNING id`,
          [user?.id, inboxId, cfg.id]
        );
        if (!upd.rows[0]) {
          // Already posted?
          const cur = await pool.query(
            `SELECT status, posted_voucher_mas_id
             FROM tally_voucher_inbox WHERE id=$1 AND config_id=$2`,
            [inboxId, cfg.id]
          );
          if (cur.rows[0]?.status === "posted") {
            return res.json({ ok: true, idempotent: true, voucherMasId: cur.rows[0].posted_voucher_mas_id });
          }
          return res.status(400).json({ error: "Inbox record not found" });
        }

        const { voucherMasId, voucherNo } = await postInboundVoucher(inboxId, user?.id || "");
        res.json({ ok: true, voucherMasId, voucherNo });
      } catch (e: any) {
        // Revert to review on failure so user can retry
        await pool.query(
          `UPDATE tally_voucher_inbox SET status='review', conflict_reason=$1, updated_at=now() WHERE id=$2`,
          [e.message, String(req.params.id)]
        ).catch(() => {});
        res.status(400).json({ error: e.message });
      }
    }
  );

  // ── Inbox: reject ─────────────────────────────────────────────────────────
  app.post(
    "/api/tally/inbox/:id/reject",
    requireAuth,
    requireTallyRight("tally_sync", "can_approve"),
    async (req, res) => {
      try {
        const user = (req as any).user;
        const { reason } = req.body;
        if (!String(reason || "").trim()) {
          return res.status(400).json({ error: "A rejection reason is required" });
        }
        const cfg = await getActiveConfig();
        if (!cfg) return res.status(404).json({ error: "No active Tally configuration" });
        const rejected = await pool.query(
          `UPDATE tally_voucher_inbox
           SET status='rejected', review_notes=$1, reviewed_by=$2, reviewed_at=now(), updated_at=now()
           WHERE id=$3 AND config_id=$4 AND status!='posted'
           RETURNING id`,
          [String(reason).trim(), user?.id, String(req.params.id), cfg.id]
        );
        if (!rejected.rows[0]) return res.status(404).json({ error: "Review record not found or already posted" });
        await auditLog({
          configId: cfg.id,
          eventType: "voucher_reject",
          entityType: "tally_voucher_inbox",
          entityId: String(req.params.id),
          actorType: "user",
          actorId: user?.id,
          description: `Rejected: ${String(reason).trim()}`,
        });
        res.json({ ok: true });
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ── Sync jobs: retry ──────────────────────────────────────────────────────
  app.post(
    "/api/tally/sync/jobs/:id/retry",
    requireAuth,
    requireTallyRight("tally_sync", "can_approve"),
    async (req, res) => {
      try {
        const cfg = await getActiveConfig();
        if (!cfg) return res.status(404).json({ error: "No active Tally configuration" });
        const r = await pool.query(
          `UPDATE tally_sync_jobs
           SET status='queued', retry_count=retry_count+1,
               error_message='', leased_at=null, leased_by='', updated_at=now()
           WHERE id=$1 AND config_id=$2 AND status='failed' AND direction='inbound'
             AND retry_count < max_retries
           RETURNING *`,
          [String(req.params.id), cfg.id]
        );
        if (!r.rows[0]) return res.status(400).json({ error: "Job not eligible for retry" });
        res.json(r.rows[0]);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ── Outbox: list ──────────────────────────────────────────────────────────
  app.get(
    "/api/tally/outbox",
    requireAuth,
    requireTallyRight("tally_sync", "can_view"),
    async (req, res) => {
      try {
        const cfg = await getActiveConfig();
        if (!cfg) return res.json([]);
        const status = req.query.status as string | undefined;
        const limit = parseLimit(req.query.limit, 100, 500);
        const r = status
          ? await pool.query(
              `SELECT * FROM tally_outbox WHERE config_id=$1 AND status=$2 ORDER BY created_at DESC LIMIT $3`,
              [cfg.id, status, limit]
            )
          : await pool.query(
              `SELECT * FROM tally_outbox WHERE config_id=$1 ORDER BY created_at DESC LIMIT $2`,
              [cfg.id, limit]
            );
        res.json(r.rows);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ── Outbox: retry failed ──────────────────────────────────────────────────
  app.post(
    "/api/tally/outbox/:id/retry",
    requireAuth,
    requireTallyRight("tally_sync", "can_approve"),
    async (req, res) => {
      try {
        const cfg = await getActiveConfig();
        if (!cfg) return res.status(404).json({ error: "No active Tally configuration" });
        const r = await pool.query(
          `UPDATE tally_outbox
           SET status='queued', retry_count=retry_count+1, error_message='',
               leased_at=NULL, leased_by='', updated_at=now()
           WHERE id=$1 AND config_id=$2 AND status='failed' AND retry_count < max_retries
           RETURNING *`,
          [String(req.params.id), cfg.id]
        );
        if (!r.rows[0]) return res.status(400).json({ error: "Outbox record not eligible for retry" });
        res.json(r.rows[0]);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ── Audit log ─────────────────────────────────────────────────────────────
  app.get(
    "/api/tally/audit",
    requireAuth,
    requireTallyRight("tally_integration", "can_view"),
    async (req, res) => {
      try {
        const cfg = await getActiveConfig();
        const limit = parseLimit(req.query.limit, 100, 500);
        const r = await pool.query(
          `SELECT * FROM tally_audit_log WHERE config_id=$1 ORDER BY created_at DESC LIMIT $2`,
          [cfg?.id || "none", limit]
        );
        res.json(r.rows);
      } catch (e: any) {
        res.status(500).json({ error: e.message });
      }
    }
  );

  // ════════════════════════════════════════════════════════════════════
  // FINANCE REPORTS — fully parameterized, no SQL string interpolation
  // ════════════════════════════════════════════════════════════════════

  // ── Profit & Loss ─────────────────────────────────────────────────────────
  app.get(
    "/api/tally/reports/profit-loss",
    requireAuth,
    requireTallyRight("report_acc_profit_loss", "can_view"),
    async (req, res) => {
      try {
        const fromDate = requireDate(req.query.fromDate as string, "fromDate");
        const toDate = requireDate(req.query.toDate as string, "toDate");
        if (fromDate > toDate) {
          return res.status(400).json({ error: "fromDate must be on or before toDate" });
        }
        const cfg = await getActiveConfig();

        // Income: join voucher_mas with date filter in the JOIN condition (not WHERE)
        // so ledgers with no transactions in range still show 0
        const income = await pool.query(
          `SELECT gl.id, gl.name, gl.gl_type,
                  COALESCE(SUM(CASE WHEN vd.dr_cr='CR' AND vm.voucher_date BETWEEN $1 AND $2
                                    THEN vd.amount::numeric ELSE 0 END), 0)
                  - COALESCE(SUM(CASE WHEN vd.dr_cr='DR' AND vm.voucher_date BETWEEN $1 AND $2
                                      THEN vd.amount::numeric ELSE 0 END), 0) AS net_credit
           FROM general_ledgers gl
           LEFT JOIN voucher_det vd ON vd.general_ledger_id = gl.id
           LEFT JOIN voucher_mas vm ON vm.id = vd.voucher_mas_id
           LEFT JOIN ledger_categories lc ON lc.id = gl.category_id
           WHERE (lc.name ILIKE '%income%' OR lc.name ILIKE '%revenue%'
                  OR lc.name ILIKE '%sales%' OR gl.gl_type = 'income')
           GROUP BY gl.id, gl.name, gl.gl_type
           ORDER BY gl.name`,
          [fromDate, toDate]
        );

        const expense = await pool.query(
          `SELECT gl.id, gl.name, gl.gl_type,
                  COALESCE(SUM(CASE WHEN vd.dr_cr='DR' AND vm.voucher_date BETWEEN $1 AND $2
                                    THEN vd.amount::numeric ELSE 0 END), 0)
                  - COALESCE(SUM(CASE WHEN vd.dr_cr='CR' AND vm.voucher_date BETWEEN $1 AND $2
                                      THEN vd.amount::numeric ELSE 0 END), 0) AS net_debit
           FROM general_ledgers gl
           LEFT JOIN voucher_det vd ON vd.general_ledger_id = gl.id
           LEFT JOIN voucher_mas vm ON vm.id = vd.voucher_mas_id
           LEFT JOIN ledger_categories lc ON lc.id = gl.category_id
           WHERE (lc.name ILIKE '%expense%' OR lc.name ILIKE '%cost%'
                  OR lc.name ILIKE '%purchase%' OR gl.gl_type = 'expense')
           GROUP BY gl.id, gl.name, gl.gl_type
           ORDER BY gl.name`,
          [fromDate, toDate]
        );

        const totalIncome = income.rows.reduce((s: number, r: any) => s + parseFloat(r.net_credit || 0), 0);
        const totalExpense = expense.rows.reduce((s: number, r: any) => s + parseFloat(r.net_debit || 0), 0);

        res.json({
          disclaimer: REPORT_DISCLAIMER,
          fromDate,
          toDate,
          lastTallySyncAt: cfg?.last_heartbeat_at || null,
          income: income.rows,
          expense: expense.rows,
          totalIncome,
          totalExpense,
          netProfit: totalIncome - totalExpense,
          origin: "erp_vouchers",
        });
      } catch (e: any) {
        res.status((e as any).status || 500).json({ error: e.message });
      }
    }
  );

  // ── Ledger Statement ──────────────────────────────────────────────────────
  app.get(
    "/api/tally/reports/ledger",
    requireAuth,
    requireTallyRight("report_acc_ledger_report", "can_view"),
    async (req, res) => {
      try {
        const fromDate = requireDate(req.query.fromDate as string, "fromDate");
        const toDate = requireDate(req.query.toDate as string, "toDate");
        if (fromDate > toDate) {
          return res.status(400).json({ error: "fromDate must be on or before toDate" });
        }
        const glId = req.query.glId as string | undefined;
        const slId = req.query.slId as string | undefined;
        if (!glId && !slId) return res.status(400).json({ error: "glId or slId required" });

        const cfg = await getActiveConfig();
        let ledgerName = "";
        if (glId) {
          const r = await pool.query(`SELECT name FROM general_ledgers WHERE id=$1`, [glId]);
          ledgerName = r.rows[0]?.name || "";
        } else if (slId) {
          const r = await pool.query(`SELECT name FROM sub_ledgers WHERE id=$1`, [slId]);
          ledgerName = r.rows[0]?.name || "";
        }

        const txns = await pool.query(
          `SELECT vm.voucher_no, vm.voucher_date, vm.voucher_type, vm.narration, vm.source_type,
                  vd.dr_cr, vd.amount, vd.narration AS line_narration,
                  ter.external_id AS tally_guid, ter.synced_at AS tally_synced_at
           FROM voucher_det vd
           JOIN voucher_mas vm ON vm.id = vd.voucher_mas_id
           LEFT JOIN tally_external_refs ter
             ON ter.internal_table='voucher_mas' AND ter.internal_id=vm.id
           WHERE vm.voucher_date BETWEEN $1 AND $2
             AND ($3::varchar IS NULL OR vd.general_ledger_id=$3)
             AND ($4::varchar IS NULL OR vd.sub_ledger_id=$4)
           ORDER BY vm.voucher_date, vm.voucher_no`,
          [fromDate, toDate, glId || null, slId || null]
        );

        // Opening balance strictly before fromDate
        const opening = await pool.query(
          `SELECT
             COALESCE(SUM(CASE WHEN vd.dr_cr='DR' THEN vd.amount::numeric ELSE 0 END), 0) AS total_dr,
             COALESCE(SUM(CASE WHEN vd.dr_cr='CR' THEN vd.amount::numeric ELSE 0 END), 0) AS total_cr
           FROM voucher_det vd
           JOIN voucher_mas vm ON vm.id = vd.voucher_mas_id
           WHERE vm.voucher_date < $1
             AND ($2::varchar IS NULL OR vd.general_ledger_id=$2)
             AND ($3::varchar IS NULL OR vd.sub_ledger_id=$3)`,
          [fromDate, glId || null, slId || null]
        );
        const ob = opening.rows[0];
        const openingBalance = parseFloat(ob?.total_dr || 0) - parseFloat(ob?.total_cr || 0);

        res.json({
          disclaimer: REPORT_DISCLAIMER,
          fromDate,
          toDate,
          ledgerName,
          glId: glId || null,
          slId: slId || null,
          lastTallySyncAt: cfg?.last_heartbeat_at || null,
          openingBalance,
          transactions: txns.rows,
          origin: "erp_vouchers",
        });
      } catch (e: any) {
        res.status((e as any).status || 500).json({ error: e.message });
      }
    }
  );

  // ── Outstanding ───────────────────────────────────────────────────────────
  app.get(
    "/api/tally/reports/outstanding",
    requireAuth,
    requireTallyRight("report_acc_outstanding", "can_view"),
    async (req, res) => {
      try {
        const asOfDate = req.query.asOfDate as string | undefined;
        if (asOfDate) requireDate(asOfDate, "asOfDate");
        const partyType = req.query.partyType as string | undefined;
        if (partyType && !["customer", "supplier"].includes(partyType)) {
          return res.status(400).json({ error: "partyType must be customer or supplier" });
        }
        const cfg = await getActiveConfig();

        const result = await pool.query(
          `SELECT sl.id AS sub_ledger_id, sl.name AS party_name,
                  gl.gl_type,
                  COALESCE(SUM(
                    CASE WHEN vd.dr_cr='DR' AND ($1::date IS NULL OR vm.voucher_date <= $1::date)
                         THEN vd.amount::numeric
                         WHEN vd.dr_cr='CR' AND ($1::date IS NULL OR vm.voucher_date <= $1::date)
                         THEN -vd.amount::numeric
                         ELSE 0 END
                  ), 0) AS balance,
                  sl.closing_balance, sl.closing_balance_type,
                  MAX(ter.synced_at) AS last_tally_sync
           FROM sub_ledgers sl
           JOIN general_ledgers gl ON gl.id = sl.general_ledger_id
           LEFT JOIN voucher_det vd ON vd.sub_ledger_id = sl.id
           LEFT JOIN voucher_mas vm ON vm.id = vd.voucher_mas_id
           LEFT JOIN tally_external_refs ter
             ON ter.internal_table='voucher_mas' AND ter.internal_id=vm.id
           WHERE sl.is_active=true
             AND (
               $2::text IS NULL OR $2::text = ''
               OR ($2 = 'customer' AND gl.gl_type='sundry_debtor')
               OR ($2 = 'supplier' AND gl.gl_type='sundry_creditor')
             )
           GROUP BY sl.id, sl.name, gl.gl_type, sl.closing_balance, sl.closing_balance_type
           HAVING ABS(COALESCE(SUM(
                    CASE WHEN vd.dr_cr='DR' AND ($1::date IS NULL OR vm.voucher_date <= $1::date)
                         THEN vd.amount::numeric
                         WHEN vd.dr_cr='CR' AND ($1::date IS NULL OR vm.voucher_date <= $1::date)
                         THEN -vd.amount::numeric
                         ELSE 0 END
                  ), 0)) > 0.005
              OR sl.closing_balance::numeric > 0.005
           ORDER BY sl.name`,
          [asOfDate || null, partyType || null]
        );

        res.json({
          disclaimer: REPORT_DISCLAIMER,
          asOfDate: asOfDate || new Date().toISOString().slice(0, 10),
          lastTallySyncAt: cfg?.last_heartbeat_at || null,
          parties: result.rows,
          origin: "erp_vouchers",
        });
      } catch (e: any) {
        res.status((e as any).status || 500).json({ error: e.message });
      }
    }
  );

  // ── Customer Receivables ──────────────────────────────────────────────────
  app.get(
    "/api/tally/reports/customer-receivable",
    requireAuth,
    requireTallyRight("report_acc_customer_receivable", "can_view"),
    async (req, res) => {
      try {
        const asOfDate = req.query.asOfDate as string | undefined;
        if (asOfDate) requireDate(asOfDate, "asOfDate");
        const cfg = await getActiveConfig();

        const r = await pool.query(
          `SELECT sl.id, sl.name AS customer_name, c.gstin, c.phone,
                  sl.closing_balance, sl.closing_balance_type,
                  COALESCE(SUM(
                    CASE WHEN vd.dr_cr='DR' AND ($1::date IS NULL OR vm.voucher_date <= $1::date)
                         THEN vd.amount::numeric
                         WHEN vd.dr_cr='CR' AND ($1::date IS NULL OR vm.voucher_date <= $1::date)
                         THEN -vd.amount::numeric
                         ELSE 0 END
                  ), 0) AS txn_balance,
                  MAX(ter.synced_at) AS last_tally_sync
           FROM sub_ledgers sl
           JOIN general_ledgers gl ON gl.id = sl.general_ledger_id AND gl.gl_type='sundry_debtor'
           LEFT JOIN customers c ON c.sub_ledger_id = sl.id
           LEFT JOIN voucher_det vd ON vd.sub_ledger_id = sl.id
           LEFT JOIN voucher_mas vm ON vm.id = vd.voucher_mas_id
           LEFT JOIN tally_external_refs ter
             ON ter.internal_table='voucher_mas' AND ter.internal_id=vm.id
           WHERE sl.is_active=true
           GROUP BY sl.id, sl.name, c.gstin, c.phone, sl.closing_balance, sl.closing_balance_type
           ORDER BY sl.name`,
          [asOfDate || null]
        );

        res.json({
          disclaimer: REPORT_DISCLAIMER,
          asOfDate: asOfDate || new Date().toISOString().slice(0, 10),
          lastTallySyncAt: cfg?.last_heartbeat_at || null,
          receivables: r.rows,
          origin: "erp_vouchers",
        });
      } catch (e: any) {
        res.status((e as any).status || 500).json({ error: e.message });
      }
    }
  );

  // ── Supplier Payables ─────────────────────────────────────────────────────
  app.get(
    "/api/tally/reports/supplier-payables",
    requireAuth,
    requireTallyRight("report_acc_supplier_payables", "can_view"),
    async (req, res) => {
      try {
        const asOfDate = req.query.asOfDate as string | undefined;
        if (asOfDate) requireDate(asOfDate, "asOfDate");
        const cfg = await getActiveConfig();

        const r = await pool.query(
          `SELECT sl.id, sl.name AS supplier_name, s.gstin, s.phone,
                  sl.closing_balance, sl.closing_balance_type,
                  COALESCE(SUM(
                    CASE WHEN vd.dr_cr='CR' AND ($1::date IS NULL OR vm.voucher_date <= $1::date)
                         THEN vd.amount::numeric
                         WHEN vd.dr_cr='DR' AND ($1::date IS NULL OR vm.voucher_date <= $1::date)
                         THEN -vd.amount::numeric
                         ELSE 0 END
                  ), 0) AS txn_balance,
                  MAX(ter.synced_at) AS last_tally_sync
           FROM sub_ledgers sl
           JOIN general_ledgers gl ON gl.id = sl.general_ledger_id AND gl.gl_type='sundry_creditor'
           LEFT JOIN suppliers s ON s.sub_ledger_id = sl.id
           LEFT JOIN voucher_det vd ON vd.sub_ledger_id = sl.id
           LEFT JOIN voucher_mas vm ON vm.id = vd.voucher_mas_id
           LEFT JOIN tally_external_refs ter
             ON ter.internal_table='voucher_mas' AND ter.internal_id=vm.id
           WHERE sl.is_active=true
           GROUP BY sl.id, sl.name, s.gstin, s.phone, sl.closing_balance, sl.closing_balance_type
           ORDER BY sl.name`,
          [asOfDate || null]
        );

        res.json({
          disclaimer: REPORT_DISCLAIMER,
          asOfDate: asOfDate || new Date().toISOString().slice(0, 10),
          lastTallySyncAt: cfg?.last_heartbeat_at || null,
          payables: r.rows,
          origin: "erp_vouchers",
        });
      } catch (e: any) {
        res.status((e as any).status || 500).json({ error: e.message });
      }
    }
  );

  // ── Bank Reconciliation ───────────────────────────────────────────────────
  app.get(
    "/api/tally/reports/bank-reconciliation",
    requireAuth,
    requireTallyRight("report_acc_bank_reconciliation", "can_view"),
    async (req, res) => {
      try {
        const bankGlId = req.query.bankGlId as string | undefined;
        const fromDate = req.query.fromDate as string | undefined;
        const toDate = req.query.toDate as string | undefined;
        if (!bankGlId) return res.status(400).json({ error: "bankGlId is required" });
        if (fromDate) requireDate(fromDate, "fromDate");
        if (toDate) requireDate(toDate, "toDate");
        if (fromDate && toDate && fromDate > toDate) {
          return res.status(400).json({ error: "fromDate must be on or before toDate" });
        }

        const cfg = await getActiveConfig();
        let bankName = "";
        {
          const r = await pool.query(
            `SELECT name, gl_type FROM general_ledgers WHERE id=$1 AND is_active=true`,
            [bankGlId]
          );
          if (!r.rows[0] || !String(r.rows[0].gl_type || "").toLowerCase().includes("bank")) {
            return res.status(400).json({ error: "Select an active bank general ledger" });
          }
          bankName = r.rows[0].name;
        }

        // Book transactions — fully parameterized
        const txns = await pool.query(
              `SELECT vm.voucher_no, vm.ref_no, vm.voucher_date, vm.voucher_type, vm.narration, vm.source_type,
                      vd.dr_cr, vd.amount,
                      ter.external_id AS tally_guid, ter.synced_at AS tally_synced_at,
                       NULL::text AS recon_status
               FROM voucher_det vd
               JOIN voucher_mas vm ON vm.id = vd.voucher_mas_id
               LEFT JOIN tally_external_refs ter
                 ON ter.internal_table='voucher_mas' AND ter.internal_id=vm.id
               WHERE vd.general_ledger_id=$1
                 AND ($2::date IS NULL OR vm.voucher_date >= $2::date)
                 AND ($3::date IS NULL OR vm.voucher_date <= $3::date)
               ORDER BY vm.voucher_date, vm.voucher_no`,
              [bankGlId, fromDate || null, toDate || null]
            );

        // Recon records — fully parameterized
        const reconRecords = cfg
          ? await pool.query(
              `SELECT * FROM tally_bank_recon
               WHERE config_id=$1
                 AND ($2::varchar IS NULL OR internal_gl_id=$2)
                 AND ($3::date IS NULL OR statement_date >= $3::date)
                 AND ($4::date IS NULL OR statement_date <= $4::date)
               ORDER BY statement_date DESC LIMIT 200`,
              [cfg.id, bankGlId || null, fromDate || null, toDate || null]
            )
          : { rows: [] as any[] };

        const bookTransactions = txns.rows.map((transaction: any) => {
          const match = reconRecords.rows.find((recon: any) =>
            recon.internal_gl_id === bankGlId
            && String(recon.statement_date).slice(0, 10) === String(transaction.voucher_date).slice(0, 10)
            && Math.abs(Number(recon.statement_balance) - Number(transaction.amount)) <= 0.01
            && (!recon.voucher_number || !transaction.ref_no || recon.voucher_number === transaction.ref_no)
          );
          return { ...transaction, recon_status: match?.recon_status || "unmatched" };
        });
        const totalDr = bookTransactions.reduce(
          (s: number, r: any) => r.dr_cr === "DR" ? s + parseFloat(r.amount || 0) : s, 0
        );
        const totalCr = bookTransactions.reduce(
          (s: number, r: any) => r.dr_cr === "CR" ? s + parseFloat(r.amount || 0) : s, 0
        );

        res.json({
          disclaimer: REPORT_DISCLAIMER,
          fromDate: fromDate || null,
          toDate: toDate || null,
          bankGlId: bankGlId || null,
          bankName,
          lastTallySyncAt: cfg?.last_heartbeat_at || null,
          bookTransactions,
          bookTotalDr: totalDr,
          bookTotalCr: totalCr,
          bookBalance: totalDr - totalCr,
          reconRecords: reconRecords.rows,
          origin: "erp_vouchers",
        });
      } catch (e: any) {
        res.status((e as any).status || 500).json({ error: e.message });
      }
    }
  );
}
