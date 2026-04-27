import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import {
  ReportShell, ReportFilterSelect, RTh, RTd, exportToCSV,
} from "@/components/ReportShell";

const SC = { primary: "#027fa5", tonal: "#d2f1fa" };

function today()    { return new Date().toISOString().slice(0, 10); }
function monthAgo() { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10); }
function fmtQty(v: number | string) { return parseFloat(String(v) || "0").toFixed(2); }

type ReportRow = {
  item_code: string;
  item_name: string;
  unit: string;
  opening: string;
  receipt: string;
  issue: string;
  closing: string;
};

export default function StockReport() {
  const [search,     setSearch]     = useState("");
  const [fromDate,   setFromDate]   = useState(monthAgo());
  const [toDate,     setToDate]     = useState(today());
  const [itemFilter, setItemFilter] = useState("");

  const { data: rawRows = [], isLoading } = useQuery<ReportRow[]>({
    queryKey: ["/api/reports/stock-report", fromDate, toDate],
    queryFn: () =>
      fetch(`/api/reports/stock-report?from=${fromDate}&to=${toDate}`, { credentials: "include" })
        .then(r => r.json()),
  });

  // Filter options
  const allItems = useMemo(() =>
    [...new Set(rawRows.map(r => r.item_name).filter(Boolean))].sort(), [rawRows]);

  // Apply search + item filter
  const filtered: ReportRow[] = useMemo(() =>
    rawRows.filter(r => {
      if (itemFilter && r.item_name !== itemFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (![r.item_code, r.item_name, r.unit].join(" ").toLowerCase().includes(q)) return false;
      }
      return true;
    }),
  [rawRows, search, itemFilter]);

  // Footer totals
  const totals = useMemo(() => ({
    opening: filtered.reduce((s, r) => s + parseFloat(r.opening || "0"), 0),
    receipt: filtered.reduce((s, r) => s + parseFloat(r.receipt || "0"), 0),
    issue:   filtered.reduce((s, r) => s + parseFloat(r.issue   || "0"), 0),
    closing: filtered.reduce((s, r) => s + parseFloat(r.closing || "0"), 0),
  }), [filtered]);

  function handleExcel() {
    const headers = ["S.No","Item Code","Item Name","Unit","Opening","Receipt","Issue","Closing"];
    const rows = filtered.map((r, i) => [
      i + 1, r.item_code, r.item_name, r.unit,
      fmtQty(r.opening), fmtQty(r.receipt), fmtQty(r.issue), fmtQty(r.closing),
    ]);
    exportToCSV(`StockReport_${fromDate}_to_${toDate}.csv`, headers, rows);
  }

  return (
    <ReportShell
      title="Stock Report"
      search={search} onSearch={setSearch}
      fromDate={fromDate} toDate={toDate}
      onFromDate={setFromDate} onToDate={setToDate}
      onExcelExport={handleExcel}
      recordCount={filtered.length}
      extraFilters={
        <ReportFilterSelect
          label="Item" value={itemFilter} onChange={setItemFilter}
          options={allItems} allLabel="All Items" />
      }
    >
      {/* Summary strip */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex items-center gap-8 px-5 py-2 border-b border-gray-100 bg-gray-50/50 text-xs">
          <span className="text-gray-500">Items: <b className="text-gray-800">{filtered.length}</b></span>
          <span className="text-gray-500">Opening: <b className="text-gray-800">{fmtQty(totals.opening)}</b></span>
          <span className="text-gray-500">Receipt: <b style={{ color: SC.primary }}>{fmtQty(totals.receipt)}</b></span>
          <span className="text-gray-500">Issue: <b className="text-orange-600">{fmtQty(totals.issue)}</b></span>
          <span className="text-gray-500">Closing: <b className="font-semibold text-gray-800">{fmtQty(totals.closing)}</b></span>
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="sticky top-0">
          <tr>
            <RTh>S.no</RTh>
            <RTh>Item Code</RTh>
            <RTh>Item Name</RTh>
            <RTh>Unit</RTh>
            <RTh right>Opening</RTh>
            <RTh right>Receipt</RTh>
            <RTh right>Issue</RTh>
            <RTh right>Closing</RTh>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr><td colSpan={8} className="px-5 py-14 text-center text-gray-400">
              <div className="flex flex-col items-center gap-2">
                <div className="w-7 h-7 rounded-full animate-spin"
                  style={{ border: "3px solid #d2f1fa", borderTopColor: "#027fa5" }} />
                <span>Loading…</span>
              </div>
            </td></tr>
          )}
          {!isLoading && filtered.length === 0 && (
            <tr><td colSpan={8} className="px-5 py-14 text-center">
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <AlertCircle size={28} className="text-gray-300" />
                <span className="text-sm">
                  {search || itemFilter ? "No items match the filters." : "No inventory items found."}
                </span>
              </div>
            </td></tr>
          )}
          {!isLoading && filtered.map((row, idx) => {
            const closing = parseFloat(row.closing || "0");
            const isLow   = closing < 0;
            return (
              <tr key={row.item_code}
                className={`border-t border-gray-50 hover:bg-[#f0f9ff] transition-colors
                  ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/20"}`}
                data-testid={`row-item-${row.item_code}`}>
                <RTd muted>{String(idx + 1).padStart(2, "0")}</RTd>
                <RTd>
                  <span className="font-mono text-xs font-semibold text-gray-500">{row.item_code}</span>
                </RTd>
                <RTd bold>{row.item_name}</RTd>
                <RTd muted>{row.unit}</RTd>
                <RTd right>{fmtQty(row.opening)}</RTd>
                <RTd right>
                  <span style={{ color: parseFloat(row.receipt || "0") > 0 ? SC.primary : undefined }}>
                    {fmtQty(row.receipt)}
                  </span>
                </RTd>
                <RTd right>
                  <span className={parseFloat(row.issue || "0") > 0 ? "text-orange-600" : ""}>
                    {fmtQty(row.issue)}
                  </span>
                </RTd>
                <RTd right>
                  <span className={`font-semibold ${isLow ? "text-red-600" : closing > 0 ? "text-green-700" : "text-gray-500"}`}>
                    {fmtQty(row.closing)}
                  </span>
                </RTd>
              </tr>
            );
          })}
        </tbody>

        {!isLoading && filtered.length > 0 && (
          <tfoot>
            <tr className="border-t-2" style={{ background: SC.tonal }}>
              <td colSpan={4} className="px-4 py-2.5 text-sm font-bold text-gray-700">
                Total — {filtered.length} item{filtered.length !== 1 ? "s" : ""}
              </td>
              <RTd right bold>{fmtQty(totals.opening)}</RTd>
              <RTd right bold>
                <span style={{ color: SC.primary }}>{fmtQty(totals.receipt)}</span>
              </RTd>
              <RTd right bold>
                <span className="text-orange-600">{fmtQty(totals.issue)}</span>
              </RTd>
              <RTd right bold>
                <span className={totals.closing < 0 ? "text-red-600" : "text-green-700"}>
                  {fmtQty(totals.closing)}
                </span>
              </RTd>
            </tr>
          </tfoot>
        )}
      </table>
    </ReportShell>
  );
}
