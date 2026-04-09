import { db } from "./db";
import { eq, desc, ilike, or, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import {
  users, suppliers, customers, inventoryCategories, inventoryItems,
  purchaseInvoices, purchaseInvoiceItems, salesInvoices, salesInvoiceItems,
  accounts, journalEntries, journalEntryLines, tasks, tallySyncLogs,
  type User, type InsertUser,
  type Supplier, type InsertSupplier,
  type Customer, type InsertCustomer,
  type InventoryCategory, type InsertInventoryCategory,
  type InventoryItem, type InsertInventoryItem,
  type PurchaseInvoice, type InsertPurchaseInvoice,
  type PurchaseInvoiceItem, type InsertPurchaseInvoiceItem,
  type SalesInvoice, type InsertSalesInvoice,
  type SalesInvoiceItem, type InsertSalesInvoiceItem,
  type Account, type InsertAccount,
  type JournalEntry, type InsertJournalEntry,
  type JournalEntryLine, type InsertJournalEntryLine,
  type Task, type InsertTask,
  type TallySyncLog, type InsertTallySyncLog,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  listUsers(): Promise<User[]>;

  // Suppliers
  listSuppliers(): Promise<Supplier[]>;
  getSupplier(id: string): Promise<Supplier | undefined>;
  createSupplier(s: InsertSupplier): Promise<Supplier>;
  updateSupplier(id: string, s: Partial<InsertSupplier>): Promise<Supplier>;
  deleteSupplier(id: string): Promise<void>;

  // Customers
  listCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  createCustomer(c: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, c: Partial<InsertCustomer>): Promise<Customer>;
  deleteCustomer(id: string): Promise<void>;

  // Inventory Categories
  listInventoryCategories(): Promise<InventoryCategory[]>;
  createInventoryCategory(c: InsertInventoryCategory): Promise<InventoryCategory>;
  updateInventoryCategory(id: string, c: Partial<InsertInventoryCategory>): Promise<InventoryCategory>;
  deleteInventoryCategory(id: string): Promise<void>;

  // Inventory Items
  listInventoryItems(): Promise<InventoryItem[]>;
  getInventoryItem(id: string): Promise<InventoryItem | undefined>;
  createInventoryItem(i: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: string, i: Partial<InsertInventoryItem>): Promise<InventoryItem>;
  deleteInventoryItem(id: string): Promise<void>;

  // Purchase Invoices
  listPurchaseInvoices(): Promise<PurchaseInvoice[]>;
  getPurchaseInvoice(id: string): Promise<PurchaseInvoice | undefined>;
  createPurchaseInvoice(inv: InsertPurchaseInvoice): Promise<PurchaseInvoice>;
  updatePurchaseInvoice(id: string, inv: Partial<InsertPurchaseInvoice>): Promise<PurchaseInvoice>;
  deletePurchaseInvoice(id: string): Promise<void>;
  listPurchaseInvoiceItems(invoiceId: string): Promise<PurchaseInvoiceItem[]>;
  createPurchaseInvoiceItem(item: InsertPurchaseInvoiceItem): Promise<PurchaseInvoiceItem>;
  deletePurchaseInvoiceItems(invoiceId: string): Promise<void>;

  // Sales Invoices
  listSalesInvoices(): Promise<SalesInvoice[]>;
  getSalesInvoice(id: string): Promise<SalesInvoice | undefined>;
  createSalesInvoice(inv: InsertSalesInvoice): Promise<SalesInvoice>;
  updateSalesInvoice(id: string, inv: Partial<InsertSalesInvoice>): Promise<SalesInvoice>;
  deleteSalesInvoice(id: string): Promise<void>;
  listSalesInvoiceItems(invoiceId: string): Promise<SalesInvoiceItem[]>;
  createSalesInvoiceItem(item: InsertSalesInvoiceItem): Promise<SalesInvoiceItem>;
  deleteSalesInvoiceItems(invoiceId: string): Promise<void>;

  // Accounts
  listAccounts(): Promise<Account[]>;
  createAccount(a: InsertAccount): Promise<Account>;
  updateAccount(id: string, a: Partial<InsertAccount>): Promise<Account>;
  deleteAccount(id: string): Promise<void>;

  // Journal Entries
  listJournalEntries(): Promise<JournalEntry[]>;
  getJournalEntry(id: string): Promise<JournalEntry | undefined>;
  createJournalEntry(e: InsertJournalEntry): Promise<JournalEntry>;
  listJournalEntryLines(entryId: string): Promise<JournalEntryLine[]>;
  createJournalEntryLine(line: InsertJournalEntryLine): Promise<JournalEntryLine>;

  // Tasks
  listTasks(): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(t: InsertTask): Promise<Task>;
  updateTask(id: string, t: Partial<InsertTask>): Promise<Task>;
  deleteTask(id: string): Promise<void>;

  // Tally Sync Logs
  listTallySyncLogs(): Promise<TallySyncLog[]>;
  createTallySyncLog(log: InsertTallySyncLog): Promise<TallySyncLog>;

  // Dashboard stats
  getDashboardStats(): Promise<{
    totalSales: number; totalPurchases: number; stockValue: number;
    pendingTasks: number; salesThisMonth: number; purchasesThisMonth: number;
    recentPurchases: PurchaseInvoice[]; recentSales: SalesInvoice[]; lowStockItems: InventoryItem[];
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string) {
    const [u] = await db.select().from(users).where(eq(users.id, id));
    return u;
  }
  async getUserByUsername(username: string) {
    const [u] = await db.select().from(users).where(eq(users.username, username));
    return u;
  }
  async createUser(user: InsertUser) {
    const hashed = await bcrypt.hash(user.password, 10);
    const [u] = await db.insert(users).values({ ...user, password: hashed, id: randomUUID() }).returning();
    return u;
  }
  async listUsers() {
    return db.select().from(users).orderBy(users.name);
  }

  async listSuppliers() { return db.select().from(suppliers).orderBy(suppliers.name); }
  async getSupplier(id: string) { const [s] = await db.select().from(suppliers).where(eq(suppliers.id, id)); return s; }
  async createSupplier(s: InsertSupplier) { const [r] = await db.insert(suppliers).values({ ...s, id: randomUUID() }).returning(); return r; }
  async updateSupplier(id: string, s: Partial<InsertSupplier>) { const [r] = await db.update(suppliers).set(s).where(eq(suppliers.id, id)).returning(); return r; }
  async deleteSupplier(id: string) { await db.delete(suppliers).where(eq(suppliers.id, id)); }

  async listCustomers() { return db.select().from(customers).orderBy(customers.name); }
  async getCustomer(id: string) { const [c] = await db.select().from(customers).where(eq(customers.id, id)); return c; }
  async createCustomer(c: InsertCustomer) { const [r] = await db.insert(customers).values({ ...c, id: randomUUID() }).returning(); return r; }
  async updateCustomer(id: string, c: Partial<InsertCustomer>) { const [r] = await db.update(customers).set(c).where(eq(customers.id, id)).returning(); return r; }
  async deleteCustomer(id: string) { await db.delete(customers).where(eq(customers.id, id)); }

  async listInventoryCategories() { return db.select().from(inventoryCategories).orderBy(inventoryCategories.name); }
  async createInventoryCategory(c: InsertInventoryCategory) { const [r] = await db.insert(inventoryCategories).values({ ...c, id: randomUUID() }).returning(); return r; }
  async updateInventoryCategory(id: string, c: Partial<InsertInventoryCategory>) { const [r] = await db.update(inventoryCategories).set(c).where(eq(inventoryCategories.id, id)).returning(); return r; }
  async deleteInventoryCategory(id: string) { await db.delete(inventoryCategories).where(eq(inventoryCategories.id, id)); }

  async listInventoryItems() { return db.select().from(inventoryItems).orderBy(inventoryItems.name); }
  async getInventoryItem(id: string) { const [i] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id)); return i; }
  async createInventoryItem(i: InsertInventoryItem) { const [r] = await db.insert(inventoryItems).values({ ...i, id: randomUUID() }).returning(); return r; }
  async updateInventoryItem(id: string, i: Partial<InsertInventoryItem>) { const [r] = await db.update(inventoryItems).set(i).where(eq(inventoryItems.id, id)).returning(); return r; }
  async deleteInventoryItem(id: string) { await db.delete(inventoryItems).where(eq(inventoryItems.id, id)); }

  async listPurchaseInvoices() { return db.select().from(purchaseInvoices).orderBy(desc(purchaseInvoices.createdAt)); }
  async getPurchaseInvoice(id: string) { const [i] = await db.select().from(purchaseInvoices).where(eq(purchaseInvoices.id, id)); return i; }
  async createPurchaseInvoice(inv: InsertPurchaseInvoice) { const [r] = await db.insert(purchaseInvoices).values({ ...inv, id: randomUUID() }).returning(); return r; }
  async updatePurchaseInvoice(id: string, inv: Partial<InsertPurchaseInvoice>) { const [r] = await db.update(purchaseInvoices).set({ ...inv, updatedAt: new Date() }).where(eq(purchaseInvoices.id, id)).returning(); return r; }
  async deletePurchaseInvoice(id: string) { await db.delete(purchaseInvoiceItems).where(eq(purchaseInvoiceItems.invoiceId, id)); await db.delete(purchaseInvoices).where(eq(purchaseInvoices.id, id)); }
  async listPurchaseInvoiceItems(invoiceId: string) { return db.select().from(purchaseInvoiceItems).where(eq(purchaseInvoiceItems.invoiceId, invoiceId)); }
  async createPurchaseInvoiceItem(item: InsertPurchaseInvoiceItem) { const [r] = await db.insert(purchaseInvoiceItems).values({ ...item, id: randomUUID() }).returning(); return r; }
  async deletePurchaseInvoiceItems(invoiceId: string) { await db.delete(purchaseInvoiceItems).where(eq(purchaseInvoiceItems.invoiceId, invoiceId)); }

  async listSalesInvoices() { return db.select().from(salesInvoices).orderBy(desc(salesInvoices.createdAt)); }
  async getSalesInvoice(id: string) { const [i] = await db.select().from(salesInvoices).where(eq(salesInvoices.id, id)); return i; }
  async createSalesInvoice(inv: InsertSalesInvoice) { const [r] = await db.insert(salesInvoices).values({ ...inv, id: randomUUID() }).returning(); return r; }
  async updateSalesInvoice(id: string, inv: Partial<InsertSalesInvoice>) { const [r] = await db.update(salesInvoices).set({ ...inv, updatedAt: new Date() }).where(eq(salesInvoices.id, id)).returning(); return r; }
  async deleteSalesInvoice(id: string) { await db.delete(salesInvoiceItems).where(eq(salesInvoiceItems.invoiceId, id)); await db.delete(salesInvoices).where(eq(salesInvoices.id, id)); }
  async listSalesInvoiceItems(invoiceId: string) { return db.select().from(salesInvoiceItems).where(eq(salesInvoiceItems.invoiceId, invoiceId)); }
  async createSalesInvoiceItem(item: InsertSalesInvoiceItem) { const [r] = await db.insert(salesInvoiceItems).values({ ...item, id: randomUUID() }).returning(); return r; }
  async deleteSalesInvoiceItems(invoiceId: string) { await db.delete(salesInvoiceItems).where(eq(salesInvoiceItems.invoiceId, invoiceId)); }

  async listAccounts() { return db.select().from(accounts).orderBy(accounts.code); }
  async createAccount(a: InsertAccount) { const [r] = await db.insert(accounts).values({ ...a, id: randomUUID() }).returning(); return r; }
  async updateAccount(id: string, a: Partial<InsertAccount>) { const [r] = await db.update(accounts).set(a).where(eq(accounts.id, id)).returning(); return r; }
  async deleteAccount(id: string) { await db.delete(accounts).where(eq(accounts.id, id)); }

  async listJournalEntries() { return db.select().from(journalEntries).orderBy(desc(journalEntries.createdAt)); }
  async getJournalEntry(id: string) { const [e] = await db.select().from(journalEntries).where(eq(journalEntries.id, id)); return e; }
  async createJournalEntry(e: InsertJournalEntry) { const [r] = await db.insert(journalEntries).values({ ...e, id: randomUUID() }).returning(); return r; }
  async listJournalEntryLines(entryId: string) { return db.select().from(journalEntryLines).where(eq(journalEntryLines.entryId, entryId)); }
  async createJournalEntryLine(line: InsertJournalEntryLine) { const [r] = await db.insert(journalEntryLines).values({ ...line, id: randomUUID() }).returning(); return r; }

  async listTasks() { return db.select().from(tasks).orderBy(desc(tasks.createdAt)); }
  async getTask(id: string) { const [t] = await db.select().from(tasks).where(eq(tasks.id, id)); return t; }
  async createTask(t: InsertTask) { const [r] = await db.insert(tasks).values({ ...t, id: randomUUID() }).returning(); return r; }
  async updateTask(id: string, t: Partial<InsertTask>) { const [r] = await db.update(tasks).set(t).where(eq(tasks.id, id)).returning(); return r; }
  async deleteTask(id: string) { await db.delete(tasks).where(eq(tasks.id, id)); }

  async listTallySyncLogs() { return db.select().from(tallySyncLogs).orderBy(desc(tallySyncLogs.syncedAt)).limit(50); }
  async createTallySyncLog(log: InsertTallySyncLog) { const [r] = await db.insert(tallySyncLogs).values({ ...log, id: randomUUID() }).returning(); return r; }

  async getDashboardStats() {
    const [allPurchases, allSales, allItems, allTasks] = await Promise.all([
      db.select().from(purchaseInvoices).orderBy(desc(purchaseInvoices.createdAt)).limit(5),
      db.select().from(salesInvoices).orderBy(desc(salesInvoices.createdAt)).limit(5),
      db.select().from(inventoryItems),
      db.select().from(tasks).where(eq(tasks.status, "pending")),
    ]);
    const allPurchasesAll = await db.select().from(purchaseInvoices);
    const allSalesAll = await db.select().from(salesInvoices);
    const totalPurchases = allPurchasesAll.reduce((s, i) => s + Number(i.totalAmount), 0);
    const totalSales = allSalesAll.reduce((s, i) => s + Number(i.totalAmount), 0);
    const stockValue = allItems.reduce((s, i) => s + Number(i.stockQuantity) * Number(i.purchasePrice), 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const salesThisMonth = allSalesAll.filter(i => i.invoiceDate >= monthStart).reduce((s, i) => s + Number(i.totalAmount), 0);
    const purchasesThisMonth = allPurchasesAll.filter(i => i.invoiceDate >= monthStart).reduce((s, i) => s + Number(i.totalAmount), 0);
    const lowStockItems = allItems.filter(i => Number(i.stockQuantity) <= Number(i.minStockLevel)).slice(0, 5);
    return { totalSales, totalPurchases, stockValue, pendingTasks: allTasks.length, salesThisMonth, purchasesThisMonth, recentPurchases: allPurchases, recentSales: allSales, lowStockItems };
  }
}

export const storage = new DatabaseStorage();
