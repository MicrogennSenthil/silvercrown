import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import passport from "passport";
import multer from "multer";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { requireAuth } from "./auth";
import { insertSupplierSchema, insertCustomerSchema, insertInventoryItemSchema, insertInventoryCategorySchema, insertPurchaseInvoiceSchema, insertSalesInvoiceSchema, insertTaskSchema, insertAccountSchema, insertJournalEntrySchema } from "@shared/schema";

const upload = multer({ dest: "uploads/", limits: { fileSize: 10 * 1024 * 1024 } });

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {

  // Auth routes
  app.post("/api/auth/login", (req: Request, res: Response, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Invalid credentials" });
      req.logIn(user, (err) => {
        if (err) return next(err);
        const { password: _, ...safeUser } = user;
        return res.json({ user: safeUser });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout(() => res.json({ ok: true }));
  });

  app.get("/api/auth/me", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
    const { password: _, ...safeUser } = req.user as any;
    res.json({ user: safeUser });
  });

  // Dashboard
  app.get("/api/dashboard/stats", requireAuth, async (_req, res) => {
    const stats = await storage.getDashboardStats();
    res.json(stats);
  });

  // Suppliers
  app.get("/api/suppliers", requireAuth, async (_req, res) => res.json(await storage.listSuppliers()));
  app.post("/api/suppliers", requireAuth, async (req, res) => {
    const data = insertSupplierSchema.parse(req.body);
    res.json(await storage.createSupplier(data));
  });
  app.patch("/api/suppliers/:id", requireAuth, async (req, res) => {
    res.json(await storage.updateSupplier(req.params.id, req.body));
  });
  app.delete("/api/suppliers/:id", requireAuth, async (req, res) => {
    await storage.deleteSupplier(req.params.id);
    res.json({ ok: true });
  });

  // Customers
  app.get("/api/customers", requireAuth, async (_req, res) => res.json(await storage.listCustomers()));
  app.post("/api/customers", requireAuth, async (req, res) => {
    const data = insertCustomerSchema.parse(req.body);
    res.json(await storage.createCustomer(data));
  });
  app.patch("/api/customers/:id", requireAuth, async (req, res) => {
    res.json(await storage.updateCustomer(req.params.id, req.body));
  });
  app.delete("/api/customers/:id", requireAuth, async (req, res) => {
    await storage.deleteCustomer(req.params.id);
    res.json({ ok: true });
  });

  // Inventory Categories
  app.get("/api/inventory/categories", requireAuth, async (_req, res) => res.json(await storage.listInventoryCategories()));
  app.post("/api/inventory/categories", requireAuth, async (req, res) => {
    const data = insertInventoryCategorySchema.parse(req.body);
    res.json(await storage.createInventoryCategory(data));
  });
  app.patch("/api/inventory/categories/:id", requireAuth, async (req, res) => {
    res.json(await storage.updateInventoryCategory(req.params.id, req.body));
  });
  app.delete("/api/inventory/categories/:id", requireAuth, async (req, res) => {
    await storage.deleteInventoryCategory(req.params.id);
    res.json({ ok: true });
  });

  // Inventory Items
  app.get("/api/inventory/items", requireAuth, async (_req, res) => res.json(await storage.listInventoryItems()));
  app.post("/api/inventory/items", requireAuth, async (req, res) => {
    const data = insertInventoryItemSchema.parse(req.body);
    res.json(await storage.createInventoryItem(data));
  });
  app.patch("/api/inventory/items/:id", requireAuth, async (req, res) => {
    res.json(await storage.updateInventoryItem(req.params.id, req.body));
  });
  app.delete("/api/inventory/items/:id", requireAuth, async (req, res) => {
    await storage.deleteInventoryItem(req.params.id);
    res.json({ ok: true });
  });

  // Purchase Invoices
  app.get("/api/purchase/invoices", requireAuth, async (_req, res) => res.json(await storage.listPurchaseInvoices()));
  app.get("/api/purchase/invoices/:id", requireAuth, async (req, res) => {
    const inv = await storage.getPurchaseInvoice(req.params.id);
    if (!inv) return res.status(404).json({ message: "Not found" });
    const items = await storage.listPurchaseInvoiceItems(req.params.id);
    res.json({ ...inv, items });
  });
  app.post("/api/purchase/invoices", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { items = [], ...invData } = req.body;
      const invRes = await client.query(`
        INSERT INTO purchase_invoices
          (id, invoice_number, supplier_id, supplier_name, invoice_date, due_date,
           subtotal, tax_amount, total_amount, paid_amount, status, notes, scanned_image_url)
        VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *
      `, [invData.invoiceNumber || invData.invoice_number,
          invData.supplierId || invData.supplier_id || null,
          invData.supplierName || invData.supplier_name || "",
          invData.invoiceDate || invData.invoice_date || null,
          invData.dueDate || invData.due_date || null,
          invData.subtotal || 0, invData.taxAmount || invData.tax_amount || 0,
          invData.totalAmount || invData.total_amount || 0,
          invData.paidAmount || invData.paid_amount || 0,
          invData.status || "pending", invData.notes || "",
          invData.scannedImageUrl || invData.scanned_image_url || null]);
      const inv = invRes.rows[0];
      for (const item of items) {
        await client.query(`
          INSERT INTO purchase_invoice_items
            (id, invoice_id, item_id, description, quantity, unit, unit_price, tax_rate, tax_amount, amount)
          VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9)
        `, [inv.id, item.itemId || null, item.description || "",
            item.quantity || 0, item.unit || "", item.unitPrice || 0,
            item.taxRate || 0, item.taxAmount || 0, item.amount || 0]);
      }
      await client.query("COMMIT");
      res.json(inv);
    } catch (e: any) {
      await client.query("ROLLBACK");
      console.error("Purchase invoice create error:", e.message);
      res.status(400).json({ message: e.message });
    } finally { client.release(); }
  });
  app.patch("/api/purchase/invoices/:id", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { items, ...invData } = req.body;
      const invRes = await client.query(`
        UPDATE purchase_invoices SET
          invoice_number=$1, supplier_id=$2, supplier_name=$3, invoice_date=$4, due_date=$5,
          subtotal=$6, tax_amount=$7, total_amount=$8, paid_amount=$9, status=$10, notes=$11,
          updated_at=NOW()
        WHERE id=$12 RETURNING *
      `, [invData.invoiceNumber, invData.supplierId || null, invData.supplierName || "",
          invData.invoiceDate || null, invData.dueDate || null,
          invData.subtotal || 0, invData.taxAmount || 0, invData.totalAmount || 0,
          invData.paidAmount || 0, invData.status || "Pending", invData.notes || "",
          req.params.id]);
      if (items !== undefined) {
        await client.query(`DELETE FROM purchase_invoice_items WHERE invoice_id=$1`, [req.params.id]);
        for (const item of items || []) {
          await client.query(`
            INSERT INTO purchase_invoice_items
              (id, invoice_id, item_id, description, quantity, unit, unit_price, tax_rate, tax_amount, amount)
            VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9)
          `, [req.params.id, item.itemId || null, item.description || "",
              item.quantity || 0, item.unit || "", item.unitPrice || 0,
              item.taxRate || 0, item.taxAmount || 0, item.amount || 0]);
        }
      }
      await client.query("COMMIT");
      res.json(invRes.rows[0]);
    } catch (e: any) {
      await client.query("ROLLBACK");
      console.error("Purchase invoice update error:", e.message);
      res.status(400).json({ message: e.message });
    } finally { client.release(); }
  });
  app.delete("/api/purchase/invoices/:id", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM purchase_invoice_items WHERE invoice_id=$1`, [req.params.id]);
      await client.query(`DELETE FROM purchase_invoices WHERE id=$1`, [req.params.id]);
      await client.query("COMMIT");
      res.json({ ok: true });
    } catch (e: any) {
      await client.query("ROLLBACK");
      res.status(400).json({ message: e.message });
    } finally { client.release(); }
  });

  // Gemini Invoice Scanning
  app.post("/api/purchase/scan", requireAuth, upload.single("invoice"), async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ message: "Gemini API key not configured" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
      const imageData = fs.readFileSync(req.file.path);
      const base64Image = imageData.toString("base64");
      const mimeType = req.file.mimetype as "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
      const prompt = `Analyze this purchase invoice image and extract all details in JSON format. Return ONLY valid JSON with this structure:
{
  "supplierName": "supplier name",
  "invoiceNumber": "invoice number",
  "invoiceDate": "YYYY-MM-DD",
  "dueDate": "YYYY-MM-DD or empty",
  "items": [
    { "description": "item name", "quantity": number, "unit": "Nos/Kg/etc", "unitPrice": number, "taxRate": number, "amount": number }
  ],
  "subtotal": number,
  "taxAmount": number,
  "totalAmount": number,
  "notes": "any additional notes"
}`;
      const result = await model.generateContent([
        prompt,
        { inlineData: { mimeType, data: base64Image } },
      ]);
      const text = result.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return res.status(422).json({ message: "Could not extract invoice data" });
      const extracted = JSON.parse(jsonMatch[0]);
      fs.unlinkSync(req.file.path);
      res.json(extracted);
    } catch (err: any) {
      if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
      res.status(500).json({ message: err.message || "Scan failed" });
    }
  });

  // Sales Invoices
  app.get("/api/sales/invoices", requireAuth, async (_req, res) => res.json(await storage.listSalesInvoices()));
  app.get("/api/sales/invoices/:id", requireAuth, async (req, res) => {
    const inv = await storage.getSalesInvoice(req.params.id);
    if (!inv) return res.status(404).json({ message: "Not found" });
    const items = await storage.listSalesInvoiceItems(req.params.id);
    res.json({ ...inv, items });
  });
  app.post("/api/sales/invoices", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { items = [], ...invData } = req.body;
      const invRes = await client.query(`
        INSERT INTO sales_invoices
          (id, invoice_number, customer_id, customer_name, invoice_date, due_date,
           subtotal, tax_amount, total_amount, paid_amount, status, notes)
        VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *
      `, [invData.invoiceNumber || invData.invoice_number,
          invData.customerId || invData.customer_id || null,
          invData.customerName || invData.customer_name || "",
          invData.invoiceDate || invData.invoice_date || null,
          invData.dueDate || invData.due_date || null,
          invData.subtotal || 0, invData.taxAmount || invData.tax_amount || 0,
          invData.totalAmount || invData.total_amount || 0,
          invData.paidAmount || invData.paid_amount || 0,
          invData.status || "pending", invData.notes || ""]);
      const inv = invRes.rows[0];
      for (const item of items) {
        await client.query(`
          INSERT INTO sales_invoice_items
            (id, invoice_id, item_id, description, quantity, unit, unit_price, tax_rate, tax_amount, amount)
          VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9)
        `, [inv.id, item.itemId || null, item.description || "",
            item.quantity || 0, item.unit || "", item.unitPrice || 0,
            item.taxRate || 0, item.taxAmount || 0, item.amount || 0]);
      }
      await client.query("COMMIT");
      res.json(inv);
    } catch (e: any) {
      await client.query("ROLLBACK");
      console.error("Sales invoice create error:", e.message);
      res.status(400).json({ message: e.message });
    } finally { client.release(); }
  });
  app.patch("/api/sales/invoices/:id", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { items, ...invData } = req.body;
      const invRes = await client.query(`
        UPDATE sales_invoices SET
          invoice_number=$1, customer_id=$2, customer_name=$3, invoice_date=$4, due_date=$5,
          subtotal=$6, tax_amount=$7, total_amount=$8, paid_amount=$9, status=$10, notes=$11,
          updated_at=NOW()
        WHERE id=$12 RETURNING *
      `, [invData.invoiceNumber, invData.customerId || null, invData.customerName || "",
          invData.invoiceDate || null, invData.dueDate || null,
          invData.subtotal || 0, invData.taxAmount || 0, invData.totalAmount || 0,
          invData.paidAmount || 0, invData.status || "Pending", invData.notes || "",
          req.params.id]);
      if (items !== undefined) {
        await client.query(`DELETE FROM sales_invoice_items WHERE invoice_id=$1`, [req.params.id]);
        for (const item of items || []) {
          await client.query(`
            INSERT INTO sales_invoice_items
              (id, invoice_id, item_id, description, quantity, unit, unit_price, tax_rate, tax_amount, amount)
            VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9)
          `, [req.params.id, item.itemId || null, item.description || "",
              item.quantity || 0, item.unit || "", item.unitPrice || 0,
              item.taxRate || 0, item.taxAmount || 0, item.amount || 0]);
        }
      }
      await client.query("COMMIT");
      res.json(invRes.rows[0]);
    } catch (e: any) {
      await client.query("ROLLBACK");
      console.error("Sales invoice update error:", e.message);
      res.status(400).json({ message: e.message });
    } finally { client.release(); }
  });
  app.delete("/api/sales/invoices/:id", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM sales_invoice_items WHERE invoice_id=$1`, [req.params.id]);
      await client.query(`DELETE FROM sales_invoices WHERE id=$1`, [req.params.id]);
      await client.query("COMMIT");
      res.json({ ok: true });
    } catch (e: any) {
      await client.query("ROLLBACK");
      res.status(400).json({ message: e.message });
    } finally { client.release(); }
  });

  // Accounts
  app.get("/api/accounts", requireAuth, async (_req, res) => res.json(await storage.listAccounts()));
  app.post("/api/accounts", requireAuth, async (req, res) => {
    const data = insertAccountSchema.parse(req.body);
    res.json(await storage.createAccount(data));
  });
  app.patch("/api/accounts/:id", requireAuth, async (req, res) => {
    res.json(await storage.updateAccount(req.params.id, req.body));
  });
  app.delete("/api/accounts/:id", requireAuth, async (req, res) => {
    await storage.deleteAccount(req.params.id);
    res.json({ ok: true });
  });

  // Journal Entries
  app.get("/api/journal", requireAuth, async (_req, res) => res.json(await storage.listJournalEntries()));
  app.get("/api/journal/:id", requireAuth, async (req, res) => {
    const entry = await storage.getJournalEntry(req.params.id);
    if (!entry) return res.status(404).json({ message: "Not found" });
    const lines = await storage.listJournalEntryLines(req.params.id);
    res.json({ ...entry, lines });
  });
  app.post("/api/journal", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { lines = [], ...entryData } = req.body;
      const entryRes = await client.query(`
        INSERT INTO journal_entries
          (id, entry_number, date, description, reference, total_debit, total_credit)
        VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6)
        RETURNING *
      `, [entryData.entryNumber || entryData.entry_number,
          entryData.date || null,
          entryData.description || "",
          entryData.reference || "",
          entryData.totalDebit || entryData.total_debit || 0,
          entryData.totalCredit || entryData.total_credit || 0]);
      const entry = entryRes.rows[0];
      for (const line of lines) {
        await client.query(`
          INSERT INTO journal_entry_lines
            (id, entry_id, account_id, account_name, description, debit, credit)
          VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6)
        `, [entry.id, line.accountId || null, line.accountName || "",
            line.description || "", line.debit || 0, line.credit || 0]);
      }
      await client.query("COMMIT");
      res.json(entry);
    } catch (e: any) {
      await client.query("ROLLBACK");
      console.error("Journal entry create error:", e.message);
      res.status(400).json({ message: e.message });
    } finally { client.release(); }
  });

  // Tasks
  app.get("/api/tasks", requireAuth, async (_req, res) => res.json(await storage.listTasks()));
  app.post("/api/tasks", requireAuth, async (req, res) => {
    const data = insertTaskSchema.parse(req.body);
    res.json(await storage.createTask(data));
  });
  app.patch("/api/tasks/:id", requireAuth, async (req, res) => {
    res.json(await storage.updateTask(req.params.id, req.body));
  });
  app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
    await storage.deleteTask(req.params.id);
    res.json({ ok: true });
  });

  // Tally Sync Logs
  app.get("/api/tally/logs", requireAuth, async (_req, res) => res.json(await storage.listTallySyncLogs()));
  app.post("/api/tally/sync", requireAuth, async (req, res) => {
    const { syncType } = req.body;
    // Simulate Tally sync
    await new Promise(r => setTimeout(r, 1500));
    const log = await storage.createTallySyncLog({ syncType: syncType || "full", status: "success", recordsSynced: Math.floor(Math.random() * 50) + 1, errorMessage: "" });
    res.json(log);
  });

  // Users
  app.get("/api/users", requireAuth, async (_req, res) => {
    const list = await storage.listUsers();
    res.json(list.map(({ password: _, ...u }) => u));
  });
  app.post("/api/users", requireAuth, async (req, res) => {
    try {
      const u = await storage.createUser(req.body);
      const { password: _, ...safe } = u;
      res.json(safe);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });
  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    try {
      const u = await storage.updateUser(req.params.id, req.body);
      const { password: _, ...safe } = u;
      res.json(safe);
    } catch (err: any) { res.status(400).json({ message: err.message }); }
  });
  app.delete("/api/users/:id", requireAuth, async (req, res) => {
    await storage.deleteUser(req.params.id); res.json({ ok: true });
  });

  // Employees
  app.get("/api/employees", requireAuth, async (_req, res) => res.json(await storage.listEmployees()));
  app.post("/api/employees", requireAuth, async (req, res) => {
    try { res.json(await storage.createEmployee(req.body)); } catch (err: any) { res.status(400).json({ message: err.message }); }
  });
  app.patch("/api/employees/:id", requireAuth, async (req, res) => {
    res.json(await storage.updateEmployee(req.params.id, req.body));
  });
  app.delete("/api/employees/:id", requireAuth, async (req, res) => {
    await storage.deleteEmployee(req.params.id); res.json({ ok: true });
  });

  // User Roles
  app.get("/api/user-roles", requireAuth, async (_req, res) => res.json(await storage.listUserRoles()));
  app.post("/api/user-roles", requireAuth, async (req, res) => {
    try { res.json(await storage.createUserRole(req.body)); } catch (err: any) { res.status(400).json({ message: err.message }); }
  });
  app.patch("/api/user-roles/:id", requireAuth, async (req, res) => {
    res.json(await storage.updateUserRole(req.params.id, req.body));
  });
  app.delete("/api/user-roles/:id", requireAuth, async (req, res) => {
    await storage.deleteUserRole(req.params.id); res.json({ ok: true });
  });

  // Role Rights
  app.get("/api/user-roles/:id/rights", requireAuth, async (req, res) => {
    res.json(await storage.listRoleRights(req.params.id));
  });
  app.put("/api/user-roles/:id/rights", requireAuth, async (req, res) => {
    res.json(await storage.upsertRoleRights(req.params.id, req.body.rights));
  });

  // Warehouses
  app.get("/api/warehouses", requireAuth, async (_req, res) => res.json(await storage.listWarehouses()));
  app.post("/api/warehouses", requireAuth, async (req, res) => {
    try { res.json(await storage.createWarehouse(req.body)); } catch (err: any) { res.status(400).json({ message: err.message }); }
  });
  app.patch("/api/warehouses/:id", requireAuth, async (req, res) => {
    res.json(await storage.updateWarehouse(req.params.id, req.body));
  });
  app.delete("/api/warehouses/:id", requireAuth, async (req, res) => {
    await storage.deleteWarehouse(req.params.id); res.json({ ok: true });
  });

  // Units of Measure
  app.get("/api/uom", requireAuth, async (_req, res) => res.json(await storage.listUom()));
  app.post("/api/uom", requireAuth, async (req, res) => {
    try { res.json(await storage.createUom(req.body)); } catch (err: any) { res.status(400).json({ message: err.message }); }
  });
  app.patch("/api/uom/:id", requireAuth, async (req, res) => {
    res.json(await storage.updateUom(req.params.id, req.body));
  });
  app.delete("/api/uom/:id", requireAuth, async (req, res) => {
    await storage.deleteUom(req.params.id); res.json({ ok: true });
  });

  // Processes master
  app.get("/api/processes", requireAuth, async (_req, res) => {
    try {
      const { pool } = await import("./db");
      const rows = (await pool.query(`SELECT * FROM processes ORDER BY name`)).rows;
      res.json(rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.post("/api/processes", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const { code, name, price = 0, is_active = true } = req.body;
      if (!name?.trim()) return res.status(400).json({ message: "Name is required" });
      const r = await pool.query(
        `INSERT INTO processes (id, code, name, price, is_active) VALUES (gen_random_uuid()::text, $1, $2, $3, $4) RETURNING *`,
        [code?.trim().toUpperCase() || name.trim().toUpperCase().replace(/\s+/g, "-"), name.trim(), price, is_active]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/processes/:id", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const { code, name, price, is_active } = req.body;
      const r = await pool.query(
        `UPDATE processes SET code=$1, name=$2, price=$3, is_active=$4 WHERE id=$5 RETURNING *`,
        [code, name, price ?? 0, is_active ?? true, req.params.id]
      );
      res.json(r.rows[0]);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.delete("/api/processes/:id", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      await pool.query(`DELETE FROM processes WHERE id=$1`, [req.params.id]);
      res.json({ ok: true });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Tax Rates
  app.get("/api/tax-rates", requireAuth, async (_req, res) => res.json(await storage.listTaxRates()));
  app.post("/api/tax-rates", requireAuth, async (req, res) => {
    try { res.json(await storage.createTaxRate(req.body)); } catch (err: any) { res.status(400).json({ message: err.message }); }
  });
  app.patch("/api/tax-rates/:id", requireAuth, async (req, res) => {
    res.json(await storage.updateTaxRate(req.params.id, req.body));
  });
  app.delete("/api/tax-rates/:id", requireAuth, async (req, res) => {
    await storage.deleteTaxRate(req.params.id); res.json({ ok: true });
  });

  // Countries
  app.get("/api/countries", requireAuth, async (_req, res) => res.json(await storage.listCountries()));
  app.post("/api/countries", requireAuth, async (req, res) => {
    try { res.json(await storage.createCountry(req.body)); } catch (err: any) { res.status(400).json({ message: err.message }); }
  });
  app.patch("/api/countries/:id", requireAuth, async (req, res) => {
    res.json(await storage.updateCountry(req.params.id, req.body));
  });
  app.delete("/api/countries/:id", requireAuth, async (req, res) => {
    await storage.deleteCountry(req.params.id); res.json({ ok: true });
  });

  // States
  app.get("/api/states", requireAuth, async (req, res) => {
    res.json(await storage.listStates(req.query.countryId as string | undefined));
  });
  app.post("/api/states", requireAuth, async (req, res) => {
    try { res.json(await storage.createState(req.body)); } catch (err: any) { res.status(400).json({ message: err.message }); }
  });
  app.patch("/api/states/:id", requireAuth, async (req, res) => {
    res.json(await storage.updateState(req.params.id, req.body));
  });
  app.delete("/api/states/:id", requireAuth, async (req, res) => {
    await storage.deleteState(req.params.id); res.json({ ok: true });
  });

  // Cities
  app.get("/api/cities", requireAuth, async (req, res) => {
    res.json(await storage.listCities(req.query.stateId as string | undefined));
  });
  app.post("/api/cities", requireAuth, async (req, res) => {
    try { res.json(await storage.createCity(req.body)); } catch (err: any) { res.status(400).json({ message: err.message }); }
  });
  app.patch("/api/cities/:id", requireAuth, async (req, res) => {
    res.json(await storage.updateCity(req.params.id, req.body));
  });
  app.delete("/api/cities/:id", requireAuth, async (req, res) => {
    await storage.deleteCity(req.params.id); res.json({ ok: true });
  });

  // Categories
  app.get("/api/categories", requireAuth, async (req, res) => { res.json(await storage.listCategories()); });
  app.post("/api/categories", requireAuth, async (req, res) => {
    try { res.json(await storage.createCategory(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/categories/:id", requireAuth, async (req, res) => { res.json(await storage.updateCategory(req.params.id, req.body)); });
  app.delete("/api/categories/:id", requireAuth, async (req, res) => { await storage.deleteCategory(req.params.id); res.json({ ok: true }); });

  // Sub Categories
  app.get("/api/sub-categories", requireAuth, async (req, res) => {
    res.json(await storage.listSubCategories(req.query.categoryId as string | undefined));
  });
  app.post("/api/sub-categories", requireAuth, async (req, res) => {
    try { res.json(await storage.createSubCategory(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/sub-categories/:id", requireAuth, async (req, res) => { res.json(await storage.updateSubCategory(req.params.id, req.body)); });
  app.delete("/api/sub-categories/:id", requireAuth, async (req, res) => { await storage.deleteSubCategory(req.params.id); res.json({ ok: true }); });

  // Products
  app.get("/api/products", requireAuth, async (req, res) => { res.json(await storage.listProducts()); });
  app.post("/api/products", requireAuth, async (req, res) => {
    try { res.json(await storage.createProduct(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/products/:id", requireAuth, async (req, res) => { res.json(await storage.updateProduct(req.params.id, req.body)); });
  app.delete("/api/products/:id", requireAuth, async (req, res) => { await storage.deleteProduct(req.params.id); res.json({ ok: true }); });

  // Machine Master
  app.get("/api/machines", requireAuth, async (req, res) => { res.json(await storage.listMachines()); });
  app.post("/api/machines", requireAuth, async (req, res) => {
    try { res.json(await storage.createMachine(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/machines/:id", requireAuth, async (req, res) => { res.json(await storage.updateMachine(req.params.id, req.body)); });
  app.delete("/api/machines/:id", requireAuth, async (req, res) => { await storage.deleteMachine(req.params.id); res.json({ ok: true }); });

  // Store Item Groups
  app.get("/api/store-item-groups", requireAuth, async (req, res) => { res.json(await storage.listStoreItemGroups()); });
  app.post("/api/store-item-groups", requireAuth, async (req, res) => {
    try { res.json(await storage.createStoreItemGroup(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/store-item-groups/:id", requireAuth, async (req, res) => { res.json(await storage.updateStoreItemGroup(req.params.id, req.body)); });
  app.delete("/api/store-item-groups/:id", requireAuth, async (req, res) => { await storage.deleteStoreItemGroup(req.params.id); res.json({ ok: true }); });

  // Store Item Sub Groups
  app.get("/api/store-item-sub-groups", requireAuth, async (req, res) => { res.json(await storage.listStoreItemSubGroups()); });
  app.post("/api/store-item-sub-groups", requireAuth, async (req, res) => {
    try { res.json(await storage.createStoreItemSubGroup(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/store-item-sub-groups/:id", requireAuth, async (req, res) => { res.json(await storage.updateStoreItemSubGroup(req.params.id, req.body)); });
  app.delete("/api/store-item-sub-groups/:id", requireAuth, async (req, res) => { await storage.deleteStoreItemSubGroup(req.params.id); res.json({ ok: true }); });

  // Purchase Store Items
  app.get("/api/purchase-store-items", requireAuth, async (req, res) => {
    res.json(await storage.listPurchaseStoreItems(req.query.groupId as string | undefined));
  });
  app.post("/api/purchase-store-items", requireAuth, async (req, res) => {
    try { res.json(await storage.createPurchaseStoreItem(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/purchase-store-items/:id", requireAuth, async (req, res) => { res.json(await storage.updatePurchaseStoreItem(req.params.id, req.body)); });
  app.delete("/api/purchase-store-items/:id", requireAuth, async (req, res) => { await storage.deletePurchaseStoreItem(req.params.id); res.json({ ok: true }); });

  // Purchase Approval Levels
  app.get("/api/purchase-approvals", requireAuth, async (req, res) => { res.json(await storage.listPurchaseApprovals()); });
  app.post("/api/purchase-approvals", requireAuth, async (req, res) => {
    try { res.json(await storage.createPurchaseApproval(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/purchase-approvals/:id", requireAuth, async (req, res) => { res.json(await storage.updatePurchaseApproval(req.params.id, req.body)); });
  app.delete("/api/purchase-approvals/:id", requireAuth, async (req, res) => { await storage.deletePurchaseApproval(req.params.id); res.json({ ok: true }); });

  // Voucher Types
  app.get("/api/voucher-types", requireAuth, async (req, res) => { res.json(await storage.listVoucherTypes()); });
  app.post("/api/voucher-types", requireAuth, async (req, res) => {
    try { res.json(await storage.createVoucherType(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/voucher-types/:id", requireAuth, async (req, res) => { res.json(await storage.updateVoucherType(req.params.id, req.body)); });
  app.delete("/api/voucher-types/:id", requireAuth, async (req, res) => { await storage.deleteVoucherType(req.params.id); res.json({ ok: true }); });

  // Pay Mode Types
  app.get("/api/pay-mode-types", requireAuth, async (req, res) => { res.json(await storage.listPayModeTypes()); });
  app.post("/api/pay-mode-types", requireAuth, async (req, res) => {
    try { res.json(await storage.createPayModeType(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/pay-mode-types/:id", requireAuth, async (req, res) => { res.json(await storage.updatePayModeType(req.params.id, req.body)); });
  app.delete("/api/pay-mode-types/:id", requireAuth, async (req, res) => { await storage.deletePayModeType(req.params.id); res.json({ ok: true }); });

  // Sub Ledgers
  app.get("/api/sub-ledgers", requireAuth, async (req, res) => { res.json(await storage.listSubLedgers()); });
  app.get("/api/sub-ledgers/:id", requireAuth, async (req, res) => {
    const s = await storage.getSubLedger(req.params.id);
    if (!s) return res.status(404).json({ message: "Not found" });
    const bills = await storage.listSubLedgerBills(s.id);
    res.json({ ...s, bills });
  });
  app.post("/api/sub-ledgers", requireAuth, async (req, res) => {
    try {
      const { bills = [], ...data } = req.body;
      const ledger = await storage.createSubLedger(data);
      const savedBills = await storage.replaceSubLedgerBills(ledger.id, bills);
      res.json({ ...ledger, bills: savedBills });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/sub-ledgers/:id", requireAuth, async (req, res) => {
    try {
      const { bills = [], ...data } = req.body;
      const ledger = await storage.updateSubLedger(req.params.id, data);
      const savedBills = await storage.replaceSubLedgerBills(req.params.id, bills);
      res.json({ ...ledger, bills: savedBills });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.delete("/api/sub-ledgers/:id", requireAuth, async (req, res) => { await storage.deleteSubLedger(req.params.id); res.json({ ok: true }); });

  // General Ledgers
  app.get("/api/general-ledgers", requireAuth, async (req, res) => { res.json(await storage.listGeneralLedgers()); });
  app.post("/api/general-ledgers", requireAuth, async (req, res) => {
    try { res.json(await storage.createGeneralLedger(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/general-ledgers/:id", requireAuth, async (req, res) => { res.json(await storage.updateGeneralLedger(req.params.id, req.body)); });
  app.delete("/api/general-ledgers/:id", requireAuth, async (req, res) => { await storage.deleteGeneralLedger(req.params.id); res.json({ ok: true }); });

  app.get("/api/ledger-categories", requireAuth, async (req, res) => { res.json(await storage.listLedgerCategories()); });
  app.post("/api/ledger-categories", requireAuth, async (req, res) => {
    try { res.json(await storage.createLedgerCategory(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/ledger-categories/:id", requireAuth, async (req, res) => { res.json(await storage.updateLedgerCategory(req.params.id, req.body)); });
  app.delete("/api/ledger-categories/:id", requireAuth, async (req, res) => { await storage.deleteLedgerCategory(req.params.id); res.json({ ok: true }); });

  // Term Types
  app.get("/api/term-types", requireAuth, async (req, res) => { res.json(await storage.listTermTypes()); });
  app.post("/api/term-types", requireAuth, async (req, res) => {
    try { res.json(await storage.createTermType(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/term-types/:id", requireAuth, async (req, res) => { res.json(await storage.updateTermType(req.params.id, req.body)); });
  app.delete("/api/term-types/:id", requireAuth, async (req, res) => { await storage.deleteTermType(req.params.id); res.json({ ok: true }); });

  // Terms
  app.get("/api/terms", requireAuth, async (req, res) => {
    res.json(await storage.listTerms(req.query.termTypeId as string | undefined));
  });
  app.post("/api/terms", requireAuth, async (req, res) => {
    try { res.json(await storage.createTerm(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/terms/:id", requireAuth, async (req, res) => { res.json(await storage.updateTerm(req.params.id, req.body)); });
  app.delete("/api/terms/:id", requireAuth, async (req, res) => { await storage.deleteTerm(req.params.id); res.json({ ok: true }); });

  // Departments
  app.get("/api/departments", requireAuth, async (req, res) => { res.json(await storage.listDepartments()); });
  app.post("/api/departments", requireAuth, async (req, res) => {
    try { res.json(await storage.createDepartment(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/departments/:id", requireAuth, async (req, res) => { res.json(await storage.updateDepartment(req.params.id, req.body)); });
  app.delete("/api/departments/:id", requireAuth, async (req, res) => { await storage.deleteDepartment(req.params.id); res.json({ ok: true }); });

  // Purchase Approval Config
  app.get("/api/purchase-approval-config", requireAuth, async (req, res) => { res.json(await storage.listPurchaseApprovalConfig()); });
  app.post("/api/purchase-approval-config", requireAuth, async (req, res) => {
    try { res.json(await storage.createPurchaseApprovalConfig(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/purchase-approval-config/:id", requireAuth, async (req, res) => { res.json(await storage.updatePurchaseApprovalConfig(req.params.id, req.body)); });
  app.delete("/api/purchase-approval-config/:id", requireAuth, async (req, res) => { await storage.deletePurchaseApprovalConfig(req.params.id); res.json({ ok: true }); });

  // ─── Financial Years ─────────────────────────────────────────────────────────
  app.get("/api/financial-years", requireAuth, async (_req, res) => {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    const rows = await db.execute(sql`SELECT * FROM financial_years ORDER BY start_date DESC`);
    res.json(rows.rows);
  });
  app.post("/api/financial-years", requireAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { label, start_date, end_date, is_current } = req.body;
      if (is_current) await db.execute(sql`UPDATE financial_years SET is_current = false`);
      const [row] = (await db.execute(sql`INSERT INTO financial_years (label,start_date,end_date,is_current) VALUES (${label},${start_date},${end_date},${!!is_current}) RETURNING *`)).rows;
      res.json(row);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/financial-years/:id", requireAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { label, start_date, end_date, is_current } = req.body;
      if (is_current) await db.execute(sql`UPDATE financial_years SET is_current = false`);
      const [row] = (await db.execute(sql`UPDATE financial_years SET label=${label},start_date=${start_date},end_date=${end_date},is_current=${!!is_current} WHERE id=${req.params.id} RETURNING *`)).rows;
      res.json(row);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.delete("/api/financial-years/:id", requireAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      await db.execute(sql`DELETE FROM financial_years WHERE id = ${req.params.id}`);
      res.json({ ok: true });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // ─── Voucher Series ───────────────────────────────────────────────────────────
  app.get("/api/voucher-series", requireAuth, async (_req, res) => {
    const { db } = await import("./db");
    const { sql } = await import("drizzle-orm");
    const rows = await db.execute(sql`SELECT vs.*, fy.label as fy_label FROM voucher_series vs LEFT JOIN financial_years fy ON fy.id = vs.financial_year_id ORDER BY vs.transaction_label`);
    res.json(rows.rows);
  });
  app.post("/api/voucher-series", requireAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { transaction_type, transaction_label, prefix, digits, starting_number, financial_year_id, is_active } = req.body;
      const [row] = (await db.execute(sql`INSERT INTO voucher_series (transaction_type,transaction_label,prefix,digits,starting_number,current_number,financial_year_id,is_active) VALUES (${transaction_type},${transaction_label},${prefix},${digits||5},${starting_number||1},${starting_number||1},${financial_year_id||null},${is_active!==false}) RETURNING *`)).rows;
      res.json(row);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/voucher-series/:id", requireAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { prefix, digits, starting_number, current_number, financial_year_id, is_active, transaction_label } = req.body;
      const [row] = (await db.execute(sql`UPDATE voucher_series SET prefix=${prefix},digits=${digits||5},starting_number=${starting_number||1},current_number=${current_number!=null?current_number:starting_number},financial_year_id=${financial_year_id||null},is_active=${is_active!==false},transaction_label=${transaction_label} WHERE id=${req.params.id} RETURNING *`)).rows;
      res.json(row);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.delete("/api/voucher-series/:id", requireAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      await db.execute(sql`DELETE FROM voucher_series WHERE id = ${req.params.id}`);
      res.json({ ok: true });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });

  // Preview next voucher number without consuming it
  app.get("/api/voucher-series/next/:type", requireAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const fyRows = await db.execute(sql`SELECT id FROM financial_years WHERE is_current = true LIMIT 1`);
      const fyId = (fyRows.rows[0] as any)?.id;
      let seriesRow: any;
      if (fyId) {
        const r = await db.execute(sql`SELECT * FROM voucher_series WHERE transaction_type = ${req.params.type} AND financial_year_id = ${fyId} AND is_active = true LIMIT 1`);
        seriesRow = r.rows[0];
      }
      if (!seriesRow) {
        const r = await db.execute(sql`SELECT * FROM voucher_series WHERE transaction_type = ${req.params.type} AND is_active = true LIMIT 1`);
        seriesRow = r.rows[0];
      }
      if (!seriesRow) return res.json({ voucher_no: `${req.params.type.slice(0, 3).toUpperCase()}${Date.now()}` });
      const num = seriesRow.current_number || seriesRow.starting_number || 1;
      const preview = `${seriesRow.prefix}${String(num).padStart(seriesRow.digits, "0")}`;
      res.json({ voucher_no: preview });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── AI: Extract DC from image ──────────────────────────────────────────────
  app.post("/api/ai/extract-dc", requireAuth, upload.single("file"), async (req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const rows = await db.execute(sql`SELECT key, value FROM app_settings WHERE category = 'AI Configuration'`);
      const cfg: Record<string, string> = {};
      rows.rows.forEach((r: any) => { cfg[r.key] = r.value; });

      const provider = cfg["ai_provider"] || "gemini";
      const model = cfg["ai_model"] || "gemini-2.0-flash";
      const apiKey = provider === "gemini" ? cfg["gemini_api_key"] : cfg["groq_api_key"];

      if (!apiKey) return res.status(400).json({ message: `${provider === "gemini" ? "Gemini" : "Groq"} API key not configured. Please set it in Software Setup → AI Configuration.` });

      const filePath = (req as any).file?.path;
      if (!filePath) return res.status(400).json({ message: "No file uploaded" });

      const imageData = fs.readFileSync(filePath);
      const base64 = imageData.toString("base64");
      const mimeType = (req as any).file?.mimetype || "image/jpeg";

      const prompt = `You are an OCR assistant for an Indian manufacturing ERP. Extract data from this Delivery Challan / DC image.
Return ONLY valid JSON with exactly this structure (no markdown, no explanation):
{
  "partyName": "string",
  "dcNo": "string",
  "dcDate": "YYYY-MM-DD or empty string",
  "deliveryDate": "YYYY-MM-DD or empty string",
  "vehicleNo": "string",
  "items": [
    { "itemCode": "string", "itemName": "string", "qty": number, "unit": "string", "process": "string", "hsn": "string", "remark": "string" }
  ]
}`;

      let extracted: any = {};

      if (provider === "gemini") {
        const genAI = new GoogleGenerativeAI(apiKey);
        const gModel = genAI.getGenerativeModel({ model });
        const result = await gModel.generateContent([
          { inlineData: { data: base64, mimeType } },
          prompt,
        ]);
        const text = result.response.text().trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
        extracted = JSON.parse(text);
      } else {
        // Groq via fetch (vision models)
        const groqMime = mimeType === "application/pdf" ? "image/jpeg" : mimeType;
        const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{
              role: "user",
              content: [
                { type: "image_url", image_url: { url: `data:${groqMime};base64,${base64}` } },
                { type: "text", text: prompt }
              ]
            }],
            max_tokens: 2000,
            temperature: 0.1,
          }),
        });
        const jResp = await resp.json() as any;
        if (jResp.error) throw new Error(jResp.error.message || JSON.stringify(jResp.error));
        const rawText = jResp.choices?.[0]?.message?.content || "{}";
        const text = rawText.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "").replace(/^```\n?/, "").replace(/\n?```$/, "");
        extracted = JSON.parse(text);
      }

      // Cleanup temp file
      try { fs.unlinkSync(filePath); } catch {}
      res.json(extracted);
    } catch (e: any) {
      console.error("AI extract error:", e.message);
      res.status(500).json({ message: e.message || "AI extraction failed" });
    }
  });

  // ─── Job Work Inward ─────────────────────────────────────────────────────────
  app.get("/api/job-work-inward", requireAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const rows = await db.execute(sql`SELECT j.*, c.name as party_name_db FROM job_work_inward j LEFT JOIN customers c ON c.id = j.party_id ORDER BY j.created_at DESC`);
      res.json(rows.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.get("/api/job-work-inward/:id", requireAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const [header] = (await db.execute(sql`SELECT j.*, c.name as party_name_db FROM job_work_inward j LEFT JOIN customers c ON c.id = j.party_id WHERE j.id = ${req.params.id}`)).rows;
      if (!header) return res.status(404).json({ message: "Not found" });
      const items = (await db.execute(sql`SELECT * FROM job_work_inward_items WHERE inward_id = ${req.params.id} ORDER BY seq_no`)).rows;
      res.json({ ...header, items });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  // ── Shared helper: resolve or auto-create UOM + item in masters ──────────────
  async function resolveItemMasters(client: any, it: any): Promise<{ itemId: string | null }> {
    if (!it.item_name?.trim()) return { itemId: null };

    // 1. Resolve UOM — find or create in units_of_measure
    let uomCode = (it.unit || "").trim();
    if (uomCode) {
      const uomChk = await client.query(
        `SELECT id FROM units_of_measure WHERE LOWER(code)=LOWER($1) OR LOWER(name)=LOWER($1) LIMIT 1`,
        [uomCode]
      );
      if (uomChk.rows.length === 0) {
        await client.query(
          `INSERT INTO units_of_measure (id, code, name, short_form, is_active)
           VALUES (gen_random_uuid(), $1, $1, $1, true)
           ON CONFLICT DO NOTHING`,
          [uomCode.toUpperCase()]
        );
      }
    }

    // 2. Resolve Item — always look up in products master by name first
    //    (item_id from frontend may reference purchase_store_items, not products)
    let itemId: string | null = null;
    const itemName = it.item_name.trim();

    // 2a. If item_id provided, check if it actually exists in products table
    if (it.item_id) {
      const idChk = await client.query(`SELECT id FROM products WHERE id=$1 LIMIT 1`, [it.item_id]);
      if (idChk.rows.length > 0) itemId = idChk.rows[0].id;
    }

    // 2b. Search by name in products
    if (!itemId) {
      const nameChk = await client.query(
        `SELECT id FROM products WHERE LOWER(name)=LOWER($1) LIMIT 1`,
        [itemName]
      );
      if (nameChk.rows.length > 0) itemId = nameChk.rows[0].id;
    }

    // 2c. Search by code in products
    if (!itemId && it.item_code?.trim()) {
      const codeChk = await client.query(
        `SELECT id FROM products WHERE LOWER(code)=LOWER($1) LIMIT 1`,
        [it.item_code.trim()]
      );
      if (codeChk.rows.length > 0) itemId = codeChk.rows[0].id;
    }

    // 2d. Not found — auto-create in products master with available data
    if (!itemId) {
      const code = (it.item_code?.trim() || itemName.substring(0, 20).toUpperCase().replace(/\s+/g, "-")).toUpperCase();
      const ins = await client.query(
        `INSERT INTO products (id, code, name, uom, hsn_code, is_active)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, true)
         ON CONFLICT (code) DO UPDATE
           SET uom = COALESCE(NULLIF(EXCLUDED.uom,''), products.uom),
               hsn_code = COALESCE(NULLIF(EXCLUDED.hsn_code,''), products.hsn_code)
         RETURNING id`,
        [code, itemName, uomCode.toUpperCase() || null, it.hsn?.trim() || null]
      );
      itemId = ins.rows[0]?.id || null;
    }

    return { itemId };
  }

  // ── Shared helper: resolve or auto-create Customer in masters ────────────────
  async function resolvePartyMaster(client: any, partyId: string | null, partyName: string): Promise<string | null> {
    const name = (partyName || "").trim();
    if (!name) return partyId || null;

    // If party_id already provided, verify it exists and return it
    if (partyId) {
      const chk = await client.query(`SELECT id FROM customers WHERE id=$1 LIMIT 1`, [partyId]);
      if (chk.rows.length > 0) return partyId;
    }

    // Search by name (case-insensitive)
    const nameChk = await client.query(
      `SELECT id FROM customers WHERE LOWER(name)=LOWER($1) LIMIT 1`, [name]
    );
    if (nameChk.rows.length > 0) return nameChk.rows[0].id;

    // Not found — auto-create with minimal required fields
    const ins = await client.query(
      `INSERT INTO customers (id, name) VALUES (gen_random_uuid()::text, $1)
       ON CONFLICT DO NOTHING RETURNING id`,
      [name]
    );
    if (ins.rows.length > 0) return ins.rows[0].id;

    // Fallback: fetch by name in case of a race
    const retry = await client.query(`SELECT id FROM customers WHERE LOWER(name)=LOWER($1) LIMIT 1`, [name]);
    return retry.rows[0]?.id || null;
  }

  app.post("/api/job-work-inward", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { items = [], ...data } = req.body;

      // Auto-generate voucher number
      if (!data.voucher_no) {
        const { generateVoucherNo } = await import("./voucher");
        data.voucher_no = await generateVoucherNo("job_work_inward", client);
      }

      // Resolve or auto-create customer in masters
      const resolvedPartyId = await resolvePartyMaster(client, data.party_id || null, data.party_name_manual || "");

      // Insert inward header
      const hRes = await client.query(
        `INSERT INTO job_work_inward
           (id, voucher_no, inward_date, party_id, party_name_manual, party_dc_no,
            party_dc_date, delivery_date, work_order_no, party_po_no, vehicle_no, notes, status)
         VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Saved')
         RETURNING *`,
        [
          data.voucher_no,
          data.inward_date || new Date().toISOString().split("T")[0],
          resolvedPartyId,
          data.party_name_manual || "",
          data.party_dc_no || "",
          data.party_dc_date || null,
          data.delivery_date || null,
          data.work_order_no || "",
          data.party_po_no || "",
          (data.vehicle_no || "").toUpperCase(),
          data.notes || "",
        ]
      );
      const inwardId = hRes.rows[0].id;

      // Insert items — auto-create UOM + item masters as needed
      let seq = 1;
      for (const it of items) {
        if (!it.item_name?.trim() && !it.item_code?.trim()) continue;
        const { itemId } = await resolveItemMasters(client, it);
        await client.query(
          `INSERT INTO job_work_inward_items
             (id, inward_id, seq_no, item_code, item_id, item_name, qty, unit, process, process_id, hsn, remark)
           VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [inwardId, seq++, it.item_code || "", itemId, it.item_name || "", it.qty || 0,
           (it.unit || "").toUpperCase(), it.process || "", it.process_id || null, it.hsn || "", it.remark || ""]
        );
      }

      await client.query("COMMIT");
      res.json(hRes.rows[0]);
    } catch (e: any) {
      await client.query("ROLLBACK");
      console.error("Inward save error:", e.message);
      res.status(400).json({ message: e.message });
    } finally {
      client.release();
    }
  });

  app.patch("/api/job-work-inward/:id", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { items = [], ...data } = req.body;

      // Resolve or auto-create customer in masters
      const resolvedPartyId = await resolvePartyMaster(client, data.party_id || null, data.party_name_manual || "");

      // Update header
      await client.query(
        `UPDATE job_work_inward SET
           inward_date=$1, party_id=$2, party_name_manual=$3, party_dc_no=$4,
           party_dc_date=$5, delivery_date=$6, work_order_no=$7, party_po_no=$8,
           vehicle_no=$9, notes=$10, status='Saved'
         WHERE id=$11`,
        [
          data.inward_date, resolvedPartyId, data.party_name_manual || "",
          data.party_dc_no || "", data.party_dc_date || null, data.delivery_date || null,
          data.work_order_no || "", data.party_po_no || "",
          (data.vehicle_no || "").toUpperCase(), data.notes || "",
          req.params.id,
        ]
      );

      // Replace items atomically
      await client.query(`DELETE FROM job_work_inward_items WHERE inward_id=$1`, [req.params.id]);
      let seq = 1;
      for (const it of items) {
        if (!it.item_name?.trim() && !it.item_code?.trim()) continue;
        const { itemId } = await resolveItemMasters(client, it);
        await client.query(
          `INSERT INTO job_work_inward_items
             (id, inward_id, seq_no, item_code, item_id, item_name, qty, unit, process, process_id, hsn, remark)
           VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [req.params.id, seq++, it.item_code || "", itemId, it.item_name || "", it.qty || 0,
           (it.unit || "").toUpperCase(), it.process || "", it.process_id || null, it.hsn || "", it.remark || ""]
        );
      }

      await client.query("COMMIT");
      const hRes = await client.query(`SELECT * FROM job_work_inward WHERE id=$1`, [req.params.id]);
      res.json(hRes.rows[0]);
    } catch (e: any) {
      await client.query("ROLLBACK");
      console.error("Inward update error:", e.message);
      res.status(400).json({ message: e.message });
    } finally {
      client.release();
    }
  });

  app.delete("/api/job-work-inward/:id", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM job_work_inward_items WHERE inward_id=$1`, [req.params.id]);
      await client.query(`DELETE FROM job_work_inward WHERE id=$1`, [req.params.id]);
      await client.query("COMMIT");
      res.json({ ok: true });
    } catch (e: any) {
      await client.query("ROLLBACK");
      res.status(400).json({ message: e.message });
    } finally {
      client.release();
    }
  });

  // App Settings
  app.get("/api/settings", requireAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const rows = await db.execute(sql`SELECT * FROM app_settings ORDER BY category, key`);
      res.json(rows.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.patch("/api/settings/:key", requireAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { value } = req.body;
      await db.execute(sql`UPDATE app_settings SET value=${value}, updated_at=now() WHERE key=${req.params.key}`);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.post("/api/settings/bulk", requireAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const entries: { key: string; value: string }[] = req.body;
      for (const { key, value } of entries) {
        await db.execute(sql`UPDATE app_settings SET value=${value}, updated_at=now() WHERE key=${key}`);
      }
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ─── Job Work Despatch ────────────────────────────────────────────────────────
  // Helper: recalculate despatch_status on inward after any despatch change
  async function recalcInwardDespatchStatus(client: any, inwardId: string) {
    // For each item in inward, compare total despatched vs inward qty
    const res = await client.query(`
      SELECT
        i.id,
        i.qty,
        COALESCE(SUM(di.qty_despatched),0) AS total_despatched
      FROM job_work_inward_items i
      LEFT JOIN job_work_despatch_items di ON di.inward_item_id = i.id
      WHERE i.inward_id = $1
      GROUP BY i.id, i.qty
    `, [inwardId]);
    const rows = res.rows;
    if (!rows.length) { await client.query(`UPDATE job_work_inward SET despatch_status='Pending' WHERE id=$1`, [inwardId]); return; }
    const allDone = rows.every((r: any) => parseFloat(r.total_despatched) >= parseFloat(r.qty));
    const anyDone = rows.some((r: any) => parseFloat(r.total_despatched) > 0);
    const status = allDone ? "Completed" : anyDone ? "Partial" : "Pending";
    await client.query(`UPDATE job_work_inward SET despatch_status=$1 WHERE id=$2`, [status, inwardId]);
  }

  // GET /api/job-work-despatch — list all
  app.get("/api/job-work-despatch", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const r = await pool.query(`
        SELECT d.*, c.name AS party_name_db,
               j.voucher_no AS inward_voucher_no, j.party_dc_no
        FROM job_work_despatch d
        LEFT JOIN customers c ON c.id = d.party_id
        LEFT JOIN job_work_inward j ON j.id = d.inward_id
        ORDER BY d.created_at DESC
      `);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/job-work-despatch/:id — single with items
  app.get("/api/job-work-despatch/:id", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const [header] = (await pool.query(`
        SELECT d.*, c.name AS party_name_db,
               j.voucher_no AS inward_voucher_no, j.party_dc_no
        FROM job_work_despatch d
        LEFT JOIN customers c ON c.id = d.party_id
        LEFT JOIN job_work_inward j ON j.id = d.inward_id
        WHERE d.id=$1
      `, [req.params.id])).rows;
      if (!header) return res.status(404).json({ message: "Not found" });
      const items = (await pool.query(`SELECT * FROM job_work_despatch_items WHERE despatch_id=$1 ORDER BY seq_no`, [req.params.id])).rows;
      res.json({ ...header, items });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/job-work-inward/:id/despatch-items — items with balance for a specific inward
  app.get("/api/job-work-inward/:id/despatch-items", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const rows = (await pool.query(`
        SELECT
          i.id AS inward_item_id,
          i.item_id, i.item_code, i.item_name, i.unit,
          i.process, i.process_id, i.hsn, i.remark,
          COALESCE(p.price, 0) AS process_price,
          i.qty AS qty_inward,
          COALESCE(SUM(di.qty_despatched),0) AS qty_prev_despatched,
          i.qty - COALESCE(SUM(di.qty_despatched),0) AS qty_balance
        FROM job_work_inward_items i
        LEFT JOIN processes p ON p.id = i.process_id
        LEFT JOIN job_work_despatch_items di ON di.inward_item_id = i.id
        WHERE i.inward_id = $1
        GROUP BY i.id, i.item_id, i.item_code, i.item_name, i.unit,
                 i.process, i.process_id, i.hsn, i.remark, p.price, i.qty
        ORDER BY i.seq_no
      `, [req.params.id])).rows;
      res.json(rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/job-work-despatch — create (atomic)
  app.post("/api/job-work-despatch", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { items = [], ...data } = req.body;

      const { generateVoucherNo } = await import("./voucher");
      const voucherNo = data.voucher_no || await generateVoucherNo("job_work_despatch", client);

      // Resolve or auto-create customer in masters
      const resolvedPartyId = await resolvePartyMaster(client, data.party_id || null, data.party_name_manual || "");

      const hRes = await client.query(`
        INSERT INTO job_work_despatch
          (id, voucher_no, despatch_date, inward_id, party_id, party_name_manual, vehicle_no, driver_name, lr_no, notes, status)
        VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,'Saved')
        RETURNING *
      `, [voucherNo, data.despatch_date || new Date().toISOString().split("T")[0],
          data.inward_id || null, resolvedPartyId, data.party_name_manual || "",
          (data.vehicle_no || "").toUpperCase(), data.driver_name || "", data.lr_no || "", data.notes || ""]);

      const despatchId = hRes.rows[0].id;
      let seq = 1;
      for (const it of items) {
        if (!it.item_name?.trim() || parseFloat(it.qty_despatched || 0) <= 0) continue;
        await client.query(`
          INSERT INTO job_work_despatch_items
            (id, despatch_id, inward_id, inward_item_id, seq_no, item_id, item_code, item_name,
             unit, process, hsn, qty_inward, qty_prev_despatched, qty_despatched, remark, rate)
          VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        `, [despatchId, it.inward_id || data.inward_id, it.inward_item_id || null, seq++,
            it.item_id || null, it.item_code || "", it.item_name,
            (it.unit || "").toUpperCase(), it.process || "", it.hsn || "",
            it.qty_inward || 0, it.qty_prev_despatched || 0, it.qty_despatched || 0,
            it.remark || "", it.rate || 0]);
      }

      const inwardIds = [...new Set(items.map((it: any) => it.inward_id).filter(Boolean))];
      if (data.inward_id && !inwardIds.includes(data.inward_id)) inwardIds.push(data.inward_id);
      for (const iid of inwardIds) await recalcInwardDespatchStatus(client, iid);
      await client.query("COMMIT");
      res.json(hRes.rows[0]);
    } catch (e: any) {
      await client.query("ROLLBACK");
      console.error("Despatch save error:", e.message);
      res.status(400).json({ message: e.message });
    } finally { client.release(); }
  });

  // PATCH /api/job-work-despatch/:id — update (atomic)
  app.patch("/api/job-work-despatch/:id", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { items = [], ...data } = req.body;

      // Resolve or auto-create customer in masters
      const resolvedPartyId = await resolvePartyMaster(client, data.party_id || null, data.party_name_manual || "");

      await client.query(`
        UPDATE job_work_despatch SET
          despatch_date=$1, inward_id=$2, party_id=$3, party_name_manual=$4,
          vehicle_no=$5, driver_name=$6, lr_no=$7, notes=$8, status='Saved'
        WHERE id=$9
      `, [data.despatch_date, data.inward_id || null, resolvedPartyId,
          data.party_name_manual || "", (data.vehicle_no || "").toUpperCase(),
          data.driver_name || "", data.lr_no || "", data.notes || "", req.params.id]);

      await client.query(`DELETE FROM job_work_despatch_items WHERE despatch_id=$1`, [req.params.id]);
      let seq = 1;
      for (const it of items) {
        if (!it.item_name?.trim() || parseFloat(it.qty_despatched || 0) <= 0) continue;
        await client.query(`
          INSERT INTO job_work_despatch_items
            (id, despatch_id, inward_id, inward_item_id, seq_no, item_id, item_code, item_name,
             unit, process, hsn, qty_inward, qty_prev_despatched, qty_despatched, remark, rate)
          VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
        `, [req.params.id, it.inward_id || data.inward_id, it.inward_item_id || null, seq++,
            it.item_id || null, it.item_code || "", it.item_name,
            (it.unit || "").toUpperCase(), it.process || "", it.hsn || "",
            it.qty_inward || 0, it.qty_prev_despatched || 0, it.qty_despatched || 0,
            it.remark || "", it.rate || 0]);
      }

      const inwardIdsP = [...new Set(items.map((it: any) => it.inward_id).filter(Boolean))];
      if (data.inward_id && !inwardIdsP.includes(data.inward_id)) inwardIdsP.push(data.inward_id);
      for (const iid of inwardIdsP) await recalcInwardDespatchStatus(client, iid);
      await client.query("COMMIT");
      const hRes = await client.query(`SELECT * FROM job_work_despatch WHERE id=$1`, [req.params.id]);
      res.json(hRes.rows[0]);
    } catch (e: any) {
      await client.query("ROLLBACK");
      res.status(400).json({ message: e.message });
    } finally { client.release(); }
  });

  // DELETE /api/job-work-despatch/:id
  app.delete("/api/job-work-despatch/:id", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const [d] = (await client.query(`SELECT inward_id FROM job_work_despatch WHERE id=$1`, [req.params.id])).rows;
      await client.query(`DELETE FROM job_work_despatch_items WHERE despatch_id=$1`, [req.params.id]);
      await client.query(`DELETE FROM job_work_despatch WHERE id=$1`, [req.params.id]);
      if (d?.inward_id) await recalcInwardDespatchStatus(client, d.inward_id);
      await client.query("COMMIT");
      res.json({ ok: true });
    } catch (e: any) {
      await client.query("ROLLBACK");
      res.status(400).json({ message: e.message });
    } finally { client.release(); }
  });

  // Approval Authority
  app.get("/api/approval-authority", requireAuth, async (req, res) => { res.json(await storage.listApprovalAuthority()); });
  app.post("/api/approval-authority", requireAuth, async (req, res) => {
    try { res.json(await storage.createApprovalAuthority(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/approval-authority/:id", requireAuth, async (req, res) => { res.json(await storage.updateApprovalAuthority(req.params.id, req.body)); });
  app.delete("/api/approval-authority/:id", requireAuth, async (req, res) => { await storage.deleteApprovalAuthority(req.params.id); res.json({ ok: true }); });

  return httpServer;
}
