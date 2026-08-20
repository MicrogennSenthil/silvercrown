/**
 * Tally Prime Integration — Core Service
 *
 * Token security: only SHA-256 hash stored; plaintext returned only at rotation.
 * Never log tokens. Use timing-safe comparison.
 * All DDL uses IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS so it is safe
 * to run against both fresh and already-migrated databases.
 * DDL errors are thrown (not swallowed) so startup fails explicitly.
 */

import { randomBytes, createHash, timingSafeEqual } from "crypto";
import { pool } from "./db";

// ─── Token helpers ────────────────────────────────────────────────────────────

export function hashToken(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function generateConnectorToken(): { plaintext: string; hash: string; hint: string } {
  const plaintext = randomBytes(32).toString("hex"); // 64-char hex
  const hash = hashToken(plaintext);
  const hint = plaintext.slice(-6);
  return { plaintext, hash, hint };
}

/** Timing-safe token verification — prevents timing attacks on the secret. */
export async function verifyConnectorToken(
  bearer: string,
  configId?: string
): Promise<{ valid: boolean; configId: string | null }> {
  const incomingHash = hashToken(bearer);
  const q = configId
    ? `SELECT id, connector_token_hash FROM tally_config WHERE id=$1 AND is_active=true LIMIT 1`
    : `SELECT id, connector_token_hash FROM tally_config WHERE is_active=true AND connector_token_hash!='' ORDER BY created_at LIMIT 10`;
  const params = configId ? [configId] : [];
  const r = await pool.query(q, params);
  if (r.rows.length === 0) return { valid: false, configId: null };

  const inBuf = Buffer.from(incomingHash, "hex");
  for (const row of r.rows) {
    const stored = row.connector_token_hash || "";
    if (!stored || stored.length !== 64) continue;
    const storedBuf = Buffer.from(stored, "hex");
    if (inBuf.length === storedBuf.length && timingSafeEqual(inBuf, storedBuf)) {
      return { valid: true, configId: row.id };
    }
  }
  return { valid: false, configId: null };
}

// ─── Startup DDL ──────────────────────────────────────────────────────────────
// Throws on failure so the server does not start with an incomplete schema.

export async function ensureTallySchema(): Promise<void> {
  // Create tables — each is idempotent
  const createStatements = [
    // tally_config
    `CREATE TABLE IF NOT EXISTS tally_config (
      id                        varchar  PRIMARY KEY DEFAULT gen_random_uuid()::text,
      company_name              text     NOT NULL,
      display_name              text     NOT NULL DEFAULT '',
      tally_host                text     NOT NULL DEFAULT 'localhost',
      tally_port                integer  NOT NULL DEFAULT 9000,
      financial_year            text     DEFAULT '',
      enable_stock_sync         boolean  DEFAULT false,
      import_masters_enabled    boolean  DEFAULT true,
      import_vouchers_enabled   boolean  DEFAULT true,
      export_sales_enabled      boolean  DEFAULT false,
      export_purchases_enabled  boolean  DEFAULT false,
      auto_approve_mapped       boolean  DEFAULT false,
      sync_interval_minutes     integer  DEFAULT 0,
      last_scheduled_at         timestamp,
      last_tally_status         text     DEFAULT '',
      last_tally_error          text     DEFAULT '',
      is_active                 boolean  DEFAULT true,
      connector_token_hash      text     DEFAULT '',
      connector_token_hint      text     DEFAULT '',
      connector_token_rotated_at timestamp,
      last_heartbeat_at         timestamp,
      connector_version         text     DEFAULT '',
      created_at                timestamp DEFAULT now(),
      updated_at                timestamp DEFAULT now()
    )`,

    // tally_mappings
    `CREATE TABLE IF NOT EXISTS tally_mappings (
      id            varchar  PRIMARY KEY DEFAULT gen_random_uuid()::text,
      config_id     varchar  REFERENCES tally_config(id),
      mapping_type  text     NOT NULL,
      tally_name    text     NOT NULL,
      tally_guid    text     DEFAULT '',
      internal_id   varchar,
      internal_type text     DEFAULT '',
      notes         text     DEFAULT '',
      is_active     boolean  DEFAULT true,
      created_at    timestamp DEFAULT now(),
      updated_at    timestamp DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS tally_mappings_active_uidx
       ON tally_mappings(config_id, mapping_type, LOWER(tally_name))
       WHERE is_active = true`,

    // tally_discovered_masters — ledgers/voucher-types/stock discovered via connector
    `CREATE TABLE IF NOT EXISTS tally_discovered_masters (
      id            varchar  PRIMARY KEY DEFAULT gen_random_uuid()::text,
      config_id     varchar  REFERENCES tally_config(id),
      master_type   text     NOT NULL,   -- ledger | voucher_type | stock_item | cost_centre
      tally_name    text     NOT NULL,
      tally_guid    text     DEFAULT '',
      tally_group   text     DEFAULT '',
      extra         jsonb    DEFAULT '{}',
      last_seen_at  timestamp DEFAULT now(),
      created_at    timestamp DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS tally_discovered_masters_uidx
       ON tally_discovered_masters(config_id, master_type, LOWER(tally_name))`,

    // tally_sync_jobs
    `CREATE TABLE IF NOT EXISTS tally_sync_jobs (
      id             varchar  PRIMARY KEY DEFAULT gen_random_uuid()::text,
      config_id      varchar  REFERENCES tally_config(id),
      job_type       text     NOT NULL,
      direction      text     NOT NULL DEFAULT 'inbound',
      status         text     NOT NULL DEFAULT 'queued',
      priority       integer  NOT NULL DEFAULT 5,
      from_date      date,
      to_date        date,
      payload        jsonb    DEFAULT '{}',
      leased_at      timestamp,
      leased_by      text     DEFAULT '',
      completed_at   timestamp,
      result_summary text     DEFAULT '',
      error_message  text     DEFAULT '',
      retry_count    integer  DEFAULT 0,
      max_retries    integer  DEFAULT 3,
      created_by     varchar,
      created_at     timestamp DEFAULT now(),
      updated_at     timestamp DEFAULT now()
    )`,

    // tally_voucher_inbox
    `CREATE TABLE IF NOT EXISTS tally_voucher_inbox (
      id                    varchar  PRIMARY KEY DEFAULT gen_random_uuid()::text,
      config_id             varchar  REFERENCES tally_config(id),
      job_id                varchar  REFERENCES tally_sync_jobs(id),
      external_id           text     NOT NULL,
      alteration_id         text     DEFAULT '',
      voucher_type          text     NOT NULL,
      voucher_number        text     NOT NULL,
      voucher_date          date     NOT NULL,
      narration             text     DEFAULT '',
      company               text     DEFAULT '',
      financial_year        text     DEFAULT '',
      checksum              text     DEFAULT '',
      raw_payload           jsonb    DEFAULT '{}',
      status                text     NOT NULL DEFAULT 'review',
      review_notes          text     DEFAULT '',
      conflict_reason       text     DEFAULT '',
      posted_voucher_mas_id varchar,
      reviewed_by           varchar,
      reviewed_at           timestamp,
      created_at            timestamp DEFAULT now(),
      updated_at            timestamp DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS tally_voucher_inbox_ext_uidx
       ON tally_voucher_inbox(config_id, external_id)`,

    // tally_outbox
    `CREATE TABLE IF NOT EXISTS tally_outbox (
      id              varchar  PRIMARY KEY DEFAULT gen_random_uuid()::text,
      config_id       varchar  REFERENCES tally_config(id),
      sync_job_id     varchar  REFERENCES tally_sync_jobs(id),
      source_type     text     NOT NULL,
      source_id       varchar  NOT NULL,
      voucher_type    text     NOT NULL,
      status          text     NOT NULL DEFAULT 'queued',
      payload         jsonb    DEFAULT '{}',
      review_reason   text     DEFAULT '',
      sent_at         timestamp,
      leased_at       timestamp,
      leased_by       text     DEFAULT '',
      error_message   text     DEFAULT '',
      retry_count     integer  DEFAULT 0,
      max_retries     integer  DEFAULT 3,
      created_at      timestamp DEFAULT now(),
      updated_at      timestamp DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS tally_outbox_source_uidx
       ON tally_outbox(config_id, source_type, source_id)
       WHERE status NOT IN ('failed','cancelled')`,

    // tally_external_refs
    `CREATE TABLE IF NOT EXISTS tally_external_refs (
      id              varchar  PRIMARY KEY DEFAULT gen_random_uuid()::text,
      config_id       varchar  REFERENCES tally_config(id),
      internal_table  text     NOT NULL,
      internal_id     varchar  NOT NULL,
      external_system text     NOT NULL DEFAULT 'tally',
      external_id     text     NOT NULL,
      external_ref    text     DEFAULT '',
      synced_at       timestamp DEFAULT now(),
      created_at      timestamp DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS tally_external_refs_uidx
       ON tally_external_refs(config_id, internal_table, internal_id, external_system)`,

    // tally_audit_log
    `CREATE TABLE IF NOT EXISTS tally_audit_log (
      id          varchar  PRIMARY KEY DEFAULT gen_random_uuid()::text,
      config_id   varchar,
      event_type  text     NOT NULL,
      entity_type text     DEFAULT '',
      entity_id   varchar,
      actor_type  text     NOT NULL DEFAULT 'user',
      actor_id    varchar,
      description text     DEFAULT '',
      meta        jsonb    DEFAULT '{}',
      created_at  timestamp DEFAULT now()
    )`,

    // tally_bank_recon
    `CREATE TABLE IF NOT EXISTS tally_bank_recon (
      id                 varchar  PRIMARY KEY DEFAULT gen_random_uuid()::text,
      config_id          varchar  REFERENCES tally_config(id),
      bank_ledger_name   text     NOT NULL,
      internal_gl_id     varchar,
      external_id        text     NOT NULL DEFAULT '',
      voucher_number     text     NOT NULL DEFAULT '',
      instrument_number  text     NOT NULL DEFAULT '',
      transaction_type   text     NOT NULL DEFAULT '',
      allocation_key     text     NOT NULL DEFAULT '',
      statement_date     date     NOT NULL,
      statement_balance  decimal(15,2) NOT NULL DEFAULT 0,
      book_balance       decimal(15,2) DEFAULT 0,
      difference         decimal(15,2) DEFAULT 0,
      recon_status       text     NOT NULL DEFAULT 'pending',
      tally_data         jsonb    DEFAULT '{}',
      last_sync_at       timestamp,
      created_at         timestamp DEFAULT now(),
      updated_at         timestamp DEFAULT now()
    )`,
  ];

  for (const stmt of createStatements) {
    await pool.query(stmt); // throws on real errors
  }

  // Idempotent column additions for tables that may already exist
  const alterStatements = [
    `ALTER TABLE tally_config ADD COLUMN IF NOT EXISTS display_name             text     NOT NULL DEFAULT ''`,
    `ALTER TABLE tally_config ADD COLUMN IF NOT EXISTS import_masters_enabled   boolean  DEFAULT true`,
    `ALTER TABLE tally_config ADD COLUMN IF NOT EXISTS import_vouchers_enabled  boolean  DEFAULT true`,
    `ALTER TABLE tally_config ADD COLUMN IF NOT EXISTS export_sales_enabled     boolean  DEFAULT false`,
    `ALTER TABLE tally_config ADD COLUMN IF NOT EXISTS export_purchases_enabled boolean  DEFAULT false`,
    `ALTER TABLE tally_config ADD COLUMN IF NOT EXISTS auto_approve_mapped      boolean  DEFAULT false`,
    `ALTER TABLE tally_config ADD COLUMN IF NOT EXISTS sync_interval_minutes    integer  DEFAULT 0`,
    `ALTER TABLE tally_config ADD COLUMN IF NOT EXISTS last_scheduled_at        timestamp`,
    `ALTER TABLE tally_config ADD COLUMN IF NOT EXISTS last_tally_status        text     DEFAULT ''`,
    `ALTER TABLE tally_config ADD COLUMN IF NOT EXISTS last_tally_error         text     DEFAULT ''`,
    `ALTER TABLE tally_outbox ADD COLUMN IF NOT EXISTS max_retries              integer  DEFAULT 3`,
    `ALTER TABLE tally_outbox ADD COLUMN IF NOT EXISTS leased_at                timestamp`,
    `ALTER TABLE tally_outbox ADD COLUMN IF NOT EXISTS leased_by                text DEFAULT ''`,
    `ALTER TABLE tally_bank_recon ADD COLUMN IF NOT EXISTS external_id        text NOT NULL DEFAULT ''`,
    `ALTER TABLE tally_bank_recon ADD COLUMN IF NOT EXISTS voucher_number     text NOT NULL DEFAULT ''`,
    `ALTER TABLE tally_bank_recon ADD COLUMN IF NOT EXISTS instrument_number  text NOT NULL DEFAULT ''`,
    `ALTER TABLE tally_bank_recon ADD COLUMN IF NOT EXISTS transaction_type   text NOT NULL DEFAULT ''`,
    `ALTER TABLE tally_bank_recon ADD COLUMN IF NOT EXISTS allocation_key      text NOT NULL DEFAULT ''`,
    `UPDATE tally_bank_recon SET allocation_key=md5(id) WHERE allocation_key=''`,
    `DROP INDEX IF EXISTS tally_bank_recon_uidx`,
    `CREATE UNIQUE INDEX IF NOT EXISTS tally_bank_recon_txn_uidx
       ON tally_bank_recon(config_id, allocation_key)`,
  ];

  for (const stmt of alterStatements) {
    await pool.query(stmt); // throws on real errors
  }
}

// ─── Audit helper ─────────────────────────────────────────────────────────────

export async function auditLog(opts: {
  configId?: string | null;
  eventType: string;
  entityType?: string;
  entityId?: string | null;
  actorType?: "user" | "connector";
  actorId?: string | null;
  description?: string;
  meta?: Record<string, any>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO tally_audit_log
       (config_id, event_type, entity_type, entity_id, actor_type, actor_id, description, meta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      opts.configId || null,
      opts.eventType,
      opts.entityType || "",
      opts.entityId || null,
      opts.actorType || "user",
      opts.actorId || null,
      opts.description || "",
      JSON.stringify(opts.meta || {}),
    ]
  );
}

// ─── Config helpers ───────────────────────────────────────────────────────────

const CONFIG_COLS = `id, company_name, display_name, tally_host, tally_port, financial_year,
  enable_stock_sync, import_masters_enabled, import_vouchers_enabled,
  export_sales_enabled, export_purchases_enabled, auto_approve_mapped,
  sync_interval_minutes, last_scheduled_at, last_tally_status, last_tally_error,
  is_active, connector_token_hint, connector_token_rotated_at,
  last_heartbeat_at, connector_version, created_at, updated_at`;

export async function getActiveConfig(): Promise<any | null> {
  const r = await pool.query(
    `SELECT ${CONFIG_COLS}
     FROM tally_config
     ORDER BY is_active DESC, created_at DESC
     LIMIT 1`
  );
  return r.rows[0] || null;
}

export async function getConfigById(
  configId: string,
  requireActive = false
): Promise<any | null> {
  const r = await pool.query(
    `SELECT ${CONFIG_COLS}
     FROM tally_config
     WHERE id=$1 AND ($2::boolean=false OR is_active=true)
     LIMIT 1`,
    [configId, requireActive]
  );
  return r.rows[0] || null;
}

/** Convert snake_case DB row to camelCase for the browser. Never includes hash. */
export function safeConfig(row: any): any {
  if (!row) return null;
  return {
    id: row.id,
    companyName: row.company_name,
    displayName: row.display_name || "",
    tallyHost: row.tally_host,
    tallyPort: row.tally_port,
    financialYear: row.financial_year || "",
    stockSyncEnabled: row.enable_stock_sync ?? false,
    importMasters: row.import_masters_enabled ?? true,
    importVouchers: row.import_vouchers_enabled ?? true,
    exportSales: row.export_sales_enabled ?? false,
    exportPurchases: row.export_purchases_enabled ?? false,
    syncIntervalMinutes: row.sync_interval_minutes ?? 0,
    lastScheduledAt: row.last_scheduled_at || null,
    lastTallyStatus: row.last_tally_status || "",
    lastTallyError: row.last_tally_error || "",
    enabled: row.is_active ?? false,
    connectorTokenHint: row.connector_token_hint || "",
    connectorTokenRotatedAt: row.connector_token_rotated_at || null,
    lastHeartbeatAt: row.last_heartbeat_at || null,
    connectorVersion: row.connector_version || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Permission check ─────────────────────────────────────────────────────────

export async function checkTallyPermission(
  user: any,
  module: string,
  permission: "can_view" | "can_create" | "can_edit" | "can_delete" | "can_approve" | "can_export"
): Promise<boolean> {
  if (user?.role === "admin") return true;
  const roleId = user?.userRoleId || user?.user_role_id;
  if (!roleId) return false;
  const r = await pool.query(
    `SELECT ${permission} FROM role_rights WHERE role_id=$1 AND module=$2 LIMIT 1`,
    [roleId, module]
  );
  return !!r.rows[0]?.[permission];
}

// ─── Date / field validation ──────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateDate(s: string | undefined, fieldName: string): string {
  if (!s) throw new Error(`${fieldName} is required`);
  const parsed = new Date(`${s}T00:00:00Z`);
  if (!DATE_RE.test(s) || isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== s) {
    throw new Error(`${fieldName} must be a valid YYYY-MM-DD date, got "${s}"`);
  }
  return s;
}

export function validateDateOptional(s: string | undefined): string | null {
  if (!s) return null;
  const parsed = new Date(`${s}T00:00:00Z`);
  if (!DATE_RE.test(s) || isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== s) {
    throw new Error(`Invalid date value "${s}", expected YYYY-MM-DD`);
  }
  return s;
}

// ─── Inbound voucher interfaces ───────────────────────────────────────────────

export interface VoucherLine {
  ledgerName: string;
  tallyLedgerGuid?: string;
  drCr: "DR" | "CR";
  amount: number;
  narration?: string;
  billAllocations?: { billName: string; billType: string; amount: number }[];
  bankAllocations?: {
    transactionType?: string;
    bankName?: string;
    instrumentDate?: string | null;
    instrumentNo?: string;
    amount: number;
  }[];
}

export interface InboundVoucher {
  externalId: string;
  alterationId?: string;
  voucherType: string;
  voucherNumber: string;
  voucherDate: string;
  narration?: string;
  company: string;
  financialYear?: string;
  checksum?: string;
  lines: VoucherLine[];
  bankAllocations?: any[];
}

export function validateVoucherFields(v: Partial<InboundVoucher>): string[] {
  const errs: string[] = [];
  if (!v.externalId) errs.push("externalId is required");
  if (!v.voucherType) errs.push("voucherType is required");
  if (!v.voucherNumber) errs.push("voucherNumber is required");
  if (!v.voucherDate) errs.push("voucherDate is required");
  else if (!DATE_RE.test(v.voucherDate) || isNaN(Date.parse(v.voucherDate)))
    errs.push(`voucherDate "${v.voucherDate}" is not a valid YYYY-MM-DD date`);
  if (!Array.isArray(v.lines) || v.lines.length === 0) {
    errs.push("lines must be a non-empty array");
  } else {
    v.lines.forEach((line, index) => {
      if (!line?.ledgerName?.trim()) errs.push(`lines[${index}].ledgerName is required`);
      if (line?.drCr !== "DR" && line?.drCr !== "CR") {
        errs.push(`lines[${index}].drCr must be DR or CR`);
      }
      const amount = Number(line?.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        errs.push(`lines[${index}].amount must be a non-negative finite number`);
      }
    });
  }
  return errs;
}

export function validateVoucherBalance(v: InboundVoucher): string | null {
  const dr = v.lines
    .filter(l => l.drCr === "DR")
    .reduce((s, l) => s + (Number(l.amount) || 0), 0);
  const cr = v.lines
    .filter(l => l.drCr === "CR")
    .reduce((s, l) => s + (Number(l.amount) || 0), 0);
  if (Math.abs(dr - cr) > 0.01) {
    return `Voucher not balanced: DR=${dr.toFixed(2)} CR=${cr.toFixed(2)}`;
  }
  return null;
}

// ─── Mapping resolution ───────────────────────────────────────────────────────

/**
 * Mapping types that resolve to general_ledger:
 *   general_ledger, bank, gst_ledger, round_off_ledger, freight_ledger,
 *   discount_ledger, voucher_type (skipped for line resolution)
 * Mapping types that resolve to sub_ledger:
 *   sub_ledger, party, customer, supplier
 */
const GL_TYPES = new Set([
  "general_ledger", "bank", "gst_ledger", "round_off_ledger",
  "freight_ledger", "discount_ledger", "ledger",
]);
const SL_TYPES = new Set([
  "sub_ledger", "party", "customer", "supplier",
]);

export async function resolveMappings(
  configId: string,
  lines: VoucherLine[]
): Promise<{
  resolved: { line: VoucherLine; glId: string | null; slId: string | null }[];
  unmapped: string[];
}> {
  const resolved: { line: VoucherLine; glId: string | null; slId: string | null }[] = [];
  const unmappedMap: Record<string, true> = {};

  for (const line of lines) {
    const guid = line.tallyLedgerGuid || "";
    const r = await pool.query(
      `SELECT m.internal_id, m.internal_type
       FROM tally_mappings m
       WHERE m.config_id=$1
         AND m.is_active=true
         AND m.mapping_type NOT IN ('voucher_type','stock')
         AND (
           ($2 != '' AND m.tally_guid=$2)
           OR LOWER(TRIM(m.tally_name)) = LOWER(TRIM($3))
         )
       ORDER BY (m.tally_guid=$2 AND $2!='') DESC
       LIMIT 1`,
      [configId, guid, line.ledgerName]
    );

    if (!r.rows[0]) {
      unmappedMap[line.ledgerName] = true;
      resolved.push({ line, glId: null, slId: null });
    } else {
      const { internal_id, internal_type } = r.rows[0];
      const isSL = SL_TYPES.has(internal_type);
      const isGL = GL_TYPES.has(internal_type);

      let glId: string | null = isGL ? internal_id : null;
      const slId: string | null = isSL ? internal_id : null;

      if (slId && !glId) {
        const slr = await pool.query(
          `SELECT general_ledger_id FROM sub_ledgers WHERE id=$1`,
          [slId]
        );
        glId = slr.rows[0]?.general_ledger_id || null;
      }
      resolved.push({ line, glId, slId });
    }
  }

  return { resolved, unmapped: Object.keys(unmappedMap) };
}

// ─── Post approved inbound voucher transactionally ────────────────────────────

export async function postInboundVoucher(
  inboxId: string,
  userId: string,
  configId: string
): Promise<{ voucherMasId: string; voucherNo: string }> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Lock before checking or changing review state. Concurrent approval
    // requests serialize on this row, so only one transaction can post it.
    const inboxRes = await client.query(
      `SELECT * FROM tally_voucher_inbox
       WHERE id=$1 AND config_id=$2
       FOR UPDATE`,
      [inboxId, configId]
    );
    if (!inboxRes.rows[0]) throw new Error("Inbox record not found");
    const inbox = inboxRes.rows[0];

    // A repeated approval after a successful commit is idempotent.
    if (inbox.status === "posted" && inbox.posted_voucher_mas_id) {
      const existing = await client.query(
        `SELECT id, voucher_no FROM voucher_mas WHERE id=$1`,
        [inbox.posted_voucher_mas_id]
      );
      if (existing.rows[0]) {
        await client.query("COMMIT");
        return { voucherMasId: existing.rows[0].id, voucherNo: existing.rows[0].voucher_no };
      }
      throw new Error("Posted inbox record is missing its ERP voucher");
    }
    if (inbox.status !== "review") {
      throw new Error(`Inbox record is ${inbox.status}; only review records can be approved`);
    }

    const payload: InboundVoucher = inbox.raw_payload as InboundVoucher;

    // Claim review state inside the same transaction that creates the ERP
    // voucher. Any posting error rolls this change back to review.
    await client.query(
      `UPDATE tally_voucher_inbox
       SET status='approved', reviewed_by=$1, reviewed_at=now(), updated_at=now()
       WHERE id=$2 AND config_id=$3 AND status='review'`,
      [userId, inboxId, configId]
    );

    // Validate fields
    const fieldErrs = validateVoucherFields(payload);
    if (fieldErrs.length > 0) throw new Error(fieldErrs.join("; "));

    // Balance check
    const balErr = validateVoucherBalance(payload);
    if (balErr) throw new Error(balErr);

    // Resolve mappings — all must resolve
    const { resolved, unmapped } = await resolveMappings(configId, payload.lines);
    if (unmapped.length > 0) {
      throw new Error(`Cannot post: unmapped ledgers: ${unmapped.join(", ")}`);
    }

    // Generate voucher number
    const { generateVoucherNo } = await import("./voucher");
    const fyRes = await client.query(
      `SELECT id, label FROM financial_years WHERE is_current=true LIMIT 1`
    );
    const fy = fyRes.rows[0] || { id: null, label: "" };
    const voucherNo = await generateVoucherNo("tally_import", client);
    const totalDr = payload.lines
      .filter(l => l.drCr === "DR")
      .reduce((s, l) => s + (Number(l.amount) || 0), 0);

    // Insert voucher_mas
    const vmRes = await client.query(
      `INSERT INTO voucher_mas
         (voucher_no, voucher_type, voucher_date, narration,
          financial_year_id, financial_year, total_amount, taxable_amount, tax_amount,
          source_type, source_id, ref_no)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'0','tally_import',$9,$10)
       RETURNING id`,
      [
        voucherNo, payload.voucherType,
        payload.voucherDate,
        payload.narration || "",
        fy.id, fy.label,
        totalDr.toFixed(2), totalDr.toFixed(2),
        inboxId,
        payload.voucherNumber,
      ]
    );
    const vmId: string = vmRes.rows[0].id;

    // Insert voucher_det lines
    for (let i = 0; i < resolved.length; i++) {
      const { line, glId, slId } = resolved[i];
      await client.query(
        `INSERT INTO voucher_det
           (voucher_mas_id, seq_no, general_ledger_id, sub_ledger_id, dr_cr, amount, narration)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [vmId, i + 1, glId, slId, line.drCr, Number(line.amount), line.narration || payload.narration || ""]
      );

      // Bill allocations → sub_ledger_bills
      if (line.billAllocations && slId) {
        for (const ba of line.billAllocations) {
          await client.query(
            `INSERT INTO sub_ledger_bills
               (id, sub_ledger_id, ref_no, amount, cr_dr, bill_type, voucher_no, voucher_date)
             VALUES (gen_random_uuid()::text,$1,$2,$3,$4,'Bills',$5,$6)
             ON CONFLICT DO NOTHING`,
            [slId, ba.billName, Number(ba.amount), line.drCr === "DR" ? "Dr" : "Cr", voucherNo, payload.voucherDate]
          );
        }
      }

      // Preserve Tally's bank allocation metadata transaction-by-transaction.
      // This makes the reconciliation report usable without opening Tally's
      // local port to the internet or relying on one aggregate row per date.
      for (let bankIndex = 0; bankIndex < (line.bankAllocations || []).length; bankIndex++) {
        const ba = line.bankAllocations![bankIndex] || {};
        const statementDate = validateDateOptional(ba.instrumentDate || undefined) || payload.voucherDate;
        const statementAmount = Math.abs(Number(ba.amount ?? line.amount) || 0);
        const bookAmount = Math.abs(Number(line.amount) || 0);
        const difference = statementAmount - bookAmount;
        const allocationKey = createHash("sha256")
          .update(`${payload.externalId}|${i}|${bankIndex}|${line.ledgerName}|${statementDate}`)
          .digest("hex");

        await client.query(
          `INSERT INTO tally_bank_recon
             (config_id, bank_ledger_name, internal_gl_id, external_id,
              voucher_number, instrument_number, transaction_type, allocation_key,
              statement_date, statement_balance, book_balance, difference,
              recon_status, tally_data, last_sync_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,now())
           ON CONFLICT (config_id, allocation_key) DO UPDATE SET
             bank_ledger_name=EXCLUDED.bank_ledger_name,
             internal_gl_id=EXCLUDED.internal_gl_id,
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
            configId,
            line.ledgerName,
            glId,
            payload.externalId,
            payload.voucherNumber,
            ba.instrumentNo || "",
            ba.transactionType || "",
            allocationKey,
            statementDate,
            statementAmount.toFixed(2),
            bookAmount.toFixed(2),
            difference.toFixed(2),
            Math.abs(difference) <= 0.01 ? "matched" : "unmatched",
            ba,
          ]
        );
      }
    }

    // Mark inbox as posted
    await client.query(
      `UPDATE tally_voucher_inbox
       SET status='posted', posted_voucher_mas_id=$1, reviewed_by=$2, reviewed_at=now(), updated_at=now()
       WHERE id=$3 AND config_id=$4 AND status='approved'`,
      [vmId, userId, inboxId, configId]
    );

    // Create/update external ref (idempotent)
    await client.query(
      `INSERT INTO tally_external_refs
         (config_id, internal_table, internal_id, external_system, external_id, external_ref, synced_at)
       VALUES ($1,'voucher_mas',$2,'tally',$3,$4,now())
       ON CONFLICT (config_id, internal_table, internal_id, external_system)
       DO UPDATE SET external_id=$3, external_ref=$4, synced_at=now()`,
      [configId, vmId, payload.externalId, payload.voucherNumber]
    );

    await client.query("COMMIT");

    await auditLog({
      configId,
      eventType: "voucher_import",
      entityType: "voucher_mas",
      entityId: vmId,
      actorType: "user",
      actorId: userId,
      description: `Posted Tally voucher ${payload.voucherNumber} as ${voucherNo}`,
      meta: { externalId: payload.externalId, inboxId },
    });

    return { voucherMasId: vmId, voucherNo };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// ─── Export preparation — builds real balanced Tally voucher payloads ─────────

