#!/usr/bin/env node
// Run this on the VPS once to create all process-related tables:
// node script/migrate-vps.js

const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const migrations = [
  {
    name: "processes",
    sql: `
      CREATE TABLE IF NOT EXISTS processes (
        id TEXT DEFAULT gen_random_uuid() PRIMARY KEY,
        code TEXT,
        name TEXT,
        price NUMERIC(14,3) DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `,
  },
  {
    name: "process_outward",
    sql: `
      CREATE TABLE IF NOT EXISTS process_outward (
        id TEXT DEFAULT gen_random_uuid() PRIMARY KEY,
        voucher_no TEXT,
        outward_date DATE,
        supplier_id TEXT,
        supplier_name_manual TEXT,
        vehicle_no TEXT,
        purpose TEXT,
        notes TEXT,
        status TEXT,
        is_returnable BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `,
  },
  {
    name: "process_outward.is_returnable column (safe add)",
    sql: `
      ALTER TABLE process_outward
        ADD COLUMN IF NOT EXISTS is_returnable BOOLEAN DEFAULT FALSE
    `,
  },
  {
    name: "process_outward_items",
    sql: `
      CREATE TABLE IF NOT EXISTS process_outward_items (
        id TEXT DEFAULT gen_random_uuid() PRIMARY KEY,
        outward_id TEXT,
        seq_no INTEGER DEFAULT 0,
        customer_ref TEXT,
        item_id TEXT,
        item_code TEXT,
        item_name TEXT,
        drawing_no TEXT,
        hsn TEXT,
        process_nature TEXT,
        bill_ref TEXT,
        qty NUMERIC(14,3) DEFAULT 0,
        unit TEXT
      )
    `,
  },
  {
    name: "process_inward",
    sql: `
      CREATE TABLE IF NOT EXISTS process_inward (
        id TEXT DEFAULT gen_random_uuid() PRIMARY KEY,
        voucher_no TEXT,
        inward_date DATE,
        outward_id TEXT,
        supplier_id TEXT,
        supplier_name_manual TEXT,
        supplier_invoice_no TEXT,
        supplier_invoice_date DATE,
        taxable_amount NUMERIC(14,3) DEFAULT 0,
        cgst_amount NUMERIC(14,3) DEFAULT 0,
        sgst_amount NUMERIC(14,3) DEFAULT 0,
        igst_amount NUMERIC(14,3) DEFAULT 0,
        total_amount NUMERIC(14,3) DEFAULT 0,
        payment_mode TEXT,
        payment_account_id TEXT,
        expense_gl_id TEXT,
        notes TEXT,
        status TEXT,
        voucher_mas_id TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `,
  },
  {
    name: "process_inward_items",
    sql: `
      CREATE TABLE IF NOT EXISTS process_inward_items (
        id TEXT DEFAULT gen_random_uuid() PRIMARY KEY,
        inward_id TEXT,
        seq_no INTEGER DEFAULT 0,
        outward_item_id TEXT,
        item_id TEXT,
        item_code TEXT,
        item_name TEXT,
        hsn TEXT,
        qty NUMERIC(14,3) DEFAULT 0,
        unit TEXT,
        rate NUMERIC(14,3) DEFAULT 0,
        taxable_amount NUMERIC(14,3) DEFAULT 0,
        cgst_rate NUMERIC(14,3) DEFAULT 0,
        sgst_rate NUMERIC(14,3) DEFAULT 0,
        igst_rate NUMERIC(14,3) DEFAULT 0,
        cgst_amount NUMERIC(14,3) DEFAULT 0,
        sgst_amount NUMERIC(14,3) DEFAULT 0,
        igst_amount NUMERIC(14,3) DEFAULT 0,
        amount NUMERIC(14,3) DEFAULT 0
      )
    `,
  },
  {
    name: "voucher_series: process_outward entry",
    sql: `
      INSERT INTO voucher_series (transaction_type, transaction_label, prefix, digits, starting_number, current_number, is_active)
      SELECT 'process_outward','Process Outward DC','PO-DC',4,1,1,true
      WHERE NOT EXISTS (
        SELECT 1 FROM voucher_series WHERE transaction_type = 'process_outward'
      )
    `,
  },
  {
    name: "voucher_series: process_inward entry",
    sql: `
      INSERT INTO voucher_series (transaction_type, transaction_label, prefix, digits, starting_number, current_number, is_active)
      SELECT 'process_inward','Process Inward Invoice','PI',4,1,1,true
      WHERE NOT EXISTS (
        SELECT 1 FROM voucher_series WHERE transaction_type = 'process_inward'
      )
    `,
  },
];

async function run() {
  const client = await pool.connect();
  let ok = 0, fail = 0;
  try {
    for (const m of migrations) {
      try {
        await client.query(m.sql);
        console.log(`  ✓  ${m.name}`);
        ok++;
      } catch (e) {
        console.error(`  ✗  ${m.name}: ${e.message}`);
        fail++;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
  console.log(`\nDone: ${ok} succeeded, ${fail} failed.`);
  if (fail > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
