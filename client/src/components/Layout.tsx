import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, ShoppingCart, Package, TrendingUp, BookOpen,
  CheckSquare, RefreshCw, LogOut, Menu, Bell, User, Settings,
  Users, Database, ChevronDown, ChevronRight, Cpu, Printer,
  BarChart2, Handshake, IndianRupee, Warehouse, Wrench, Shield,
  MoreHorizontal, X, Download
} from "lucide-react";

// ─── Navigation Structure ─────────────────────────────────────────────────────
// moduleKey on leaf items maps to the role_rights.module column.
// Groups are visible when at least one child/grandchild is visible.

const NAV: any[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", moduleKey: "dashboard" },
  {
    label: "Masters", icon: Database, children: [
      {
        label: "Parties", icon: Handshake, subChildren: [
          { label: "Suppliers",  href: "/masters/suppliers",  moduleKey: "masters_suppliers" },
          { label: "Customers",  href: "/masters/customers",  moduleKey: "masters_customers" },
          { label: "City",       href: "/masters/cities",     moduleKey: "masters_cities" },
          { label: "State",      href: "/masters/states",     moduleKey: "masters_states" },
          { label: "Country",    href: "/masters/countries",  moduleKey: "masters_countries" },
        ]
      },
      {
        label: "Items", icon: Package, subChildren: [
          { label: "Product",           href: "/masters/products",           moduleKey: "masters_products" },
          { label: "Process",           href: "/masters/processes",          moduleKey: "masters_processes" },
          { label: "Machine",           href: "/masters/machines",           moduleKey: "masters_machines" },
          { label: "Category",          href: "/masters/categories",         moduleKey: "masters_categories" },
          { label: "Sub Category",      href: "/masters/sub-categories",     moduleKey: "masters_sub_categories" },
          { label: "Purchase approval", href: "/masters/purchase-approvals", moduleKey: "masters_purchase_approvals" },
          { label: "Approval Authority",href: "/masters/approval-authority", moduleKey: "masters_approval_authority" },
          { label: "Store Master",      href: "/masters/stores",             moduleKey: "masters_stores" },
          { label: "UOM",               href: "/masters/uom",                moduleKey: "masters_uom" },
          { label: "Terms",             href: "/masters/terms",              moduleKey: "masters_terms" },
          { label: "Term types",        href: "/masters/term-types",         moduleKey: "masters_term_types" },
          { label: "Department",        href: "/masters/departments",        moduleKey: "masters_departments" },
        ]
      },
      {
        label: "Accounts", icon: IndianRupee, subChildren: [
          { label: "Chart of Accounts",  href: "/masters/accounts",          moduleKey: "masters_chart_of_accounts" },
          { label: "Voucher Types",      href: "/masters/voucher-types",     moduleKey: "masters_voucher_types" },
          { label: "Pay Mode Types",     href: "/masters/pay-mode-types",    moduleKey: "masters_pay_mode_types" },
          { label: "Ledger Categories",  href: "/masters/ledger-categories", moduleKey: "masters_ledger_categories" },
          { label: "General Ledger",     href: "/masters/general-ledgers",   moduleKey: "masters_general_ledgers" },
          { label: "Ledger",             href: "/masters/ledger",            moduleKey: "masters_ledger" },
        ]
      },
      {
        label: "Administration", icon: Shield, subChildren: [
          { label: "Financial Years",   href: "/masters/financial-years",    moduleKey: "masters_financial_years" },
          { label: "Year-End Closing",  href: "/masters/year-end-closing",   moduleKey: "masters_year_end_closing" },
          { label: "Voucher Numbering", href: "/masters/voucher-series",     moduleKey: "masters_voucher_series" },
        ]
      },
    ]
  },
  {
    label: "Engineering", icon: Cpu, children: [
      { label: "Job Work Inward",    href: "/engineering/job-work-inward",    moduleKey: "engineering_job_work_inward" },
      { label: "Job Work Despatch",  href: "/engineering/job-work-despatch",  moduleKey: "engineering_job_work_despatch" },
      { label: "Job Work Invoice",   href: "/engineering/job-work-invoice",   moduleKey: "engineering_job_work_invoice" },
      { label: "Returnable Inward",  href: "/engineering/returnable-inward",  moduleKey: "engineering_returnable_inward" },
      { label: "Returnable Outward", href: "/engineering/returnable-outward", moduleKey: "engineering_returnable_outward" },
      { label: "Gate Pass",          href: "/engineering/gate-pass",          moduleKey: "engineering_gate_pass" },
    ]
  },
  {
    label: "Inventory", icon: Warehouse, children: [
      { label: "Purchase Order",           href: "/inventory/purchase-order",           moduleKey: "inventory_purchase_order" },
      { label: "Purchase Amendment",       href: "/inventory/purchase-amendment",       moduleKey: "inventory_purchase_amendment" },
      { label: "Purchase Order Approval",  href: "/inventory/purchase-order-approval",  moduleKey: "inventory_purchase_order_approval" },
      { label: "Goods Receipt Note",       href: "/inventory/goods-receipt-note",       moduleKey: "inventory_goods_receipt_note" },
      { label: "Store Request Note",       href: "/inventory/store-request-note",       moduleKey: "inventory_store_request_note" },
      { label: "Store Issue Indent",       href: "/inventory/store-issue-indent",       moduleKey: "inventory_store_issue_indent" },
      { label: "PHY INV Reconciliation",   href: "/inventory/phy-reconciliation",       moduleKey: "inventory_phy_reconciliation" },
      { label: "Goods Receipt Return",     href: "/inventory/goods-receipt-return",     moduleKey: "inventory_goods_receipt_return" },
      { label: "Issue Indent Return",      href: "/inventory/issue-indent-return",      moduleKey: "inventory_issue_indent_return" },
      { label: "Store Opening",            href: "/inventory/store-opening",            moduleKey: "inventory_store_opening" },
    ]
  },
  {
    label: "Accounts", icon: BookOpen, children: [
      { label: "Voucher",         href: "/accounts/voucher",         moduleKey: "accounts_voucher" },
      { label: "General Ledger",  href: "/accounts/general-ledger",  moduleKey: "accounts_general_ledger" },
      { label: "Ledger",          href: "/accounts/ledger",          moduleKey: "accounts_ledger" },
    ]
  },
  { label: "Tasks & Reminders", icon: CheckSquare, href: "/tasks",  moduleKey: "tasks_reminders" },
  { label: "Tally Integration",  icon: RefreshCw,   href: "/tally",  moduleKey: "tally_integration" },
  {
    label: "Reports", icon: BarChart2, children: [
      {
        label: "Engineering",
        subChildren: [
          { label: "Job Work Pending",  href: "/reports/engineering/job-work-pending",  moduleKey: "report_eng_job_work_pending" },
          { label: "Despatch Pending",  href: "/reports/engineering/despatch-pending",  moduleKey: "report_eng_despatch_pending" },
          { label: "Invoice Pending",   href: "/reports/engineering/invoice-pending",   moduleKey: "report_eng_invoice_pending" },
          { label: "Despatch Register", href: "/reports/engineering/despatch-register", moduleKey: "report_eng_despatch_register" },
        ],
      },
      {
        label: "Inventory",
        subChildren: [
          { label: "Stock Report",           href: "/reports/inventory/stock-report",       moduleKey: "report_inv_stock_report" },
          { label: "Stock Report With Value", href: "/reports/inventory/stock-report-value", moduleKey: "report_inv_stock_report_value" },
          { label: "Stock Ledger",           href: "/reports/inventory/stock-ledger",       moduleKey: "report_inv_stock_ledger" },
          { label: "Bank Stock Report",      href: "/reports/inventory/bank-stock-report",  moduleKey: "report_inv_bank_stock" },
          { label: "PO Pending",             href: "/reports/inventory/po-pending",         moduleKey: "report_inv_po_pending" },
          { label: "Material Register",      href: "/reports/inventory/material-register",  moduleKey: "report_inv_material_register" },
          { label: "Issue Register",         href: "/reports/inventory/issue-register",     moduleKey: "report_inv_issue_register" },
          { label: "Receipt List",           href: "/reports/inventory/receipt-list",       moduleKey: "report_inv_receipt_list" },
          { label: "Expiry Item List",       href: "/reports/inventory/expiry-item-list",   moduleKey: "report_inv_expiry_item_list" },
        ],
      },
      {
        label: "Accounts",
        subChildren: [
          { label: "Customer Receivable", href: "/reports/accounts/customer-receivable", moduleKey: "report_acc_customer_receivable" },
          { label: "Supplier Payables",   href: "/reports/accounts/supplier-payables",   moduleKey: "report_acc_supplier_payables" },
          { label: "Ledger Report",       href: "/reports/accounts/ledger",              moduleKey: "report_acc_ledger_report" },
          { label: "Trial Balance",       href: "/reports/accounts/trial-balance",       moduleKey: "report_acc_trial_balance" },
          { label: "Ageing List",         href: "/reports/accounts/ageing-list",         moduleKey: "report_acc_ageing_list" },
        ],
      },
    ],
  },
  { label: "Reprint", icon: Printer, href: "/reprint", moduleKey: "reprint" },
  {
    label: "User Management", icon: Users, children: [
      { label: "Users",       href: "/usermgmt/users",      moduleKey: "usermgmt_users" },
      { label: "Roles",       href: "/usermgmt/roles",      moduleKey: "usermgmt_roles" },
      { label: "Role Rights", href: "/usermgmt/role-rights",moduleKey: "usermgmt_role_rights" },
    ]
  },
  { label: "Software Setup", icon: Settings, href: "/setup", moduleKey: "software_setup" },
];

