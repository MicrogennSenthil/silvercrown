import { db } from "./db";
import { sql } from "drizzle-orm";

// Maps transaction_type → actual DB table name holding voucher_no
const TYPE_TABLE: Record<string, string> = {
  job_work_despatch:        "job_work_despatch",
  job_work_inward:          "job_work_inward",
  job_work_invoice:         "job_work_invoices",
  returnable_inward:        "returnable_inward",
  returnable_outward:       "returnable_outward",
  purchase_order:           "purchase_orders",
  purchase_order_amendment: "purchase_order_amendments",
  gate_pass:                "gate_pass",
  store_opening:            "store_openings",
  store_issue:              "store_issues",
  store_request:            "store_requests",
  purchase_receipt:         "purchase_receipts",
  issue_indent_return:      "issue_indent_returns",
  goods_receipt_return:     "goods_receipt_returns",
  phy_reconciliation:       "phy_reconciliations",
  manual_voucher:           "manual_vouchers",
};

export async function generateVoucherNo(
  transactionType: string,
  client?: any
): Promise<string> {
  const exec = async (rawSql: string, params?: any[]) => {
    if (client) return client.query(rawSql, params);
    return db.execute(sql.raw(rawSql));
  };

  // Find active financial year
  let fyId: string | null = null;
  if (client) {
    const fyRes = await client.query(`SELECT id FROM financial_years WHERE is_current = true LIMIT 1`);
    fyId = fyRes.rows[0]?.id || null;
  } else {
    const fyRows = await db.execute(sql`SELECT id FROM financial_years WHERE is_current = true LIMIT 1`);
    fyId = (fyRows.rows[0] as any)?.id || null;
  }

  // Find matching voucher series — lock the row when inside a transaction (prevents race conditions)
  let seriesRow: any = null;
  const lockSuffix = client ? " FOR UPDATE" : "";

  if (client) {
    if (fyId) {
      const r = await client.query(
        `SELECT * FROM voucher_series WHERE transaction_type=$1 AND financial_year_id=$2 AND is_active=true LIMIT 1${lockSuffix}`,
        [transactionType, fyId]
      );
      seriesRow = r.rows[0] || null;
    }
    if (!seriesRow) {
      const r = await client.query(
        `SELECT * FROM voucher_series WHERE transaction_type=$1 AND is_active=true LIMIT 1${lockSuffix}`,
        [transactionType]
      );
      seriesRow = r.rows[0] || null;
    }
  } else {
    if (fyId) {
      const r = await db.execute(sql`SELECT * FROM voucher_series WHERE transaction_type = ${transactionType} AND financial_year_id = ${fyId} AND is_active = true LIMIT 1`);
      seriesRow = r.rows[0] || null;
    }
    if (!seriesRow) {
      const r = await db.execute(sql`SELECT * FROM voucher_series WHERE transaction_type = ${transactionType} AND is_active = true LIMIT 1`);
      seriesRow = r.rows[0] || null;
    }
  }

  if (!seriesRow) {
    return `${transactionType.slice(0, 3).toUpperCase()}${Date.now()}`;
  }

  const prefix = seriesRow.prefix || "";
  const digits = seriesRow.digits || 5;
  const startingNum = seriesRow.starting_number || 1;
  let counterNum = seriesRow.current_number || startingNum;

  // Sync counter with actual max in the target table to recover from counter drift.
  // IMPORTANT: Always use db.execute (a separate pool connection) here — never the client
  // transaction connection — so that a missing table error cannot abort the outer transaction.
  const tableName = TYPE_TABLE[transactionType];
  if (tableName) {
    try {
      const maxRes = await db.execute(sql.raw(
        `SELECT MAX(
           CASE WHEN voucher_no ~ '[0-9]+$'
                THEN CAST(SUBSTRING(voucher_no FROM '[0-9]+$') AS INTEGER)
                ELSE 0
           END
         ) AS max_num FROM "${tableName}"`
      ));
      const maxInTable: number = parseInt((maxRes as any).rows?.[0]?.max_num ?? "0", 10) || 0;
      if (maxInTable >= counterNum) {
        counterNum = maxInTable + 1;
      }
    } catch (_) {
      // table may not exist yet — proceed with counter value
    }
  }

  // Persist the incremented counter (GREATEST ensures we never go backwards)
  if (client) {
    await client.query(
      `UPDATE voucher_series SET current_number = GREATEST(current_number, $2) + 1 WHERE id = $1`,
      [seriesRow.id, counterNum]
    );
  } else {
    await db.execute(
      sql`UPDATE voucher_series SET current_number = GREATEST(current_number, ${counterNum}) + 1 WHERE id = ${seriesRow.id}`
    );
  }

  return `${prefix}${String(counterNum).padStart(digits, "0")}`;
}
