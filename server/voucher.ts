import { db } from "./db";
import { sql } from "drizzle-orm";

export async function generateVoucherNo(
  transactionType: string,
  client?: any
): Promise<string> {
  const query = client
    ? (q: string, params?: any[]) => client.query(q, params)
    : (q: string) => db.execute(sql.raw(q));

  const exec = async (rawSql: string, params?: any[]) => {
    if (client) {
      return client.query(rawSql, params);
    } else {
      return db.execute(sql.raw(rawSql));
    }
  };

  // Find active financial year
  let fyId: string | null = null;
  if (client) {
    const fyRes = await client.query(
      `SELECT id FROM financial_years WHERE is_current = true LIMIT 1`
    );
    fyId = fyRes.rows[0]?.id || null;
  } else {
    const fyRows = await db.execute(sql`SELECT id FROM financial_years WHERE is_current = true LIMIT 1`);
    fyId = (fyRows.rows[0] as any)?.id || null;
  }

  // Find matching voucher series
  let seriesRow: any = null;
  if (client) {
    if (fyId) {
      const r = await client.query(
        `SELECT * FROM voucher_series WHERE transaction_type=$1 AND financial_year_id=$2 AND is_active=true LIMIT 1`,
        [transactionType, fyId]
      );
      seriesRow = r.rows[0] || null;
    }
    if (!seriesRow) {
      const r = await client.query(
        `SELECT * FROM voucher_series WHERE transaction_type=$1 AND is_active=true LIMIT 1`,
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
  const num = seriesRow.current_number || seriesRow.starting_number || 1;

  // Atomically increment current_number — runs inside the caller's transaction if client provided
  if (client) {
    await client.query(
      `UPDATE voucher_series SET current_number = current_number + 1 WHERE id = $1`,
      [seriesRow.id]
    );
  } else {
    await db.execute(sql`UPDATE voucher_series SET current_number = current_number + 1 WHERE id = ${seriesRow.id}`);
  }

  return `${prefix}${String(num).padStart(digits, "0")}`;
}
