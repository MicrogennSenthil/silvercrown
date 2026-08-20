import { sql } from "drizzle-orm";
import {
  pgTable, text, varchar, integer, decimal, boolean,
  timestamp, date, pgEnum, json
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
  shortName: text("short_name").default(""),
  email: text("email").default(""),
  phone: text("phone").default(""),
  address: text("address").default(""),
  // Address tab
  address1: text("address1").default(""),
  address2: text("address2").default(""),
  city: text("city").default(""),
  pincode: text("pincode").default(""),
  state: text("state").default(""),
  gstStateCode: text("gst_state_code").default(""),
  contactName: text("contact_name").default(""),
  contactRole: text("contact_role").default(""),
  telephone: text("telephone").default(""),
  websiteUrl: text("website_url").default(""),
  // Account Info tab
  creditLimit: decimal("credit_limit", { precision: 15, scale: 2 }).default("0"),
  creditDays: integer("credit_days").default(0),
  accountNo: text("account_no").default(""),
  accountHolderName: text("account_holder_name").default(""),
  accountType: text("account_type").default(""),
  bankName: text("bank_name").default(""),
  branchName: text("branch_name").default(""),
  ifscCode: text("ifsc_code").default(""),
  // Other Info tab
  gstin: text("gstin").default(""),
  gstRegisteredType: text("gst_registered_type").default(""),
  gstinDate: text("gstin_date").default(""),
  gstState: text("gst_state").default(""),
  category: text("category").default(""),
  deliveryAddress: text("delivery_address").default(""),
  termOfDelivery: text("term_of_delivery").default(""),
  transport: text("transport").default(""),
  sameAsCompany: boolean("same_as_company").default(false),
  notes: text("notes").default(""),
  contactPerson: text("contact_person").default(""),
  subLedgerId: varchar("sub_ledger_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertSupplierSchema = createInsertSchema(suppliers).omit({ id: true, createdAt: true });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliers.$inferSelect;

// Customers
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  shortName: text("short_name").default(""),
  email: text("email").default(""),
  phone: text("phone").default(""),
  address: text("address").default(""),
  // Address tab
  address1: text("address1").default(""),
  address2: text("address2").default(""),
  city: text("city").default(""),
  pincode: text("pincode").default(""),
  state: text("state").default(""),
  gstStateCode: text("gst_state_code").default(""),
  contactName: text("contact_name").default(""),
  contactRole: text("contact_role").default(""),
  telephone: text("telephone").default(""),
  websiteUrl: text("website_url").default(""),
  // Account Info tab
  creditLimit: decimal("credit_limit", { precision: 15, scale: 2 }).default("0"),
  creditDays: integer("credit_days").default(0),
  accountNo: text("account_no").default(""),
  accountHolderName: text("account_holder_name").default(""),
  accountType: text("account_type").default(""),
  bankName: text("bank_name").default(""),
  branchName: text("branch_name").default(""),
  ifscCode: text("ifsc_code").default(""),
  // Other Info tab
  gstin: text("gstin").default(""),
  gstRegisteredType: text("gst_registered_type").default(""),
  gstinDate: text("gstin_date").default(""),
  gstState: text("gst_state").default(""),
  category: text("category").default(""),
  deliveryAddress: text("delivery_address").default(""),
  termOfDelivery: text("term_of_delivery").default(""),
  transport: text("transport").default(""),
  sameAsCompany: boolean("same_as_company").default(false),
  notes: text("notes").default(""),
  contactPerson: text("contact_person").default(""),
  termOfPayment: text("term_of_payment").default(""),
  freight: text("freight").default("to_pay"),
  subLedgerId: varchar("sub_ledger_id"),
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
  batchRequired: boolean("batch_required").default(false),
  expiryRequired: boolean("expiry_required").default(false),
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
  shortForm: text("short_form").notNull().default(""),
  numberOfDecimals: integer("number_of_decimals").notNull().default(0),
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

// Contact Roles
export const contactRoles = pgTable("contact_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertContactRoleSchema = createInsertSchema(contactRoles).omit({ id: true, createdAt: true });
export type InsertContactRole = z.infer<typeof insertContactRoleSchema>;
export type ContactRole = typeof contactRoles.$inferSelect;
export type TaxRate = typeof taxRates.$inferSelect;

// Categories
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").default(""),
  isActive: boolean("is_active").default(true),
  isRawMaterial: boolean("is_raw_material").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

// Sub Categories
export const subCategories = pgTable("sub_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").references(() => categories.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description").default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertSubCategorySchema = createInsertSchema(subCategories).omit({ id: true, createdAt: true });
export type InsertSubCategory = z.infer<typeof insertSubCategorySchema>;
export type SubCategory = typeof subCategories.$inferSelect;

// Products
export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull(),
  name: text("name").notNull(),
  categoryId: varchar("category_id").references(() => categories.id),
  subCategoryId: varchar("sub_category_id").references(() => subCategories.id),
  unit: text("unit").default(""),
  uom: text("uom").default(""),
  hsnCode: text("hsn_code").default(""),
  hsnCodeEway: text("hsn_code_eway").default(""),
  sapNo: text("sap_no").default(""),
  drgNo: text("drg_no").default(""),
  location: text("location").default(""),
  description: text("description").default(""),
  rate: decimal("selling_price", { precision: 15, scale: 2 }).default("0"),
  costPrice: decimal("cost_price", { precision: 15, scale: 2 }).default("0"),
  purchasePrice: decimal("purchase_price", { precision: 15, scale: 2 }).default("0"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("0"),
  cgstRate: decimal("cgst_rate", { precision: 5, scale: 2 }).default("0"),
  sgstRate: decimal("sgst_rate", { precision: 5, scale: 2 }).default("0"),
  igstRate: decimal("igst_rate", { precision: 5, scale: 2 }).default("0"),
  minStockLevel: decimal("min_stock_level", { precision: 15, scale: 3 }).default("0"),
  maxStockLevel: decimal("max_stock_level", { precision: 15, scale: 3 }).default("0"),
  batchRequired: boolean("batch_required").default(false),
  expiryRequired: boolean("expiry_required").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true });
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof products.$inferSelect;

// Machine Master
export const machineMaster = pgTable("machine_master", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  machineId: text("machine_id").default(""),
  machineGroup: text("machine_group").default(""),
  subGroup: text("sub_group").default(""),
  dueTime: text("due_time").default(""),
  calibrationDate: text("calibration_date").default(""),
  company: text("company").default(""),
  notes: text("notes").default(""),
  department: text("department").default(""),
  description: text("description").default(""),
  capacity: text("capacity").default(""),
  location: text("location").default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertMachineSchema = createInsertSchema(machineMaster).omit({ id: true, createdAt: true });
export type InsertMachine = z.infer<typeof insertMachineSchema>;
export type Machine = typeof machineMaster.$inferSelect;

// Store Item Groups
export const storeItemGroups = pgTable("store_item_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertStoreItemGroupSchema = createInsertSchema(storeItemGroups).omit({ id: true, createdAt: true });
export type InsertStoreItemGroup = z.infer<typeof insertStoreItemGroupSchema>;
export type StoreItemGroup = typeof storeItemGroups.$inferSelect;

// Store Item Sub Groups
export const storeItemSubGroups = pgTable("store_item_sub_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  groupId: varchar("group_id").references(() => storeItemGroups.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertStoreItemSubGroupSchema = createInsertSchema(storeItemSubGroups).omit({ id: true, createdAt: true });
export type InsertStoreItemSubGroup = z.infer<typeof insertStoreItemSubGroupSchema>;
export type StoreItemSubGroup = typeof storeItemSubGroups.$inferSelect;

// Purchase Store Items
export const purchaseStoreItems = pgTable("purchase_store_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  itemGroupId: varchar("item_group_id"),
  itemSubGroupId: varchar("item_sub_group_id").default(""),
  uom: text("uom").default(""),
  batchNo: text("batch_no").default(""),
  expDate: text("exp_date").default(""),
  qty: decimal("qty", { precision: 15, scale: 2 }).default("0"),
  hsnCode: text("hsn_code").default(""),
  minNo: integer("min_no").default(0),
  maxNo: integer("max_no").default(0),
  location: text("location").default(""),
  conversion: boolean("conversion").default(false),
  conversionUnit: text("conversion_unit").default(""),
  conversionValue: decimal("conversion_value", { precision: 10, scale: 4 }).default("0"),
  expiryRequired: boolean("expiry_required").default(false),
  description: text("description").default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertPurchaseStoreItemSchema = createInsertSchema(purchaseStoreItems).omit({ id: true, createdAt: true });
export type InsertPurchaseStoreItem = z.infer<typeof insertPurchaseStoreItemSchema>;
export type PurchaseStoreItem = typeof purchaseStoreItems.$inferSelect;

// Purchase Approval Levels
export const purchaseApprovalLevels = pgTable("purchase_approval_levels", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  approvalLevel: integer("approval_level").notNull().default(1),
  minAmount: decimal("min_amount", { precision: 15, scale: 2 }).default("0"),
  maxAmount: decimal("max_amount", { precision: 15, scale: 2 }).default("0"),
  approverRole: text("approver_role").default(""),
  description: text("description").default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertPurchaseApprovalSchema = createInsertSchema(purchaseApprovalLevels).omit({ id: true, createdAt: true });
export type InsertPurchaseApproval = z.infer<typeof insertPurchaseApprovalSchema>;
export type PurchaseApproval = typeof purchaseApprovalLevels.$inferSelect;

// Voucher Types
export const voucherTypes = pgTable("voucher_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  prefix: text("prefix").notNull().default(""),
  defaultNarration: text("default_narration").notNull().default(""),
  description: text("description").default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertVoucherTypeSchema = createInsertSchema(voucherTypes).omit({ id: true, createdAt: true });
export type InsertVoucherType = z.infer<typeof insertVoucherTypeSchema>;
export type VoucherType = typeof voucherTypes.$inferSelect;

// Pay Mode Types
export const payModeTypes = pgTable("pay_mode_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  prefix: text("prefix").notNull().default(""),
  defaultNarration: text("default_narration").notNull().default(""),
  description: text("description").default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertPayModeTypeSchema = createInsertSchema(payModeTypes).omit({ id: true, createdAt: true });
export type InsertPayModeType = z.infer<typeof insertPayModeTypeSchema>;
export type PayModeType = typeof payModeTypes.$inferSelect;

// Ledger Categories
export const ledgerCategories = pgTable("ledger_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertLedgerCategorySchema = createInsertSchema(ledgerCategories).omit({ id: true, createdAt: true });
export type InsertLedgerCategory = z.infer<typeof insertLedgerCategorySchema>;
export type LedgerCategory = typeof ledgerCategories.$inferSelect;

// General Ledgers (linked to Ledger Categories)
export const generalLedgers = pgTable("general_ledgers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  categoryId: varchar("category_id").references(() => ledgerCategories.id),
  openingBalance: decimal("opening_balance", { precision: 15, scale: 2 }).notNull().default("0"),
  balanceType: text("balance_type").notNull().default("Dr"),
  description: text("description").default(""),
  isActive: boolean("is_active").default(true),
  glType: text("gl_type").default("other"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertGeneralLedgerSchema = createInsertSchema(generalLedgers).omit({ id: true, createdAt: true });
export type InsertGeneralLedger = z.infer<typeof insertGeneralLedgerSchema>;
export type GeneralLedger = typeof generalLedgers.$inferSelect;

// Sub Ledgers
export const subLedgers = pgTable("sub_ledgers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  generalLedgerId: varchar("general_ledger_id").references(() => generalLedgers.id),
  categoryId: varchar("category_id").references(() => ledgerCategories.id),
  levelType: text("level_type").notNull().default("Same"),
  paymentType: text("payment_type").notNull().default("BillToBill"),
  openingBalanceEntry: boolean("opening_balance_entry").default(false),
  openingBalance: decimal("opening_balance", { precision: 15, scale: 2 }).notNull().default("0"),
  openingBalanceType: text("opening_balance_type").notNull().default("Credit"),
  closingBalance: decimal("closing_balance", { precision: 15, scale: 2 }).notNull().default("0"),
  closingBalanceType: text("closing_balance_type").notNull().default("Credit"),
  notes: text("notes").default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertSubLedgerSchema = createInsertSchema(subLedgers).omit({ id: true, createdAt: true });
export type InsertSubLedger = z.infer<typeof insertSubLedgerSchema>;
export type SubLedger = typeof subLedgers.$inferSelect;

// Sub Ledger Bills (opening balance bill detail lines)
export const subLedgerBills = pgTable("sub_ledger_bills", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subLedgerId: varchar("sub_ledger_id").notNull().references(() => subLedgers.id),
  refNo: text("ref_no").default(""),
  refDate: date("ref_date"),
  voucherNo: text("voucher_no").default(""),
  voucherDate: date("voucher_date"),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull().default("0"),
  crDr: text("cr_dr").notNull().default("Cr"),
  billType: text("bill_type").notNull().default("Opening"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertSubLedgerBillSchema = createInsertSchema(subLedgerBills).omit({ id: true, createdAt: true });
export type InsertSubLedgerBill = z.infer<typeof insertSubLedgerBillSchema>;
export type SubLedgerBill = typeof subLedgerBills.$inferSelect;

// Term Types
export const termTypes = pgTable("term_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertTermTypeSchema = createInsertSchema(termTypes).omit({ id: true, createdAt: true });
export type InsertTermType = z.infer<typeof insertTermTypeSchema>;
export type TermType = typeof termTypes.$inferSelect;

// Terms
export const terms = pgTable("terms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  termTypeId: varchar("term_type_id").references(() => termTypes.id),
  days: integer("days").default(0),
  description: text("description").default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertTermSchema = createInsertSchema(terms).omit({ id: true, createdAt: true });
export type InsertTerm = z.infer<typeof insertTermSchema>;
export type Term = typeof terms.$inferSelect;

// Departments
export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true, createdAt: true });
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departments.$inferSelect;

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

// Purchase Approval Config
export const purchaseApprovalConfig = pgTable("purchase_approval_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionType: text("transaction_type").notNull().default(""),
  typeCode: text("type_code").notNull().default(""),
  levels: json("levels").$type<{ level: string; selected: boolean; procedure: string }[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertPurchaseApprovalConfigSchema = createInsertSchema(purchaseApprovalConfig).omit({ id: true, createdAt: true });
export type InsertPurchaseApprovalConfig = z.infer<typeof insertPurchaseApprovalConfigSchema>;
export type PurchaseApprovalConfig = typeof purchaseApprovalConfig.$inferSelect;

// Approval Authority
export const approvalAuthority = pgTable("approval_authority", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transactionType: text("transaction_type").notNull().default(""),
  typeCode: text("type_code").notNull().default(""),
  approvalLevel: text("approval_level").notNull().default(""),
  approvers: json("approvers").$type<{ username: string; department: string }[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertApprovalAuthoritySchema = createInsertSchema(approvalAuthority).omit({ id: true, createdAt: true });
export type InsertApprovalAuthority = z.infer<typeof insertApprovalAuthoritySchema>;
export type ApprovalAuthority = typeof approvalAuthority.$inferSelect;

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

// Process Outward — Send items to external testing/calibration agency
export const processOutward = pgTable("process_outward", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  voucherNo: text("voucher_no").notNull().unique(),
  outwardDate: date("outward_date").notNull(),
  supplierId: varchar("supplier_id"),
  supplierNameManual: text("supplier_name_manual").default(""),
  vehicleNo: text("vehicle_no").default(""),
  purpose: text("purpose").default(""),
  notes: text("notes").default(""),
  status: text("status").default("Saved"),
  isReturnable: boolean("is_returnable").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertProcessOutwardSchema = createInsertSchema(processOutward).omit({ id: true, createdAt: true });
export type InsertProcessOutward = z.infer<typeof insertProcessOutwardSchema>;
export type ProcessOutward = typeof processOutward.$inferSelect;

export const processOutwardItems = pgTable("process_outward_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  outwardId: varchar("outward_id").notNull(),
  seqNo: integer("seq_no").notNull(),
  customerRef: text("customer_ref").default(""),
  itemId: varchar("item_id"),
  itemCode: text("item_code").default(""),
  itemName: text("item_name").default(""),
  drawingNo: text("drawing_no").default(""),
  hsn: text("hsn").default(""),
  processNature: text("process_nature").default(""),
  billRef: text("bill_ref").default(""),
  qty: decimal("qty", { precision: 15, scale: 3 }).default("0"),
  unit: text("unit").default(""),
});
export const insertProcessOutwardItemSchema = createInsertSchema(processOutwardItems).omit({ id: true });
export type InsertProcessOutwardItem = z.infer<typeof insertProcessOutwardItemSchema>;
export type ProcessOutwardItem = typeof processOutwardItems.$inferSelect;

// Process Inward — Receive items back + record supplier invoice + post accounts
export const processInward = pgTable("process_inward", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  voucherNo: text("voucher_no").notNull().unique(),
  inwardDate: date("inward_date").notNull(),
  outwardId: varchar("outward_id"),
  supplierId: varchar("supplier_id"),
  supplierNameManual: text("supplier_name_manual").default(""),
  supplierInvoiceNo: text("supplier_invoice_no").default(""),
  supplierInvoiceDate: date("supplier_invoice_date"),
  taxableAmount: decimal("taxable_amount", { precision: 15, scale: 2 }).default("0"),
  cgstAmount: decimal("cgst_amount", { precision: 15, scale: 2 }).default("0"),
  sgstAmount: decimal("sgst_amount", { precision: 15, scale: 2 }).default("0"),
  igstAmount: decimal("igst_amount", { precision: 15, scale: 2 }).default("0"),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).default("0"),
  paymentMode: text("payment_mode").default("Credit"),
  paymentAccountId: varchar("payment_account_id"),
  expenseGlId: varchar("expense_gl_id"),
  notes: text("notes").default(""),
  status: text("status").default("Saved"),
  voucherMasId: varchar("voucher_mas_id"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertProcessInwardSchema = createInsertSchema(processInward).omit({ id: true, createdAt: true });
export type InsertProcessInward = z.infer<typeof insertProcessInwardSchema>;
export type ProcessInward = typeof processInward.$inferSelect;

export const processInwardItems = pgTable("process_inward_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inwardId: varchar("inward_id").notNull(),
  seqNo: integer("seq_no").notNull(),
  outwardItemId: varchar("outward_item_id"),
  itemId: varchar("item_id"),
  itemCode: text("item_code").default(""),
  itemName: text("item_name").default(""),
  hsn: text("hsn").default(""),
  qty: decimal("qty", { precision: 15, scale: 3 }).default("0"),
  unit: text("unit").default(""),
  rate: decimal("rate", { precision: 15, scale: 2 }).default("0"),
  taxableAmount: decimal("taxable_amount", { precision: 15, scale: 2 }).default("0"),
  cgstRate: decimal("cgst_rate", { precision: 5, scale: 2 }).default("0"),
  sgstRate: decimal("sgst_rate", { precision: 5, scale: 2 }).default("0"),
  igstRate: decimal("igst_rate", { precision: 5, scale: 2 }).default("0"),
  cgstAmount: decimal("cgst_amount", { precision: 15, scale: 2 }).default("0"),
  sgstAmount: decimal("sgst_amount", { precision: 15, scale: 2 }).default("0"),
  igstAmount: decimal("igst_amount", { precision: 15, scale: 2 }).default("0"),
  amount: decimal("amount", { precision: 15, scale: 2 }).default("0"),
});
export const insertProcessInwardItemSchema = createInsertSchema(processInwardItems).omit({ id: true });
export type InsertProcessInwardItem = z.infer<typeof insertProcessInwardItemSchema>;
export type ProcessInwardItem = typeof processInwardItems.$inferSelect;

// Bill Adjustments — tracks how a payment voucher is allocated against outstanding bills
export const billAdjustments = pgTable("bill_adjustments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  voucherMasId: varchar("voucher_mas_id"),
  subLedgerId: varchar("sub_ledger_id"),
  billSource: text("bill_source").notNull().default("purchase_invoice"),
  billSourceId: varchar("bill_source_id"),
  billRefNo: text("bill_ref_no").default(""),
  billDate: date("bill_date"),
  billAmount: decimal("bill_amount", { precision: 15, scale: 2 }).default("0"),
  adjustedAmount: decimal("adjusted_amount", { precision: 15, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertBillAdjustmentSchema = createInsertSchema(billAdjustments).omit({ id: true, createdAt: true });
export type InsertBillAdjustment = z.infer<typeof insertBillAdjustmentSchema>;
export type BillAdjustment = typeof billAdjustments.$inferSelect;

// ═══════════════════════════════════════════════════════════════════
// TALLY PRIME INTEGRATION TABLES
// ═══════════════════════════════════════════════════════════════════

// Tally Configuration — one row per company (singleton pattern, keyed by company)
export const tallyConfig = pgTable("tally_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),           // Tally company name (user-configured)
  displayName: text("display_name").notNull().default(""), // friendly display name
  tallyHost: text("tally_host").notNull().default("localhost"),
  tallyPort: integer("tally_port").notNull().default(9000),
  financialYear: text("financial_year").default(""),     // e.g. "2025-26"
  enableStockSync: boolean("enable_stock_sync").default(false),
  importMastersEnabled: boolean("import_masters_enabled").default(true),
  importVouchersEnabled: boolean("import_vouchers_enabled").default(true),
  exportSalesEnabled: boolean("export_sales_enabled").default(false),
  exportPurchasesEnabled: boolean("export_purchases_enabled").default(false),
  autoApproveMapped: boolean("auto_approve_mapped").default(false),
  syncIntervalMinutes: integer("sync_interval_minutes").default(0),
  lastScheduledAt: timestamp("last_scheduled_at"),
  lastTallyStatus: text("last_tally_status").default(""),
  lastTallyError: text("last_tally_error").default(""),
  isActive: boolean("is_active").default(true),
  // Connector token: only SHA-256 hash stored here; plaintext returned only at generation
  connectorTokenHash: text("connector_token_hash").default(""),
  connectorTokenHint: text("connector_token_hint").default(""),  // last 6 chars
  connectorTokenRotatedAt: timestamp("connector_token_rotated_at"),
  lastHeartbeatAt: timestamp("last_heartbeat_at"),
  connectorVersion: text("connector_version").default(""),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertTallyConfigSchema = createInsertSchema(tallyConfig).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTallyConfig = z.infer<typeof insertTallyConfigSchema>;
export type TallyConfig = typeof tallyConfig.$inferSelect;

// Discovered masters from Tally (ledgers, voucher types, stock items, cost centres)
// Populated by connector after discover_masters job; used for mapping UI dropdowns.
export const tallyDiscoveredMasters = pgTable("tally_discovered_masters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configId: varchar("config_id").references(() => tallyConfig.id),
  masterType: text("master_type").notNull(),   // ledger | voucher_type | stock_item | cost_centre
  tallyName: text("tally_name").notNull(),
  tallyGuid: text("tally_guid").default(""),
  tallyGroup: text("tally_group").default(""),
  extra: json("extra").$type<Record<string, any>>().default({}),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});
export type TallyDiscoveredMaster = typeof tallyDiscoveredMasters.$inferSelect;

// Ledger / party / tax / bank / stock mappings from Tally names → internal IDs
export const tallyMappings = pgTable("tally_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configId: varchar("config_id").references(() => tallyConfig.id),
  mappingType: text("mapping_type").notNull(), // general_ledger | sub_ledger | customer | supplier | bank | voucher_type | gst_ledger | round_off_ledger | freight_ledger | discount_ledger | stock | party | ledger
  tallyName: text("tally_name").notNull(),     // exact Tally ledger/group/item name
  tallyGuid: text("tally_guid").default(""),
  internalId: varchar("internal_id"),          // FK to internal GL/SL/tax/bank/product
  internalType: text("internal_type").default(""), // general_ledger | sub_ledger | tax_rate | bank | product
  notes: text("notes").default(""),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertTallyMappingSchema = createInsertSchema(tallyMappings).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTallyMapping = z.infer<typeof insertTallyMappingSchema>;
export type TallyMapping = typeof tallyMappings.$inferSelect;

// Sync Jobs — queued commands for connector (import/export)
export const tallySyncJobs = pgTable("tally_sync_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configId: varchar("config_id").references(() => tallyConfig.id),
  jobType: text("job_type").notNull(), // import_masters | import_vouchers | export_sales | export_purchases | full
  direction: text("direction").notNull().default("inbound"), // inbound | outbound
  status: text("status").notNull().default("queued"), // queued | leased | completed | failed | cancelled
  priority: integer("priority").notNull().default(5),
  fromDate: date("from_date"),
  toDate: date("to_date"),
  payload: json("payload").$type<Record<string, any>>().default({}),
  leasedAt: timestamp("leased_at"),
  leasedBy: text("leased_by").default(""),  // connector instance ID
  completedAt: timestamp("completed_at"),
  resultSummary: text("result_summary").default(""),
  errorMessage: text("error_message").default(""),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertTallySyncJobSchema = createInsertSchema(tallySyncJobs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTallySyncJob = z.infer<typeof insertTallySyncJobSchema>;
export type TallySyncJob = typeof tallySyncJobs.$inferSelect;

// Inbound voucher inbox — raw vouchers received from Tally connector, pending review
export const tallyVoucherInbox = pgTable("tally_voucher_inbox", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configId: varchar("config_id").references(() => tallyConfig.id),
  jobId: varchar("job_id").references(() => tallySyncJobs.id),
  externalId: text("external_id").notNull(),        // Tally GUID / alteration ID
  alterationId: text("alteration_id").default(""),
  voucherType: text("voucher_type").notNull(),
  voucherNumber: text("voucher_number").notNull(),
  voucherDate: date("voucher_date").notNull(),
  narration: text("narration").default(""),
  company: text("company").default(""),
  financialYear: text("financial_year").default(""),
  checksum: text("checksum").default(""),
  rawPayload: json("raw_payload").$type<Record<string, any>>().default({}),
  status: text("status").notNull().default("review"), // review | approved | rejected | posted | conflict
  reviewNotes: text("review_notes").default(""),
  conflictReason: text("conflict_reason").default(""),
  postedVoucherMasId: varchar("posted_voucher_mas_id"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertTallyVoucherInboxSchema = createInsertSchema(tallyVoucherInbox).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTallyVoucherInbox = z.infer<typeof insertTallyVoucherInboxSchema>;
export type TallyVoucherInbox = typeof tallyVoucherInbox.$inferSelect;

// Outbound job records — per-record export tasks for ERP → Tally
export const tallyOutbox = pgTable("tally_outbox", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configId: varchar("config_id").references(() => tallyConfig.id),
  syncJobId: varchar("sync_job_id").references(() => tallySyncJobs.id),
  sourceType: text("source_type").notNull(),  // job_work_invoice | grn
  sourceId: varchar("source_id").notNull(),
  voucherType: text("voucher_type").notNull(), // Sales Invoice | Purchase Invoice
  status: text("status").notNull().default("queued"), // queued | review | sent | failed | cancelled
  payload: json("payload").$type<Record<string, any>>().default({}),
  reviewReason: text("review_reason").default(""),
  sentAt: timestamp("sent_at"),
  leasedAt: timestamp("leased_at"),
  leasedBy: text("leased_by").default(""),
  errorMessage: text("error_message").default(""),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertTallyOutboxSchema = createInsertSchema(tallyOutbox).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTallyOutbox = z.infer<typeof insertTallyOutboxSchema>;
export type TallyOutbox = typeof tallyOutbox.$inferSelect;

// External references — permanent link between internal records and Tally GUIDs
export const tallyExternalRefs = pgTable("tally_external_refs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configId: varchar("config_id").references(() => tallyConfig.id),
  internalTable: text("internal_table").notNull(),   // voucher_mas | job_work_invoices | goods_receipt_notes
  internalId: varchar("internal_id").notNull(),
  externalSystem: text("external_system").notNull().default("tally"),
  externalId: text("external_id").notNull(),          // Tally GUID
  externalRef: text("external_ref").default(""),      // Tally voucher number
  syncedAt: timestamp("synced_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});
export const insertTallyExternalRefSchema = createInsertSchema(tallyExternalRefs).omit({ id: true, createdAt: true });
export type InsertTallyExternalRef = z.infer<typeof insertTallyExternalRefSchema>;
export type TallyExternalRef = typeof tallyExternalRefs.$inferSelect;

// Audit log for all Tally integration events
export const tallyAuditLog = pgTable("tally_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configId: varchar("config_id"),
  eventType: text("event_type").notNull(), // config_change | token_rotate | job_enqueue | voucher_import | voucher_approve | voucher_reject | export_sent | heartbeat
  entityType: text("entity_type").default(""),
  entityId: varchar("entity_id"),
  actorType: text("actor_type").notNull().default("user"), // user | connector
  actorId: varchar("actor_id"),
  description: text("description").default(""),
  meta: json("meta").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at").defaultNow(),
});
export type TallyAuditLog = typeof tallyAuditLog.$inferSelect;

// Bank reconciliation records
export const tallyBankRecon = pgTable("tally_bank_recon", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  configId: varchar("config_id").references(() => tallyConfig.id),
  bankLedgerName: text("bank_ledger_name").notNull(),  // Tally bank ledger name
  internalGlId: varchar("internal_gl_id"),
  externalId: text("external_id").notNull().default(""),
  voucherNumber: text("voucher_number").notNull().default(""),
  instrumentNumber: text("instrument_number").notNull().default(""),
  transactionType: text("transaction_type").notNull().default(""),
  allocationKey: text("allocation_key").notNull().default(""),
  statementDate: date("statement_date").notNull(),
  statementBalance: decimal("statement_balance", { precision: 15, scale: 2 }).notNull().default("0"),
  bookBalance: decimal("book_balance", { precision: 15, scale: 2 }).default("0"),
  difference: decimal("difference", { precision: 15, scale: 2 }).default("0"),
  reconStatus: text("recon_status").notNull().default("pending"), // pending | matched | unmatched
  tallyData: json("tally_data").$type<Record<string, any>>().default({}),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertTallyBankReconSchema = createInsertSchema(tallyBankRecon).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTallyBankRecon = z.infer<typeof insertTallyBankReconSchema>;
export type TallyBankRecon = typeof tallyBankRecon.$inferSelect;