// ─── Rights filtering ──────────────────────────────────────────────────────────
function buildCanView(fullAccess: boolean, rights: { module: string; canView: boolean }[]) {
  if (fullAccess) return (_key: string) => true;
  const map = new Map(rights.map(r => [r.module, r.canView]));
  // If a module has no entry saved yet, default to true so existing menus aren't
  // silently hidden when admin hasn't explicitly configured the role yet.
  return (key: string) => map.has(key) ? (map.get(key) ?? false) : true;
}

function filterNav(items: any[], canView: (key: string) => boolean): any[] {
  return items.flatMap(item => {
    // Leaf item
    if (!item.children) {
      return canView(item.moduleKey) ? [item] : [];
    }
    // Group with children (2-level or 3-level)
    const filteredChildren = item.children.flatMap((child: any) => {
      if (child.subChildren) {
        // 3-level: filter subChildren
        const filteredSubs = child.subChildren.filter((sc: any) => canView(sc.moduleKey));
        return filteredSubs.length > 0 ? [{ ...child, subChildren: filteredSubs }] : [];
      }
      // 2-level: leaf child
      return canView(child.moduleKey) ? [child] : [];
    });
    return filteredChildren.length > 0 ? [{ ...item, children: filteredChildren }] : [];
  });
}

// ─── Sub-item leaf link (level 3) ─────────────────────────────────────────────
function SubLink({ item, onClose }: { item: any; onClose?: () => void }) {
  const [location] = useLocation();
  const active = location === item.href || location.startsWith(item.href + "/");
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={`block px-3 py-1.5 text-xs rounded transition-colors ${active ? "bg-[#d74700] text-white font-semibold" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
      data-testid={`nav-leaf-${item.label.toLowerCase().replace(/\s/g, "-")}`}
    >
      {item.label}
    </Link>
  );
}

// ─── Sub-group (level 2 inside Masters) ───────────────────────────────────────
function SubGroup({ group, onClose }: { group: any; onClose?: () => void }) {
  const [location] = useLocation();
  const anyActive = group.subChildren?.some((c: any) => location === c.href || location.startsWith(c.href + "/"));
  const [open, setOpen] = useState(anyActive);
  return (
    <div>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded transition-colors ${open || anyActive ? "text-white bg-white/10" : "text-white/60 hover:text-white hover:bg-white/5"}`}
        data-testid={`nav-subgroup-${group.label.toLowerCase().replace(/\s/g, "-")}`}
      >
        {group.icon && <group.icon size={14} className="flex-shrink-0" />}
        <span className="flex-1 text-left uppercase tracking-wider">{group.label}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && (
        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/15 pl-2">
          {group.subChildren.map((c: any) => <SubLink key={c.href} item={c} onClose={onClose} />)}
        </div>
      )}
    </div>
  );
}

