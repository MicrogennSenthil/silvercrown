import { sql } from "drizzle-orm";
import {
  pgTable, text, varchar, integer, decimal, boolean,
  timestamp, pgEnum
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "manager", "user"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["draft", "pending", "approved", "paid", "cancelled"]);
export const taskPriorityEnum = pgEnum("task_priority", ["low", "medium", "high"]);
export const taskStatusEnum = pgEnum("task_status", ["pending", "in_progress", "completed", "cancelled"]);
export const accountTypeEnum = pgEnum("account_type", ["asset", "liability", "income", "expense", "equity"]);
export const syncStatusEnum = pgEnum("sync_status", ["success", "failed", "partial"]);

// Users
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull().default(""),
  email: text("email").default(""),
  role: userRoleEnum("role").notNull().default("user"),
  employeeId: varchar("employee_id"),
  userRoleId: varchar("user_role_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertUserSchema = createInsertSchema(users).pick({ username: true, password: true, name: true, email: true, role: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Suppliers
export const suppliers = pgTable("suppliers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").default(""),
  phone: text("phone").default(""),
  address: text("address").default(""),
  gstin: text("gstin").default(""),
  contactPerson: text("contact_person").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, createdAt: true });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

// Customers
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").default(""),
  phone: text("phone").default(""),
  address: text("address").default(""),
  gstin: text("gstin").default(""),
  contactPerson: text("contact_person").default(""),
  creditLimit: decimal("credit_limit", { precision: 15, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true });
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// Inventory Categories
export const inventoryCategories = pgTable("inventory_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertInventoryCategorySchema = createInsertSchema(inventoryCategories).omit({ id: true, createdAt: true });
export type InsertInventoryCategory = z.infer<typeof insertInventoryCategorySchema>;
export type InventoryCategory = typeof inventoryCategories.$inferSelect;

// Inventory Items
export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  categoryId: varchar("category_id").references(() => inventoryCategories.id),
  unit: text("unit").notNull().default("Nos"),
  description: text("description").default(""),
  purchasePrice: decimal("purchase_price", { precision: 15, scale: 2 }).default("0"),
  sellingPrice: decimal("selling_price", { precision: 15, scale: 2 }).default("0"),
  stockQuantity: decimal("stock_quantity", { precision: 15, scale: 3 }).default("0"),
  minStockLevel: decimal("min_stock_level", { precision: 15, scale: 3 }).default("0"),
  hsnCode: text("hsn_code").default(""),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("18"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({ id: true, createdAt: true });
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;

// Purchase Invoices
export const purchaseInvoices = pgTable("purchase_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(),
  supplierId: varchar("supplier_id").references(() => suppliers.id),
  supplierName: text("supplier_name").default(""),
  invoiceDate: text("invoice_date").notNull(),
  dueDate: text("due_date").default(""),
  subtotal: decimal("subtotal", { precision: 15, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).default("0"),
  paidAmount: decimal("paid_amount", { precision: 15, scale: 2 }).default("0"),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  notes: text("notes").default(""),
  scannedImageUrl: text("scanned_image_url").default(""),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertPurchaseInvoiceSchema = createInsertSchema(purchaseInvoices).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPurchaseInvoice = z.infer<typeof insertPurchaseInvoiceSchema>;
export type PurchaseInvoice = typeof purchaseInvoices.$inferSelect;

// Purchase Invoice Items
export const purchaseInvoiceItems = pgTable("purchase_invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => purchaseInvoices.id),
  itemId: varchar("item_id").references(() => inventoryItems.id),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 3 }).notNull().default("1"),
  unit: text("unit").default("Nos"),
  unitPrice: decimal("unit_price", { precision: 15, scale: 2 }).notNull().default("0"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }).default("0"),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull().default("0"),
});
export const insertPurchaseInvoiceItemSchema = createInsertSchema(purchaseInvoiceItems).omit({ id: true });
export type InsertPurchaseInvoiceItem = z.infer<typeof insertPurchaseInvoiceItemSchema>;
export type PurchaseInvoiceItem = typeof purchaseInvoiceItems.$inferSelect;

// Sales Invoices
export const salesInvoices = pgTable("sales_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceNumber: text("invoice_number").notNull().unique(),
  customerId: varchar("customer_id").references(() => customers.id),
  customerName: text("customer_name").default(""),
  invoiceDate: text("invoice_date").notNull(),
  dueDate: text("due_date").default(""),
  subtotal: decimal("subtotal", { precision: 15, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).default("0"),
  paidAmount: decimal("paid_amount", { precision: 15, scale: 2 }).default("0"),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  notes: text("notes").default(""),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertSalesInvoiceSchema = createInsertSchema(salesInvoices).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSalesInvoice = z.infer<typeof insertSalesInvoiceSchema>;
export type SalesInvoice = typeof salesInvoices.$inferSelect;

// Sales Invoice Items
export const salesInvoiceItems = pgTable("sales_invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").references(() => salesInvoices.id),
  itemId: varchar("item_id").references(() => inventoryItems.id),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 15, scale: 3 }).notNull().default("1"),
  unit: text("unit").default("Nos"),
  unitPrice: decimal("unit_price", { precision: 15, scale: 2 }).notNull().default("0"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }).default("0"),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull().default("0"),
});
export const insertSalesInvoiceItemSchema = createInsertSchema(salesInvoiceItems).omit({ id: true });
export type InsertSalesInvoiceItem = z.infer<typeof insertSalesInvoiceItemSchema>;
export type SalesInvoiceItem = typeof salesInvoiceItems.$inferSelect;

