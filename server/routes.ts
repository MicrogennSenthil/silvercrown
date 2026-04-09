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

  return httpServer;
}
