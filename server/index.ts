import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { setupAuth } from "./auth";
import { createServer } from "http";
import path from "path";
import fs from "fs";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(express.json({ limit: "10mb", verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: false }));

// Ensure uploads dir exists
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      log(logLine);
    }
  });
  next();
});

(async () => {
  // ── Auto-migrate: ensure process-module tables exist ──────────────
  try {
    const { pool } = await import("./db");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS processes (
        id TEXT DEFAULT gen_random_uuid() PRIMARY KEY,
        code TEXT, name TEXT, price NUMERIC(14,3) DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS process_outward (
        id TEXT DEFAULT gen_random_uuid() PRIMARY KEY,
        voucher_no TEXT, outward_date DATE,
        supplier_id TEXT, supplier_name_manual TEXT,
        vehicle_no TEXT, purpose TEXT, notes TEXT, status TEXT,
        is_returnable BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW()
      );
      ALTER TABLE process_outward ADD COLUMN IF NOT EXISTS is_returnable BOOLEAN DEFAULT FALSE;
      CREATE TABLE IF NOT EXISTS process_outward_items (
        id TEXT DEFAULT gen_random_uuid() PRIMARY KEY,
        outward_id TEXT, seq_no INTEGER DEFAULT 0,
        customer_ref TEXT, item_id TEXT, item_code TEXT,
        item_name TEXT, drawing_no TEXT, hsn TEXT,
        process_nature TEXT, bill_ref TEXT,
        qty NUMERIC(14,3) DEFAULT 0, unit TEXT
      );
      CREATE TABLE IF NOT EXISTS process_inward (
        id TEXT DEFAULT gen_random_uuid() PRIMARY KEY,
        voucher_no TEXT, inward_date DATE, outward_id TEXT,
        supplier_id TEXT, supplier_name_manual TEXT,
        supplier_invoice_no TEXT, supplier_invoice_date DATE,
        taxable_amount NUMERIC(14,3) DEFAULT 0, cgst_amount NUMERIC(14,3) DEFAULT 0,
        sgst_amount NUMERIC(14,3) DEFAULT 0, igst_amount NUMERIC(14,3) DEFAULT 0,
        total_amount NUMERIC(14,3) DEFAULT 0, payment_mode TEXT,
        payment_account_id TEXT, expense_gl_id TEXT,
        notes TEXT, status TEXT, voucher_mas_id TEXT, created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS process_inward_items (
        id TEXT DEFAULT gen_random_uuid() PRIMARY KEY,
        inward_id TEXT, seq_no INTEGER DEFAULT 0, outward_item_id TEXT,
        item_id TEXT, item_code TEXT, item_name TEXT, hsn TEXT,
        qty NUMERIC(14,3) DEFAULT 0, unit TEXT, rate NUMERIC(14,3) DEFAULT 0,
        taxable_amount NUMERIC(14,3) DEFAULT 0,
        cgst_rate NUMERIC(14,3) DEFAULT 0, sgst_rate NUMERIC(14,3) DEFAULT 0,
        igst_rate NUMERIC(14,3) DEFAULT 0, cgst_amount NUMERIC(14,3) DEFAULT 0,
        sgst_amount NUMERIC(14,3) DEFAULT 0, igst_amount NUMERIC(14,3) DEFAULT 0,
        amount NUMERIC(14,3) DEFAULT 0
      );
      INSERT INTO voucher_series (transaction_type, transaction_label, prefix, digits, starting_number, current_number, is_active)
      SELECT 'process_outward','Process Outward DC','PO-DC',4,1,1,true
      WHERE NOT EXISTS (SELECT 1 FROM voucher_series WHERE transaction_type='process_outward');
      INSERT INTO voucher_series (transaction_type, transaction_label, prefix, digits, starting_number, current_number, is_active)
      SELECT 'process_inward','Process Inward Invoice','PI',4,1,1,true
      WHERE NOT EXISTS (SELECT 1 FROM voucher_series WHERE transaction_type='process_inward');
    `);
    log("Process tables ready", "migrate");
  } catch (e: any) {
    console.error("[migrate] Process tables setup error:", e.message);
  }

  setupAuth(app);
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`serving on port ${port}`);
  });
})();
