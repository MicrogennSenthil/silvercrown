import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { ReportShell, exportToCSV } from "@/components/ReportShell";

const SC = { tonal: "#d2f1fa" };

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtQty(v: number | string | null | undefined) {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? "—" : n.toFixed(1);
}

type Row = {
  po_no: string; po_date: string;
  supplier_name: string; product_details: string;
  unit: string;
  ord_qty: string; rec_qty: string; pend_qty: string;
  user_name: string;
};

export default function POPending() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const [fromDate, setFromDate] = useState(fmt(firstDay));
  const [toDate,   setToDate]   = useState(fmt(today));
  const [search,   setSearch]   = useState("");

  const qKey = ["/api/reports/po-pending", fromDate, toDate];
  const { data: rawData, isLoading } = useQuery<Row[]>({
    queryKey: qKey,
    queryFn: () =>
      fetch(`/api/reports/po-pending?from=${fromDate}&to=${toDate}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!fromDate && !!toDate,
  });
  const rows: Row[] = Array.isArray(rawData) ? rawData : [];

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      [r.po_no, r.supplier_name, r.product_details, r.user_name].join(" ").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totals = useMemo(() => ({
    ord:  filtered.reduce((s, r) => s + parseFloat(r.ord_qty  || "0"), 0),
    rec:  filtered.reduce((s, r) => s + parseFloat(r.rec_qty  || "0"), 0),
    pend: filtered.reduce((s, r) => s + parseFloat(r.pend_qty || "0"), 0),
  }), [filtered]);

  function handleExcel() {
    const headers = ["S.No","PO No","PO Date","Supplier Name","Product Details","Unit","Ord Qty","Rec Qty","Pend Qty","User"];
    const data = filtered.map((r, i) => [
      i + 1, r.po_no, fmtDate(r.po_date), r.supplier_name,
      r.product_details, r.unit,
      fmtQty(r.ord_qty), fmtQty(r.rec_qty), fmtQty(r.pend_qty),
      r.user_name || "—",
    ]);
    exportToCSV("POPending.csv", headers, data);
  }

  const TH  = "px-4 py-2.5 text-xs font-bold text-gray-700 whitespace-nowrap text-left";
  const THR = "px-4 py-2.5 text-xs font-bold text-gray-700 whitespace-nowrap text-right";

  return (
    <ReportShell
      title="PO Pending"
      fromDate={fromDate} onFromDate={setFromDate}
      toDate={toDate}     onToDate={setToDate}
      search={search}     onSearch={setSearch}
      onExcelExport={handleExcel}
      recordCount={filtered.length}
    >
      {/* summary strip */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-8 px-5 py-2 border-b border-gray-100 bg-gray-50/50 text-xs">
          <span className="text-gray-500">Ord Qty: <b className="text-gray-800">{fmtQty(totals.ord)}</b></span>
          <span className="text-gray-500">Rec Qty: <b className="text-gray-800">{fmtQty(totals.rec)}</b></span>
          <span className="text-gray-500">Pend Qty: <b className="text-[#d74700]">{fmtQty(totals.pend)}</b></span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 860 }}>
          <thead className="sticky top-0">
            <tr style={{ background: SC.tonal }}>
              <th className={TH}  style={{ width: 46 }}>S.no</th>
              <th className={TH}  style={{ width: 90 }}>PO no</th>
              <th className={TH}  style={{ width: 100 }}>PO Date</th>
              <th className={TH}  style={{ minWidth: 140 }}>Supplier Name</th>
              <th className={TH}  style={{ minWidth: 160 }}>Product Details</th>
              <th className={TH}  style={{ width: 60 }}>Unit</th>
              <th className={THR} style={{ width: 80 }}>Ord Qty</th>
              <th className={THR} style={{ width: 80 }}>Rec Qty</th>
              <th className={THR} style={{ width: 80 }}>Pend Qty</th>
              <th className={TH}  style={{ width: 100 }}>User</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={10} className="px-5 py-14 text-center text-gray-400">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-7 h-7 rounded-full animate-spin"
                    style={{ border: "3px solid #d2f1fa", borderTopColor: "#027fa5" }} />
                  <span>Loading…</span>
                </div>
              </td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={10} className="px-5 py-14 text-center">
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <AlertCircle size={28} className="text-gray-300" />
                  <span className="text-sm">
                    {search ? "No records match the search." : "No pending POs found for the selected period."}
                  </span>
                </div>
              </td></tr>
            )}
            {!isLoading && filtered.map((row, idx) => (
              <tr key={`${row.po_no}-${idx}`}
                className={`border-t border-gray-50 hover:bg-[#f0f9ff] transition-colors
                  ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                data-testid={`row-po-${row.po_no}-${idx}`}>
                <td className="px-4 py-2.5 text-xs text-gray-500">{String(idx + 1).padStart(2, "0")}</td>
                <td className="px-4 py-2.5 text-sm font-semibold" style={{ color: "#027fa5" }}>{row.po_no}</td>
                <td className="px-4 py-2.5 text-sm text-gray-700">{fmtDate(row.po_date)}</td>
                <td className="px-4 py-2.5 text-sm text-gray-800">{row.supplier_name || "—"}</td>
                <td className="px-4 py-2.5 text-sm text-gray-800">{row.product_details}</td>
                <td className="px-4 py-2.5 text-xs text-gray-500">{row.unit}</td>
                <td className="px-4 py-2.5 text-sm text-right font-medium text-gray-700">{fmtQty(row.ord_qty)}</td>
                <td className="px-4 py-2.5 text-sm text-right text-gray-600">{fmtQty(row.rec_qty)}</td>
                <td className="px-4 py-2.5 text-sm text-right font-bold" style={{ color: "#d74700" }}>{fmtQty(row.pend_qty)}</td>
                <td className="px-4 py-2.5 text-sm text-gray-600">{row.user_name || "—"}</td>
              </tr>
            ))}
            {/* Totals row */}
            {!isLoading && filtered.length > 0 && (
              <tr className="border-t-2" style={{ background: SC.tonal }}>
                <td colSpan={6} className="px-4 py-3 text-sm font-bold text-gray-800 text-right">Total</td>
                <td className="px-4 py-3 text-sm font-bold text-right text-gray-800">{fmtQty(totals.ord)}</td>
                <td className="px-4 py-3 text-sm font-bold text-right text-gray-800">{fmtQty(totals.rec)}</td>
                <td className="px-4 py-3 text-sm font-bold text-right" style={{ color: "#d74700" }}>{fmtQty(totals.pend)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}
