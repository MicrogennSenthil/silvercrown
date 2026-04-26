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

  const SD_GL = "29379a58-5e96-4c71-9074-8193877bcfb5"; // Sundry Debtors
  const SC_GL_PARTY = "20845da1-6847-43ce-98d5-7e3e3e44b86b"; // Sundry Creditors

  async function ensureSubLedger(pool: any, glId: string, name: string, existingSlId?: string | null): Promise<string> {
    if (existingSlId) return existingSlId;
    const existing = await pool.query(
      `SELECT id FROM sub_ledgers WHERE general_ledger_id=$1 AND LOWER(name)=LOWER($2) LIMIT 1`, [glId, name]);
    if (existing.rows.length > 0) return existing.rows[0].id;
    const res = await pool.query(
      `INSERT INTO sub_ledgers (id, code, name, general_ledger_id, payment_type, is_active)
       VALUES (gen_random_uuid()::text,$1,$2,$3,'Credit',true) RETURNING id`,
      [`SL-${Date.now()}`, name, glId]);
    return res.rows[0].id;
  }

  // Suppliers
  app.get("/api/suppliers", requireAuth, async (_req, res) => {
    try {
      const { pool } = await import("./db");
      const r = await pool.query(`
        SELECT s.*, sl.name AS sub_ledger_name, sl.code AS sub_ledger_code
        FROM suppliers s
        LEFT JOIN sub_ledgers sl ON sl.id = s.sub_ledger_id
        ORDER BY s.name
      `);
      res.json(r.rows);
    } catch { res.json(await storage.listSuppliers()); }
  });
  app.post("/api/suppliers", requireAuth, async (req, res) => {
    try {
      const { createLedger, ...rest } = req.body;
      const data = insertSupplierSchema.parse(rest);
      const supplier = await storage.createSupplier(data);
      if (createLedger || data.subLedgerId === "__create__") {
        const { pool } = await import("./db");
        const slId = await ensureSubLedger(pool, SC_GL_PARTY, supplier.name, null);
        const updated = await storage.updateSupplier(supplier.id, { subLedgerId: slId } as any);
        return res.json({ ...updated, subLedgerId: slId });
      }
      res.json(supplier);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/suppliers/:id", requireAuth, async (req, res) => {
    try {
      const { createLedger, ...rest } = req.body;
      let subLedgerId = rest.subLedgerId;
      if (createLedger && !subLedgerId) {
        const current = await storage.listSuppliers().then(l => l.find((s: any) => s.id === req.params.id));
        const { pool } = await import("./db");
        subLedgerId = await ensureSubLedger(pool, SC_GL_PARTY, current?.name || rest.name || "", null);
      }
      res.json(await storage.updateSupplier(req.params.id, { ...rest, subLedgerId }));
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.delete("/api/suppliers/:id", requireAuth, async (req, res) => {
    await storage.deleteSupplier(req.params.id);
    res.json({ ok: true });
  });

  // Customers
  app.get("/api/customers", requireAuth, async (_req, res) => {
    try {
      const { pool } = await import("./db");
      const r = await pool.query(`
        SELECT c.*, sl.name AS sub_ledger_name, sl.code AS sub_ledger_code
        FROM customers c
        LEFT JOIN sub_ledgers sl ON sl.id = c.sub_ledger_id
        ORDER BY c.name
      `);
      res.json(r.rows);
    } catch { res.json(await storage.listCustomers()); }
  });
  app.post("/api/customers", requireAuth, async (req, res) => {
    try {
      const { createLedger, ...rest } = req.body;
      const data = insertCustomerSchema.parse(rest);
      const customer = await storage.createCustomer(data);
      if (createLedger || data.subLedgerId === "__create__") {
        const { pool } = await import("./db");
        const slId = await ensureSubLedger(pool, SD_GL, customer.name, null);
        const updated = await storage.updateCustomer(customer.id, { subLedgerId: slId } as any);
        return res.json({ ...updated, subLedgerId: slId });
      }
      res.json(customer);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/customers/:id", requireAuth, async (req, res) => {
    try {
      const { createLedger, ...rest } = req.body;
      let subLedgerId = rest.subLedgerId;
      if (createLedger && !subLedgerId) {
        const current = await storage.listCustomers().then(l => l.find((c: any) => c.id === req.params.id));
        const { pool } = await import("./db");
        subLedgerId = await ensureSubLedger(pool, SD_GL, current?.name || rest.name || "", null);
      }
      res.json(await storage.updateCustomer(req.params.id, { ...rest, subLedgerId }));
    } catch (e: any) { res.status(400).json({ message: e.message }); }
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
  app.patch("/api/categories/:id", requireAuth, async (req, res) => { const { id: _i, createdAt: _c, ...d } = req.body; try { res.json(await storage.updateCategory(req.params.id, d)); } catch (e: any) { res.status(400).json({ message: e.message }); } });
  app.delete("/api/categories/:id", requireAuth, async (req, res) => { await storage.deleteCategory(req.params.id); res.json({ ok: true }); });

  // Sub Categories
  app.get("/api/sub-categories", requireAuth, async (req, res) => {
    res.json(await storage.listSubCategories(req.query.categoryId as string | undefined));
  });
  app.post("/api/sub-categories", requireAuth, async (req, res) => {
    try { res.json(await storage.createSubCategory(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/sub-categories/:id", requireAuth, async (req, res) => { const { id: _i, createdAt: _c, ...d } = req.body; try { res.json(await storage.updateSubCategory(req.params.id, d)); } catch (e: any) { res.status(400).json({ message: e.message }); } });
  app.delete("/api/sub-categories/:id", requireAuth, async (req, res) => { await storage.deleteSubCategory(req.params.id); res.json({ ok: true }); });

  // Products
  app.get("/api/products", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const r = await pool.query(`
        SELECT p.*, c.name AS category_name
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        ORDER BY p.name
      `);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.post("/api/products", requireAuth, async (req, res) => {
    try { res.json(await storage.createProduct(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/products/:id", requireAuth, async (req, res) => {
    try {
      const { id: _id, createdAt: _ca, updatedAt: _ua, ...data } = req.body;
      res.json(await storage.updateProduct(req.params.id, data));
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.delete("/api/products/:id", requireAuth, async (req, res) => { await storage.deleteProduct(req.params.id); res.json({ ok: true }); });

  // Machine Master
  app.get("/api/machines", requireAuth, async (req, res) => { res.json(await storage.listMachines()); });
  app.post("/api/machines", requireAuth, async (req, res) => {
    try { res.json(await storage.createMachine(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/machines/:id", requireAuth, async (req, res) => { const { id: _i, createdAt: _c, ...d } = req.body; try { res.json(await storage.updateMachine(req.params.id, d)); } catch (e: any) { res.status(400).json({ message: e.message }); } });
  app.delete("/api/machines/:id", requireAuth, async (req, res) => { await storage.deleteMachine(req.params.id); res.json({ ok: true }); });

  // Store Item Groups
  app.get("/api/store-item-groups", requireAuth, async (req, res) => { res.json(await storage.listStoreItemGroups()); });
  app.post("/api/store-item-groups", requireAuth, async (req, res) => {
    try { res.json(await storage.createStoreItemGroup(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/store-item-groups/:id", requireAuth, async (req, res) => { const { id: _i, createdAt: _c, ...d } = req.body; try { res.json(await storage.updateStoreItemGroup(req.params.id, d)); } catch (e: any) { res.status(400).json({ message: e.message }); } });
  app.delete("/api/store-item-groups/:id", requireAuth, async (req, res) => { await storage.deleteStoreItemGroup(req.params.id); res.json({ ok: true }); });

  // Store Item Sub Groups
  app.get("/api/store-item-sub-groups", requireAuth, async (req, res) => { res.json(await storage.listStoreItemSubGroups()); });
  app.post("/api/store-item-sub-groups", requireAuth, async (req, res) => {
    try { res.json(await storage.createStoreItemSubGroup(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/store-item-sub-groups/:id", requireAuth, async (req, res) => { const { id: _i, createdAt: _c, ...d } = req.body; try { res.json(await storage.updateStoreItemSubGroup(req.params.id, d)); } catch (e: any) { res.status(400).json({ message: e.message }); } });
  app.delete("/api/store-item-sub-groups/:id", requireAuth, async (req, res) => { await storage.deleteStoreItemSubGroup(req.params.id); res.json({ ok: true }); });

  // Purchase Store Items
  app.get("/api/purchase-store-items", requireAuth, async (req, res) => {
    res.json(await storage.listPurchaseStoreItems(req.query.groupId as string | undefined));
  });
  app.post("/api/purchase-store-items", requireAuth, async (req, res) => {
    try { res.json(await storage.createPurchaseStoreItem(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/purchase-store-items/:id", requireAuth, async (req, res) => { const { id: _i, createdAt: _c, ...d } = req.body; try { res.json(await storage.updatePurchaseStoreItem(req.params.id, d)); } catch (e: any) { res.status(400).json({ message: e.message }); } });
  app.delete("/api/purchase-store-items/:id", requireAuth, async (req, res) => { await storage.deletePurchaseStoreItem(req.params.id); res.json({ ok: true }); });

  // Purchase Approval Levels
  app.get("/api/purchase-approvals", requireAuth, async (req, res) => { res.json(await storage.listPurchaseApprovals()); });
  app.post("/api/purchase-approvals", requireAuth, async (req, res) => {
    try { res.json(await storage.createPurchaseApproval(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/purchase-approvals/:id", requireAuth, async (req, res) => { const { id: _i, createdAt: _c, ...d } = req.body; try { res.json(await storage.updatePurchaseApproval(req.params.id, d)); } catch (e: any) { res.status(400).json({ message: e.message }); } });
  app.delete("/api/purchase-approvals/:id", requireAuth, async (req, res) => { await storage.deletePurchaseApproval(req.params.id); res.json({ ok: true }); });

  // Voucher Types
  app.get("/api/voucher-types", requireAuth, async (req, res) => { res.json(await storage.listVoucherTypes()); });
  app.post("/api/voucher-types", requireAuth, async (req, res) => {
    try { res.json(await storage.createVoucherType(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/voucher-types/:id", requireAuth, async (req, res) => { const { id: _i, createdAt: _c, ...d } = req.body; try { res.json(await storage.updateVoucherType(req.params.id, d)); } catch (e: any) { res.status(400).json({ message: e.message }); } });
  app.delete("/api/voucher-types/:id", requireAuth, async (req, res) => { await storage.deleteVoucherType(req.params.id); res.json({ ok: true }); });

  // Pay Mode Types
  app.get("/api/pay-mode-types", requireAuth, async (req, res) => { res.json(await storage.listPayModeTypes()); });
  app.post("/api/pay-mode-types", requireAuth, async (req, res) => {
    try { res.json(await storage.createPayModeType(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/pay-mode-types/:id", requireAuth, async (req, res) => { const { id: _i, createdAt: _c, ...d } = req.body; try { res.json(await storage.updatePayModeType(req.params.id, d)); } catch (e: any) { res.status(400).json({ message: e.message }); } });
  app.delete("/api/pay-mode-types/:id", requireAuth, async (req, res) => { await storage.deletePayModeType(req.params.id); res.json({ ok: true }); });

  // Sub Ledgers
  app.get("/api/sub-ledgers", requireAuth, async (req, res) => { res.json(await storage.listSubLedgers()); });

  // Named sub-ledger filters — MUST be before /:id wildcard
  app.get("/api/sub-ledgers/debtors", requireAuth, async (_req, res) => {
    try {
      const { pool } = await import("./db");
      const r = await pool.query(`
        SELECT sl.id, sl.name, sl.code, sl.payment_type, gl.name AS gl_name
        FROM sub_ledgers sl
        JOIN general_ledgers gl ON gl.id = sl.general_ledger_id
        WHERE gl.name ILIKE '%debtor%' AND sl.is_active = true
        ORDER BY sl.name
      `);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.get("/api/sub-ledgers/creditors", requireAuth, async (_req, res) => {
    try {
      const { pool } = await import("./db");
      const r = await pool.query(`
        SELECT sl.id, sl.name, sl.code, sl.payment_type, gl.name AS gl_name
        FROM sub_ledgers sl
        JOIN general_ledgers gl ON gl.id = sl.general_ledger_id
        WHERE gl.name ILIKE '%creditor%' AND sl.is_active = true
        ORDER BY sl.name
      `);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });
  app.get("/api/sub-ledgers/expense", requireAuth, async (_req, res) => {
    try {
      const { pool } = await import("./db");
      const r = await pool.query(`
        SELECT sl.id, sl.name, gl.name AS gl_name
        FROM sub_ledgers sl
        JOIN general_ledgers gl ON gl.id = sl.general_ledger_id
        JOIN ledger_categories lc ON lc.id = gl.category_id
        WHERE lc.name = 'Expense' AND sl.is_active = true
        ORDER BY sl.name
      `);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

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
      res.setHeader("Cache-Control", "no-store");
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
          i.qty - COALESCE(SUM(di.qty_despatched),0) AS qty_balance,
          COALESCE(prod.cgst_rate, 0) AS cgst_rate,
          COALESCE(prod.sgst_rate, 0) AS sgst_rate,
          COALESCE(prod.igst_rate, 0) AS igst_rate
        FROM job_work_inward_items i
        LEFT JOIN processes p ON p.id = i.process_id
        LEFT JOIN job_work_despatch_items di ON di.inward_item_id = i.id
        LEFT JOIN products prod ON prod.id = i.item_id
        WHERE i.inward_id = $1
        GROUP BY i.id, i.item_id, i.item_code, i.item_name, i.unit,
                 i.process, i.process_id, i.hsn, i.remark, p.price, i.qty,
                 prod.cgst_rate, prod.sgst_rate, prod.igst_rate
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
          (id, voucher_no, despatch_date, inward_id, party_id, party_name_manual, vehicle_no, driver_name, lr_no, notes, status, is_inter_state)
        VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,'Saved',$10)
        RETURNING *
      `, [voucherNo, data.despatch_date || new Date().toISOString().split("T")[0],
          data.inward_id || null, resolvedPartyId, data.party_name_manual || "",
          (data.vehicle_no || "").toUpperCase(), data.driver_name || "", data.lr_no || "", data.notes || "",
          data.is_inter_state ? true : false]);

      const despatchId = hRes.rows[0].id;
      let seq = 1;
      for (const it of items) {
        if (!it.item_name?.trim() || parseFloat(it.qty_despatched || 0) <= 0) continue;
        await client.query(`
          INSERT INTO job_work_despatch_items
            (id, despatch_id, inward_id, inward_item_id, seq_no, item_id, item_code, item_name,
             unit, process, hsn, qty_inward, qty_prev_despatched, qty_despatched, remark, rate,
             cgst_rate, sgst_rate, igst_rate, cgst_amt, sgst_amt, igst_amt)
          VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
        `, [despatchId, it.inward_id || data.inward_id, it.inward_item_id || null, seq++,
            it.item_id || null, it.item_code || "", it.item_name,
            (it.unit || "").toUpperCase(), it.process || "", it.hsn || "",
            it.qty_inward || 0, it.qty_prev_despatched || 0, it.qty_despatched || 0,
            it.remark || "", it.rate || 0,
            it.cgst_rate || 0, it.sgst_rate || 0, it.igst_rate || 0,
            it.cgst_amt || 0, it.sgst_amt || 0, it.igst_amt || 0]);
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
          vehicle_no=$5, driver_name=$6, lr_no=$7, notes=$8, status='Saved', is_inter_state=$9
        WHERE id=$10
      `, [data.despatch_date, data.inward_id || null, resolvedPartyId,
          data.party_name_manual || "", (data.vehicle_no || "").toUpperCase(),
          data.driver_name || "", data.lr_no || "", data.notes || "",
          data.is_inter_state ? true : false, req.params.id]);

      await client.query(`DELETE FROM job_work_despatch_items WHERE despatch_id=$1`, [req.params.id]);
      let seq = 1;
      for (const it of items) {
        if (!it.item_name?.trim() || parseFloat(it.qty_despatched || 0) <= 0) continue;
        await client.query(`
          INSERT INTO job_work_despatch_items
            (id, despatch_id, inward_id, inward_item_id, seq_no, item_id, item_code, item_name,
             unit, process, hsn, qty_inward, qty_prev_despatched, qty_despatched, remark, rate,
             cgst_rate, sgst_rate, igst_rate, cgst_amt, sgst_amt, igst_amt)
          VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
        `, [req.params.id, it.inward_id || data.inward_id, it.inward_item_id || null, seq++,
            it.item_id || null, it.item_code || "", it.item_name,
            (it.unit || "").toUpperCase(), it.process || "", it.hsn || "",
            it.qty_inward || 0, it.qty_prev_despatched || 0, it.qty_despatched || 0,
            it.remark || "", it.rate || 0,
            it.cgst_rate || 0, it.sgst_rate || 0, it.igst_rate || 0,
            it.cgst_amt || 0, it.sgst_amt || 0, it.igst_amt || 0]);
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

  // ─── Job Work Invoice ────────────────────────────────────────────────────────

  // GET despatch items for invoice by despatch ID (Despatch Notes panel)
  app.get("/api/job-work-despatch/:id/items-for-invoice", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const r = await pool.query(`
        SELECT di.id, di.despatch_id, di.inward_id, di.inward_item_id, di.item_id,
               di.item_code, di.item_name, di.unit, di.process, di.hsn,
               di.qty_despatched, di.rate,
               (di.qty_despatched * di.rate) AS amount,
               d.voucher_no AS despatch_voucher_no,
               iw.party_dc_no, iw.work_order_no, iw.party_po_no, iw.voucher_no AS inward_voucher_no,
               di.cgst_rate, di.sgst_rate, di.igst_rate,
               di.cgst_amt, di.sgst_amt, di.igst_amt
        FROM job_work_despatch_items di
        JOIN job_work_despatch d ON d.id = di.despatch_id
        JOIN job_work_inward iw ON iw.id = di.inward_id
        WHERE di.despatch_id = $1
        ORDER BY di.seq_no
      `, [req.params.id]);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET inward despatch items for invoice (Despatch Notes mode — legacy by inward id)
  app.get("/api/job-work-inward/:id/despatch-items-for-invoice", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const r = await pool.query(`
        SELECT di.id, di.despatch_id, di.inward_id, di.inward_item_id, di.item_id,
               di.item_code, di.item_name, di.unit, di.process, di.hsn,
               di.qty_despatched, di.rate,
               (di.qty_despatched * di.rate) as amount,
               d.voucher_no as despatch_voucher_no,
               iw.party_dc_no, iw.work_order_no, iw.party_po_no, iw.voucher_no as inward_voucher_no,
               COALESCE(prod.cgst_rate,0) AS cgst_rate,
               COALESCE(prod.sgst_rate,0) AS sgst_rate,
               COALESCE(prod.igst_rate,0) AS igst_rate
        FROM job_work_despatch_items di
        JOIN job_work_despatch d ON d.id = di.despatch_id
        JOIN job_work_inward iw ON iw.id = di.inward_id
        LEFT JOIN products prod ON prod.id = di.item_id
        WHERE di.inward_id = $1
        ORDER BY d.voucher_no, di.seq_no
      `, [req.params.id]);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET inward items directly for invoice (Direct Invoice mode)
  app.get("/api/job-work-inward/:id/direct-items-for-invoice", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const r = await pool.query(`
        SELECT i.id as inward_item_id, i.inward_id, i.item_id, i.item_code, i.item_name,
               i.qty as qty_despatched, i.unit, i.hsn, i.remark,
               COALESCE(p.name,'') as process, COALESCE(p.price,0) as rate,
               iw.party_dc_no, iw.work_order_no, iw.party_po_no, iw.voucher_no as inward_voucher_no,
               COALESCE(prod.cgst_rate,0) AS cgst_rate,
               COALESCE(prod.sgst_rate,0) AS sgst_rate,
               COALESCE(prod.igst_rate,0) AS igst_rate
        FROM job_work_inward_items i
        JOIN job_work_inward iw ON iw.id = i.inward_id
        LEFT JOIN processes p ON p.id = i.process_id
        LEFT JOIN products prod ON prod.id = i.item_id
        WHERE i.inward_id = $1
        ORDER BY i.seq_no
      `, [req.params.id]);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/job-work-invoice/invoiced-ids — despatch + inward IDs already covered by invoices
  // Optional ?exclude_invoice_id=xxx to allow the current invoice's own records through (for edit mode)
  app.get("/api/job-work-invoice/invoiced-ids", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const excludeId = (req.query.exclude_invoice_id as string) || null;

      // Despatch IDs already in a despatch-notes invoice
      const dq = await pool.query(`
        SELECT DISTINCT ii.despatch_id
        FROM job_work_invoice_items ii
        JOIN job_work_invoices inv ON inv.id = ii.invoice_id
        WHERE ii.despatch_id IS NOT NULL
          AND inv.invoice_type = 'despatch_notes'
          ${excludeId ? "AND inv.id <> $1" : ""}
      `, excludeId ? [excludeId] : []);

      // Inward IDs already in a direct invoice
      const iq = await pool.query(`
        SELECT DISTINCT ii.inward_id
        FROM job_work_invoice_items ii
        JOIN job_work_invoices inv ON inv.id = ii.invoice_id
        WHERE ii.inward_id IS NOT NULL
          AND inv.invoice_type = 'direct_invoice'
          ${excludeId ? "AND inv.id <> $1" : ""}
      `, excludeId ? [excludeId] : []);

      res.json({
        despatch_ids:       dq.rows.map((r: any) => r.despatch_id),
        direct_inward_ids:  iq.rows.map((r: any) => r.inward_id),
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/job-work-invoice — list all
  app.get("/api/job-work-invoice", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const r = await pool.query(`
        SELECT inv.*,
               COALESCE(c.name, inv.party_name_manual, '') as party_name_db
        FROM job_work_invoices inv
        LEFT JOIN customers c ON c.id = inv.party_id
        ORDER BY inv.created_at DESC
      `);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GET /api/job-work-invoice/:id — single with items and charges
  app.get("/api/job-work-invoice/:id", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const h = (await pool.query(`
        SELECT inv.*, COALESCE(c.name, inv.party_name_manual, '') as party_name_db
        FROM job_work_invoices inv LEFT JOIN customers c ON c.id = inv.party_id
        WHERE inv.id = $1
      `, [req.params.id])).rows[0];
      if (!h) return res.status(404).json({ message: "Not found" });
      const items = (await pool.query(`SELECT * FROM job_work_invoice_items WHERE invoice_id=$1 ORDER BY seq_no`, [req.params.id])).rows;
      const charges = (await pool.query(`SELECT * FROM job_work_invoice_charges WHERE invoice_id=$1 ORDER BY seq_no`, [req.params.id])).rows;
      res.json({ ...h, items, charges });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // POST /api/job-work-invoice — create
  app.post("/api/job-work-invoice", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { items = [], charges = [], ...data } = req.body;
      const { generateVoucherNo } = await import("./voucher");
      const voucherNo = data.voucher_no || await generateVoucherNo("job_work_invoice", client);
      const resolvedPartyId = await resolvePartyMaster(client, data.party_id || null, data.party_name_manual || "");
      const hRes = await client.query(`
        INSERT INTO job_work_invoices
          (id, voucher_no, invoice_date, party_id, party_name_manual, vehicle_no, invoice_type,
           is_inter_state, term_of_delivery, transport, freight, delivery_address, same_as_company, remark, status)
        VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Saved') RETURNING *
      `, [voucherNo, data.invoice_date || new Date().toISOString().split("T")[0],
          resolvedPartyId, data.party_name_manual || "",
          (data.vehicle_no || "").toUpperCase(), data.invoice_type || "despatch_notes",
          data.is_inter_state || false,
          data.term_of_delivery || "", data.transport || "",
          data.freight || "to_pay", data.delivery_address || "",
          data.same_as_company || false, data.remark || ""]);
      const invoiceId = hRes.rows[0].id;
      let seq = 1;
      for (const it of items) {
        if (!it.item_name?.trim()) continue;
        const iqty = parseFloat(it.qty_despatched || 0);
        const irate = parseFloat(it.rate || 0);
        const itaxable = iqty * irate;
        const icgst = parseFloat(it.cgst_rate || 0);
        const isgst = parseFloat(it.sgst_rate || 0);
        const iigst = parseFloat(it.igst_rate || 0);
        const icgstAmt = parseFloat(it.cgst_amt ?? (itaxable * icgst / 100));
        const isgstAmt = parseFloat(it.sgst_amt ?? (itaxable * isgst / 100));
        const iigstAmt = parseFloat(it.igst_amt ?? (itaxable * iigst / 100));
        await client.query(`
          INSERT INTO job_work_invoice_items
            (id, invoice_id, despatch_id, inward_id, inward_item_id, seq_no, item_id, item_code,
             item_name, unit, process, hsn, qty_despatched, rate, amount, po_no, party_dc,
             work_order_no, despatch_voucher_no, inward_voucher_no, no_of_cover, packages,
             cgst_rate, sgst_rate, igst_rate, cgst_amt, sgst_amt, igst_amt)
          VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
        `, [invoiceId, it.despatch_id || null, it.inward_id || null, it.inward_item_id || null, seq++,
            it.item_id || null, it.item_code || "", it.item_name,
            (it.unit || "").toUpperCase(), it.process || "", it.hsn || "",
            iqty, irate, itaxable,
            it.po_no || "", it.party_dc || "", it.work_order_no || "",
            it.despatch_voucher_no || "", it.inward_voucher_no || "",
            parseInt(it.no_of_cover || 0), parseInt(it.packages || 0),
            icgst, isgst, iigst, icgstAmt, isgstAmt, iigstAmt]);
      }
      let cseq = 1;
      for (const ch of charges) {
        if (!ch.charge_name?.trim() && !ch.subledger_id) continue;
        await client.query(`
          INSERT INTO job_work_invoice_charges (id, invoice_id, seq_no, charge_name, subledger_id, amount)
          VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5)
        `, [invoiceId, cseq++, ch.charge_name || "", ch.subledger_id || null, parseFloat(ch.amount || 0)]);
      }
      await client.query("COMMIT");
      res.json(hRes.rows[0]);
    } catch (e: any) {
      await client.query("ROLLBACK");
      console.error("Invoice save error:", e.message);
      res.status(400).json({ message: e.message });
    } finally { client.release(); }
  });

  // PATCH /api/job-work-invoice/:id — update
  app.patch("/api/job-work-invoice/:id", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { items = [], charges = [], ...data } = req.body;
      const resolvedPartyId = await resolvePartyMaster(client, data.party_id || null, data.party_name_manual || "");
      await client.query(`
        UPDATE job_work_invoices SET
          invoice_date=$1, party_id=$2, party_name_manual=$3, vehicle_no=$4, invoice_type=$5,
          is_inter_state=$6, term_of_delivery=$7, transport=$8, freight=$9,
          delivery_address=$10, same_as_company=$11, remark=$12
        WHERE id=$13
      `, [data.invoice_date, resolvedPartyId, data.party_name_manual || "",
          (data.vehicle_no || "").toUpperCase(), data.invoice_type || "despatch_notes",
          data.is_inter_state || false,
          data.term_of_delivery || "", data.transport || "",
          data.freight || "to_pay", data.delivery_address || "",
          data.same_as_company || false, data.remark || "", req.params.id]);
      await client.query(`DELETE FROM job_work_invoice_items WHERE invoice_id=$1`, [req.params.id]);
      await client.query(`DELETE FROM job_work_invoice_charges WHERE invoice_id=$1`, [req.params.id]);
      let seq = 1;
      for (const it of items) {
        if (!it.item_name?.trim()) continue;
        const iqty = parseFloat(it.qty_despatched || 0);
        const irate = parseFloat(it.rate || 0);
        const itaxable = iqty * irate;
        const icgst = parseFloat(it.cgst_rate || 0);
        const isgst = parseFloat(it.sgst_rate || 0);
        const iigst = parseFloat(it.igst_rate || 0);
        const icgstAmt = parseFloat(it.cgst_amt ?? (itaxable * icgst / 100));
        const isgstAmt = parseFloat(it.sgst_amt ?? (itaxable * isgst / 100));
        const iigstAmt = parseFloat(it.igst_amt ?? (itaxable * iigst / 100));
        await client.query(`
          INSERT INTO job_work_invoice_items
            (id, invoice_id, despatch_id, inward_id, inward_item_id, seq_no, item_id, item_code,
             item_name, unit, process, hsn, qty_despatched, rate, amount, po_no, party_dc,
             work_order_no, despatch_voucher_no, inward_voucher_no, no_of_cover, packages,
             cgst_rate, sgst_rate, igst_rate, cgst_amt, sgst_amt, igst_amt)
          VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27)
        `, [req.params.id, it.despatch_id || null, it.inward_id || null, it.inward_item_id || null, seq++,
            it.item_id || null, it.item_code || "", it.item_name,
            (it.unit || "").toUpperCase(), it.process || "", it.hsn || "",
            iqty, irate, itaxable,
            it.po_no || "", it.party_dc || "", it.work_order_no || "",
            it.despatch_voucher_no || "", it.inward_voucher_no || "",
            parseInt(it.no_of_cover || 0), parseInt(it.packages || 0),
            icgst, isgst, iigst, icgstAmt, isgstAmt, iigstAmt]);
      }
      let cseq = 1;
      for (const ch of charges) {
        if (!ch.charge_name?.trim() && !ch.subledger_id) continue;
        await client.query(`
          INSERT INTO job_work_invoice_charges (id, invoice_id, seq_no, charge_name, subledger_id, amount)
          VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5)
        `, [req.params.id, cseq++, ch.charge_name || "", ch.subledger_id || null, parseFloat(ch.amount || 0)]);
      }
      const hRes = await client.query(`
        SELECT inv.*, COALESCE(c.name, inv.party_name_manual,'') as party_name_db
        FROM job_work_invoices inv LEFT JOIN customers c ON c.id=inv.party_id WHERE inv.id=$1
      `, [req.params.id]);
      await client.query("COMMIT");
      res.json(hRes.rows[0]);
    } catch (e: any) {
      await client.query("ROLLBACK");
      res.status(400).json({ message: e.message });
    } finally { client.release(); }
  });

  // DELETE /api/job-work-invoice/:id
  app.delete("/api/job-work-invoice/:id", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM job_work_invoice_items WHERE invoice_id=$1`, [req.params.id]);
      await client.query(`DELETE FROM job_work_invoice_charges WHERE invoice_id=$1`, [req.params.id]);
      await client.query(`DELETE FROM job_work_invoices WHERE id=$1`, [req.params.id]);
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

  // ── Returnable Inward ───────────────────────────────────────────────────────
  app.get("/api/returnable-inward", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const r = await pool.query(`
        SELECT ri.*, c.name AS party_name_db
        FROM returnable_inward ri
        LEFT JOIN customers c ON c.id = ri.party_id
        ORDER BY ri.created_at DESC
      `);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/returnable-inward/:id", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const [header] = (await pool.query(`
        SELECT ri.*, c.name AS party_name_db
        FROM returnable_inward ri
        LEFT JOIN customers c ON c.id = ri.party_id
        WHERE ri.id = $1
      `, [req.params.id])).rows;
      if (!header) return res.status(404).json({ message: "Not found" });
      const items = (await pool.query(
        `SELECT * FROM returnable_inward_items WHERE inward_id=$1 ORDER BY seq_no`,
        [req.params.id]
      )).rows;
      res.json({ ...header, items });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/returnable-inward", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { generateVoucherNo } = await import("./voucher");
      const b = req.body;
      // Auto voucher number
      const voucher_no = await generateVoucherNo("returnable_inward", client);
      const hRes = await client.query(`
        INSERT INTO returnable_inward
          (voucher_no, party_id, party_name_manual, party_dc_no, party_dc_date,
           inward_date, due_date, vehicle_no, contact_person, mobile_no, email_id,
           delivery_address, same_as_company, remark)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING *
      `, [voucher_no, b.party_id||null, b.party_name_manual||"", b.party_dc_no||"",
          b.party_dc_date||null, b.inward_date||new Date().toISOString().split("T")[0],
          b.due_date||null, b.vehicle_no||"", b.contact_person||"", b.mobile_no||"",
          b.email_id||"", b.delivery_address||"", b.same_as_company!==false, b.remark||""]);
      const hdr = hRes.rows[0];
      const items = b.items || [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(`
          INSERT INTO returnable_inward_items
            (inward_id, seq_no, item_id, item_code, item_name, hsn, qty, unit, unit_value, total_value)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `, [hdr.id, i+1, it.item_id||null, it.item_code||"", it.item_name||"",
            it.hsn||"", parseFloat(it.qty||0), it.unit||"",
            parseFloat(it.unit_value||0), parseFloat(it.total_value||0)]);
      }
      await client.query("COMMIT");
      res.json({ ...hdr, voucher_no });
    } catch (e: any) { await client.query("ROLLBACK"); res.status(400).json({ message: e.message }); }
    finally { client.release(); }
  });

  app.patch("/api/returnable-inward/:id", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const b = req.body;
      const hRes = await client.query(`
        UPDATE returnable_inward SET
          party_id=$1, party_name_manual=$2, party_dc_no=$3, party_dc_date=$4,
          inward_date=$5, due_date=$6, vehicle_no=$7, contact_person=$8, mobile_no=$9,
          email_id=$10, delivery_address=$11, same_as_company=$12, remark=$13
        WHERE id=$14 RETURNING *
      `, [b.party_id||null, b.party_name_manual||"", b.party_dc_no||"", b.party_dc_date||null,
          b.inward_date, b.due_date||null, b.vehicle_no||"", b.contact_person||"",
          b.mobile_no||"", b.email_id||"", b.delivery_address||"",
          b.same_as_company!==false, b.remark||"", req.params.id]);
      await client.query(`DELETE FROM returnable_inward_items WHERE inward_id=$1`, [req.params.id]);
      const items = b.items || [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(`
          INSERT INTO returnable_inward_items
            (inward_id, seq_no, item_id, item_code, item_name, hsn, qty, unit, unit_value, total_value)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `, [req.params.id, i+1, it.item_id||null, it.item_code||"", it.item_name||"",
            it.hsn||"", parseFloat(it.qty||0), it.unit||"",
            parseFloat(it.unit_value||0), parseFloat(it.total_value||0)]);
      }
      await client.query("COMMIT");
      res.json(hRes.rows[0]);
    } catch (e: any) { await client.query("ROLLBACK"); res.status(400).json({ message: e.message }); }
    finally { client.release(); }
  });

  app.delete("/api/returnable-inward/:id", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      await pool.query(`DELETE FROM returnable_inward WHERE id=$1`, [req.params.id]);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Returnable Outward ──────────────────────────────────────────────────────

  // Returns which returnable_inward IDs are already covered by an outward
  app.get("/api/returnable-outward/outward-inward-ids", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const excludeId = (req.query.exclude_outward_id as string) || null;
      const r = await pool.query(`
        SELECT DISTINCT oi.inward_id
        FROM returnable_outward_items oi
        JOIN returnable_outward o ON o.id = oi.outward_id
        WHERE oi.inward_id IS NOT NULL
          ${excludeId ? "AND o.id <> $1" : ""}
      `, excludeId ? [excludeId] : []);
      res.json({ inward_ids: r.rows.map((row: any) => row.inward_id) });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/returnable-outward", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const r = await pool.query(`
        SELECT ro.*, c.name AS party_name_db
        FROM returnable_outward ro
        LEFT JOIN customers c ON c.id = ro.party_id
        ORDER BY ro.created_at DESC
      `);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/returnable-outward/:id", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const [header] = (await pool.query(`
        SELECT ro.*, c.name AS party_name_db
        FROM returnable_outward ro
        LEFT JOIN customers c ON c.id = ro.party_id
        WHERE ro.id = $1
      `, [req.params.id])).rows;
      if (!header) return res.status(404).json({ message: "Not found" });
      const items = (await pool.query(
        `SELECT * FROM returnable_outward_items WHERE outward_id=$1 ORDER BY seq_no`,
        [req.params.id]
      )).rows;
      res.json({ ...header, items });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/returnable-outward", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { generateVoucherNo } = await import("./voucher");
      const b = req.body;
      const voucher_no = await generateVoucherNo("returnable_outward", client);
      const hRes = await client.query(`
        INSERT INTO returnable_outward
          (voucher_no, party_id, party_name_manual, outward_date, vehicle_no,
           contact_person, mobile_no, email_id, delivery_address, same_as_company, remark)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *
      `, [voucher_no, b.party_id||null, b.party_name_manual||"",
          b.outward_date||new Date().toISOString().split("T")[0],
          b.vehicle_no||"", b.contact_person||"", b.mobile_no||"",
          b.email_id||"", b.delivery_address||"", b.same_as_company!==false, b.remark||""]);
      const hdr = hRes.rows[0];
      const items = b.items || [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(`
          INSERT INTO returnable_outward_items
            (outward_id, inward_id, seq_no, item_id, item_code, item_name, hsn,
             qty_inward, qty_outward, unit, weight, unit_value, total_value)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        `, [hdr.id, it.inward_id||null, i+1, it.item_id||null,
            it.item_code||"", it.item_name||"", it.hsn||"",
            parseFloat(it.qty_inward||0), parseFloat(it.qty_outward||0),
            it.unit||"", parseFloat(it.weight||0),
            parseFloat(it.unit_value||0), parseFloat(it.total_value||0)]);
      }
      // Mark used inward IDs as completed
      const usedInwardIds = [...new Set(items.map((it: any) => it.inward_id).filter(Boolean))];
      for (const iid of usedInwardIds) {
        await client.query(`UPDATE returnable_inward SET outward_status='Completed' WHERE id=$1`, [iid]);
      }
      await client.query("COMMIT");
      res.json({ ...hdr, voucher_no });
    } catch (e: any) { await client.query("ROLLBACK"); res.status(400).json({ message: e.message }); }
    finally { client.release(); }
  });

  app.patch("/api/returnable-outward/:id", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const b = req.body;
      // Reset outward_status on previously linked inwards
      const prevItems = (await client.query(
        `SELECT DISTINCT inward_id FROM returnable_outward_items WHERE outward_id=$1 AND inward_id IS NOT NULL`,
        [req.params.id]
      )).rows;
      for (const row of prevItems) {
        await client.query(`UPDATE returnable_inward SET outward_status='Pending' WHERE id=$1`, [row.inward_id]);
      }
      const hRes = await client.query(`
        UPDATE returnable_outward SET
          party_id=$1, party_name_manual=$2, outward_date=$3, vehicle_no=$4,
          contact_person=$5, mobile_no=$6, email_id=$7, delivery_address=$8,
          same_as_company=$9, remark=$10
        WHERE id=$11 RETURNING *
      `, [b.party_id||null, b.party_name_manual||"", b.outward_date,
          b.vehicle_no||"", b.contact_person||"", b.mobile_no||"",
          b.email_id||"", b.delivery_address||"", b.same_as_company!==false,
          b.remark||"", req.params.id]);
      await client.query(`DELETE FROM returnable_outward_items WHERE outward_id=$1`, [req.params.id]);
      const items = b.items || [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(`
          INSERT INTO returnable_outward_items
            (outward_id, inward_id, seq_no, item_id, item_code, item_name, hsn,
             qty_inward, qty_outward, unit, weight, unit_value, total_value)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        `, [req.params.id, it.inward_id||null, i+1, it.item_id||null,
            it.item_code||"", it.item_name||"", it.hsn||"",
            parseFloat(it.qty_inward||0), parseFloat(it.qty_outward||0),
            it.unit||"", parseFloat(it.weight||0),
            parseFloat(it.unit_value||0), parseFloat(it.total_value||0)]);
      }
      const usedInwardIds = [...new Set(items.map((it: any) => it.inward_id).filter(Boolean))];
      for (const iid of usedInwardIds) {
        await client.query(`UPDATE returnable_inward SET outward_status='Completed' WHERE id=$1`, [iid]);
      }
      await client.query("COMMIT");
      res.json(hRes.rows[0]);
    } catch (e: any) { await client.query("ROLLBACK"); res.status(400).json({ message: e.message }); }
    finally { client.release(); }
  });

  app.delete("/api/returnable-outward/:id", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // Reset inward statuses before deleting
      const prevItems = (await client.query(
        `SELECT DISTINCT inward_id FROM returnable_outward_items WHERE outward_id=$1 AND inward_id IS NOT NULL`,
        [req.params.id]
      )).rows;
      await client.query(`DELETE FROM returnable_outward WHERE id=$1`, [req.params.id]);
      for (const row of prevItems) {
        await client.query(`UPDATE returnable_inward SET outward_status='Pending' WHERE id=$1`, [row.inward_id]);
      }
      await client.query("COMMIT");
      res.json({ ok: true });
    } catch (e: any) { await client.query("ROLLBACK"); res.status(400).json({ message: e.message }); }
    finally { client.release(); }
  });

  // ── Purchase Orders ─────────────────────────────────────────────────────────

  app.get("/api/purchase-orders", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const r = await pool.query(`
        SELECT po.*, c.name AS supplier_name_db
        FROM purchase_orders po
        LEFT JOIN customers c ON c.id = po.supplier_id
        ORDER BY po.created_at DESC
      `);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/purchase-orders/:id", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const [hdr] = (await pool.query(`
        SELECT po.*, c.name AS supplier_name_db
        FROM purchase_orders po
        LEFT JOIN customers c ON c.id = po.supplier_id
        WHERE po.id=$1
      `, [req.params.id])).rows;
      if (!hdr) return res.status(404).json({ message: "Not found" });
      const [items, terms, charges] = await Promise.all([
        pool.query(`SELECT * FROM purchase_order_items WHERE po_id=$1 ORDER BY seq_no`, [req.params.id]),
        pool.query(`SELECT * FROM purchase_order_terms WHERE po_id=$1 ORDER BY seq_no`, [req.params.id]),
        pool.query(`SELECT * FROM purchase_order_charges WHERE po_id=$1 ORDER BY seq_no`, [req.params.id]),
      ]);
      res.json({ ...hdr, items: items.rows, terms: terms.rows, charges: charges.rows });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/purchase-orders", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { generateVoucherNo } = await import("./voucher");
      const b = req.body;
      const voucher_no = await generateVoucherNo("purchase_order", client);
      const hRes = await client.query(`
        INSERT INTO purchase_orders
          (voucher_no, po_date, supplier_id, supplier_name_manual, po_type,
           schedule_date, priority, payment_mode, our_ref_no, your_ref_no,
           delivery_location, remark, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *
      `, [voucher_no, b.po_date||new Date().toISOString().split("T")[0],
          b.supplier_id||null, b.supplier_name_manual||"", b.po_type||"Purchase Order",
          b.schedule_date||null, b.priority||"Medium", b.payment_mode||"Cash",
          b.our_ref_no||"", b.your_ref_no||"", b.delivery_location||"",
          b.remark||"", b.status||"Draft"]);
      const hdr = hRes.rows[0];
      for (let i=0; i<(b.items||[]).length; i++) {
        const it = b.items[i];
        await client.query(`
          INSERT INTO purchase_order_items
            (po_id,seq_no,item_id,item_code,item_name,qty,unit,rate,taxable_amt,
             tax_code,cgst_pct,sgst_pct,igst_pct,cgst_amt,sgst_amt,igst_amt,total)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        `, [hdr.id,i+1,it.item_id||null,it.item_code||"",it.item_name||"",
            +it.qty||0,it.unit||"",+it.rate||0,+it.taxable_amt||0,
            it.tax_code||"",+it.cgst_pct||0,+it.sgst_pct||0,+it.igst_pct||0,
            +it.cgst_amt||0,+it.sgst_amt||0,+it.igst_amt||0,+it.total||0]);
      }
      for (let i=0; i<(b.terms||[]).length; i++) {
        const t = b.terms[i];
        await client.query(`INSERT INTO purchase_order_terms (po_id,seq_no,term_type,terms) VALUES ($1,$2,$3,$4)`,
          [hdr.id,i+1,t.term_type||"",t.terms||""]);
      }
      for (let i=0; i<(b.charges||[]).length; i++) {
        const c = b.charges[i];
        await client.query(`INSERT INTO purchase_order_charges (po_id,seq_no,charge_type,amount) VALUES ($1,$2,$3,$4)`,
          [hdr.id,i+1,c.charge_type||"",+c.amount||0]);
      }
      await client.query("COMMIT");
      res.json({ ...hdr, voucher_no });
    } catch (e: any) { await client.query("ROLLBACK"); res.status(400).json({ message: e.message }); }
    finally { client.release(); }
  });

  app.patch("/api/purchase-orders/:id", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const b = req.body;
      const hRes = await client.query(`
        UPDATE purchase_orders SET
          po_date=$1, supplier_id=$2, supplier_name_manual=$3, po_type=$4,
          schedule_date=$5, priority=$6, payment_mode=$7, our_ref_no=$8,
          your_ref_no=$9, delivery_location=$10, remark=$11, status=$12
        WHERE id=$13 RETURNING *
      `, [b.po_date, b.supplier_id||null, b.supplier_name_manual||"", b.po_type||"Purchase Order",
          b.schedule_date||null, b.priority||"Medium", b.payment_mode||"Cash",
          b.our_ref_no||"", b.your_ref_no||"", b.delivery_location||"",
          b.remark||"", b.status||"Draft", req.params.id]);
      await client.query(`DELETE FROM purchase_order_items WHERE po_id=$1`, [req.params.id]);
      await client.query(`DELETE FROM purchase_order_terms WHERE po_id=$1`, [req.params.id]);
      await client.query(`DELETE FROM purchase_order_charges WHERE po_id=$1`, [req.params.id]);
      for (let i=0; i<(b.items||[]).length; i++) {
        const it = b.items[i];
        await client.query(`
          INSERT INTO purchase_order_items
            (po_id,seq_no,item_id,item_code,item_name,qty,unit,rate,taxable_amt,
             tax_code,cgst_pct,sgst_pct,igst_pct,cgst_amt,sgst_amt,igst_amt,total)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        `, [req.params.id,i+1,it.item_id||null,it.item_code||"",it.item_name||"",
            +it.qty||0,it.unit||"",+it.rate||0,+it.taxable_amt||0,
            it.tax_code||"",+it.cgst_pct||0,+it.sgst_pct||0,+it.igst_pct||0,
            +it.cgst_amt||0,+it.sgst_amt||0,+it.igst_amt||0,+it.total||0]);
      }
      for (let i=0; i<(b.terms||[]).length; i++) {
        const t = b.terms[i];
        await client.query(`INSERT INTO purchase_order_terms (po_id,seq_no,term_type,terms) VALUES ($1,$2,$3,$4)`,
          [req.params.id,i+1,t.term_type||"",t.terms||""]);
      }
      for (let i=0; i<(b.charges||[]).length; i++) {
        const c = b.charges[i];
        await client.query(`INSERT INTO purchase_order_charges (po_id,seq_no,charge_type,amount) VALUES ($1,$2,$3,$4)`,
          [req.params.id,i+1,c.charge_type||"",+c.amount||0]);
      }
      await client.query("COMMIT");
      res.json(hRes.rows[0]);
    } catch (e: any) { await client.query("ROLLBACK"); res.status(400).json({ message: e.message }); }
    finally { client.release(); }
  });

  app.delete("/api/purchase-orders/:id", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      await pool.query(`DELETE FROM purchase_orders WHERE id=$1`, [req.params.id]);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Purchase Order Approval ──────────────────────────────────────────────────

  // Get approval levels config
  app.get("/api/purchase-order-approval/levels", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const r = await pool.query(`SELECT * FROM purchase_approval_levels WHERE is_active=true ORDER BY approval_level`);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // List POs pending/approved with full-text search + approval status per level
  app.get("/api/purchase-order-approval", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const search = (req.query.search as string || "").toLowerCase();

      // Fetch all POs with supplier, grand total, and approval decisions
      const r = await pool.query(`
        SELECT
          po.id, po.voucher_no, po.po_date, po.status, po.payment_mode, po.priority,
          po.supplier_id, po.supplier_name_manual,
          c.name AS supplier_name_db,
          COALESCE(
            (SELECT SUM(poi.total) FROM purchase_order_items poi WHERE poi.po_id = po.id), 0
          ) +
          COALESCE(
            (SELECT SUM(poc.amount) FROM purchase_order_charges poc WHERE poc.po_id = po.id), 0
          ) AS bill_value,
          COALESCE(
            (SELECT json_agg(json_build_object(
              'id', pad.id, 'level', pad.approval_level, 'level_name', pad.level_name,
              'status', pad.status, 'approver_name', pad.approver_name,
              'comments', pad.comments, 'decided_at', pad.decided_at
            ) ORDER BY pad.approval_level)
            FROM po_approval_decisions pad WHERE pad.po_id = po.id),
            '[]'::json
          ) AS decisions,
          COALESCE(
            (SELECT string_agg(poi.item_name, ' ') FROM purchase_order_items poi WHERE poi.po_id = po.id), ''
          ) AS item_names,
          COALESCE(
            (SELECT string_agg(poi.qty::text, ' ') FROM purchase_order_items poi WHERE poi.po_id = po.id), ''
          ) AS item_qtys,
          COALESCE(
            (SELECT string_agg(poi.rate::text, ' ') FROM purchase_order_items poi WHERE poi.po_id = po.id), ''
          ) AS item_rates
        FROM purchase_orders po
        LEFT JOIN customers c ON c.id = po.supplier_id
        WHERE po.status != 'Cancelled'
        ORDER BY po.created_at DESC
      `);

      let rows = r.rows;

      // Apply universal search
      if (search) {
        rows = rows.filter((row: any) => {
          const haystack = [
            row.voucher_no, row.supplier_name_db, row.supplier_name_manual,
            row.status, row.item_names, row.item_qtys, row.item_rates,
            row.payment_mode, row.priority, String(row.bill_value||""),
            new Date(row.po_date).toLocaleDateString("en-IN", { day:"2-digit", month:"long", year:"numeric" })
          ].join(" ").toLowerCase();
          return haystack.includes(search);
        });
      }

      res.json(rows.map((r: any) => ({
        id: r.id, voucher_no: r.voucher_no, po_date: r.po_date,
        status: r.status, payment_mode: r.payment_mode, priority: r.priority,
        supplier_name: r.supplier_name_db || r.supplier_name_manual || "",
        bill_value: parseFloat(r.bill_value)||0,
        decisions: r.decisions || [],
      })));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Approve one or multiple POs at current level
  app.post("/api/purchase-order-approval/approve", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { po_ids, comments = "" } = req.body as { po_ids: string[]; comments?: string };
      const user = (req as any).user;

      // Get all active approval levels
      const levelsRes = await client.query(`SELECT * FROM purchase_approval_levels WHERE is_active=true ORDER BY approval_level`);
      const levels = levelsRes.rows;
      const totalLevels = levels.length || 1;

      const results: any[] = [];

      for (const po_id of po_ids) {
        // Get existing decisions for this PO
        const decisionsRes = await client.query(
          `SELECT * FROM po_approval_decisions WHERE po_id=$1 ORDER BY approval_level`,
          [po_id]
        );
        const decisions = decisionsRes.rows;
        const approvedLevels = decisions.filter((d: any) => d.status === "Approved").map((d: any) => d.approval_level);

        // Find the next level to approve
        let nextLevel = 1;
        for (let i = 1; i <= totalLevels; i++) {
          if (!approvedLevels.includes(i)) { nextLevel = i; break; }
        }
        const levelConfig = levels.find((l: any) => l.approval_level === nextLevel) || levels[0];

        // Upsert the decision for this level
        const existingDec = decisions.find((d: any) => d.approval_level === nextLevel);
        if (existingDec) {
          await client.query(`
            UPDATE po_approval_decisions SET status='Approved', approver_user_id=$1,
              approver_name=$2, comments=$3, decided_at=now() WHERE id=$4
          `, [user?.id||null, user?.name||user?.username||"Admin", comments, existingDec.id]);
        } else {
          await client.query(`
            INSERT INTO po_approval_decisions
              (po_id, approval_level, level_name, approver_user_id, approver_name, status, comments, decided_at)
            VALUES ($1,$2,$3,$4,$5,'Approved',$6,now())
          `, [po_id, nextLevel, levelConfig?.name||`Level ${nextLevel}`,
              user?.id||null, user?.name||user?.username||"Admin", comments]);
        }

        // Check if all levels are now approved
        const allApprovedRes = await client.query(
          `SELECT COUNT(*) FROM po_approval_decisions WHERE po_id=$1 AND status='Approved'`,
          [po_id]
        );
        const approvedCount = parseInt(allApprovedRes.rows[0].count);

        let newStatus = "Pending Approval";
        if (approvedCount >= totalLevels) {
          newStatus = "Approved";
          await client.query(`UPDATE purchase_orders SET status='Approved' WHERE id=$1`, [po_id]);
        } else {
          await client.query(`UPDATE purchase_orders SET status='Pending Approval' WHERE id=$1`, [po_id]);
        }

        results.push({ po_id, approved_level: nextLevel, status: newStatus });
      }

      await client.query("COMMIT");
      res.json({ ok: true, results });
    } catch (e: any) { await client.query("ROLLBACK"); res.status(400).json({ message: e.message }); }
    finally { client.release(); }
  });

  // Reject one or multiple POs
  app.post("/api/purchase-order-approval/reject", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { po_ids, comments = "" } = req.body as { po_ids: string[]; comments?: string };
      const user = (req as any).user;

      const levelsRes = await client.query(`SELECT * FROM purchase_approval_levels WHERE is_active=true ORDER BY approval_level LIMIT 1`);
      const level = levelsRes.rows[0] || { approval_level: 1, name: "Level 1" };

      for (const po_id of po_ids) {
        await client.query(`
          INSERT INTO po_approval_decisions
            (po_id, approval_level, level_name, approver_user_id, approver_name, status, comments, decided_at)
          VALUES ($1,$2,$3,$4,$5,'Rejected',$6,now())
          ON CONFLICT DO NOTHING
        `, [po_id, level.approval_level, level.name,
            user?.id||null, user?.name||user?.username||"Admin", comments]);
        await client.query(`UPDATE purchase_orders SET status='Rejected' WHERE id=$1`, [po_id]);
      }

      await client.query("COMMIT");
      res.json({ ok: true });
    } catch (e: any) { await client.query("ROLLBACK"); res.status(400).json({ message: e.message }); }
    finally { client.release(); }
  });

  // Reset PO approval (move back to Draft)
  app.post("/api/purchase-order-approval/reset", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const { po_ids } = req.body as { po_ids: string[] };
      for (const po_id of po_ids) {
        await pool.query(`DELETE FROM po_approval_decisions WHERE po_id=$1`, [po_id]);
        await pool.query(`UPDATE purchase_orders SET status='Draft' WHERE id=$1`, [po_id]);
      }
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Goods Receipt Notes ─────────────────────────────────────────────────────

  // AI Scan: extract GRN / purchase bill from image
  app.post("/api/grn/scan-document", requireAuth, upload.single("file"), async (req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const rows = await db.execute(sql`SELECT key, value FROM app_settings WHERE category = 'AI Configuration'`);
      const cfg: Record<string,string> = {};
      rows.rows.forEach((r: any) => { cfg[r.key] = r.value; });
      const provider = cfg["ai_provider"] || "gemini";
      const model    = cfg["ai_model"]    || "gemini-2.0-flash";
      const apiKey   = provider === "gemini" ? cfg["gemini_api_key"] : cfg["groq_api_key"];
      if (!apiKey) return res.status(400).json({ message: `${provider === "gemini" ? "Gemini" : "Groq"} API key not configured in AI Configuration settings.` });
      const filePath = (req as any).file?.path;
      if (!filePath) return res.status(400).json({ message: "No file uploaded" });
      const imageData = fs.readFileSync(filePath);
      const base64 = imageData.toString("base64");
      const mimeType = (req as any).file?.mimetype || "image/jpeg";

      const prompt = `You are an OCR assistant for an Indian manufacturing ERP. Extract data from this Purchase Bill / Goods Receipt / Invoice image.
Return ONLY valid JSON (no markdown, no explanation):
{
  "supplierName": "string",
  "billNo": "string",
  "billDate": "YYYY-MM-DD or empty",
  "dcNo": "string",
  "paymentMode": "Cash or Credit",
  "items": [
    {
      "itemCode": "string",
      "itemName": "string",
      "batchNo": "string",
      "expiryDate": "YYYY-MM-DD or empty",
      "qty": number,
      "unit": "string",
      "rate": number,
      "cgstPct": number,
      "sgstPct": number,
      "igstPct": number
    }
  ]
}`;

      let extracted: any = {};
      if (provider === "gemini") {
        const genAI = new GoogleGenerativeAI(apiKey);
        const gModel = genAI.getGenerativeModel({ model });
        const result = await gModel.generateContent([{ inlineData: { data: base64, mimeType } }, prompt]);
        const text = result.response.text().trim().replace(/^```json\n?/,"").replace(/\n?```$/,"");
        extracted = JSON.parse(text);
      } else {
        const groqMime = mimeType === "application/pdf" ? "image/jpeg" : mimeType;
        const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role:"user", content:[
              { type:"image_url", image_url:{ url:`data:${groqMime};base64,${base64}` } },
              { type:"text", text:prompt }
            ]}],
            max_tokens: 2000, temperature: 0.1,
          }),
        });
        const jResp = await resp.json() as any;
        if (jResp.error) throw new Error(jResp.error.message || JSON.stringify(jResp.error));
        const rawText = jResp.choices?.[0]?.message?.content || "{}";
        extracted = JSON.parse(rawText.trim().replace(/^```json\n?/,"").replace(/\n?```$/,"").replace(/^```\n?/,"").replace(/\n?```$/,""));
      }
      try { fs.unlinkSync(filePath); } catch {}
      res.json({ ok: true, data: extracted });
    } catch (e: any) { res.status(500).json({ message: e.message || "Scan failed" }); }
  });

  // Get all warehouses (stores)
  app.get("/api/warehouses", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const r = await pool.query(`SELECT * FROM warehouses WHERE is_active=true ORDER BY name`);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // List GRNs
  app.get("/api/goods-receipt-notes", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const r = await pool.query(`
        SELECT g.*, c.name AS supplier_name_db, w.name AS store_name_db
        FROM goods_receipt_notes g
        LEFT JOIN customers c ON c.id = g.supplier_id
        LEFT JOIN warehouses w ON w.id = g.store_id
        ORDER BY g.created_at DESC
      `);
      res.json(r.rows.map((row: any) => ({
        ...row,
        supplier_name: row.supplier_name_db || row.supplier_name_manual || "",
        store_name: row.store_name_db || row.store_name || "",
      })));
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Get single GRN with items
  app.get("/api/goods-receipt-notes/:id", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const [hRes, iRes] = await Promise.all([
        pool.query(`SELECT g.*, c.name AS supplier_name_db, w.name AS store_name_db
          FROM goods_receipt_notes g
          LEFT JOIN customers c ON c.id = g.supplier_id
          LEFT JOIN warehouses w ON w.id = g.store_id
          WHERE g.id=$1`, [req.params.id]),
        pool.query(`SELECT * FROM goods_receipt_note_items WHERE grn_id=$1 ORDER BY sno`, [req.params.id]),
      ]);
      if (!hRes.rows[0]) return res.status(404).json({ message: "GRN not found" });
      const hdr = hRes.rows[0];
      res.json({
        ...hdr,
        supplier_name: hdr.supplier_name_db || hdr.supplier_name_manual || "",
        store_name: hdr.store_name_db || hdr.store_name || "",
        items: iRes.rows,
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // GRN voucher posting helper
  async function postGrnVoucher(client: any, hdr: any, b: any) {
    const PURCHASES_GL = "7e30f23a-4c07-4768-93cb-0c478916e99d";
    const SC_GL        = "20845da1-6847-43ce-98d5-7e3e3e44b86b";
    const CASH_GL      = "883c3242-ddd1-47af-9fd0-07e4c3a00c4f";
    const CGST_GL      = "cgst0001-0000-0000-0000-000000000001";
    const SGST_GL      = "sgst0001-0000-0000-0000-000000000001";
    const IGST_GL      = "igst0001-0000-0000-0000-000000000001";
    const ROUND_GL     = "rdof0001-0000-0000-0000-000000000001";

    const items = b.items || [];
    const taxableAmt = items.reduce((s: number, it: any) => s + (+it.taxable_amt||0), 0);
    const cgstAmt    = items.reduce((s: number, it: any) => s + (+it.cgst_amt||0), 0);
    const sgstAmt    = items.reduce((s: number, it: any) => s + (+it.sgst_amt||0), 0);
    const igstAmt    = items.reduce((s: number, it: any) => s + (+it.igst_amt||0), 0);
    const roundOff   = +(b.round_off||0);
    const grandTotal = +(b.grand_total||0) || (taxableAmt + cgstAmt + sgstAmt + igstAmt + roundOff);
    if (grandTotal <= 0) return;

    const fyRes = await client.query(`SELECT id, label FROM financial_years WHERE is_current=true LIMIT 1`);
    const fy = fyRes.rows[0] || { id: null, label: "" };
    const suppName = b.supplier_name || b.supplier_name_manual || "";

    // Delete existing voucher entries for re-post
    await client.query(`DELETE FROM voucher_det WHERE voucher_mas_id IN
      (SELECT id FROM voucher_mas WHERE source_type='grn' AND source_id=$1)`, [hdr.id]);
    await client.query(`DELETE FROM voucher_mas WHERE source_type='grn' AND source_id=$1`, [hdr.id]);
    await client.query(`DELETE FROM sub_ledger_bills WHERE ref_no=$1`, [hdr.voucher_no]);

    // Find or auto-create supplier sub_ledger under Sundry Creditors (lookup by name)
    let supplierSlId: string | null = null;
    if (suppName && (b.payment_mode||"Cash") === "Credit") {
      const slRes = await client.query(
        `SELECT id FROM sub_ledgers WHERE general_ledger_id=$1 AND LOWER(name)=LOWER($2) LIMIT 1`,
        [SC_GL, suppName]);
      if (slRes.rows.length > 0) {
        supplierSlId = slRes.rows[0].id;
      } else {
        const newSl = await client.query(`
          INSERT INTO sub_ledgers (id, code, name, general_ledger_id, payment_type, is_active)
          VALUES (gen_random_uuid()::text,$1,$2,$3,'Credit',true) RETURNING id`,
          [`SL-${Date.now()}`, suppName, SC_GL]);
        supplierSlId = newSl.rows[0].id;
      }
    }

    // Insert voucher_mas
    const vmRes = await client.query(`
      INSERT INTO voucher_mas
        (voucher_no, voucher_type, voucher_date, ref_no, ref_date,
         financial_year_id, financial_year, total_amount, taxable_amount, tax_amount,
         narration, source_type, source_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'grn',$12) RETURNING id
    `, [
      hdr.voucher_no, "Goods Receipt Note", hdr.grn_date,
      b.bill_no||hdr.voucher_no, b.bill_date||hdr.grn_date,
      fy.id, fy.label, grandTotal, taxableAmt, cgstAmt+sgstAmt+igstAmt,
      `GRN ${hdr.voucher_no} - ${suppName}`, hdr.id,
    ]);
    const vmId = vmRes.rows[0].id;

    let seq = 1;
    const det = async (gl: string, sl: string|null, drCr: string, amt: number, narr: string) => {
      if (amt === 0) return;
      await client.query(`INSERT INTO voucher_det (voucher_mas_id,seq_no,general_ledger_id,sub_ledger_id,dr_cr,amount,narration)
        VALUES ($1,$2,$3,$4,$5,$6,$7)`, [vmId, seq++, gl, sl, drCr, Math.abs(amt), narr]);
    };

    const isCash = (b.payment_mode||"Cash") === "Cash";

    // DR lines (purchases breakdown)
    await det(PURCHASES_GL, null, "DR", taxableAmt, `Purchases - ${suppName}`);
    await det(CGST_GL, null, "DR", cgstAmt, `CGST Input Credit`);
    await det(SGST_GL, null, "DR", sgstAmt, `SGST Input Credit`);
    if (igstAmt > 0) await det(IGST_GL, null, "DR", igstAmt, `IGST Input Credit`);
    if (roundOff !== 0) await det(ROUND_GL, null, roundOff > 0 ? "DR" : "CR", Math.abs(roundOff), `Round Off`);

    // CR line (cash or party)
    if (isCash) {
      await det(CASH_GL, null, "CR", grandTotal, `Cash Payment to ${suppName}`);
    } else {
      await det(SC_GL, supplierSlId, "CR", grandTotal, `Payable to ${suppName}`);
      // Outstanding bill
      if (supplierSlId) {
        await client.query(`INSERT INTO sub_ledger_bills
          (id, sub_ledger_id, ref_no, ref_date, voucher_no, voucher_date, amount, cr_dr)
          VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,'CR')`,
          [supplierSlId, b.bill_no||hdr.voucher_no, b.bill_date||hdr.grn_date,
           hdr.voucher_no, hdr.grn_date, grandTotal]);
      }
    }
  }

  // Create GRN
  app.post("/api/goods-receipt-notes", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const b = req.body;
      const { generateVoucherNo } = await import("./voucher");
      const voucher_no = await generateVoucherNo("purchase_receipt", client);

      // Compute totals from items
      const items = b.items || [];
      const total_qty      = items.reduce((s: number, it: any) => s + (+it.qty||0), 0);
      const taxable_amount = items.reduce((s: number, it: any) => s + (+it.taxable_amt||0), 0);
      const cgst_amount    = items.reduce((s: number, it: any) => s + (+it.cgst_amt||0), 0);
      const sgst_amount    = items.reduce((s: number, it: any) => s + (+it.sgst_amt||0), 0);
      const igst_amount    = items.reduce((s: number, it: any) => s + (+it.igst_amt||0), 0);
      const round_off      = +(b.round_off||0);
      const grand_total    = +(b.grand_total||0) || (taxable_amount + cgst_amount + sgst_amount + igst_amount + round_off);

      const hdrRes = await client.query(`
        INSERT INTO goods_receipt_notes
          (voucher_no, grn_date, store_id, store_name, supplier_id, supplier_name_manual,
           dc_no, bill_no, bill_date, payment_mode, purchase_type, po_id, po_no,
           total_qty, taxable_amount, cgst_amount, sgst_amount, igst_amount, round_off, grand_total,
           remark, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,'Draft')
        RETURNING *
      `, [voucher_no, b.grn_date||new Date().toISOString().slice(0,10),
          b.store_id||null, b.store_name||"", b.supplier_id||null, b.supplier_name_manual||"",
          b.dc_no||"", b.bill_no||"", b.bill_date||null, b.payment_mode||"Cash",
          b.purchase_type||"PO", b.po_id||null, b.po_no||"",
          total_qty, taxable_amount, cgst_amount, sgst_amount, igst_amount, round_off, grand_total,
          b.remark||""]);
      const hdr = hdrRes.rows[0];

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(`
          INSERT INTO goods_receipt_note_items
            (grn_id, sno, item_code, item_name, batch_no, expiry_date, qty, unit, rate,
             taxable_amt, cgst_pct, cgst_amt, sgst_pct, sgst_amt, igst_pct, igst_amt, total)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        `, [hdr.id, i+1, it.item_code||"", it.item_name||"", it.batch_no||"",
            it.expiry_date||null, +it.qty||0, it.unit||"", +it.rate||0,
            +it.taxable_amt||0, +it.cgst_pct||0, +it.cgst_amt||0,
            +it.sgst_pct||0, +it.sgst_amt||0, +it.igst_pct||0, +it.igst_amt||0, +it.total||0]);
      }

      await postGrnVoucher(client, hdr, { ...b, items, grand_total });
      await client.query("COMMIT");
      res.json(hdr);
    } catch (e: any) { await client.query("ROLLBACK"); res.status(400).json({ message: e.message }); }
    finally { client.release(); }
  });

  // Update GRN
  app.patch("/api/goods-receipt-notes/:id", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const b = req.body;
      const items = b.items || [];
      const total_qty      = items.reduce((s: number, it: any) => s + (+it.qty||0), 0);
      const taxable_amount = items.reduce((s: number, it: any) => s + (+it.taxable_amt||0), 0);
      const cgst_amount    = items.reduce((s: number, it: any) => s + (+it.cgst_amt||0), 0);
      const sgst_amount    = items.reduce((s: number, it: any) => s + (+it.sgst_amt||0), 0);
      const igst_amount    = items.reduce((s: number, it: any) => s + (+it.igst_amt||0), 0);
      const round_off      = +(b.round_off||0);
      const grand_total    = +(b.grand_total||0) || (taxable_amount + cgst_amount + sgst_amount + igst_amount + round_off);

      const hdrRes = await client.query(`
        UPDATE goods_receipt_notes SET
          grn_date=$1, store_id=$2, store_name=$3, supplier_id=$4, supplier_name_manual=$5,
          dc_no=$6, bill_no=$7, bill_date=$8, payment_mode=$9, purchase_type=$10,
          po_id=$11, po_no=$12, total_qty=$13, taxable_amount=$14, cgst_amount=$15,
          sgst_amount=$16, igst_amount=$17, round_off=$18, grand_total=$19, remark=$20
        WHERE id=$21 RETURNING *
      `, [b.grn_date, b.store_id||null, b.store_name||"", b.supplier_id||null, b.supplier_name_manual||"",
          b.dc_no||"", b.bill_no||"", b.bill_date||null, b.payment_mode||"Cash",
          b.purchase_type||"PO", b.po_id||null, b.po_no||"",
          total_qty, taxable_amount, cgst_amount, sgst_amount, igst_amount, round_off, grand_total,
          b.remark||"", req.params.id]);
      if (!hdrRes.rows[0]) { await client.query("ROLLBACK"); return res.status(404).json({ message: "GRN not found" }); }
      const hdr = hdrRes.rows[0];

      await client.query(`DELETE FROM goods_receipt_note_items WHERE grn_id=$1`, [hdr.id]);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await client.query(`
          INSERT INTO goods_receipt_note_items
            (grn_id, sno, item_code, item_name, batch_no, expiry_date, qty, unit, rate,
             taxable_amt, cgst_pct, cgst_amt, sgst_pct, sgst_amt, igst_pct, igst_amt, total)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        `, [hdr.id, i+1, it.item_code||"", it.item_name||"", it.batch_no||"",
            it.expiry_date||null, +it.qty||0, it.unit||"", +it.rate||0,
            +it.taxable_amt||0, +it.cgst_pct||0, +it.cgst_amt||0,
            +it.sgst_pct||0, +it.sgst_amt||0, +it.igst_pct||0, +it.igst_amt||0, +it.total||0]);
      }

      await postGrnVoucher(client, hdr, { ...b, items, grand_total });
      await client.query("COMMIT");
      res.json(hdr);
    } catch (e: any) { await client.query("ROLLBACK"); res.status(400).json({ message: e.message }); }
    finally { client.release(); }
  });

  // Delete GRN
  app.delete("/api/goods-receipt-notes/:id", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const hRes = await pool.query(`SELECT voucher_no FROM goods_receipt_notes WHERE id=$1`, [req.params.id]);
      if (!hRes.rows[0]) return res.status(404).json({ message: "GRN not found" });
      const vno = hRes.rows[0].voucher_no;
      await pool.query(`DELETE FROM voucher_det WHERE voucher_mas_id IN (SELECT id FROM voucher_mas WHERE source_type='grn' AND source_id=$1)`, [req.params.id]);
      await pool.query(`DELETE FROM voucher_mas WHERE source_type='grn' AND source_id=$1`, [req.params.id]);
      await pool.query(`DELETE FROM sub_ledger_bills WHERE ref_no=$1`, [vno]);
      await pool.query(`DELETE FROM goods_receipt_notes WHERE id=$1`, [req.params.id]);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Purchase Order Amendments ────────────────────────────────────────────────

  app.get("/api/purchase-order-amendments", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const r = await pool.query(`
        SELECT poa.*, c.name AS supplier_name_db
        FROM purchase_order_amendments poa
        LEFT JOIN customers c ON c.id = poa.supplier_id
        ORDER BY poa.created_at DESC
      `);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/purchase-order-amendments/:id", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const [hdr] = (await pool.query(`
        SELECT poa.*, c.name AS supplier_name_db
        FROM purchase_order_amendments poa
        LEFT JOIN customers c ON c.id = poa.supplier_id
        WHERE poa.id=$1
      `, [req.params.id])).rows;
      if (!hdr) return res.status(404).json({ message: "Not found" });
      const [items, terms, charges] = await Promise.all([
        pool.query(`SELECT * FROM purchase_order_amendment_items WHERE poa_id=$1 ORDER BY seq_no`, [req.params.id]),
        pool.query(`SELECT * FROM purchase_order_amendment_terms WHERE poa_id=$1 ORDER BY seq_no`, [req.params.id]),
        pool.query(`SELECT * FROM purchase_order_amendment_charges WHERE poa_id=$1 ORDER BY seq_no`, [req.params.id]),
      ]);
      res.json({ ...hdr, items: items.rows, terms: terms.rows, charges: charges.rows });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // Get the latest amendment for a specific PO (used by downstream screens)
  app.get("/api/purchase-orders/:id/latest-amendment", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const [hdr] = (await pool.query(`
        SELECT poa.*, c.name AS supplier_name_db
        FROM purchase_order_amendments poa
        LEFT JOIN customers c ON c.id = poa.supplier_id
        WHERE poa.original_po_id=$1
        ORDER BY poa.created_at DESC LIMIT 1
      `, [req.params.id])).rows;
      if (!hdr) return res.status(404).json({ message: "No amendment found" });
      const [items, terms, charges] = await Promise.all([
        pool.query(`SELECT * FROM purchase_order_amendment_items WHERE poa_id=$1 ORDER BY seq_no`, [hdr.id]),
        pool.query(`SELECT * FROM purchase_order_amendment_terms WHERE poa_id=$1 ORDER BY seq_no`, [hdr.id]),
        pool.query(`SELECT * FROM purchase_order_amendment_charges WHERE poa_id=$1 ORDER BY seq_no`, [hdr.id]),
      ]);
      res.json({ ...hdr, items: items.rows, terms: terms.rows, charges: charges.rows });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/purchase-order-amendments", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { generateVoucherNo } = await import("./voucher");
      const b = req.body;
      const voucher_no = await generateVoucherNo("purchase_order_amendment", client);
      const hRes = await client.query(`
        INSERT INTO purchase_order_amendments
          (voucher_no, amendment_date, original_po_id, original_po_no,
           supplier_id, supplier_name_manual, po_type, schedule_date,
           priority, payment_mode, our_ref_no, your_ref_no, delivery_location, remark, status)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *
      `, [voucher_no,
          b.amendment_date||new Date().toISOString().split("T")[0],
          b.original_po_id||null, b.original_po_no||"",
          b.supplier_id||null, b.supplier_name_manual||"",
          b.po_type||"Purchase Order", b.schedule_date||null,
          b.priority||"Medium", b.payment_mode||"Cash",
          b.our_ref_no||"", b.your_ref_no||"", b.delivery_location||"",
          b.remark||"", b.status||"Draft"]);
      const hdr = hRes.rows[0];
      for (let i=0; i<(b.items||[]).length; i++) {
        const it = b.items[i];
        await client.query(`
          INSERT INTO purchase_order_amendment_items
            (poa_id,seq_no,item_id,item_code,item_name,qty,unit,rate,taxable_amt,
             tax_code,cgst_pct,sgst_pct,igst_pct,cgst_amt,sgst_amt,igst_amt,total)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        `, [hdr.id,i+1,it.item_id||null,it.item_code||"",it.item_name||"",
            +it.qty||0,it.unit||"",+it.rate||0,+it.taxable_amt||0,
            it.tax_code||"",+it.cgst_pct||0,+it.sgst_pct||0,+it.igst_pct||0,
            +it.cgst_amt||0,+it.sgst_amt||0,+it.igst_amt||0,+it.total||0]);
      }
      for (let i=0; i<(b.terms||[]).length; i++) {
        const t = b.terms[i];
        await client.query(`INSERT INTO purchase_order_amendment_terms (poa_id,seq_no,term_type,terms) VALUES ($1,$2,$3,$4)`,
          [hdr.id,i+1,t.term_type||"",t.terms||""]);
      }
      for (let i=0; i<(b.charges||[]).length; i++) {
        const c = b.charges[i];
        await client.query(`INSERT INTO purchase_order_amendment_charges (poa_id,seq_no,charge_type,amount) VALUES ($1,$2,$3,$4)`,
          [hdr.id,i+1,c.charge_type||"",+c.amount||0]);
      }
      // Mark original PO as amended
      if (b.original_po_id) {
        await client.query(`UPDATE purchase_orders SET status='Amended' WHERE id=$1`, [b.original_po_id]);
      }
      await client.query("COMMIT");
      res.json({ ...hdr, voucher_no });
    } catch (e: any) { await client.query("ROLLBACK"); res.status(400).json({ message: e.message }); }
    finally { client.release(); }
  });

  app.patch("/api/purchase-order-amendments/:id", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const b = req.body;
      const hRes = await client.query(`
        UPDATE purchase_order_amendments SET
          amendment_date=$1, original_po_id=$2, original_po_no=$3,
          supplier_id=$4, supplier_name_manual=$5, po_type=$6, schedule_date=$7,
          priority=$8, payment_mode=$9, our_ref_no=$10, your_ref_no=$11,
          delivery_location=$12, remark=$13, status=$14
        WHERE id=$15 RETURNING *
      `, [b.amendment_date, b.original_po_id||null, b.original_po_no||"",
          b.supplier_id||null, b.supplier_name_manual||"",
          b.po_type||"Purchase Order", b.schedule_date||null,
          b.priority||"Medium", b.payment_mode||"Cash",
          b.our_ref_no||"", b.your_ref_no||"",
          b.delivery_location||"", b.remark||"", b.status||"Draft",
          req.params.id]);
      await client.query(`DELETE FROM purchase_order_amendment_items WHERE poa_id=$1`, [req.params.id]);
      await client.query(`DELETE FROM purchase_order_amendment_terms WHERE poa_id=$1`, [req.params.id]);
      await client.query(`DELETE FROM purchase_order_amendment_charges WHERE poa_id=$1`, [req.params.id]);
      for (let i=0; i<(b.items||[]).length; i++) {
        const it = b.items[i];
        await client.query(`
          INSERT INTO purchase_order_amendment_items
            (poa_id,seq_no,item_id,item_code,item_name,qty,unit,rate,taxable_amt,
             tax_code,cgst_pct,sgst_pct,igst_pct,cgst_amt,sgst_amt,igst_amt,total)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
        `, [req.params.id,i+1,it.item_id||null,it.item_code||"",it.item_name||"",
            +it.qty||0,it.unit||"",+it.rate||0,+it.taxable_amt||0,
            it.tax_code||"",+it.cgst_pct||0,+it.sgst_pct||0,+it.igst_pct||0,
            +it.cgst_amt||0,+it.sgst_amt||0,+it.igst_amt||0,+it.total||0]);
      }
      for (let i=0; i<(b.terms||[]).length; i++) {
        const t = b.terms[i];
        await client.query(`INSERT INTO purchase_order_amendment_terms (poa_id,seq_no,term_type,terms) VALUES ($1,$2,$3,$4)`,
          [req.params.id,i+1,t.term_type||"",t.terms||""]);
      }
      for (let i=0; i<(b.charges||[]).length; i++) {
        const c = b.charges[i];
        await client.query(`INSERT INTO purchase_order_amendment_charges (poa_id,seq_no,charge_type,amount) VALUES ($1,$2,$3,$4)`,
          [req.params.id,i+1,c.charge_type||"",+c.amount||0]);
      }
      await client.query("COMMIT");
      res.json(hRes.rows[0]);
    } catch (e: any) { await client.query("ROLLBACK"); res.status(400).json({ message: e.message }); }
    finally { client.release(); }
  });

  app.delete("/api/purchase-order-amendments/:id", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      await pool.query(`DELETE FROM purchase_order_amendments WHERE id=$1`, [req.params.id]);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  // ── Gate Pass ───────────────────────────────────────────────────────────────

  // Returns which source IDs are already linked to a gate pass
  app.get("/api/gate-pass/linked-source-ids", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const excludeId = (req.query.exclude_gate_pass_id as string) || null;
      const cond = excludeId ? "AND gp.id <> $1" : "";
      const params = excludeId ? [excludeId] : [];
      const riRes = await pool.query(`
        SELECT DISTINCT source_inward_id FROM gate_pass gp
        WHERE source_inward_id IS NOT NULL ${cond}
      `, params);
      const roRes = await pool.query(`
        SELECT DISTINCT source_outward_id FROM gate_pass gp
        WHERE source_outward_id IS NOT NULL ${cond}
      `, params);
      res.json({
        returnable_inward_ids:  riRes.rows.map((r: any) => r.source_inward_id),
        returnable_outward_ids: roRes.rows.map((r: any) => r.source_outward_id),
      });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/gate-pass", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const r = await pool.query(`
        SELECT gp.*, c.name AS party_name_db
        FROM gate_pass gp
        LEFT JOIN customers c ON c.id = gp.party_id
        ORDER BY gp.created_at DESC
      `);
      res.json(r.rows);
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.get("/api/gate-pass/:id", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      const [header] = (await pool.query(`
        SELECT gp.*, c.name AS party_name_db
        FROM gate_pass gp
        LEFT JOIN customers c ON c.id = gp.party_id
        WHERE gp.id = $1
      `, [req.params.id])).rows;
      if (!header) return res.status(404).json({ message: "Not found" });
      const items = (await pool.query(
        `SELECT * FROM gate_pass_items WHERE gate_pass_id=$1 ORDER BY seq_no`,
        [req.params.id]
      )).rows;
      res.json({ ...header, items });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  app.post("/api/gate-pass", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const { generateVoucherNo } = await import("./voucher");
      const b = req.body;
      const voucher_no = await generateVoucherNo("gate_pass", client);
      const hRes = await client.query(`
        INSERT INTO gate_pass
          (voucher_no, entry_type, party_id, party_name_manual, outward_date, due_date,
           vehicle_no, contact_person, mobile_no, email_id, delivery_address,
           same_as_company, source_inward_id, source_outward_id, remark)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *
      `, [voucher_no, b.entry_type||"non_returnable_outward",
          b.party_id||null, b.party_name_manual||"",
          b.outward_date||new Date().toISOString().split("T")[0],
          b.due_date||null, b.vehicle_no||"",
          b.contact_person||"", b.mobile_no||"", b.email_id||"",
          b.delivery_address||"", b.same_as_company!==false,
          b.source_inward_id||null, b.source_outward_id||null, b.remark||""]);
      const hdr = hRes.rows[0];
      for (let i = 0; i < (b.items||[]).length; i++) {
        const it = b.items[i];
        await client.query(`
          INSERT INTO gate_pass_items
            (gate_pass_id, seq_no, item_type, item_id, item_code, item_name,
             hsn, out_qty, unit, rate, purpose, total_value)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        `, [hdr.id, i+1, it.item_type||"", it.item_id||null, it.item_code||"",
            it.item_name||"", it.hsn||"", parseFloat(it.out_qty||0),
            it.unit||"", parseFloat(it.rate||0), it.purpose||"",
            parseFloat(it.total_value||0)]);
      }
      await client.query("COMMIT");
      res.json({ ...hdr, voucher_no });
    } catch (e: any) { await client.query("ROLLBACK"); res.status(400).json({ message: e.message }); }
    finally { client.release(); }
  });

  app.patch("/api/gate-pass/:id", requireAuth, async (req, res) => {
    const { pool } = await import("./db");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const b = req.body;
      const hRes = await client.query(`
        UPDATE gate_pass SET
          entry_type=$1, party_id=$2, party_name_manual=$3, outward_date=$4,
          due_date=$5, vehicle_no=$6, contact_person=$7, mobile_no=$8,
          email_id=$9, delivery_address=$10, same_as_company=$11,
          source_inward_id=$12, source_outward_id=$13, remark=$14
        WHERE id=$15 RETURNING *
      `, [b.entry_type, b.party_id||null, b.party_name_manual||"",
          b.outward_date, b.due_date||null, b.vehicle_no||"",
          b.contact_person||"", b.mobile_no||"", b.email_id||"",
          b.delivery_address||"", b.same_as_company!==false,
          b.source_inward_id||null, b.source_outward_id||null, b.remark||"",
          req.params.id]);
      await client.query(`DELETE FROM gate_pass_items WHERE gate_pass_id=$1`, [req.params.id]);
      for (let i = 0; i < (b.items||[]).length; i++) {
        const it = b.items[i];
        await client.query(`
          INSERT INTO gate_pass_items
            (gate_pass_id, seq_no, item_type, item_id, item_code, item_name,
             hsn, out_qty, unit, rate, purpose, total_value)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        `, [req.params.id, i+1, it.item_type||"", it.item_id||null, it.item_code||"",
            it.item_name||"", it.hsn||"", parseFloat(it.out_qty||0),
            it.unit||"", parseFloat(it.rate||0), it.purpose||"",
            parseFloat(it.total_value||0)]);
      }
      await client.query("COMMIT");
      res.json(hRes.rows[0]);
    } catch (e: any) { await client.query("ROLLBACK"); res.status(400).json({ message: e.message }); }
    finally { client.release(); }
  });

  app.delete("/api/gate-pass/:id", requireAuth, async (req, res) => {
    try {
      const { pool } = await import("./db");
      await pool.query(`DELETE FROM gate_pass WHERE id=$1`, [req.params.id]);
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: e.message }); }
  });

  return httpServer;
}