interface ExportVoucherLine {
  ledgerName: string;
  tallyLedgerGuid: string;
  amount: number;
  narration: string;
  isParty?: boolean;
  billAllocations?: { name: string; billType: string; amount: number }[];
}

interface ExportVoucherPayload {
  externalId: string;          // ERP voucher_mas.id, retained for audit display
  remoteId: string;            // stable Tally REMOTEID used for idempotency
  voucherType: string;         // Tally voucher type name (from mapping)
  voucherNumber: string;
  date: string;
  narration: string;
  company: string;
  financialYear: string;
  ledgerEntries: ExportVoucherLine[];
}

/**
 * Build a balanced Tally voucher payload from a posted voucher_mas row.
 * Requires:
 *   - voucher_type mapping (maps ERP voucher_type → Tally voucher type name)
 *   - each GL/SL must have a tally_mappings entry
 * Returns null with a reason string if any mapping is missing.
 */
async function buildExportPayload(
  vmId: string,
  configId: string,
  company: string,
  financialYear: string
): Promise<{ payload: ExportVoucherPayload | null; reason: string }> {
  // Load voucher_mas + det
  const vmR = await pool.query(
    `SELECT vm.id, vm.voucher_no, vm.voucher_type,
            vm.voucher_date::text AS voucher_date, vm.narration,
            vt.id AS voucher_type_id
     FROM voucher_mas vm
     LEFT JOIN voucher_types vt ON vt.code=vm.voucher_type
     WHERE vm.id=$1`,
    [vmId]
  );
  if (!vmR.rows[0]) return { payload: null, reason: "Source voucher not found" };
  const vm = vmR.rows[0];

  const detR = await pool.query(
    `SELECT vd.dr_cr, vd.amount::numeric AS amount, vd.narration,
            vd.general_ledger_id, vd.sub_ledger_id,
            gl.name AS gl_name, sl.name AS sl_name
     FROM voucher_det vd
     LEFT JOIN general_ledgers gl ON gl.id=vd.general_ledger_id
     LEFT JOIN sub_ledgers sl ON sl.id=vd.sub_ledger_id
     WHERE vd.voucher_mas_id=$1
     ORDER BY vd.seq_no`,
    [vmId]
  );
  if (detR.rows.length === 0) return { payload: null, reason: "No voucher lines found" };

  // Resolve voucher type mapping
  const vtR = await pool.query(
    `SELECT tally_name FROM tally_mappings
     WHERE config_id=$1 AND mapping_type='voucher_type'
       AND is_active=true
       AND internal_type='voucher_type'
       AND internal_id=$2
     LIMIT 1`,
    [configId, vm.voucher_type_id || null]
  );
  if (!vtR.rows[0]?.tally_name) {
    return {
      payload: null,
      reason: `Missing Tally voucher-type mapping for ERP voucher type "${vm.voucher_type}"`,
    };
  }
  const tallyVoucherType = vtR.rows[0].tally_name;

  // Build lines
  const lines: ExportVoucherLine[] = [];
  const missingLedgers: string[] = [];

  for (const det of detR.rows) {
    // Prefer sub_ledger mapping, fall back to GL
    const lookupId = det.sub_ledger_id || det.general_ledger_id;
    const lookupName = det.sl_name || det.gl_name || "";
    if (!lookupId && !lookupName) {
      missingLedgers.push("(unknown ledger)");
      continue;
    }

    // Find mapping by internal_id
    const mR = await pool.query(
      `SELECT tally_name, tally_guid FROM tally_mappings
       WHERE config_id=$1
         AND is_active=true
         AND mapping_type NOT IN ('voucher_type','stock')
         AND internal_id=$2
       LIMIT 1`,
      [configId, lookupId]
    );

    if (!mR.rows[0]) {
      // Try by name fallback
      const mRN = await pool.query(
        `SELECT tally_name, tally_guid FROM tally_mappings
         WHERE config_id=$1
           AND is_active=true
           AND mapping_type NOT IN ('voucher_type','stock')
           AND LOWER(TRIM(tally_name)) = LOWER(TRIM($2))
         LIMIT 1`,
        [configId, lookupName]
      );
      if (!mRN.rows[0]) {
        missingLedgers.push(lookupName || lookupId);
        continue;
      }
      lines.push({
        ledgerName: mRN.rows[0].tally_name,
        tallyLedgerGuid: mRN.rows[0].tally_guid || "",
        amount: det.dr_cr === "DR" ? Math.abs(Number(det.amount)) : -Math.abs(Number(det.amount)),
        narration: det.narration || vm.narration || "",
        isParty: !!det.sub_ledger_id,
      });
    } else {
      lines.push({
        ledgerName: mR.rows[0].tally_name,
        tallyLedgerGuid: mR.rows[0].tally_guid || "",
        amount: det.dr_cr === "DR" ? Math.abs(Number(det.amount)) : -Math.abs(Number(det.amount)),
        narration: det.narration || vm.narration || "",
        isParty: !!det.sub_ledger_id,
      });
    }
  }

  if (missingLedgers.length > 0) {
    return { payload: null, reason: `Missing Tally mappings for: ${missingLedgers.join(", ")}` };
  }

  // Verify balance
  const dr = lines.filter(l => l.amount >= 0).reduce((s, l) => s + Math.abs(l.amount), 0);
  const cr = lines.filter(l => l.amount < 0).reduce((s, l) => s + Math.abs(l.amount), 0);
  if (Math.abs(dr - cr) > 0.01) {
    return { payload: null, reason: `Export voucher not balanced DR=${dr.toFixed(2)} CR=${cr.toFixed(2)}` };
  }

  return {
    payload: {
      externalId: vm.id,
      remoteId: `ERP:${vm.id}`,
      voucherType: tallyVoucherType,
      voucherNumber: vm.voucher_no,
      date: vm.voucher_date,
      narration: vm.narration || "",
      company,
      financialYear,
      ledgerEntries: lines,
    },
    reason: "",
  };
}

