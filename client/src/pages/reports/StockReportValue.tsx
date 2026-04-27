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
function fmtVal(v: number | string) {
  return parseFloat(String(v) || "0").toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type ReportRow = {
  item_code: string;
  item_name: string;
  unit: string;
  opening_qty: string;
  opening_val: string;
  purchase_qty: string;
  purchase_val: string;
  grn_return_qty: string;
  grn_return_val: string;
  issue_qty: string;
  issue_val: string;
  issue_return_qty: string;
  issue_return_val: string;
  closing_qty: string;
  closing_val: string;
};

type Totals = {
  opening_qty: number; opening_val: number;
  purchase_qty: number; purchase_val: number;
  grn_return_qty: number; grn_return_val: number;
  issue_qty: number; issue_val: number;
  issue_return_qty: number; issue_return_val: number;
  closing_qty: number; closing_val: number;
};

export default function StockReportValue() {
  const [search,     setSearch]     = useState("");
  const [fromDate,   setFromDate]   = useState(monthAgo());
  const [toDate,     setToDate]     = useState(today());
  const [itemFilter, setItemFilter] = useState("");

  const { data: rawRows = [], isLoading } = useQuery<ReportRow[]>({
    queryKey: ["/api/reports/stock-report-value", fromDate, toDate],
    queryFn: () =>
      fetch(`/api/reports/stock-report-value?from=${fromDate}&to=${toDate}`, { credentials: "include" })
        .then(r => r.json()),
  });

  const allItems = useMemo(() =>
    [...new Set(rawRows.map(r => r.item_name).filter(Boolean))].sort(), [rawRows]);

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

  const totals: Totals = useMemo(() => ({
    opening_qty:     filtered.reduce((s, r) => s + parseFloat(r.opening_qty     || "0"), 0),
    opening_val:     filtered.reduce((s, r) => s + parseFloat(r.opening_val     || "0"), 0),
    purchase_qty:    filtered.reduce((s, r) => s + parseFloat(r.purchase_qty    || "0"), 0),
    purchase_val:    filtered.reduce((s, r) => s + parseFloat(r.purchase_val    || "0"), 0),
    grn_return_qty:  filtered.reduce((s, r) => s + parseFloat(r.grn_return_qty  || "0"), 0),
    grn_return_val:  filtered.reduce((s, r) => s + parseFloat(r.grn_return_val  || "0"), 0),
    issue_qty:       filtered.reduce((s, r) => s + parseFloat(r.issue_qty       || "0"), 0),
    issue_val:       filtered.reduce((s, r) => s + parseFloat(r.issue_val       || "0"), 0),
    issue_return_qty:filtered.reduce((s, r) => s + parseFloat(r.issue_return_qty|| "0"), 0),
    issue_return_val:filtered.reduce((s, r) => s + parseFloat(r.issue_return_val|| "0"), 0),
    closing_qty:     filtered.reduce((s, r) => s + parseFloat(r.closing_qty     || "0"), 0),
    closing_val:     filtered.reduce((s, r) => s + parseFloat(r.closing_val     || "0"), 0),
  }), [filtered]);

  function handleExcel() {
    const headers = [
      "S.No","Item Code","Item Name","Unit",
      "Opening Qty","Opening Val",
      "Purchase Qty","Purchase Val",
      "GRN Return Qty","GRN Return Val",
      "Issue Qty","Issue Val",
      "Issue Return Qty","Issue Return Val",
      "Closing Qty","Closing Val",
    ];
    const rows = filtered.map((r, i) => [
      i + 1, r.item_code, r.item_name, r.unit,
      fmtQty(r.opening_qty), fmtQty(r.opening_val),
      fmtQty(r.purchase_qty), fmtQty(r.purchase_val),
      fmtQty(r.grn_return_qty), fmtQty(r.grn_return_val),
      fmtQty(r.issue_qty), fmtQty(r.issue_val),
      fmtQty(r.issue_return_qty), fmtQty(r.issue_return_val),
      fmtQty(r.closing_qty), fmtQty(r.closing_val),
    ]);
    exportToCSV(`StockReportValue_${fromDate}_to_${toDate}.csv`, headers, rows);
  }

  return (
    <ReportShell
      title="Stock Report With Value"
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
        <div className="flex flex-wrap items-center gap-x-8 gap-y-1 px-5 py-2 border-b border-gray-100 bg-gray-50/50 text-xs">
          <span className="text-gray-500">Items: <b className="text-gray-800">{filtered.length}</b></span>
          <span className="text-gray-500">Opening Val: <b className="text-gray-800">₹{fmtVal(totals.opening_val)}</b></span>
          <span className="text-gray-500">Purchase Val: <b style={{ color: SC.primary }}>₹{fmtVal(totals.purchase_val)}</b></span>
          <span className="text-gray-500">Issue Val: <b className="text-orange-600">₹{fmtVal(totals.issue_val)}</b></span>
          <span className="text-gray-500">Closing Val: <b className={totals.closing_val < 0 ? "text-red-600" : "text-green-700"}>₹{fmtVal(totals.closing_val)}</b></span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 1100 }}>
          <thead className="sticky top-0">
            <tr>
              <RTh rowSpan={2} className="align-middle">S.no</RTh>
              <RTh rowSpan={2} className="align-middle">Item Code</RTh>
              <RTh rowSpan={2} className="align-middle">Item Name</RTh>
              <RTh rowSpan={2} className="align-middle">Unit</RTh>
              <RTh colSpan={2} center>Opening</RTh>
              <RTh colSpan={2} center>Purchase</RTh>
              <RTh colSpan={2} center>GRN Return</RTh>
              <RTh colSpan={2} center>Issue</RTh>
              <RTh colSpan={2} center>Issue Return</RTh>
              <RTh colSpan={2} center>Closing</RTh>
            </tr>
            <tr>
              <RTh right sub>Qty</RTh><RTh right sub>Value</RTh>
              <RTh right sub>Qty</RTh><RTh right sub>Value</RTh>
              <RTh right sub>Qty</RTh><RTh right sub>Value</RTh>
              <RTh right sub>Qty</RTh><RTh right sub>Value</RTh>
              <RTh right sub>Qty</RTh><RTh right sub>Value</RTh>
              <RTh right sub>Qty</RTh><RTh right sub>Value</RTh>
            </tr>
          </thead>

          <tbody>
            {isLoading && (
              <tr><td colSpan={16} className="px-5 py-14 text-center text-gray-400">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-7 h-7 rounded-full animate-spin"
                    style={{ border: "3px solid #d2f1fa", borderTopColor: "#027fa5" }} />
                  <span>Loading…</span>
                </div>
              </td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={16} className="px-5 py-14 text-center">
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <AlertCircle size={28} className="text-gray-300" />
                  <span className="text-sm">
                    {search || itemFilter ? "No items match the filters." : "No inventory items found."}
                  </span>
                </div>
              </td></tr>
            )}
            {!isLoading && filtered.map((row, idx) => {
              const closingQty = parseFloat(row.closing_qty || "0");
              return (
                <tr key={row.item_code}
                  className={`border-t border-gray-50 hover:bg-[#f0f9ff] transition-colors
                    ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/20"}`}
                  data-testid={`row-item-${row.item_code}`}>
                  <RTd muted>{String(idx + 1).padStart(2, "0")}</RTd>
                  <RTd><span className="font-mono text-xs font-semibold text-gray-500">{row.item_code}</span></RTd>
                  <RTd bold>{row.item_name}</RTd>
                  <RTd muted>{row.unit}</RTd>
                  {/* Opening */}
                  <RTd right>{fmtQty(row.opening_qty)}</RTd>
                  <RTd right muted>{fmtVal(row.opening_val)}</RTd>
                  {/* Purchase */}
                  <RTd right>
                    <span style={{ color: parseFloat(row.purchase_qty||"0") > 0 ? SC.primary : undefined }}>
                      {fmtQty(row.purchase_qty)}
                    </span>
                  </RTd>
                  <RTd right muted>
                    <span style={{ color: parseFloat(row.purchase_val||"0") > 0 ? SC.primary : undefined }}>
                      {fmtVal(row.purchase_val)}
                    </span>
                  </RTd>
                  {/* GRN Return */}
                  <RTd right>
                    <span className={parseFloat(row.grn_return_qty||"0") > 0 ? "text-red-500" : ""}>
                      {fmtQty(row.grn_return_qty)}
                    </span>
                  </RTd>
                  <RTd right muted>
                    <span className={parseFloat(row.grn_return_val||"0") > 0 ? "text-red-500" : ""}>
                      {fmtVal(row.grn_return_val)}
                    </span>
                  </RTd>
                  {/* Issue */}
                  <RTd right>
                    <span className={parseFloat(row.issue_qty||"0") > 0 ? "text-orange-600" : ""}>
                      {fmtQty(row.issue_qty)}
                    </span>
                  </RTd>
                  <RTd right muted>
                    <span className={parseFloat(row.issue_val||"0") > 0 ? "text-orange-600" : ""}>
                      {fmtVal(row.issue_val)}
                    </span>
                  </RTd>
                  {/* Issue Return */}
                  <RTd right>
                    <span className={parseFloat(row.issue_return_qty||"0") > 0 ? "text-green-600" : ""}>
                      {fmtQty(row.issue_return_qty)}
                    </span>
                  </RTd>
                  <RTd right muted>
                    <span className={parseFloat(row.issue_return_val||"0") > 0 ? "text-green-600" : ""}>
                      {fmtVal(row.issue_return_val)}
                    </span>
                  </RTd>
                  {/* Closing */}
                  <RTd right>
                    <span className={`font-semibold ${closingQty < 0 ? "text-red-600" : closingQty > 0 ? "text-green-700" : "text-gray-500"}`}>
                      {fmtQty(row.closing_qty)}
                    </span>
                  </RTd>
                  <RTd right>
                    <span className={`font-semibold ${parseFloat(row.closing_val||"0") < 0 ? "text-red-600" : "text-gray-800"}`}>
                      {fmtVal(row.closing_val)}
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
                <RTd right bold>{fmtQty(totals.opening_qty)}</RTd>
                <RTd right bold muted>{fmtVal(totals.opening_val)}</RTd>
                <RTd right bold>
                  <span style={{ color: SC.primary }}>{fmtQty(totals.purchase_qty)}</span>
                </RTd>
                <RTd right bold muted>
                  <span style={{ color: SC.primary }}>{fmtVal(totals.purchase_val)}</span>
                </RTd>
                <RTd right bold>
                  <span className="text-red-500">{fmtQty(totals.grn_return_qty)}</span>
                </RTd>
                <RTd right bold muted>
                  <span className="text-red-500">{fmtVal(totals.grn_return_val)}</span>
                </RTd>
                <RTd right bold>
                  <span className="text-orange-600">{fmtQty(totals.issue_qty)}</span>
                </RTd>
                <RTd right bold muted>
                  <span className="text-orange-600">{fmtVal(totals.issue_val)}</span>
                </RTd>
                <RTd right bold>
                  <span className="text-green-600">{fmtQty(totals.issue_return_qty)}</span>
                </RTd>
                <RTd right bold muted>
                  <span className="text-green-600">{fmtVal(totals.issue_return_val)}</span>
                </RTd>
                <RTd right bold>
                  <span className={totals.closing_qty < 0 ? "text-red-600" : "text-green-700"}>
                    {fmtQty(totals.closing_qty)}
                  </span>
                </RTd>
                <RTd right bold>
                  <span className={totals.closing_val < 0 ? "text-red-600" : "text-gray-800"}>
                    {fmtVal(totals.closing_val)}
                  </span>
                </RTd>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </ReportShell>
  );
}
