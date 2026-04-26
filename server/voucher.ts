import { db } from "./db";
import { sql } from "drizzle-orm";

export async function generateVoucherNo(transactionType: string): Promise<string> {
  // Find the active financial year
  const fyRows = await db.execute(sql`SELECT id FROM financial_years WHERE is_current = true LIMIT 1`);
  const fyId = (fyRows.rows[0] as any)?.id;

  // Find the series
  let seriesRow: any;
  if (fyId) {
    const r = await db.execute(sql`SELECT * FROM voucher_series WHERE transaction_type = ${transactionType} AND financial_year_id = ${fyId} AND is_active = true LIMIT 1`);
    seriesRow = r.rows[0];
  }
  if (!seriesRow) {
    // fallback: no FY match, try without FY
    const r = await db.execute(sql`SELECT * FROM voucher_series WHERE transaction_type = ${transactionType} AND is_active = true LIMIT 1`);
    seriesRow = r.rows[0];
  }

  if (!seriesRow) {
    // Last resort: generate a simple timestamp-based number
    return `${transactionType.slice(0, 3).toUpperCase()}${Date.now()}`;
  }

  const prefix = seriesRow.prefix || "";
  const digits = seriesRow.digits || 5;
  const num = seriesRow.current_number || seriesRow.starting_number || 1;

  // Atomically increment current_number
  await db.execute(sql`UPDATE voucher_series SET current_number = current_number + 1 WHERE id = ${seriesRow.id}`);

  return `${prefix}${String(num).padStart(digits, "0")}`;
}
