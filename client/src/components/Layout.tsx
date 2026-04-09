import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, ShoppingCart, Package, TrendingUp, BookOpen,
  CheckSquare, RefreshCw, LogOut, Menu, X, ChevronDown, ChevronRight,
  Bell, User, Settings, Users, Database
} from "lucide-react";

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  {
    label: "Masters", icon: Database, children: [
      { label: "Suppliers", href: "/masters/suppliers" },
      { label: "Customers", href: "/masters/customers" },
      { label: "Employees", href: "/masters/employees" },
      { label: "Inventory Categories", href: "/masters/inventory-categories" },
      { label: "Chart of Accounts", href: "/masters/accounts" },
      { label: "Warehouses", href: "/masters/warehouses" },
      { label: "Units of Measure", href: "/masters/uom" },
      { label: "Tax Rates", href: "/masters/tax-rates" },
    ]
  },
  {
    label: "Purchase", icon: ShoppingCart, children: [
      { label: "Invoices", href: "/purchase/invoices" },
    ]
  },
  {
    label: "Inventory", icon: Package, children: [
      { label: "Stock Items", href: "/inventory/items" },
    ]
  },
  {
    label: "Sales", icon: TrendingUp, children: [
      { label: "Invoices", href: "/sales/invoices" },
    ]
  },
  {
    label: "Accounts", icon: BookOpen, children: [
      { label: "Journal Entries", href: "/journal" },
      { label: "Reports", href: "/reports" },
    ]
  },
  { label: "Tasks & Reminders", icon: CheckSquare, href: "/tasks" },
  { label: "Tally Integration", icon: RefreshCw, href: "/tally" },
  {
    label: "User Management", icon: Users, children: [
      { label: "Users", href: "/usermgmt/users" },
      { label: "Roles", href: "/usermgmt/roles" },
      { label: "Role Rights", href: "/usermgmt/role-rights" },
    ]
  },
];

function NavItem({ item, collapsed, onClose }: { item: any; collapsed: boolean; onClose?: () => void }) {
  const [location] = useLocation();
  const isAnyChildActive = item.children?.some((c: any) => location.startsWith(c.href));
  const [open, setOpen] = useState(isAnyChildActive);

  if (item.children) {
    return (
      <div>
        <button
          onClick={() => setOpen((o: boolean) => !o)}
          className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors rounded-lg ${open ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
          style={{ width: "calc(100% - 16px)", margin: "0 8px" }}
          data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
        >
          <item.icon size={18} className="flex-shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">{item.label}</span>
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </>
          )}
        </button>
        {!collapsed && open && (
          <div className="ml-9 mt-0.5 mb-1 space-y-0.5">
            {item.children.map((c: any) => {
              const active = location === c.href;
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

  const active = location === item.href;
  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors rounded-lg ${active ? "bg-[#d74700] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
      style={{ width: "calc(100% - 16px)", margin: "0 8px" }}
      data-testid={`nav-${item.label.toLowerCase().replace(/\s/g, "-")}`}
    >
      <item.icon size={18} className="flex-shrink-0" />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
}

function Sidebar({ collapsed, mobile, onClose }: { collapsed: boolean; mobile?: boolean; onClose?: () => void }) {
  const { user, logout } = useAuth();
  return (
    <div className="flex flex-col h-full" style={{ background: "linear-gradient(180deg, #027fa5 0%, #015f7a 100%)" }}>
      <div className="flex items-center gap-3 px-4 py-4 border-b border-white/20 flex-shrink-0">
        <img src="/figmaAssets/image-1.png" alt="Silver Crown Metals" className="h-9 w-auto object-contain flex-shrink-0 filter brightness-0 invert" />
        {(!collapsed || mobile) && (
          <div>
            <div className="text-white font-bold text-sm leading-tight">Silver Crown</div>
            <div className="text-white/70 text-xs">Metals · Element ERP</div>
          </div>
        )}
      </div>

      <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(item => (
          <NavItem key={item.label} item={item} collapsed={collapsed && !mobile} onClose={onClose} />
        ))}
      </nav>

      <div className="border-t border-white/20 p-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <User size={16} className="text-white" />
          </div>
          {(!collapsed || mobile) && (
            <div className="min-w-0">
              <div className="text-white text-sm font-medium truncate">{user?.name || user?.username}</div>
              <div className="text-white/60 text-xs capitalize">{user?.role}</div>
            </div>
          )}
        </div>
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
