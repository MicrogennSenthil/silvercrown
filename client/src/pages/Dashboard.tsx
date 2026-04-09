import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { TrendingUp, ShoppingCart, Package, CheckSquare, ArrowUpRight, AlertTriangle } from "lucide-react";

function StatCard({ label, value, icon: Icon, color, sub }: any) {
  return (
    <div className="bg-white rounded-xl p-5 flex items-start gap-4" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
        <Icon size={22} style={{ color }} />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500 font-medium mb-1">{label}</div>
        <div className="text-2xl font-bold text-gray-800">{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<any>({ queryKey: ["/api/dashboard/stats"] });

  if (isLoading) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
      {[...Array(4)].map((_, i) => <div key={i} className="h-28 bg-white rounded-xl" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }} />)}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome to Silver Crown Metals — Element ERP</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Sales" value={fmt(stats?.totalSales || 0)} icon={TrendingUp} color="#027fa5" sub={`This month: ${fmt(stats?.salesThisMonth || 0)}`} />
        <StatCard label="Total Purchases" value={fmt(stats?.totalPurchases || 0)} icon={ShoppingCart} color="#d74700" sub={`This month: ${fmt(stats?.purchasesThisMonth || 0)}`} />
        <StatCard label="Stock Value" value={fmt(stats?.stockValue || 0)} icon={Package} color="#f96a0b" />
        <StatCard label="Pending Tasks" value={stats?.pendingTasks || 0} icon={CheckSquare} color="#5b5e66" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Purchases */}
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Recent Purchases</h2>
            <Link href="/purchase/invoices"><a className="text-xs font-medium flex items-center gap-1" style={{ color: "#027fa5" }}>View all <ArrowUpRight size={12} /></a></Link>
          </div>
          <div className="divide-y divide-gray-50">
            {stats?.recentPurchases?.length ? stats.recentPurchases.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                <div>
                  <div className="text-sm font-medium text-gray-700">{inv.invoiceNumber}</div>
                  <div className="text-xs text-gray-400">{inv.supplierName || "—"} · {inv.invoiceDate}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-800">{fmt(Number(inv.totalAmount))}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inv.status === "paid" ? "bg-green-100 text-green-700" : inv.status === "approved" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"}`}>{inv.status}</span>
                </div>
              </div>
            )) : <div className="px-5 py-8 text-center text-gray-400 text-sm">No purchase invoices yet</div>}
          </div>
        </div>

        {/* Recent Sales */}
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Recent Sales</h2>
            <Link href="/sales/invoices"><a className="text-xs font-medium flex items-center gap-1" style={{ color: "#027fa5" }}>View all <ArrowUpRight size={12} /></a></Link>
          </div>
          <div className="divide-y divide-gray-50">
            {stats?.recentSales?.length ? stats.recentSales.map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                <div>
                  <div className="text-sm font-medium text-gray-700">{inv.invoiceNumber}</div>
                  <div className="text-xs text-gray-400">{inv.customerName || "—"} · {inv.invoiceDate}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-800">{fmt(Number(inv.totalAmount))}</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${inv.status === "paid" ? "bg-green-100 text-green-700" : inv.status === "approved" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"}`}>{inv.status}</span>
                </div>
              </div>
            )) : <div className="px-5 py-8 text-center text-gray-400 text-sm">No sales invoices yet</div>}
          </div>
        </div>
      </div>

      {/* Low Stock */}
      {stats?.lowStockItems?.length > 0 && (
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
          <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
            <AlertTriangle size={16} className="text-orange-500" />
            <h2 className="font-semibold text-gray-800">Low Stock Alert</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50"><th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Item</th><th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th><th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th><th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Min Level</th></tr></thead>
              <tbody className="divide-y divide-gray-50">
                {stats.lowStockItems.map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-700">{item.name}</td>
                    <td className="px-5 py-3 text-gray-500">{item.code}</td>
                    <td className="px-5 py-3 text-right text-red-600 font-semibold">{item.stockQuantity} {item.unit}</td>
                    <td className="px-5 py-3 text-right text-gray-500">{item.minStockLevel} {item.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
