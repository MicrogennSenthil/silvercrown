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
  inw_no: string; inw_date: string;
  po_no: string; po_date: string;
  bill_no: string; bill_date: string;
  party_name: string; product_name: string;
  unit: string; qty: string;
};

export default function MaterialRegister() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const [fromDate, setFromDate] = useState(fmt(firstDay));
  const [toDate,   setToDate]   = useState(fmt(today));
  const [search,   setSearch]   = useState("");

  const qKey = ["/api/reports/material-register", fromDate, toDate];
  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: qKey,
    queryFn: () =>
      fetch(`/api/reports/material-register?from=${fromDate}&to=${toDate}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!fromDate && !!toDate,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      [r.inw_no, r.po_no, r.bill_no, r.party_name, r.product_name].join(" ").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totalQty = useMemo(
    () => filtered.reduce((s, r) => s + parseFloat(r.qty || "0"), 0),
    [filtered]
  );

  function handleExcel() {
    const headers = ["S.No","Inw No","Inw Date","PO No","PO Date","Bill No","Bill Date","Party Name","Product Name","Unit","Qty"];
    const data = filtered.map((r, i) => [
      i + 1, r.inw_no, fmtDate(r.inw_date), r.po_no || "—",
      r.po_date ? fmtDate(r.po_date) : "—",
      r.bill_no || "—", r.bill_date ? fmtDate(r.bill_date) : "—",
      r.party_name, r.product_name, r.unit, fmtQty(r.qty),
    ]);
    exportToCSV("MaterialRegister.csv", headers, data);
  }

  const TH  = "px-3 py-2.5 text-xs font-bold text-gray-700 whitespace-nowrap text-left";
  const THR = "px-3 py-2.5 text-xs font-bold text-gray-700 whitespace-nowrap text-right";

  return (
    <ReportShell
      title="Material Inward Register"
      fromDate={fromDate} onFromDate={setFromDate}
      toDate={toDate}     onToDate={setToDate}
      search={search}     onSearch={setSearch}
      onExcelExport={handleExcel}
      recordCount={filtered.length}
    >
      {/* Summary strip */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-8 px-5 py-2 border-b border-gray-100 bg-gray-50/50 text-xs">
          <span className="text-gray-500">
            Total Qty: <b className="text-gray-800">{fmtQty(totalQty)}</b>
          </span>
          <span className="text-gray-500">
            Records: <b className="text-gray-800">{filtered.length}</b>
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 1020 }}>
          <thead className="sticky top-0">
            <tr style={{ background: SC.tonal }}>
              <th className={TH}  style={{ width: 44 }}>S.no</th>
              <th className={TH}  style={{ width: 95 }}>Inw no</th>
              <th className={TH}  style={{ width: 105 }}>Inw Date</th>
              <th className={TH}  style={{ width: 90 }}>PO No</th>
              <th className={TH}  style={{ width: 105 }}>PO Date</th>
              <th className={TH}  style={{ width: 80 }}>Bill No</th>
              <th className={TH}  style={{ width: 105 }}>Bill Date</th>
              <th className={TH}  style={{ minWidth: 160 }}>Party Name</th>
              <th className={TH}  style={{ minWidth: 140 }}>Product Name</th>
              <th className={TH}  style={{ width: 60 }}>Unit</th>
              <th className={THR} style={{ width: 75 }}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={11} className="px-5 py-14 text-center text-gray-400">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-7 h-7 rounded-full animate-spin"
                    style={{ border: "3px solid #d2f1fa", borderTopColor: "#027fa5" }} />
                  <span>Loading…</span>
                </div>
              </td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={11} className="px-5 py-14 text-center">
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <AlertCircle size={28} className="text-gray-300" />
                  <span className="text-sm">
                    {search ? "No records match the search." : "No inward records found for the selected period."}
                  </span>
                </div>
              </td></tr>
            )}
            {!isLoading && filtered.map((row, idx) => (
              <tr key={`${row.inw_no}-${idx}`}
                className={`border-t border-gray-50 hover:bg-[#f0f9ff] transition-colors
                  ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                data-testid={`row-inward-${row.inw_no}-${idx}`}>
                <td className="px-3 py-2.5 text-xs text-gray-500">{String(idx + 1).padStart(2, "0")}</td>
                <td className="px-3 py-2.5 text-sm font-semibold" style={{ color: "#027fa5" }}>{row.inw_no}</td>
                <td className="px-3 py-2.5 text-sm text-gray-700">{fmtDate(row.inw_date)}</td>
                <td className="px-3 py-2.5 text-sm text-gray-600">{row.po_no || "—"}</td>
                <td className="px-3 py-2.5 text-sm text-gray-600">{row.po_date ? fmtDate(row.po_date) : "—"}</td>
                <td className="px-3 py-2.5 text-sm text-gray-600">{row.bill_no && row.bill_no !== "-" ? row.bill_no : "—"}</td>
                <td className="px-3 py-2.5 text-sm text-gray-600">{row.bill_date ? fmtDate(row.bill_date) : "—"}</td>
                <td className="px-3 py-2.5 text-sm text-gray-800">{row.party_name || "—"}</td>
                <td className="px-3 py-2.5 text-sm text-gray-800">{row.product_name}</td>
                <td className="px-3 py-2.5 text-xs text-gray-500">{row.unit}</td>
                <td className="px-3 py-2.5 text-sm text-right font-medium text-gray-700">{fmtQty(row.qty)}</td>
              </tr>
            ))}
            {/* Totals row */}
            {!isLoading && filtered.length > 0 && (
              <tr className="border-t-2" style={{ background: SC.tonal }}>
                <td colSpan={10} className="px-3 py-3 text-sm font-bold text-right text-gray-800">
                  Total Qty
                </td>
                <td className="px-3 py-3 text-sm font-bold text-right text-gray-800">
                  {fmtQty(totalQty)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}
