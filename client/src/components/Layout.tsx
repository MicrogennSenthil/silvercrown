import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, ShoppingCart, Package, TrendingUp, BookOpen,
  CheckSquare, RefreshCw, LogOut, Menu, Bell, User, Settings,
  Users, Database, ChevronDown, ChevronRight, Cpu, Printer,
  BarChart2, Handshake, IndianRupee, Warehouse, Wrench
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
          { label: "Machine", href: "/masters/machines" },
          { label: "Category", href: "/masters/categories" },
          { label: "Sub Category", href: "/masters/sub-categories" },
          { label: "Purchase approval", href: "/masters/purchase-approvals" },
          { label: "Approval Authority", href: "/masters/approval-authority" },
          { label: "Purchase Store Item", href: "/masters/purchase-store-items" },
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
      { label: "Stock Items", href: "/inventory/items" },
      { label: "Stock Transfer", href: "/inventory/transfer" },
      { label: "Stock Adjustment", href: "/inventory/adjustment" },
    ]
  },
  {
    label: "Purchase", icon: ShoppingCart, children: [
      { label: "Purchase Order", href: "/purchase/orders" },
      { label: "Purchase Invoice", href: "/purchase/invoices" },
      { label: "Purchase Return", href: "/purchase/returns" },
    ]
  },
  {
    label: "Sales", icon: TrendingUp, children: [
      { label: "Sales Order", href: "/sales/orders" },
      { label: "Sales Invoice", href: "/sales/invoices" },
      { label: "Sales Return", href: "/sales/returns" },
    ]
  },
  {
    label: "Accounts", icon: BookOpen, children: [
      { label: "Journal Entries", href: "/accounts/journal" },
      { label: "Ledger", href: "/accounts/ledger" },
      { label: "Reports", href: "/accounts/reports" },
    ]
  },
  { label: "Tasks & Reminders", icon: CheckSquare, href: "/tasks" },
  { label: "Tally Integration", icon: RefreshCw, href: "/tally" },
  { label: "Report", icon: BarChart2, href: "/reports" },
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

// ─── Layout ───────────────────────────────────────────────────────────────────
export function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-[#f5f0ed] font-['Source_Sans_Pro',sans-serif] overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className={`hidden lg:flex flex-col flex-shrink-0 transition-all duration-300 ${collapsed ? "w-16" : "w-64"}`}>
        <Sidebar collapsed={collapsed} />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 flex flex-col">
            <Sidebar collapsed={false} mobile onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between" style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }}>
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setSidebarOpen(true)} data-testid="button-menu">
              <Menu size={20} className="text-gray-600" />
            </button>
            <button className="hidden lg:flex p-2 rounded-lg hover:bg-gray-100 transition-colors" onClick={() => setCollapsed(c => !c)} data-testid="button-collapse">
              <Menu size={20} className="text-gray-600" />
            </button>
            <div>
              <div className="text-sm font-semibold text-gray-800">Silver Crown Metals</div>
              <div className="text-xs text-gray-500 hidden sm:block">Element ERP System</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors" data-testid="button-notifications">
              <Bell size={18} className="text-gray-600" />
            </button>
            <Link href="/setup">
              <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors" title="Software Setup" data-testid="button-setup">
                <Settings size={18} className="text-gray-600" />
              </button>
            </Link>
            <div className="h-8 w-px bg-gray-200" />
            <div className="flex items-center gap-2 pl-1">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium" style={{ background: "#027fa5" }}>
                {(user?.name || user?.username || "U")[0].toUpperCase()}
              </div>
              <span className="text-sm font-medium text-gray-700 hidden sm:block">{user?.name || user?.username}</span>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
