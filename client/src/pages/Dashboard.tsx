import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid
} from "recharts";
import { TrendingUp, TrendingDown, Bell, Eye } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed", accent: "#f96a0b" };

const AGEING_RANGES = "0-15,15-30,30-45,45-60,60-9999";

type TabKey = "inward" | "despatch" | "invoice" | "purchaseOrder" | "payments";

const TABS: { key: TabKey; label: string }[] = [
  { key: "inward",        label: "Job Work" },
  { key: "despatch",      label: "Despatch" },
  { key: "invoice",       label: "Invoice" },
  { key: "purchaseOrder", label: "Purchase Order" },
  { key: "payments",      label: "Payments" },
];

const COLS: Record<TabKey, { key: string; header: string; right?: boolean }[]> = {
  inward: [
    { key: "sno",         header: "S.No" },
    { key: "voucher_no",  header: "Inw No" },
    { key: "inward_date", header: "Inw Date" },
    { key: "party_name",  header: "Party Name" },
    { key: "item_name",   header: "Item Name" },
    { key: "unit",        header: "Unit" },
    { key: "qty",         header: "Qty", right: true },
    { key: "process",     header: "Nature Of Process" },
  ],
  despatch: [
    { key: "sno",               header: "S.No" },
    { key: "voucher_no",        header: "Desp No" },
    { key: "despatch_date",     header: "Desp Date" },
    { key: "party_name",        header: "Party Name" },
    { key: "item_name",         header: "Item Name" },
    { key: "unit",              header: "Unit" },
    { key: "qty_despatched",    header: "Qty", right: true },
    { key: "inward_voucher_no", header: "Inward Ref" },
  ],
  invoice: [
    { key: "sno",          header: "S.No" },
    { key: "voucher_no",   header: "Invoice No" },
    { key: "invoice_date", header: "Date" },
    { key: "party_name",   header: "Party Name" },
    { key: "invoice_type_label", header: "Type" },
    { key: "total_amount", header: "Amount", right: true },
    { key: "status",       header: "Status" },
  ],
  purchaseOrder: [
    { key: "sno",           header: "S.No" },
    { key: "voucher_no",    header: "PO No" },
    { key: "po_date",       header: "PO Date" },
    { key: "supplier_name", header: "Supplier" },
    { key: "status",        header: "Status" },
    { key: "item_count",    header: "Items", right: true },
  ],
  payments: [
    { key: "sno",          header: "S.No" },
    { key: "voucher_no",   header: "Voucher No" },
    { key: "voucher_date", header: "Date" },
    { key: "party_name",   header: "Narration" },
    { key: "total_amount", header: "Amount", right: true },
    { key: "voucher_type", header: "Type" },
  ],
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtAmt(v: any) {
  if (v === null || v === undefined) return "—";
  const n = parseFloat(v);
  return isNaN(n) ? "—" : `₹ ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function daysDiff(dateStr: string) {
  const due = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - due.getTime()) / 86400000);
}
function invTypeLabel(t: string) {
  if (t === "despatch_notes") return "Despatch Note";
  if (t === "direct_invoice") return "Direct Invoice";
  return t || "—";
}

function formatMonthlyValue(value: number) {
  return `₹ ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatChartValue(value: number) {
  if (value >= 10000000) return `₹ ${(value / 10000000).toFixed(1)} Cr`;
  if (value >= 100000) return `₹ ${(value / 100000).toFixed(1)} L`;
  if (value >= 1000) return `₹ ${(value / 1000).toFixed(1)} K`;
  return `₹ ${Math.round(value).toLocaleString("en-IN")}`;
}

function StatCard({ label, value, amount, lastDate }: { label: string; value: number; amount: number; lastDate?: string | null }) {
  const formattedDate = lastDate
    ? new Date(lastDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : null;
  return (
    <div className="bg-white rounded-xl p-4 flex items-start gap-3 flex-1" style={{ boxShadow: "1px 1px 3px 1px rgba(0,0,0,0.12)" }}>
      <div className="flex-shrink-0 mt-1">
        <div className="w-9 h-9 rounded flex items-center justify-center" style={{ background: "#e8f4f8" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={SC.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </svg>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-gray-500 font-medium">Monthly</div>
            <div className="text-3xl font-bold leading-tight" style={{ color: SC.primary }}>
              {String(value).padStart(2, "0")}
            </div>
            <div className="text-sm font-semibold text-gray-700 mt-0.5">{label}</div>
          </div>
          <TrendingUp size={20} className="text-green-500 mt-1 flex-shrink-0" />
        </div>
        <div className="flex items-center gap-1 mt-2 min-w-0">
          <span className="text-xs text-gray-400 shrink-0">Value:</span>
          <span
            className="text-xs font-semibold truncate"
            style={{ color: SC.primary }}
            title={formatMonthlyValue(amount)}
            data-testid={`dashboard-${label.toLowerCase()}-monthly-value`}
          >
            {formatMonthlyValue(amount)}
          </span>
        </div>
        {formattedDate && (
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs text-gray-400">Last:</span>
            <span className="text-xs font-semibold" style={{ color: SC.primary }}>{formattedDate}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function WipCircle({ pct }: { pct: number }) {
  const r = 42, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
      <circle cx="55" cy="55" r={r} fill="none" stroke={SC.primary} strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 55 55)" />
      <text x="55" y="50" textAnchor="middle" fontSize="20" fontWeight="bold" fill={SC.primary}>{pct}%</text>
      <text x="55" y="66" textAnchor="middle" fontSize="10" fill="#6b7280">Onprocess</text>
    </svg>
  );
}

const SCROLL_Y = { overflowY: "auto" as const };
const SCROLL_XY = { overflowX: "auto" as const, overflowY: "auto" as const };

export default function Dashboard() {
  const [chartFilter, setChartFilter]  = useState("Last 10-days");
  const [activeTab,   setActiveTab]    = useState<TabKey>("inward");
  const [ageingType,  setAgeingType]   = useState<"receivable" | "payable">("receivable");
  const [ageingUnit,  setAgeingUnit]   = useState<"thousands" | "lakhs" | "crores">("lakhs");

  const { data: overdueTasks = [] } = useQuery<any[]>({
    queryKey: ["/api/tasks/overdue"],
    queryFn: () => fetch("/api/tasks/overdue", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 60000,
  });

  const { data: counts = {} } = useQuery<Record<string, any>>({
    queryKey: ["/api/dashboard/counts"],
    queryFn: () => fetch("/api/dashboard/counts", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: detail = [], isFetching: detailLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/detail", activeTab],
    queryFn: () => fetch(`/api/dashboard/detail/${activeTab}`, { credentials: "include" }).then(r => r.json()),
  });

  const ageingParty = ageingType === "receivable" ? "customer" : "supplier";
  const { data: ageingRows = [], isFetching: ageingLoading } = useQuery<any[]>({
    queryKey: ["/api/reports/ageing-list", ageingParty],
    queryFn: () => fetch(`/api/reports/ageing-list?party=${ageingParty}&ranges=${AGEING_RANGES}`, { credentials: "include" }).then(r => r.json()),
    staleTime: 60000,
  });

  const tabCounts: Record<TabKey, number> = {
    inward:        counts.inward        ?? 0,
    despatch:      counts.despatch      ?? 0,
    invoice:       counts.invoice       ?? 0,
    purchaseOrder: counts.purchaseOrder ?? 0,
    payments:      counts.payments      ?? 0,
  };

  const cols = COLS[activeTab];
  const salesTrend: { month: string; label: string; value: number }[] =
    Array.isArray(counts.salesTrend) ? counts.salesTrend : [];
  const currentSales = salesTrend[salesTrend.length - 1]?.value || 0;
  const previousSales = salesTrend[salesTrend.length - 2]?.value || 0;
  const salesTrendPct = previousSales > 0
    ? ((currentSales - previousSales) / previousSales) * 100
    : null;

  function cellValue(row: any, key: string, idx: number): string {
    if (key === "sno") return String(idx + 1).padStart(2, "0");
    if (key === "invoice_type_label") return invTypeLabel(row.invoice_type);
    if (key === "total_amount") return fmtAmt(row.total_amount);
    const v = row[key];
    if (v === null || v === undefined || v === "") return "—";
    if (key.endsWith("_date") || key === "voucher_date") return fmtDate(String(v));
    return String(v);
  }

  const divisor = ageingUnit === "thousands" ? 1000 : ageingUnit === "crores" ? 10000000 : 100000;
  const fmtUnit = (v: number) => v > 0 ? `₹ ${(v / divisor).toFixed(2)}` : "";

  return (
    <div className="space-y-4 text-sm" style={{ fontFamily: "Source Sans Pro, sans-serif" }}>

      {/* ── Top Stat Cards ── */}
      <div className="flex gap-4">
        <StatCard label="Inward"   value={tabCounts.inward}   amount={Number(counts.inwardValue) || 0}   lastDate={counts.lastInwardDate} />
        <StatCard label="Despatch" value={tabCounts.despatch} amount={Number(counts.despatchValue) || 0} lastDate={counts.lastDespatchDate} />
        <StatCard label="Invoice"  value={tabCounts.invoice}  amount={Number(counts.invoiceValue) || 0}  lastDate={counts.lastInvoiceDate} />
      </div>

      {/* ── Main Two-Column Grid ── */}
      <div className="flex gap-4 items-start">

        {/* ── LEFT column ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Month-wise Sales Value */}
          <div className="bg-white rounded-xl p-4" style={{ boxShadow: "1px 1px 3px 1px rgba(0,0,0,0.1)" }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-sm font-semibold text-gray-700">Month-wise Sales Value</div>
                <div className="text-xs text-gray-400 mt-0.5">Last 12 months · excluding cancelled invoices</div>
              </div>
              <div className="text-right">
                <div className="text-base font-bold" style={{ color: SC.primary }}>{formatMonthlyValue(currentSales)}</div>
                <div className={`flex items-center justify-end gap-1 text-xs font-semibold ${salesTrendPct === null || salesTrendPct >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {salesTrendPct !== null && (salesTrendPct >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />)}
                  {salesTrendPct === null ? "No prior month" : `${salesTrendPct >= 0 ? "+" : ""}${salesTrendPct.toFixed(1)}% vs last month`}
                </div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={salesTrend} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesTrendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={SC.primary} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={SC.primary} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#edf2f4" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false}
                  tickFormatter={formatChartValue} width={58} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #d2f1fa" }}
                  formatter={(value: any) => [formatMonthlyValue(Number(value) || 0), "Sales Value"]}
                  labelFormatter={(label) => `Month: ${label}`}
                />
                <Area type="monotone" dataKey="value" name="Sales Value" stroke={SC.primary}
                  strokeWidth={2.5} fill="url(#salesTrendFill)" dot={{ r: 3, fill: SC.primary, strokeWidth: 0 }}
                  activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Over-all Chart card */}
          <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 3px 1px rgba(0,0,0,0.1)" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-semibold text-gray-700">Over-all Chart</span>
              <div
                className="flex items-center gap-1 border rounded px-2 py-1 text-xs text-gray-500 cursor-pointer"
                style={{ borderColor: "#00000020" }}
                onClick={() => setChartFilter(f => f === "Last 10-days" ? "Last 30-days" : "Last 10-days")}
                data-testid="filter-chart-period"
              >
                {chartFilter}
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
              </div>
            </div>

            {/* Tab selector boxes */}
            <div className="grid grid-cols-5 divide-x divide-gray-100 border-b border-gray-100">
              {TABS.map(tab => {
                const isActive = tab.key === activeTab;
                return (
                  <div
                    key={tab.key}
                    className="px-4 py-3 text-center cursor-pointer select-none transition-colors"
                    style={isActive ? { background: SC.primary } : { background: "white" }}
                    onClick={() => setActiveTab(tab.key)}
                    data-testid={`tab-overall-${tab.key}`}
                  >
                    <div className={`text-xs font-medium mb-1 ${isActive ? "text-white/80" : "text-gray-500"}`}>
                      {tab.label}
                    </div>
                    <div className={`text-xl font-bold ${isActive ? "text-white" : "text-gray-800"}`}>
                      {String(tabCounts[tab.key]).padStart(2, "0")}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detail table — fixed height, scrolls both axes */}
            <div style={{ ...SCROLL_XY, minHeight: 80, maxHeight: 280 }}>
              {detailLoading ? (
                <div className="text-center py-6 text-xs text-gray-400">Loading...</div>
              ) : detail.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-400">No records found</div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10" style={{ background: SC.tonal }}>
                    <tr>
                      {cols.map(c => (
                        <th key={c.key} className={`px-3 py-2 font-semibold text-gray-600 whitespace-nowrap ${c.right ? "text-right" : "text-left"}`}>
                          {c.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {detail.map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        {cols.map(c => (
                          <td
                            key={c.key}
                            className={`px-3 py-2 ${
                              c.key === "voucher_no"
                                ? "font-semibold"
                                : c.right
                                ? "text-right font-semibold text-gray-800"
                                : "text-gray-700"
                            }`}
                            style={c.key === "voucher_no" ? { color: SC.primary } : undefined}
                          >
                            {cellValue(row, c.key, idx)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>
        {/* ── end LEFT column ── */}

        {/* ── RIGHT column ── */}
        <div className="w-80 flex-shrink-0 space-y-4">

          {/* Ageing List */}
          <div className="bg-white rounded-xl" style={{ boxShadow: "1px 1px 3px 1px rgba(0,0,0,0.1)", overflow: "hidden" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-700 text-sm">Ageing List</span>
                <select
                  value={ageingType}
                  onChange={e => setAgeingType(e.target.value as "receivable" | "payable")}
                  className="text-xs border border-gray-200 rounded-md px-2 py-0.5 bg-white font-medium focus:outline-none"
                  style={{ color: SC.primary }}>
                  <option value="receivable">Receivable</option>
                  <option value="payable">Payable</option>
                </select>
              </div>
              <select
                value={ageingUnit}
                onChange={e => setAgeingUnit(e.target.value as "thousands" | "lakhs" | "crores")}
                className="text-xs border border-gray-200 rounded-md px-2 py-0.5 bg-white font-medium focus:outline-none"
                style={{ color: SC.primary }}>
                <option value="thousands">Thousands</option>
                <option value="lakhs">Lakhs</option>
                <option value="crores">Crores</option>
              </select>
            </div>
            {/* Ageing table — fixed height, scrolls both axes */}
            <div style={{ ...SCROLL_XY, maxHeight: 220 }}>
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10" style={{ background: SC.tonal }}>
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Party</th>
                    <th className="text-right px-2 py-2 font-semibold text-gray-600">Total</th>
                    <th className="text-right px-2 py-2 font-semibold text-gray-600 whitespace-nowrap">0-15<br />Days</th>
                    <th className="text-right px-2 py-2 font-semibold text-gray-600 whitespace-nowrap">15-30<br />Days</th>
                    <th className="text-right px-2 py-2 font-semibold text-gray-600 whitespace-nowrap">30-45<br />Days</th>
                    <th className="text-right px-2 py-2 font-semibold text-gray-600 whitespace-nowrap">45-60<br />Days</th>
                    <th className="text-right px-2 py-2 font-semibold text-gray-600 whitespace-nowrap">&gt;60<br />Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ageingLoading ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-5 text-center text-gray-400">Loading…</td>
                    </tr>
                  ) : ageingRows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-5 text-center text-gray-400">
                        No outstanding {ageingType === "receivable" ? "receivables" : "payables"}
                      </td>
                    </tr>
                  ) : ageingRows.map((r: any) => {
                    const total = parseFloat(r.total || 0);
                    const bkts: number[] = r.buckets || [];
                    return (
                      <tr key={r.party_id || r.party_name} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-700">{r.party_name}</td>
                        <td className="px-2 py-2 text-right font-semibold" style={{ color: SC.primary }}>
                          {total !== 0 ? `₹ ${(Math.abs(total) / divisor).toFixed(2)}` : ""}
                        </td>
                        <td className="px-2 py-2 text-right text-gray-600">{fmtUnit(bkts[0] ?? 0)}</td>
                        <td className="px-2 py-2 text-right text-gray-600">{fmtUnit(bkts[1] ?? 0)}</td>
                        <td className="px-2 py-2 text-right text-gray-600">{fmtUnit(bkts[2] ?? 0)}</td>
                        <td className="px-2 py-2 text-right text-gray-600">{fmtUnit(bkts[3] ?? 0)}</td>
                        <td className="px-2 py-2 text-right text-gray-600">{fmtUnit(bkts[4] ?? 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Overdue Tasks / Reminders */}
          <div className="bg-white rounded-xl" style={{ boxShadow: "1px 1px 3px 1px rgba(0,0,0,0.1)", overflow: "hidden" }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Bell size={14} style={{ color: SC.orange }} />
              <span className="font-semibold text-gray-700 text-sm">Overdue Tasks / Reminders</span>
              {(overdueTasks as any[]).length > 0 && (
                <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white" style={{ background: SC.orange }}>
                  {(overdueTasks as any[]).length}
                </span>
              )}
            </div>
            {/* Tasks table — fixed height, scrolls both axes */}
            <div style={{ ...SCROLL_XY, maxHeight: 200 }}>
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10" style={{ background: SC.tonal }}>
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">S.No</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Task</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Assigned To</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">Due Date</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">Lapsed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(overdueTasks as any[]).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-5 text-center text-gray-400">
                        No overdue tasks — all tasks are on schedule ✓
                      </td>
                    </tr>
                  ) : (overdueTasks as any[]).map((t: any, idx: number) => {
                    const due = t.due_date || t.dueDate || "";
                    const lapsed = due ? daysDiff(due) : 0;
                    return (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-500">{String(idx + 1).padStart(2, "0")}</td>
                        <td className="px-3 py-2 text-gray-700 font-medium">
                          {t.title}
                          {t.category && (
                            <span className="ml-2 text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{t.category}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-500">{t.assigned_employee_name || "—"}</td>
                        <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{fmtDate(due)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="px-1.5 py-0.5 rounded text-xs font-semibold" style={{ background: "#fff0e6", color: SC.orange }}>
                            +{lapsed} Day{lapsed !== 1 ? "s" : ""}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Work In Process */}
          <div className="bg-white rounded-xl p-4 flex flex-col items-center gap-2" style={{ boxShadow: "1px 1px 3px 1px rgba(0,0,0,0.1)" }}>
            <div className="w-full flex items-center justify-between mb-1">
              <span className="font-semibold text-gray-700 text-sm">Work In Process (WIP)</span>
            </div>
            <WipCircle pct={64} />
            <button className="flex items-center gap-2 px-6 py-2 rounded text-white text-sm font-semibold" style={{ background: SC.orange }} data-testid="button-wip-view">
              <Eye size={14} /> View
            </button>
          </div>

        </div>
        {/* ── end RIGHT column ── */}

      </div>
      {/* ── end Main Two-Column Grid ── */}

    </div>
  );
}