// Chart of Accounts
export const accounts = pgTable("accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  type: accountTypeEnum("type").notNull(),
  parentId: varchar("parent_id"),
  description: text("description").default(""),
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true, createdAt: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accounts.$inferSelect;

// Journal Entries
export const journalEntries = pgTable("journal_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entryNumber: text("entry_number").notNull().unique(),
  date: text("date").notNull(),
  description: text("description").notNull(),
  reference: text("reference").default(""),
  totalDebit: decimal("total_debit", { precision: 15, scale: 2 }).default("0"),
  totalCredit: decimal("total_credit", { precision: 15, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({ id: true, createdAt: true });
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalEntry = typeof journalEntries.$inferSelect;

// Journal Entry Lines
export const journalEntryLines = pgTable("journal_entry_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  entryId: varchar("entry_id").references(() => journalEntries.id),
  accountId: varchar("account_id").references(() => accounts.id),
  accountName: text("account_name").default(""),
  description: text("description").default(""),
  debit: decimal("debit", { precision: 15, scale: 2 }).default("0"),
  credit: decimal("credit", { precision: 15, scale: 2 }).default("0"),
});
export const insertJournalEntryLineSchema = createInsertSchema(journalEntryLines).omit({ id: true });
export type InsertJournalEntryLine = z.infer<typeof insertJournalEntryLineSchema>;
export type JournalEntryLine = typeof journalEntryLines.$inferSelect;

// Tasks / Reminders
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").default(""),
  dueDate: text("due_date").default(""),
  dueTime: text("due_time").default(""),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  status: taskStatusEnum("status").notNull().default("pending"),
  assignedTo: varchar("assigned_to").references(() => users.id),
  category: text("category").default("general"),
  isReminder: boolean("is_reminder").default(false),
  reminderDate: text("reminder_date").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true });
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type Task = typeof tasks.$inferSelect;

// Employees (Master linked to Users)
export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  employeeCode: text("employee_code").notNull().unique(),
  name: text("name").notNull(),
  userId: varchar("user_id").references(() => users.id),
  department: text("department").default(""),
  designation: text("designation").default(""),
  email: text("email").default(""),
  phone: text("phone").default(""),
  dateOfJoining: text("date_of_joining").default(""),
  dateOfBirth: text("date_of_birth").default(""),
  address: text("address").default(""),
  emergencyContact: text("emergency_contact").default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true, createdAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

// User Roles (custom roles with permissions)
export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description").default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({ id: true, createdAt: true });
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;

// Role Rights (module-level permissions per role)
export const roleRights = pgTable("role_rights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").references(() => userRoles.id),
  module: text("module").notNull(),
  canView: boolean("can_view").default(false),
  canCreate: boolean("can_create").default(false),
  canEdit: boolean("can_edit").default(false),
  canDelete: boolean("can_delete").default(false),
  canApprove: boolean("can_approve").default(false),
  canExport: boolean("can_export").default(false),
});
export const insertRoleRightSchema = createInsertSchema(roleRights).omit({ id: true });
export type InsertRoleRight = z.infer<typeof insertRoleRightSchema>;
export type RoleRight = typeof roleRights.$inferSelect;

// Warehouses
export const warehouses = pgTable("warehouses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  location: text("location").default(""),
  description: text("description").default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertWarehouseSchema = createInsertSchema(warehouses).omit({ id: true, createdAt: true });
export type InsertWarehouse = z.infer<typeof insertWarehouseSchema>;
export type Warehouse = typeof warehouses.$inferSelect;

// Units of Measure
export const unitsOfMeasure = pgTable("units_of_measure", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertUomSchema = createInsertSchema(unitsOfMeasure).omit({ id: true, createdAt: true });
export type InsertUom = z.infer<typeof insertUomSchema>;
export type Uom = typeof unitsOfMeasure.$inferSelect;

// Tax Rates
export const taxRates = pgTable("tax_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  rate: decimal("rate", { precision: 5, scale: 2 }).notNull(),
  description: text("description").default(""),
  hsnCode: text("hsn_code").default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertTaxRateSchema = createInsertSchema(taxRates).omit({ id: true, createdAt: true });
export type InsertTaxRate = z.infer<typeof insertTaxRateSchema>;
export type TaxRate = typeof taxRates.$inferSelect;

// Countries
export const countries = pgTable("countries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCountrySchema = createInsertSchema(countries).omit({ id: true, createdAt: true });
export type InsertCountry = z.infer<typeof insertCountrySchema>;
export type Country = typeof countries.$inferSelect;

// States
export const states = pgTable("states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  countryId: varchar("country_id").references(() => countries.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertStateSchema = createInsertSchema(states).omit({ id: true, createdAt: true });
export type InsertState = z.infer<typeof insertStateSchema>;
export type State = typeof states.$inferSelect;

// Cities
export const cities = pgTable("cities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  stateId: varchar("state_id").references(() => states.id),
  countryId: varchar("country_id").references(() => countries.id),
  name: text("name").notNull(),
  pinCode: text("pin_code").default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCitySchema = createInsertSchema(cities).omit({ id: true, createdAt: true });
export type InsertCity = z.infer<typeof insertCitySchema>;
export type City = typeof cities.$inferSelect;

// Tally Sync Logs
export const tallySyncLogs = pgTable("tally_sync_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  syncType: text("sync_type").notNull(),
  status: syncStatusEnum("status").notNull(),
  recordsSynced: integer("records_synced").default(0),
  errorMessage: text("error_message").default(""),
  syncedAt: timestamp("synced_at").defaultNow(),
});
export const insertTallySyncLogSchema = createInsertSchema(tallySyncLogs).omit({ id: true, syncedAt: true });
export type InsertTallySyncLog = z.infer<typeof insertTallySyncLogSchema>;
export type TallySyncLog = typeof tallySyncLogs.$inferSelect;