export async function enqueueExportJobs(
  configId: string,
  jobType: "export_sales" | "export_purchases",
  syncJobId: string,
  fromDate?: string | null,
  toDate?: string | null
): Promise<{ queued: number; review: number }> {
  let queued = 0;
  let review = 0;

  // Config for company/FY
  const cfgR = await pool.query(
    `SELECT company_name, financial_year FROM tally_config WHERE id=$1`,
    [configId]
  );
  const cfg = cfgR.rows[0] || { company_name: "", financial_year: "" };

  if (jobType === "export_sales") {
    // Find finalized job_work_invoices that have an associated posted voucher_mas record
    const rows = await pool.query(
      `SELECT jwi.id AS source_id, jwi.voucher_no, vm.id AS vm_id
       FROM job_work_invoices jwi
       JOIN voucher_mas vm ON vm.source_type='job_work_invoice' AND vm.source_id=jwi.id::text
       WHERE COALESCE(jwi.status,'') NOT IN ('cancelled','Cancelled','draft','Draft')
         AND ($1::date IS NULL OR jwi.invoice_date >= $1::date)
         AND ($2::date IS NULL OR jwi.invoice_date <= $2::date)
       LIMIT 500`,
      [fromDate || null, toDate || null]
    );

    for (const row of rows.rows) {
      // Idempotency: skip if already queued/sent
      const dup = await pool.query(
        `SELECT id FROM tally_outbox
         WHERE config_id=$1 AND source_type='job_work_invoice' AND source_id=$2
           AND status NOT IN ('failed','cancelled')
         LIMIT 1`,
        [configId, row.source_id]
      );
      if (dup.rows.length > 0) continue;

      const { payload, reason } = await buildExportPayload(
        row.vm_id, configId, cfg.company_name, cfg.financial_year
      );
      const status = payload ? "queued" : "review";

      await pool.query(
        `INSERT INTO tally_outbox
           (config_id, sync_job_id, source_type, source_id, voucher_type, status, review_reason, payload)
         VALUES ($1,$2,'job_work_invoice',$3,'Sales Invoice',$4,$5,$6::jsonb)
         ON CONFLICT DO NOTHING`,
        [configId, syncJobId, row.source_id, status, reason, JSON.stringify(payload || {})]
      );
      if (status === "queued") queued++; else review++;
    }

    // Also handle sources with no posted voucher (put to review)
    const unposted = await pool.query(
      `SELECT jwi.id AS source_id, jwi.voucher_no
       FROM job_work_invoices jwi
       WHERE COALESCE(jwi.status,'') NOT IN ('cancelled','Cancelled','draft','Draft')
         AND ($1::date IS NULL OR jwi.invoice_date >= $1::date)
         AND ($2::date IS NULL OR jwi.invoice_date <= $2::date)
         AND NOT EXISTS (
           SELECT 1 FROM voucher_mas vm
           WHERE vm.source_type='job_work_invoice' AND vm.source_id=jwi.id::text
         )
         AND NOT EXISTS (
           SELECT 1 FROM tally_outbox ob
           WHERE ob.source_type='job_work_invoice' AND ob.source_id=jwi.id::text
             AND ob.status NOT IN ('failed','cancelled')
         )
       LIMIT 200`,
      [fromDate || null, toDate || null]
    );
    for (const row of unposted.rows) {
      await pool.query(
        `INSERT INTO tally_outbox
           (config_id, sync_job_id, source_type, source_id, voucher_type, status, review_reason, payload)
         VALUES ($1,$2,'job_work_invoice',$3,'Sales Invoice','review',$4,'{}')
         ON CONFLICT DO NOTHING`,
        [configId, syncJobId, row.source_id, `No posted accounting voucher found for ${row.voucher_no}`]
      );
      review++;
    }

  } else if (jobType === "export_purchases") {
    const rows = await pool.query(
      `SELECT g.id AS source_id, g.voucher_no, vm.id AS vm_id
       FROM goods_receipt_notes g
       JOIN voucher_mas vm ON vm.source_type='grn' AND vm.source_id=g.id::text
       WHERE COALESCE(g.status,'') NOT IN ('Cancelled','Draft')
         AND ($1::date IS NULL OR g.grn_date >= $1::date)
         AND ($2::date IS NULL OR g.grn_date <= $2::date)
       LIMIT 500`,
      [fromDate || null, toDate || null]
    );

    for (const row of rows.rows) {
      const dup = await pool.query(
        `SELECT id FROM tally_outbox
         WHERE config_id=$1 AND source_type='grn' AND source_id=$2
           AND status NOT IN ('failed','cancelled')
         LIMIT 1`,
        [configId, row.source_id]
      );
      if (dup.rows.length > 0) continue;

      const { payload, reason } = await buildExportPayload(
        row.vm_id, configId, cfg.company_name, cfg.financial_year
      );
      const status = payload ? "queued" : "review";

      await pool.query(
        `INSERT INTO tally_outbox
           (config_id, sync_job_id, source_type, source_id, voucher_type, status, review_reason, payload)
         VALUES ($1,$2,'grn',$3,'Purchase Invoice',$4,$5,$6::jsonb)
         ON CONFLICT DO NOTHING`,
        [configId, syncJobId, row.source_id, status, reason, JSON.stringify(payload || {})]
      );
      if (status === "queued") queued++; else review++;
    }

    // GRNs without posted voucher → review
    const unposted = await pool.query(
      `SELECT g.id AS source_id, g.voucher_no
       FROM goods_receipt_notes g
       WHERE COALESCE(g.status,'') NOT IN ('Cancelled','Draft')
         AND ($1::date IS NULL OR g.grn_date >= $1::date)
         AND ($2::date IS NULL OR g.grn_date <= $2::date)
         AND NOT EXISTS (
           SELECT 1 FROM voucher_mas vm
           WHERE vm.source_type='grn' AND vm.source_id=g.id::text
         )
         AND NOT EXISTS (
           SELECT 1 FROM tally_outbox ob
           WHERE ob.source_type='grn' AND ob.source_id=g.id::text
             AND ob.status NOT IN ('failed','cancelled')
         )
       LIMIT 200`,
      [fromDate || null, toDate || null]
    );
    for (const row of unposted.rows) {
      await pool.query(
        `INSERT INTO tally_outbox
           (config_id, sync_job_id, source_type, source_id, voucher_type, status, review_reason, payload)
         VALUES ($1,$2,'grn',$3,'Purchase Invoice','review',$4,'{}')
         ON CONFLICT DO NOTHING`,
        [configId, syncJobId, row.source_id, `No posted accounting voucher found for ${row.voucher_no}`]
      );
      review++;
    }
  }

  return { queued, review };
}

