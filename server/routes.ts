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
    const { items, ...invData } = req.body;
    const data = insertPurchaseInvoiceSchema.parse(invData);
    const inv = await storage.createPurchaseInvoice(data);
    if (items?.length) {
      for (const item of items) {
        await storage.createPurchaseInvoiceItem({ ...item, invoiceId: inv.id });
      }
    }
    res.json(inv);
  });
  app.patch("/api/purchase/invoices/:id", requireAuth, async (req, res) => {
    const { items, ...invData } = req.body;
    const inv = await storage.updatePurchaseInvoice(req.params.id, invData);
    if (items) {
      await storage.deletePurchaseInvoiceItems(req.params.id);
      for (const item of items) {
        await storage.createPurchaseInvoiceItem({ ...item, invoiceId: req.params.id });
      }
    }
    res.json(inv);
  });
  app.delete("/api/purchase/invoices/:id", requireAuth, async (req, res) => {
    await storage.deletePurchaseInvoice(req.params.id);
    res.json({ ok: true });
  });

  // Gemini Invoice Scanning
  app.post("/api/purchase/scan", requireAuth, upload.single("invoice"), async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ message: "Gemini API key not configured" });
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
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
    const { items, ...invData } = req.body;
    const data = insertSalesInvoiceSchema.parse(invData);
    const inv = await storage.createSalesInvoice(data);
    if (items?.length) {
      for (const item of items) {
        await storage.createSalesInvoiceItem({ ...item, invoiceId: inv.id });
      }
    }
    res.json(inv);
  });
  app.patch("/api/sales/invoices/:id", requireAuth, async (req, res) => {
    const { items, ...invData } = req.body;
    const inv = await storage.updateSalesInvoice(req.params.id, invData);
    if (items) {
      await storage.deleteSalesInvoiceItems(req.params.id);
      for (const item of items) {
        await storage.createSalesInvoiceItem({ ...item, invoiceId: req.params.id });
      }
    }
    res.json(inv);
  });
  app.delete("/api/sales/invoices/:id", requireAuth, async (req, res) => {
    await storage.deleteSalesInvoice(req.params.id);
    res.json({ ok: true });
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
    const { lines, ...entryData } = req.body;
    const data = insertJournalEntrySchema.parse(entryData);
    const entry = await storage.createJournalEntry(data);
    if (lines?.length) {
      for (const line of lines) {
        await storage.createJournalEntryLine({ ...line, entryId: entry.id });
      }
    }
    res.json(entry);
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
      const model = cfg["ai_model"] || "gemini-1.5-flash";
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
        // Groq via fetch
        const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: [
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
              { type: "text", text: prompt }
            ]}],
            max_tokens: 1500,
          }),
        });
        const jResp = await resp.json() as any;
        const text = jResp.choices?.[0]?.message?.content?.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "") || "{}";
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
  app.post("/api/job-work-inward", requireAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { items = [], ...data } = req.body;
      // Auto-generate voucher_no if not provided
      if (!data.voucher_no) {
        const { generateVoucherNo } = await import("./voucher");
        data.voucher_no = await generateVoucherNo("job_work_inward");
      }
      const [header] = (await db.execute(sql`
        INSERT INTO job_work_inward (id, voucher_no, inward_date, party_id, party_name_manual, party_dc_no, party_dc_date, delivery_date, work_order_no, party_po_no, vehicle_no, notes, status)
        VALUES (gen_random_uuid(), ${data.voucher_no}, ${data.inward_date || new Date().toISOString().split("T")[0]}, ${data.party_id || null}, ${data.party_name_manual || ""}, ${data.party_dc_no || ""}, ${data.party_dc_date || null}, ${data.delivery_date || null}, ${data.work_order_no || ""}, ${data.party_po_no || ""}, ${data.vehicle_no || ""}, ${data.notes || ""}, 'Saved')
        RETURNING *
      `)).rows;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await db.execute(sql`INSERT INTO job_work_inward_items (id, inward_id, seq_no, item_code, item_id, item_name, qty, unit, process, hsn, remark) VALUES (gen_random_uuid(), ${header.id}, ${i + 1}, ${it.item_code || ""}, ${it.item_id || null}, ${it.item_name || ""}, ${it.qty || 0}, ${it.unit || ""}, ${it.process || ""}, ${it.hsn || ""}, ${it.remark || ""})`);
      }
      res.json(header);
    } catch (e: any) { console.error(e); res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/job-work-inward/:id", requireAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      const { items = [], ...data } = req.body;
      await db.execute(sql`UPDATE job_work_inward SET inward_date=${data.inward_date}, party_id=${data.party_id || null}, party_name_manual=${data.party_name_manual || ""}, party_dc_no=${data.party_dc_no || ""}, party_dc_date=${data.party_dc_date || null}, delivery_date=${data.delivery_date || null}, work_order_no=${data.work_order_no || ""}, party_po_no=${data.party_po_no || ""}, vehicle_no=${data.vehicle_no || ""}, notes=${data.notes || ""}, status='Saved' WHERE id=${req.params.id}`);
      await db.execute(sql`DELETE FROM job_work_inward_items WHERE inward_id = ${req.params.id}`);
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await db.execute(sql`INSERT INTO job_work_inward_items (id, inward_id, seq_no, item_code, item_id, item_name, qty, unit, process, hsn, remark) VALUES (gen_random_uuid(), ${req.params.id}, ${i + 1}, ${it.item_code || ""}, ${it.item_id || null}, ${it.item_name || ""}, ${it.qty || 0}, ${it.unit || ""}, ${it.process || ""}, ${it.hsn || ""}, ${it.remark || ""})`);
      }
      const [header] = (await db.execute(sql`SELECT * FROM job_work_inward WHERE id = ${req.params.id}`)).rows;
      res.json(header);
    } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.delete("/api/job-work-inward/:id", requireAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { sql } = await import("drizzle-orm");
      await db.execute(sql`DELETE FROM job_work_inward WHERE id = ${req.params.id}`);
      res.json({ ok: true });
    } catch (e: any) { res.status(400).json({ message: e.message }); }
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

  // Approval Authority
  app.get("/api/approval-authority", requireAuth, async (req, res) => { res.json(await storage.listApprovalAuthority()); });
  app.post("/api/approval-authority", requireAuth, async (req, res) => {
    try { res.json(await storage.createApprovalAuthority(req.body)); } catch (e: any) { res.status(400).json({ message: e.message }); }
  });
  app.patch("/api/approval-authority/:id", requireAuth, async (req, res) => { res.json(await storage.updateApprovalAuthority(req.params.id, req.body)); });
  app.delete("/api/approval-authority/:id", requireAuth, async (req, res) => { await storage.deleteApprovalAuthority(req.params.id); res.json({ ok: true }); });

  return httpServer;
}
