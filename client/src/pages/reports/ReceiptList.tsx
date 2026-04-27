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
function taxCell(amt: string, pct: string) {
  const a = parseFloat(amt || "0");
  const p = parseFloat(pct || "0");
  if (a === 0 && p === 0) return "—";
  if (p > 0) return `${fmtN(a)}(${p}%)`;
  return fmtN(a);
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
  total: string; user_name: string;
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
      [r.receipt_no, r.bill_no, r.supplier, r.item_code, r.item_name, r.user_name].join(" ").toLowerCase().includes(q)
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
      "CGST ₹","SGST ₹","IGST ₹","Total Amt ₹","User",
    ];
    const data = filtered.map((r, i) => [
      i + 1, r.receipt_no, fmtDate(r.receipt_dt),
      r.bill_no && r.bill_no !== "-" ? r.bill_no : "—",
      r.bill_date ? fmtDate(r.bill_date) : "—",
      r.supplier, r.item_code, r.item_name, r.unit,
      fmtN(r.qty), fmtAmt(r.rate), fmtAmt(r.taxable_amt),
      taxCell(r.cgst_amt, r.cgst_pct),
      taxCell(r.sgst_amt, r.sgst_pct),
      taxCell(r.igst_amt, r.igst_pct),
      fmtAmt(r.total), r.user_name || "—",
    ]);
    exportToCSV("ReceiptList.csv", headers, data);
  }

  const TH  = "px-3 py-2.5 text-xs font-bold text-gray-700 whitespace-nowrap text-left";
  const THR = "px-3 py-2.5 text-xs font-bold text-gray-700 whitespace-nowrap text-right";
  const COLS = 17;

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
        <table className="w-full text-sm" style={{ minWidth: 1300 }}>
          <thead className="sticky top-0">
            <tr style={{ background: SC.tonal }}>
              <th className={TH}  style={{ width: 44 }}>S.no</th>
              <th className={TH}  style={{ width: 96 }}>Receipt No</th>
              <th className={TH}  style={{ width: 105 }}>Receipt Dt</th>
              <th className={TH}  style={{ width: 82 }}>Bill No</th>
              <th className={TH}  style={{ width: 105 }}>Bill Date</th>
              <th className={TH}  style={{ minWidth: 130 }}>Supplier</th>
              <th className={TH}  style={{ width: 88 }}>Item Code</th>
              <th className={TH}  style={{ minWidth: 120 }}>Item Name</th>
              <th className={TH}  style={{ width: 50 }}>Unit</th>
              <th className={THR} style={{ width: 60 }}>Qty</th>
              <th className={THR} style={{ width: 72 }}>Rate ₹</th>
              <th className={THR} style={{ width: 100 }}>Taxable Amt ₹</th>
              <th className={THR} style={{ width: 95 }}>CGST ₹</th>
              <th className={THR} style={{ width: 95 }}>SGST ₹</th>
              <th className={THR} style={{ width: 95 }}>IGST ₹</th>
              <th className={THR} style={{ width: 100 }}>Total Amt ₹</th>
              <th className={TH}  style={{ width: 90 }}>User</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={COLS} className="px-5 py-14 text-center text-gray-400">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-7 h-7 rounded-full animate-spin"
                    style={{ border: "3px solid #d2f1fa", borderTopColor: "#027fa5" }} />
                  <span>Loading…</span>
                </div>
              </td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={COLS} className="px-5 py-14 text-center">
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
                <td className="px-3 py-2.5 text-sm text-right text-gray-600 whitespace-nowrap">
                  {taxCell(row.cgst_amt, row.cgst_pct)}
                </td>
                <td className="px-3 py-2.5 text-sm text-right text-gray-600 whitespace-nowrap">
                  {taxCell(row.sgst_amt, row.sgst_pct)}
                </td>
                <td className="px-3 py-2.5 text-sm text-right text-gray-600 whitespace-nowrap">
                  {taxCell(row.igst_amt, row.igst_pct)}
                </td>
                <td className="px-3 py-2.5 text-sm text-right font-semibold text-gray-800">{fmtAmt(row.total)}</td>
                <td className="px-3 py-2.5 text-sm text-gray-600">{row.user_name || "—"}</td>
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
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}