// ─── Scheduled sync ───────────────────────────────────────────────────────────

/**
 * Called on heartbeat. If sync_interval_minutes > 0 and enough time has elapsed
 * since last_scheduled_at, enqueue configured import jobs.
 * Idempotent: only enqueues if no queued/leased inbound job exists already.
 */
export async function maybeScheduleSync(configId: string): Promise<void> {
  const client = await pool.connect();
  const outboundJobs: Array<{ id: string; type: "export_sales" | "export_purchases" }> = [];
  let intervalMinutes = 0;
  let fromDate = "";
  let toDate = "";

  try {
    await client.query("BEGIN");
    const cfgR = await client.query(
      `SELECT sync_interval_minutes, last_scheduled_at,
              import_masters_enabled, import_vouchers_enabled,
              export_sales_enabled, export_purchases_enabled,
              enable_stock_sync, company_name, financial_year, is_active
       FROM tally_config WHERE id=$1 FOR UPDATE`,
      [configId]
    );
    const cfg = cfgR.rows[0];
    intervalMinutes = Number(cfg?.sync_interval_minutes || 0);
    if (!cfg?.is_active || intervalMinutes <= 0) {
      await client.query("COMMIT");
      return;
    }

    const now = new Date();
    if (cfg.last_scheduled_at) {
      const lastMs = new Date(cfg.last_scheduled_at).getTime();
      if (now.getTime() - lastMs < intervalMinutes * 60 * 1000) {
        await client.query("COMMIT");
        return;
      }
    }

    const active = await client.query(
      `SELECT 1 FROM tally_sync_jobs
       WHERE config_id=$1 AND direction='inbound' AND status IN ('queued','leased')
       LIMIT 1`,
      [configId]
    );
    if (active.rows.length > 0) {
      await client.query("COMMIT");
      return;
    }

    toDate = now.toISOString().slice(0, 10);
    if (cfg.last_scheduled_at) {
      fromDate = new Date(cfg.last_scheduled_at).toISOString().slice(0, 10);
    } else {
      const startYear = /^(\d{4})-\d{2,4}$/.exec(String(cfg.financial_year || ""))?.[1];
      if (startYear) {
        fromDate = `${startYear}-04-01`;
      } else {
        const fallback = new Date(now);
        fallback.setDate(fallback.getDate() - 30);
        fromDate = fallback.toISOString().slice(0, 10);
      }
    }

    if (cfg.import_masters_enabled) {
      await client.query(
        `INSERT INTO tally_sync_jobs (config_id, job_type, direction, status, created_by)
         VALUES ($1,'import_masters','inbound','queued','scheduled')`,
        [configId]
      );
    }
    if (cfg.import_vouchers_enabled) {
      await client.query(
        `INSERT INTO tally_sync_jobs
           (config_id, job_type, direction, status, from_date, to_date, created_by)
         VALUES ($1,'import_vouchers','inbound','queued',$2,$3,'scheduled')`,
        [configId, fromDate, toDate]
      );
    }

    for (const type of ["export_sales", "export_purchases"] as const) {
      const enabled = type === "export_sales"
        ? cfg.export_sales_enabled
        : cfg.export_purchases_enabled;
      if (!enabled) continue;
      const jobR = await client.query(
        `INSERT INTO tally_sync_jobs
           (config_id, job_type, direction, status, from_date, to_date, created_by)
         VALUES ($1,$2,'outbound','queued',$3,$4,'scheduled')
         RETURNING id`,
        [configId, type, fromDate, toDate]
      );
      outboundJobs.push({ id: jobR.rows[0].id, type });
    }

    await client.query(
      `UPDATE tally_config SET last_scheduled_at=now(), updated_at=now() WHERE id=$1`,
      [configId]
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  for (const job of outboundJobs) {
    try {
      const prepared = await enqueueExportJobs(
        configId,
        job.type,
        job.id,
        fromDate,
        toDate
      );
      await pool.query(
        `UPDATE tally_sync_jobs
         SET status='completed', completed_at=now(), updated_at=now(),
             result_summary=$1
         WHERE id=$2`,
        [`Prepared ${prepared.queued} export(s); ${prepared.review} held for review`, job.id]
      );
    } catch (error: any) {
      await pool.query(
        `UPDATE tally_sync_jobs
         SET status='failed', completed_at=now(), updated_at=now(), error_message=$1
         WHERE id=$2`,
        [String(error?.message || error), job.id]
      );
      throw error;
    }
  }

  await auditLog({
    configId,
    eventType: "scheduled_sync",
    actorType: "connector",
    description: `Scheduled sync triggered (${fromDate} to ${toDate}, interval=${intervalMinutes}m)`,
  });
}
