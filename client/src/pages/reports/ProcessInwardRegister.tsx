import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtAmt(v: any) {
  return parseFloat(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function firstDay() {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function lastDay() { return new Date().toISOString().split("T")[0]; }

export default function ProcessInwardRegister() {
  const [from,       setFrom]       = useState(firstDay());
  const [to,         setTo]         = useState(lastDay());
  const [suppFilter, setSuppFilter] = useState("");

  const params = new URLSearchParams({ from, to, ...(suppFilter ? { supplier_id: suppFilter } : {}) }).toString();
  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/reports/process-inward-register", from, to, suppFilter],
    queryFn: () => fetch(`/api/reports/process-inward-register?${params}`, { credentials: "include" }).then(r => r.json()),
  });

  const totTaxable = (rows as any[]).reduce((s: number, r: any) => s + parseFloat(r.taxable_amount || 0), 0);
  const totCgst    = (rows as any[]).reduce((s: number, r: any) => s + parseFloat(r.cgst_amount    || 0), 0);
  const totSgst    = (rows as any[]).reduce((s: number, r: any) => s + parseFloat(r.sgst_amount    || 0), 0);
  const totIgst    = (rows as any[]).reduce((s: number, r: any) => s + parseFloat(r.igst_amount    || 0), 0);
  const totTotal   = (rows as any[]).reduce((s: number, r: any) => s + parseFloat(r.total_amount   || 0), 0);

  function printReport() {
    const w = window.open("", "_blank");
    if (!w) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Process Inward Register</title>
    <style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;font-size:9px;}
    table{width:100%;border-collapse:collapse;}th,td{border:1px solid #000;padding:2px 4px;}
    th{background:#f0f0f0;font-weight:700;text-align:center;}h2{font-size:13px;text-align:center;margin-bottom:6px;}
    .sub{text-align:center;font-size:9px;margin-bottom:5px;color:#555;}
    @page{size:A4 landscape;margin:8mm;}</style></head><body>
    <h2>Process Inward Register</h2>
    <div class="sub">Period: ${fmtDate(from)} to ${fmtDate(to)}</div>
    <table><thead><tr><th>#</th><th>Invoice No.</th><th>Date</th><th>Supplier</th>
    <th>Supp. Invoice</th><th>Against DC</th><th>Payment</th>
    <th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th></tr></thead>
    <tbody>${(rows as any[]).map((r: any, i: number) => `<tr>
      <td style="text-align:center">${i+1}</td>
      <td>${r.voucher_no}</td><td>${fmtDate(r.inward_date)}</td>
      <td>${r.supplier_name||""}</td><td>${r.supplier_invoice_no||""}</td>
      <td>${r.outward_voucher_no||""}</td><td>${r.payment_mode||""}</td>
      <td style="text-align:right">${fmtAmt(r.taxable_amount)}</td>
      <td style="text-align:right">${fmtAmt(r.cgst_amount)}</td>
      <td style="text-align:right">${fmtAmt(r.sgst_amount)}</td>
      <td style="text-align:right">${fmtAmt(r.igst_amount)}</td>
      <td style="text-align:right;font-weight:700">${fmtAmt(r.total_amount)}</td>
    </tr>`).join("")}</tbody>
    <tfoot><tr><td colspan="7" style="text-align:right;font-weight:700">Total</td>
    <td style="text-align:right;font-weight:700">${fmtAmt(totTaxable)}</td>
    <td style="text-align:right;font-weight:700">${fmtAmt(totCgst)}</td>
    <td style="text-align:right;font-weight:700">${fmtAmt(totSgst)}</td>
    <td style="text-align:right;font-weight:700">${fmtAmt(totIgst)}</td>
    <td style="text-align:right;font-weight:700">${fmtAmt(totTotal)}</td></tr></tfoot>
    </table></body></html>`;
    w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400);
  }

  return (
    <div className="flex flex-col h-full" style={{ background: SC.bg, fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white">
        <div>
          <div className="text-xl font-bold" style={{ color: SC.primary }}>Process Inward Register</div>
          <div className="text-xs text-gray-500">Supplier invoice register for testing/calibration services + outstanding</div>
        </div>
        <button onClick={printReport} className="flex items-center gap-1 px-3 py-1.5 rounded border text-sm">
          <Printer size={14} /> Print
        </button>
      </div>

      <div className="px-6 py-3 bg-white border-b flex gap-4 items-end flex-wrap">
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">From Date</label>
          <DatePicker value={from} onChange={setFrom} className="border rounded px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-600 block mb-1">To Date</label>
          <DatePicker value={to} onChange={setTo} className="border rounded px-2 py-1 text-sm" />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: SC.tonal }}>
                  <th className="px-3 py-2 text-left text-xs font-semibold">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Invoice No.</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Supplier</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Supp. Invoice No.</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Against DC</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Payment</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">Taxable</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">CGST</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">SGST</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">IGST</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {(rows as any[]).length === 0 ? (
                  <tr><td colSpan={12} className="text-center py-12 text-gray-400">No records for selected period</td></tr>
                ) : (rows as any[]).map((r: any, i: number) => (
                  <tr key={r.voucher_no} className="border-t hover:bg-blue-50">
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 font-semibold" style={{ color: SC.primary }}>{r.voucher_no}</td>
                    <td className="px-3 py-2">{fmtDate(r.inward_date)}</td>
                    <td className="px-3 py-2">{r.supplier_name || "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{r.supplier_invoice_no || "—"}</td>
                    <td className="px-3 py-2 text-gray-500">{r.outward_voucher_no || "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.payment_mode === "Credit" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                        {r.payment_mode}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{fmtAmt(r.taxable_amount)}</td>
                    <td className="px-3 py-2 text-right">{fmtAmt(r.cgst_amount)}</td>
                    <td className="px-3 py-2 text-right">{fmtAmt(r.sgst_amount)}</td>
                    <td className="px-3 py-2 text-right">{fmtAmt(r.igst_amount)}</td>
                    <td className="px-3 py-2 text-right font-bold">{fmtAmt(r.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
              {(rows as any[]).length > 0 && (
                <tfoot>
                  <tr style={{ background: SC.tonal }}>
                    <td colSpan={7} className="px-3 py-2 text-right text-xs font-bold">Total</td>
                    <td className="px-3 py-2 text-right text-xs font-bold">{fmtAmt(totTaxable)}</td>
                    <td className="px-3 py-2 text-right text-xs font-bold">{fmtAmt(totCgst)}</td>
                    <td className="px-3 py-2 text-right text-xs font-bold">{fmtAmt(totSgst)}</td>
                    <td className="px-3 py-2 text-right text-xs font-bold">{fmtAmt(totIgst)}</td>
                    <td className="px-3 py-2 text-right text-xs font-bold">{fmtAmt(totTotal)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
