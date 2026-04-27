import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, ShoppingCart, Package, TrendingUp, BookOpen,
  CheckSquare, RefreshCw, LogOut, Menu, Bell, User, Settings,
  Users, Database, ChevronDown, ChevronRight, Cpu, Printer,
  BarChart2, Handshake, IndianRupee, Warehouse, Wrench, Shield,
  MoreHorizontal, X, Download
} from "lucide-react";

// ─── Navigation Structure ─────────────────────────────────────────────────────
// Each item can be:
//   { label, icon, href }                        — leaf link
//   { label, icon, children: [...] }             — 2-level group
//   { label, icon, children: [{ label, icon, subChildren: [...] }] }  — 3-level group

const NAV: any[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  {
    label: "Masters", icon: Database, children: [
      {
        label: "Parties", icon: Handshake, subChildren: [
          { label: "Suppliers", href: "/masters/suppliers" },
          { label: "Customers", href: "/masters/customers" },
          { label: "City", href: "/masters/cities" },
          { label: "State", href: "/masters/states" },
          { label: "Country", href: "/masters/countries" },
        ]
      },
      {
        label: "Items", icon: Package, subChildren: [
          { label: "Product", href: "/masters/products" },
          { label: "Process", href: "/masters/processes" },
          { label: "Machine", href: "/masters/machines" },
          { label: "Category", href: "/masters/categories" },
          { label: "Sub Category", href: "/masters/sub-categories" },
          { label: "Purchase approval", href: "/masters/purchase-approvals" },
          { label: "Approval Authority", href: "/masters/approval-authority" },
          { label: "Purchase Store Item", href: "/masters/purchase-store-items" },
          { label: "Store Master", href: "/masters/stores" },
          { label: "Store Item Group", href: "/masters/store-item-groups" },
          { label: "Store Item Sub Group", href: "/masters/store-item-sub-groups" },
          { label: "UOM", href: "/masters/uom" },
          { label: "Terms", href: "/masters/terms" },
          { label: "Term types", href: "/masters/term-types" },
          { label: "Department", href: "/masters/departments" },
        ]
      },
      {
        label: "Accounts", icon: IndianRupee, subChildren: [
          { label: "Chart of Accounts", href: "/masters/accounts" },
          { label: "Voucher Types", href: "/masters/voucher-types" },
          { label: "Pay Mode Types", href: "/masters/pay-mode-types" },
          { label: "Ledger Categories", href: "/masters/ledger-categories" },
          { label: "General Ledger", href: "/masters/general-ledgers" },
          { label: "Ledger", href: "/masters/ledger" },
        ]
      },
      {
        label: "Administration", icon: Shield, subChildren: [
          { label: "Financial Years", href: "/masters/financial-years" },
          { label: "Year-End Closing", href: "/masters/year-end-closing" },
          { label: "Voucher Numbering", href: "/masters/voucher-series" },
        ]
      },
    ]
  },
  {
    label: "Engineering", icon: Cpu, children: [
      { label: "Job Work Inward", href: "/engineering/job-work-inward" },
      { label: "Job Work Despatch", href: "/engineering/job-work-despatch" },
      { label: "Job Work Invoice", href: "/engineering/job-work-invoice" },
      { label: "Returnable Inward", href: "/engineering/returnable-inward" },
      { label: "Returnable Outward", href: "/engineering/returnable-outward" },
      { label: "Gate Pass", href: "/engineering/gate-pass" },
    ]
  },
  {
    label: "Inventory", icon: Warehouse, children: [
      { label: "Purchase Order", href: "/inventory/purchase-order" },
      { label: "Purchase Amendment", href: "/inventory/purchase-amendment" },
      { label: "Purchase Order Approval", href: "/inventory/purchase-order-approval" },
      { label: "Goods Receipt Note", href: "/inventory/goods-receipt-note" },
      { label: "Store Request Note", href: "/inventory/store-request-note" },
      { label: "Store Issue Indent", href: "/inventory/store-issue-indent" },
      { label: "PHY INV Reconciliation", href: "/inventory/phy-reconciliation" },
      { label: "Goods Receipt Return", href: "/inventory/goods-receipt-return" },
      { label: "Issue Indent Return", href: "/inventory/issue-indent-return" },
      { label: "Store Opening", href: "/inventory/store-opening" },
    ]
  },
  {
    label: "Accounts", icon: BookOpen, children: [
      { label: "Voucher", href: "/accounts/voucher" },
      { label: "General Ledger", href: "/accounts/general-ledger" },
      { label: "Ledger", href: "/accounts/ledger" },
    ]
  },
  { label: "Tasks & Reminders", icon: CheckSquare, href: "/tasks" },
  { label: "Tally Integration", icon: RefreshCw, href: "/tally" },
  {
    label: "Reports", icon: BarChart2, children: [
      {
        label: "Engineering",
        subChildren: [
          { label: "Job Work Pending",  href: "/reports/engineering/job-work-pending" },
          { label: "Despatch Pending",  href: "/reports/engineering/despatch-pending" },
          { label: "Invoice Pending",   href: "/reports/engineering/invoice-pending" },
          { label: "Despatch Register", href: "/reports/engineering/despatch-register" },
        ],
      },
      {
        label: "Inventory",
        subChildren: [
          { label: "Stock Report",            href: "/reports/inventory/stock-report" },
          { label: "Stock Report With Value",  href: "/reports/inventory/stock-report-value" },
          { label: "Stock Ledger",             href: "/reports/inventory/stock-ledger" },
          { label: "Bank Stock Report",        href: "/reports/inventory/bank-stock-report" },
          { label: "PO Pending",               href: "/reports/inventory/po-pending" },
          { label: "Material Register",        href: "/reports/inventory/material-register" },
          { label: "Issue Register",           href: "/reports/inventory/issue-register" },
          { label: "Receipt List",             href: "/reports/inventory/receipt-list" },
          { label: "Expiry Item List",         href: "/reports/inventory/expiry-item-list" },
        ],
      },
      {
        label: "Accounts",
        subChildren: [
          { label: "Customer Receivable", href: "/reports/accounts/customer-receivable" },
          { label: "Supplier Payables",   href: "/reports/accounts/supplier-payables" },
          { label: "Ledger Report",       href: "/reports/accounts/ledger" },
          { label: "Trial Balance",       href: "/reports/accounts/trial-balance" },
          { label: "Ageing List",         href: "/reports/accounts/ageing-list" },
        ],
      },
    ],
  },
  { label: "Reprint", icon: Printer, href: "/reprint" },
  {
    label: "User Management", icon: Users, children: [
      { label: "Users", href: "/usermgmt/users" },
      { label: "Roles", href: "/usermgmt/roles" },
      { label: "Role Rights", href: "/usermgmt/role-rights" },
    ]
  },
  { label: "Software Setup", icon: Settings, href: "/setup" },
];

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
  // Check if any child/grandchild is active
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
            // Sub-group (has subChildren — level 3)
            if (c.subChildren) {
              return <SubGroup key={c.label} group={c} onClose={onClose} />;
            }
            // Regular child link
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
function Sidebar({ collapsed, mobile, onClose }: { collapsed: boolean; mobile?: boolean; onClose?: () => void }) {
  const { user, logout } = useAuth();
  return (
    <div className="flex flex-col h-full" style={{ background: "linear-gradient(180deg, #027fa5 0%, #015f7a 100%)" }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/20 flex-shrink-0">
        <img src="/figmaAssets/image-1.png" alt="Silver Crown Metals" className="h-9 w-auto object-contain flex-shrink-0 filter brightness-0 invert" />
        {(!collapsed || mobile) && (
          <div>
            <div className="text-white font-bold text-sm leading-tight">Silver Crown</div>
            <div className="text-white/70 text-xs">Metals · Element ERP</div>
          </div>
        )}
      </div>

      {/* User profile */}
      {(!collapsed || mobile) && (
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 flex-shrink-0">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <User size={18} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-white text-sm font-semibold truncate">{user?.name || user?.username}</div>
            <div className="text-white/60 text-xs capitalize">{user?.role}</div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {NAV.map(item => (
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

  return (
    <div className="flex h-screen bg-[#f5f0ed] font-['Source_Sans_Pro',sans-serif] overflow-hidden">
      {/* PWA Install Banner */}
      <InstallBanner />

      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col flex-shrink-0 transition-all duration-300 ${collapsed ? "w-16" : "w-64"}`}>
        <Sidebar collapsed={collapsed} />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col shadow-2xl">
            <Sidebar collapsed={false} mobile onClose={() => setSidebarOpen(false)} />
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
              <div className="text-sm font-semibold text-gray-800">Silver Crown Metals</div>
              <div className="text-xs text-gray-500 hidden sm:block">Element ERP System</div>
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
              <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.name || user?.username}</span>
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