// ─── Top-level nav item ────────────────────────────────────────────────────────
function NavItem({ item, collapsed, onClose }: { item: any; collapsed: boolean; onClose?: () => void }) {
  const [location] = useLocation();
  const isAnyChildActive = item.children?.some((c: any) => {
    if (c.subChildren) return c.subChildren.some((sc: any) => location === sc.href || location.startsWith(sc.href + "/"));
    return location === c.href || location.startsWith(c.href + "/");
  });
  const [open, setOpen] = useState(isAnyChildActive);

  // Leaf link
  if (!item.children) {
    const active = location === item.href || location.startsWith(item.href + "/");
    return (
      <Link
        href={item.href}
        onClick={onClose}
        className={`flex items-center gap-3 py-2.5 text-sm font-medium transition-colors rounded-lg ${active ? "bg-[#d74700] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
        style={{ width: "calc(100% - 16px)", margin: "0 8px" }}
        data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
      >
        <item.icon size={18} className={`flex-shrink-0 ${collapsed ? "mx-auto" : "ml-1"}`} />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  }

  // Group with children
  return (
    <div>
      <button
        onClick={() => setOpen((o: boolean) => !o)}
        className={`flex items-center gap-3 py-2.5 text-sm font-medium transition-colors rounded-lg ${open || isAnyChildActive ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
        style={{ width: "calc(100% - 16px)", margin: "0 8px" }}
        data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
      >
        <item.icon size={18} className={`flex-shrink-0 ${collapsed ? "mx-auto" : "ml-1"}`} />
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{item.label}</span>
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </>
        )}
      </button>

      {!collapsed && open && (
        <div className="ml-8 mt-0.5 mb-1 space-y-0.5">
          {item.children.map((c: any) => {
            if (c.subChildren) {
              return <SubGroup key={c.label} group={c} onClose={onClose} />;
            }
            const active = location === c.href || location.startsWith(c.href + "/");
            return (
              <Link
                key={c.href}
                href={c.href}
                onClick={onClose}
                className={`block px-3 py-2 text-sm rounded-lg transition-colors ${active ? "bg-[#d74700] text-white font-medium" : "text-white/70 hover:bg-white/10 hover:text-white"}`}
                data-testid={`nav-sub-${c.label.toLowerCase().replace(/\s/g, "-")}`}
              >
                {c.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({ collapsed, mobile, onClose, companyName }: { collapsed: boolean; mobile?: boolean; onClose?: () => void; companyName?: string }) {
  const { user, logout } = useAuth();

  const { data: myRights } = useQuery<{ fullAccess: boolean; rights: { module: string; canView: boolean }[] }>({
    queryKey: ["/api/my-rights"],
    staleTime: 60_000,
  });

  const visibleNav = useMemo(() => {
    if (!myRights) return NAV;
    const canView = buildCanView(myRights.fullAccess, myRights.rights);
    return filterNav(NAV, canView);
  }, [myRights]);

  return (
    <div className="flex flex-col h-full" style={{ background: "linear-gradient(180deg, #027fa5 0%, #015f7a 100%)" }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/20 flex-shrink-0">
        <div className="h-9 w-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0 overflow-hidden">
          <img src="/figmaAssets/image-1.png" alt="logo" className="h-8 w-8 object-contain" />
        </div>
        {(!collapsed || mobile) && (
          <span className="text-white font-bold text-sm tracking-wide">Pioneer Prism</span>
        )}
      </div>


      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {visibleNav.map(item => (
          <NavItem key={item.label} item={item} collapsed={collapsed && !mobile} onClose={onClose} />
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t border-white/20 p-3 flex-shrink-0">
        <button
          onClick={() => logout.mutate()}
          className="w-full flex items-center gap-3 px-3 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-sm transition-colors"
          data-testid="button-logout"
        >
          <LogOut size={16} />
          {(!collapsed || mobile) && <span>Logout</span>}
        </button>
      </div>
    </div>
  );
}

// ─── PWA Install Banner ────────────────────────────────────────────────────────
function InstallBanner() {
  const [prompt, setPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!prompt || dismissed) return null;

  async function install() {
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setPrompt(null);
    else setDismissed(true);
  }

  return (
    <div className="lg:hidden fixed top-0 left-0 right-0 z-[60] flex items-center justify-between gap-3 px-4 py-2.5 text-white text-sm"
      style={{ background: "#027fa5", paddingTop: "calc(0.625rem + env(safe-area-inset-top))" }}>
      <div className="flex items-center gap-2">
        <Download size={16} />
        <span className="font-medium">Install Element ERP on your device</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={install}
          className="px-3 py-1 rounded-full text-xs font-semibold bg-white" style={{ color: "#027fa5" }}>
          Install
        </button>
        <button onClick={() => setDismissed(true)} className="p-1 opacity-70 hover:opacity-100">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Mobile Bottom Tab Bar ─────────────────────────────────────────────────────
const BOTTOM_TABS = [
  { label: "Home",        icon: LayoutDashboard, href: "/dashboard" },
  { label: "Inventory",   icon: Warehouse,        href: "/inventory/purchase-order" },
  { label: "Engineering", icon: Cpu,              href: "/engineering/job-work-inward" },
  { label: "Accounts",    icon: BookOpen,         href: "/accounts/voucher" },
  { label: "Reports",     icon: BarChart2,        href: "/reports/inventory/stock-report" },
];

function BottomTabBar({ onMorePress }: { onMorePress: () => void }) {
  const [location] = useLocation();
  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 flex items-stretch"
      style={{
        boxShadow: "0 -2px 12px rgba(0,0,0,0.08)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {BOTTOM_TABS.map(tab => {
        const active = location.startsWith(tab.href.split("/").slice(0, 2).join("/"));
        return (
          <Link key={tab.href} href={tab.href}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] active:bg-gray-50 transition-colors"
            data-testid={`bottomnav-${tab.label.toLowerCase()}`}
          >
            <tab.icon size={22} style={{ color: active ? "#027fa5" : "#9ca3af" }} strokeWidth={active ? 2.2 : 1.8} />
            <span className="text-[10px] font-medium" style={{ color: active ? "#027fa5" : "#9ca3af" }}>
              {tab.label}
            </span>
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full" style={{ background: "#027fa5" }} />
            )}
          </Link>
        );
      })}
      {/* More */}
      <button
        onClick={onMorePress}
        className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] active:bg-gray-50 transition-colors"
        data-testid="bottomnav-more"
      >
        <MoreHorizontal size={22} className="text-gray-400" strokeWidth={1.8} />
        <span className="text-[10px] font-medium text-gray-400">More</span>
      </button>
    </nav>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
export function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const { data: settingsArr = [] } = useQuery<{ key: string; value: string }[]>({
    queryKey: ["/api/settings"],
  });
  const companyName = settingsArr.find(s => s.key === "company_name")?.value || "Element ERP";

  return (
    <div className="flex h-screen bg-[#f5f0ed] font-['Source_Sans_Pro',sans-serif] overflow-hidden">
      {/* PWA Install Banner */}
      <InstallBanner />

      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col flex-shrink-0 transition-all duration-300 ${collapsed ? "w-16" : "w-64"}`}>
        <Sidebar collapsed={collapsed} companyName={companyName} />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col shadow-2xl">
            <Sidebar collapsed={false} mobile onClose={() => setSidebarOpen(false)} companyName={companyName} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header
          className="flex-shrink-0 bg-white border-b border-gray-200 px-4 flex items-center justify-between"
          style={{
            boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
            paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))",
            paddingBottom: "0.75rem",
          }}
        >
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation"
              onClick={() => setSidebarOpen(true)}
              data-testid="button-menu"
            >
              <Menu size={20} className="text-gray-600" />
            </button>
            <button
              className="hidden lg:flex p-2 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setCollapsed(c => !c)}
              data-testid="button-collapse"
            >
              <Menu size={20} className="text-gray-600" />
            </button>
            <div>
              <div className="text-sm font-semibold text-gray-800">{companyName}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation" data-testid="button-notifications">
              <Bell size={18} className="text-gray-600" />
            </button>
            <Link href="/setup">
              <button className="hidden sm:flex p-2 rounded-lg hover:bg-gray-100 transition-colors touch-manipulation" title="Software Setup" data-testid="button-setup">
                <Settings size={18} className="text-gray-600" />
              </button>
            </Link>
            <div className="h-7 w-px bg-gray-200 mx-1" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0" style={{ background: "#027fa5" }}>
                {(user?.name || user?.username || "U")[0].toUpperCase()}
              </div>
              <div className="hidden sm:flex flex-col leading-tight">
                <span className="text-xs text-gray-400">{(() => { const h = new Date().getHours(); return h < 12 ? "Good Morning" : h < 17 ? "Good Afternoon" : "Good Evening"; })()}</span>
                <span className="text-sm font-medium text-gray-700">{user?.name || user?.username}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content — extra bottom padding on mobile for bottom tab bar */}
        <main
          className="flex-1 overflow-auto p-3 md:p-6"
          style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="pb-16 lg:pb-0">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <BottomTabBar onMorePress={() => setSidebarOpen(true)} />
    </div>
  );
}
