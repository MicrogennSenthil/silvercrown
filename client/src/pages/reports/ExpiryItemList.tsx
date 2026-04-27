import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle } from "lucide-react";
import {
  ReportShell, RTh, RTd, exportToCSV,
} from "@/components/ReportShell";

function today()      { return new Date().toISOString().slice(0, 10); }
function threeMonths(){ const d = new Date(); d.setMonth(d.getMonth() + 3); return d.toISOString().slice(0, 10); }
function fmtDate(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtQty(v: any) {
  return parseFloat(String(v || "0")).toFixed(3);
}

type Row = {
  item_code: string;
  item_name: string;
  stock_qty: string;
  unit: string;
  expiry_date: string;
  batch_no: string;
  store_name: string;
  store_id: string;
  source: string;
};

function expiryStatus(expiry: string): "expired" | "critical" | "warning" | "ok" {
  if (!expiry) return "ok";
  const now   = new Date(); now.setHours(0,0,0,0);
  const exp   = new Date(expiry); exp.setHours(0,0,0,0);
  const days  = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
  if (days < 0)  return "expired";
  if (days <= 30) return "critical";
  if (days <= 90) return "warning";
  return "ok";
}

const STATUS_STYLE: Record<string, string> = {
  expired:  "bg-red-100 text-red-700 border border-red-200",
  critical: "bg-orange-100 text-orange-700 border border-orange-200",
  warning:  "bg-amber-100 text-amber-700 border border-amber-200",
  ok:       "bg-green-100 text-green-700 border border-green-200",
};
const STATUS_LABEL: Record<string, string> = {
  expired: "Expired", critical: "Critical (≤30d)", warning: "Warning (≤90d)", ok: "OK",
};

export default function ExpiryItemList() {
  const [search,     setSearch]     = useState("");
  const [fromDate,   setFromDate]   = useState(today());
  const [toDate,     setToDate]     = useState(threeMonths());
  const [storeFilter, setStoreFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const { data: warehouses = [] } = useQuery<any[]>({ queryKey: ["/api/warehouses"] });

  const { data: rawRows = [], isLoading } = useQuery<Row[]>({
    queryKey: ["/api/reports/expiry-item-list", fromDate, toDate, storeFilter],
    queryFn: () => {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      if (storeFilter) params.set("store_id", storeFilter);
      return fetch(`/api/reports/expiry-item-list?${params}`, { credentials: "include" }).then(r => r.json());
    },
  });

  const filtered = useMemo(() =>
    rawRows.filter(r => {
      if (statusFilter) {
        if (expiryStatus(r.expiry_date) !== statusFilter) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        if (![r.item_code, r.item_name, r.batch_no, r.store_name].join(" ").toLowerCase().includes(q)) return false;
      }
      return true;
    }),
  [rawRows, search, statusFilter]);

  const stores = useMemo(() =>
    (warehouses as any[]).map((w: any) => ({ value: w.id, label: w.name })), [warehouses]);

  const counts = useMemo(() => ({
    expired:  filtered.filter(r => expiryStatus(r.expiry_date) === "expired").length,
    critical: filtered.filter(r => expiryStatus(r.expiry_date) === "critical").length,
    warning:  filtered.filter(r => expiryStatus(r.expiry_date) === "warning").length,
    ok:       filtered.filter(r => expiryStatus(r.expiry_date) === "ok").length,
  }), [filtered]);

  function handleExcel() {
    const headers = ["S.No","Item Code","Item Name","Stock Qty","Unit","Expiry Date","Batch No","Store","Source","Status"];
    const rows = filtered.map((r, i) => [
      i + 1, r.item_code, r.item_name, fmtQty(r.stock_qty), r.unit,
      r.expiry_date || "", r.batch_no || "", r.store_name || "", r.source || "",
      STATUS_LABEL[expiryStatus(r.expiry_date)],
    ]);
    exportToCSV(`ExpiryItemList_${fromDate}_to_${toDate}.csv`, headers, rows);
  }

  return (
    <ReportShell
      title="Expiry Item List"
      search={search} onSearch={setSearch}
      fromDate={fromDate} toDate={toDate}
      onFromDate={setFromDate} onToDate={setToDate}
      onExcelExport={handleExcel}
      recordCount={filtered.length}
      extraFilters={
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="text-[10px] font-semibold text-gray-400 absolute -top-2 left-2 bg-white px-1 leading-none z-10">Store</span>
            <select
              value={storeFilter}
              onChange={e => setStoreFilter(e.target.value)}
              className="border border-gray-200 rounded-lg bg-white h-[36px] pl-3 pr-7 text-sm text-gray-700 outline-none
                hover:border-[#027fa5] focus:border-[#027fa5] focus:ring-1 focus:ring-[#027fa5]/20"
              data-testid="select-store-filter"
              style={{ minWidth: 150 }}>
              <option value="">All Stores</option>
              {stores.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="relative">
            <span className="text-[10px] font-semibold text-gray-400 absolute -top-2 left-2 bg-white px-1 leading-none z-10">Status</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-lg bg-white h-[36px] pl-3 pr-7 text-sm text-gray-700 outline-none
                hover:border-[#027fa5] focus:border-[#027fa5] focus:ring-1 focus:ring-[#027fa5]/20"
              data-testid="select-status-filter"
              style={{ minWidth: 130 }}>
              <option value="">All Status</option>
              {Object.entries(STATUS_LABEL).map(([val, lbl]) => (
                <option key={val} value={val}>{lbl}</option>
              ))}
            </select>
          </div>
        </div>
      }
    >
      {/* Summary strip */}
      {!isLoading && rawRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-5 py-2 border-b border-gray-100 bg-gray-50/50 text-xs">
          <button onClick={() => setStatusFilter("")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium transition-colors
              ${!statusFilter ? "ring-2 ring-offset-1 ring-gray-400" : ""} bg-gray-100 text-gray-600 hover:bg-gray-200`}>
            Total: <b>{rawRows.length}</b>
          </button>
          {counts.expired > 0 && (
            <button onClick={() => setStatusFilter(statusFilter === "expired" ? "" : "expired")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium transition-colors
                ${statusFilter === "expired" ? "ring-2 ring-offset-1 ring-red-400" : ""} ${STATUS_STYLE.expired} hover:opacity-80`}>
              <AlertCircle size={11}/> Expired: <b>{counts.expired}</b>
            </button>
          )}
          {counts.critical > 0 && (
            <button onClick={() => setStatusFilter(statusFilter === "critical" ? "" : "critical")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium transition-colors
                ${statusFilter === "critical" ? "ring-2 ring-offset-1 ring-orange-400" : ""} ${STATUS_STYLE.critical} hover:opacity-80`}>
              <AlertTriangle size={11}/> Critical (≤30d): <b>{counts.critical}</b>
            </button>
          )}
          {counts.warning > 0 && (
            <button onClick={() => setStatusFilter(statusFilter === "warning" ? "" : "warning")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium transition-colors
                ${statusFilter === "warning" ? "ring-2 ring-offset-1 ring-amber-400" : ""} ${STATUS_STYLE.warning} hover:opacity-80`}>
              Warning (≤90d): <b>{counts.warning}</b>
            </button>
          )}
          {counts.ok > 0 && (
            <button onClick={() => setStatusFilter(statusFilter === "ok" ? "" : "ok")}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium transition-colors
                ${statusFilter === "ok" ? "ring-2 ring-offset-1 ring-green-400" : ""} ${STATUS_STYLE.ok} hover:opacity-80`}>
              OK: <b>{counts.ok}</b>
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0">
            <tr>
              <RTh>S.no</RTh>
              <RTh>Item Code</RTh>
              <RTh>Item Name</RTh>
              <RTh right>Stock Qty</RTh>
              <RTh>Unit</RTh>
              <RTh>Expiry Date</RTh>
              <RTh>Batch No</RTh>
              <RTh>Store</RTh>
              <RTh center>Status</RTh>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={9} className="px-5 py-14 text-center text-gray-400">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-7 h-7 rounded-full animate-spin"
                    style={{ border: "3px solid #d2f1fa", borderTopColor: "#027fa5" }} />
                  <span>Loading…</span>
                </div>
              </td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={9} className="px-5 py-14 text-center">
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <AlertCircle size={28} className="text-gray-300" />
                  <span className="text-sm">
                    {search || statusFilter
                      ? "No items match the filters."
                      : "No items with expiry dates found in this date range."}
                  </span>
                  {!search && !statusFilter && (
                    <span className="text-xs text-gray-400 mt-1">
                      Items appear here when expiry dates are recorded in Store Openings or GRN entries.
                    </span>
                  )}
                </div>
              </td></tr>
            )}
            {!isLoading && filtered.map((row, idx) => {
              const status = expiryStatus(row.expiry_date);
              const rowBg  = status === "expired"  ? "bg-red-50/40"
                           : status === "critical" ? "bg-orange-50/40"
                           : status === "warning"  ? "bg-amber-50/20"
                           : "";
              return (
                <tr key={idx}
                  className={`border-t border-gray-50 hover:bg-[#f0f9ff] transition-colors ${rowBg}`}
                  data-testid={`row-expiry-${idx}`}>
                  <RTd muted>{String(idx + 1).padStart(2, "0")}</RTd>
                  <RTd>
                    <span className="font-mono text-xs font-semibold text-gray-500">{row.item_code}</span>
                  </RTd>
                  <RTd bold>{row.item_name}</RTd>
                  <RTd right>
                    <span className="font-semibold tabular-nums">{fmtQty(row.stock_qty)}</span>
                  </RTd>
                  <RTd muted>{row.unit || "—"}</RTd>
                  <RTd>
                    <span className={
                      status === "expired"  ? "font-semibold text-red-700" :
                      status === "critical" ? "font-semibold text-orange-700" :
                      status === "warning"  ? "font-semibold text-amber-700" :
                      "text-green-700 font-medium"
                    }>
                      {fmtDate(row.expiry_date)}
                    </span>
                  </RTd>
                  <RTd>
                    {row.batch_no
                      ? <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded border border-gray-200">{row.batch_no}</span>
                      : <span className="text-gray-300">—</span>}
                  </RTd>
                  <RTd muted>{row.store_name || "—"}</RTd>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLE[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {!isLoading && filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2 bg-[#d2f1fa]">
                <td colSpan={3} className="px-4 py-2.5 text-sm font-bold text-gray-700">
                  Total — {filtered.length} batch{filtered.length !== 1 ? "es" : ""}
                </td>
                <td className="px-4 py-2.5 text-right text-sm font-bold text-gray-800 tabular-nums">
                  {fmtQty(filtered.reduce((s, r) => s + parseFloat(r.stock_qty || "0"), 0))}
                </td>
                <td colSpan={5} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </ReportShell>
  );
}
