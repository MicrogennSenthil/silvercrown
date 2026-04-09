import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, TrendingDown, Package, FileText } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700" };
const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export default function Reports() {
  const { data: stats } = useQuery<any>({ queryKey: ["/api/dashboard/stats"] });
  const { data: purchases = [] } = useQuery<any[]>({ queryKey: ["/api/purchase/invoices"] });
  const { data: sales = [] } = useQuery<any[]>({ queryKey: ["/api/sales/invoices"] });
  const { data: items = [] } = useQuery<any[]>({ queryKey: ["/api/inventory/items"] });
  const { data: accounts = [] } = useQuery<any[]>({ queryKey: ["/api/accounts"] });

  const totalAssets = accounts.filter((a: any) => a.type === "asset").reduce((s: number, a: any) => s + Number(a.balance || 0), 0);
  const totalLiabilities = accounts.filter((a: any) => a.type === "liability").reduce((s: number, a: any) => s + Number(a.balance || 0), 0);
  const totalIncome = accounts.filter((a: any) => a.type === "income").reduce((s: number, a: any) => s + Number(a.balance || 0), 0);
  const totalExpenses = accounts.filter((a: any) => a.type === "expense").reduce((s: number, a: any) => s + Number(a.balance || 0), 0);
  const netProfit = Number(stats?.totalSales || 0) - Number(stats?.totalPurchases || 0);

  const byStatus = (arr: any[]) => arr.reduce((acc, i) => { acc[i.status] = (acc[i.status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const purchaseByStatus = byStatus(purchases);
  const salesByStatus = byStatus(sales);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Reports & Analytics</h1>
        <p className="text-sm text-gray-500 mt-0.5">Business overview and financial summary</p>
      </div>

      {/* P&L Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
          <div className="flex items-center gap-2 mb-3"><TrendingUp size={18} style={{ color: "#027fa5" }} /><span className="font-semibold text-gray-700">Total Revenue</span></div>
          <div className="text-3xl font-bold" style={{ color: "#027fa5" }}>{fmt(stats?.totalSales || 0)}</div>
          <div className="text-xs text-gray-400 mt-1">This month: {fmt(stats?.salesThisMonth || 0)}</div>
        </div>
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
          <div className="flex items-center gap-2 mb-3"><TrendingDown size={18} className="text-red-500" /><span className="font-semibold text-gray-700">Total Purchases</span></div>
          <div className="text-3xl font-bold text-red-500">{fmt(stats?.totalPurchases || 0)}</div>
          <div className="text-xs text-gray-400 mt-1">This month: {fmt(stats?.purchasesThisMonth || 0)}</div>
        </div>
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
          <div className="flex items-center gap-2 mb-3"><BarChart3 size={18} style={{ color: netProfit >= 0 ? "#16a34a" : "#dc2626" }} /><span className="font-semibold text-gray-700">Net Profit</span></div>
          <div className={`text-3xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(netProfit)}</div>
          <div className="text-xs text-gray-400 mt-1">{netProfit >= 0 ? "Profit" : "Loss"} on sales vs purchases</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Purchase Invoice Summary */}
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
          <div className="flex items-center gap-2 mb-4"><FileText size={16} style={{ color: SC.orange }} /><h2 className="font-semibold text-gray-700">Purchase Invoice Status</h2></div>
          <div className="space-y-3">
            {["draft", "pending", "approved", "paid", "cancelled"].map(status => {
              const count = purchaseByStatus[status] || 0;
              const total = purchases.filter((p: any) => p.status === status).reduce((s: number, p: any) => s + Number(p.totalAmount || 0), 0);
              return (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status === "paid" ? "bg-green-100 text-green-700" : status === "approved" ? "bg-blue-100 text-blue-700" : status === "cancelled" ? "bg-gray-100 text-gray-500" : "bg-yellow-100 text-yellow-700"}`}>{status}</span>
                    <span className="text-sm text-gray-600">{count} invoices</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{fmt(total)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sales Invoice Summary */}
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
          <div className="flex items-center gap-2 mb-4"><FileText size={16} style={{ color: SC.primary }} /><h2 className="font-semibold text-gray-700">Sales Invoice Status</h2></div>
          <div className="space-y-3">
            {["draft", "pending", "approved", "paid", "cancelled"].map(status => {
              const count = salesByStatus[status] || 0;
              const total = sales.filter((s: any) => s.status === status).reduce((sum: number, s: any) => sum + Number(s.totalAmount || 0), 0);
              return (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status === "paid" ? "bg-green-100 text-green-700" : status === "approved" ? "bg-blue-100 text-blue-700" : status === "cancelled" ? "bg-gray-100 text-gray-500" : "bg-yellow-100 text-yellow-700"}`}>{status}</span>
                    <span className="text-sm text-gray-600">{count} invoices</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{fmt(total)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Balance Sheet Summary */}
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
          <h2 className="font-semibold text-gray-700 mb-4">Balance Sheet Summary</h2>
          <div className="space-y-3">
            {[["Total Assets", totalAssets, "text-blue-700"], ["Total Liabilities", totalLiabilities, "text-red-600"], ["Net Worth", totalAssets - totalLiabilities, totalAssets - totalLiabilities >= 0 ? "text-green-600" : "text-red-600"]].map(([label, value, color]) => (
              <div key={label as string} className="flex justify-between items-center py-2 border-b border-gray-50">
                <span className="text-sm text-gray-600">{label as string}</span>
                <span className={`font-bold ${color as string}`}>{fmt(value as number)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Inventory Summary */}
        <div className="bg-white rounded-xl p-5" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
          <div className="flex items-center gap-2 mb-4"><Package size={16} className="text-orange-500" /><h2 className="font-semibold text-gray-700">Inventory Summary</h2></div>
          <div className="space-y-3">
            <div className="flex justify-between"><span className="text-sm text-gray-600">Total Items</span><span className="font-semibold text-gray-800">{items.length}</span></div>
            <div className="flex justify-between"><span className="text-sm text-gray-600">Stock Value</span><span className="font-bold text-gray-800">{fmt(stats?.stockValue || 0)}</span></div>
            <div className="flex justify-between"><span className="text-sm text-gray-600">Low Stock Items</span><span className="font-semibold text-red-600">{items.filter((i: any) => Number(i.stockQuantity) <= Number(i.minStockLevel)).length}</span></div>
            <div className="flex justify-between"><span className="text-sm text-gray-600">Out of Stock</span><span className="font-semibold text-red-700">{items.filter((i: any) => Number(i.stockQuantity) === 0).length}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
