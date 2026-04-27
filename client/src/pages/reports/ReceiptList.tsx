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
function fmtN(v: number | string | null | undefined, dec = 2) {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? "—" : n.toFixed(dec);
}
function fmtAmt(v: number | string | null | undefined) {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? "—" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Row = {
  receipt_no: string; receipt_dt: string;
  bill_no: string; bill_date: string;
  supplier: string;
  item_code: string; item_name: string; unit: string;
  qty: string; rate: string; taxable_amt: string;
  cgst_pct: string; cgst_amt: string;
  sgst_pct: string; sgst_amt: string;
  igst_pct: string; igst_amt: string;
  total: string;
};

export default function ReceiptList() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmt = (d: Date) => d.toISOString().split("T")[0];

  const [fromDate, setFromDate] = useState(fmt(firstDay));
  const [toDate,   setToDate]   = useState(fmt(today));
  const [search,   setSearch]   = useState("");

  const qKey = ["/api/reports/receipt-list", fromDate, toDate];
  const { data: rows = [], isLoading } = useQuery<Row[]>({
    queryKey: qKey,
    queryFn: () =>
      fetch(`/api/reports/receipt-list?from=${fromDate}&to=${toDate}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!fromDate && !!toDate,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(r =>
      [r.receipt_no, r.bill_no, r.supplier, r.item_code, r.item_name].join(" ").toLowerCase().includes(q)
    );
  }, [rows, search]);

  const totals = useMemo(() => ({
    qty:         filtered.reduce((s, r) => s + parseFloat(r.qty          || "0"), 0),
    taxable_amt: filtered.reduce((s, r) => s + parseFloat(r.taxable_amt  || "0"), 0),
    cgst_amt:    filtered.reduce((s, r) => s + parseFloat(r.cgst_amt     || "0"), 0),
    sgst_amt:    filtered.reduce((s, r) => s + parseFloat(r.sgst_amt     || "0"), 0),
    igst_amt:    filtered.reduce((s, r) => s + parseFloat(r.igst_amt     || "0"), 0),
    total:       filtered.reduce((s, r) => s + parseFloat(r.total        || "0"), 0),
  }), [filtered]);

  function handleExcel() {
    const headers = [
      "S.No","Receipt No","Receipt Dt","Bill No","Bill Date","Supplier",
      "Item Code","Item Name","Unit","Qty","Rate ₹","Taxable Amt ₹",
      "CGST%","CGST ₹","SGST%","SGST ₹","IGST%","IGST ₹","Total ₹",
    ];
    const data = filtered.map((r, i) => [
      i + 1, r.receipt_no, fmtDate(r.receipt_dt),
      r.bill_no && r.bill_no !== "-" ? r.bill_no : "—",
      r.bill_date ? fmtDate(r.bill_date) : "—",
      r.supplier, r.item_code, r.item_name, r.unit,
      fmtN(r.qty), fmtAmt(r.rate), fmtAmt(r.taxable_amt),
      fmtN(r.cgst_pct), fmtAmt(r.cgst_amt),
      fmtN(r.sgst_pct), fmtAmt(r.sgst_amt),
      fmtN(r.igst_pct), fmtAmt(r.igst_amt),
      fmtAmt(r.total),
    ]);
    exportToCSV("ReceiptList.csv", headers, data);
  }

  const TH  = "px-3 py-2.5 text-xs font-bold text-gray-700 whitespace-nowrap text-left";
  const THR = "px-3 py-2.5 text-xs font-bold text-gray-700 whitespace-nowrap text-right";

  function taxLabel(pct: string) {
    const p = parseFloat(pct || "0");
    return p > 0 ? `(${p}%)` : "";
  }

  return (
    <ReportShell
      title="Receipt List"
      fromDate={fromDate} onFromDate={setFromDate}
      toDate={toDate}     onToDate={setToDate}
      search={search}     onSearch={setSearch}
      onExcelExport={handleExcel}
      recordCount={filtered.length}
    >
      {/* Summary strip */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-8 px-5 py-2 border-b border-gray-100 bg-gray-50/50 text-xs">
          <span className="text-gray-500">Total Qty: <b className="text-gray-800">{fmtN(totals.qty)}</b></span>
          <span className="text-gray-500">Taxable: <b className="text-gray-800">₹{fmtAmt(totals.taxable_amt)}</b></span>
          <span className="text-gray-500">CGST: <b className="text-gray-800">₹{fmtAmt(totals.cgst_amt)}</b></span>
          <span className="text-gray-500">SGST: <b className="text-gray-800">₹{fmtAmt(totals.sgst_amt)}</b></span>
          <span className="text-gray-500">IGST: <b className="text-gray-800">₹{fmtAmt(totals.igst_amt)}</b></span>
          <span className="text-gray-500">Grand Total: <b className="text-green-700">₹{fmtAmt(totals.total)}</b></span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 1200 }}>
          <thead className="sticky top-0">
            <tr style={{ background: SC.tonal }}>
              <th className={TH}  style={{ width: 44 }}>S.no</th>
              <th className={TH}  style={{ width: 96 }}>Receipt No</th>
              <th className={TH}  style={{ width: 105 }}>Receipt Dt</th>
              <th className={TH}  style={{ width: 82 }}>Bill No</th>
              <th className={TH}  style={{ width: 105 }}>Bill Date</th>
              <th className={TH}  style={{ minWidth: 140 }}>Supplier</th>
              <th className={TH}  style={{ width: 88 }}>Item Code</th>
              <th className={TH}  style={{ minWidth: 130 }}>Item Name</th>
              <th className={TH}  style={{ width: 55 }}>Unit</th>
              <th className={THR} style={{ width: 65 }}>Qty</th>
              <th className={THR} style={{ width: 75 }}>Rate ₹</th>
              <th className={THR} style={{ width: 100 }}>Taxable ₹</th>
              <th className={THR} style={{ width: 90 }}>CGST ₹</th>
              <th className={THR} style={{ width: 90 }}>SGST ₹</th>
              <th className={THR} style={{ width: 90 }}>IGST ₹</th>
              <th className={THR} style={{ width: 100 }}>Total ₹</th>
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
                    {search ? "No records match the search." : "No receipts found for the selected period."}
                  </span>
                </div>
              </td></tr>
            )}
            {!isLoading && filtered.map((row, idx) => (
              <tr key={`${row.receipt_no}-${row.item_code}-${idx}`}
                className={`border-t border-gray-50 hover:bg-[#f0f9ff] transition-colors
                  ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                data-testid={`row-receipt-${row.receipt_no}-${idx}`}>
                <td className="px-3 py-2.5 text-xs text-gray-500">{String(idx + 1).padStart(2, "0")}</td>
                <td className="px-3 py-2.5 text-sm font-semibold" style={{ color: "#027fa5" }}>{row.receipt_no}</td>
                <td className="px-3 py-2.5 text-sm text-gray-700">{fmtDate(row.receipt_dt)}</td>
                <td className="px-3 py-2.5 text-sm text-gray-600">{row.bill_no && row.bill_no !== "-" ? row.bill_no : "—"}</td>
                <td className="px-3 py-2.5 text-sm text-gray-600">{row.bill_date ? fmtDate(row.bill_date) : "—"}</td>
                <td className="px-3 py-2.5 text-sm text-gray-800">{row.supplier || "—"}</td>
                <td className="px-3 py-2.5 text-xs font-mono text-gray-500">{row.item_code}</td>
                <td className="px-3 py-2.5 text-sm text-gray-800">{row.item_name}</td>
                <td className="px-3 py-2.5 text-xs text-gray-500">{row.unit}</td>
                <td className="px-3 py-2.5 text-sm text-right font-medium text-gray-700">{fmtN(row.qty)}</td>
                <td className="px-3 py-2.5 text-sm text-right text-gray-600">{fmtAmt(row.rate)}</td>
                <td className="px-3 py-2.5 text-sm text-right text-gray-700">{fmtAmt(row.taxable_amt)}</td>
                <td className="px-3 py-2.5 text-sm text-right text-gray-600">
                  {fmtAmt(row.cgst_amt)}
                  {parseFloat(row.cgst_pct||"0") > 0 &&
                    <span className="text-xs text-gray-400 ml-0.5">{taxLabel(row.cgst_pct)}</span>}
                </td>
                <td className="px-3 py-2.5 text-sm text-right text-gray-600">
                  {fmtAmt(row.sgst_amt)}
                  {parseFloat(row.sgst_pct||"0") > 0 &&
                    <span className="text-xs text-gray-400 ml-0.5">{taxLabel(row.sgst_pct)}</span>}
                </td>
                <td className="px-3 py-2.5 text-sm text-right text-gray-600">
                  {fmtAmt(row.igst_amt)}
                  {parseFloat(row.igst_pct||"0") > 0 &&
                    <span className="text-xs text-gray-400 ml-0.5">{taxLabel(row.igst_pct)}</span>}
                </td>
                <td className="px-3 py-2.5 text-sm text-right font-semibold text-gray-800">{fmtAmt(row.total)}</td>
              </tr>
            ))}
            {/* Totals row */}
            {!isLoading && filtered.length > 0 && (
              <tr className="border-t-2" style={{ background: SC.tonal }}>
                <td colSpan={9} className="px-3 py-3 text-sm font-bold text-right text-gray-800">Total</td>
                <td className="px-3 py-3 text-sm font-bold text-right text-gray-800">{fmtN(totals.qty)}</td>
                <td />
                <td className="px-3 py-3 text-sm font-bold text-right text-gray-800">{fmtAmt(totals.taxable_amt)}</td>
                <td className="px-3 py-3 text-sm font-bold text-right text-gray-800">{fmtAmt(totals.cgst_amt)}</td>
                <td className="px-3 py-3 text-sm font-bold text-right text-gray-800">{fmtAmt(totals.sgst_amt)}</td>
                <td className="px-3 py-3 text-sm font-bold text-right text-gray-800">{fmtAmt(totals.igst_amt)}</td>
                <td className="px-3 py-3 text-sm font-bold text-right text-gray-800">{fmtAmt(totals.total)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}
