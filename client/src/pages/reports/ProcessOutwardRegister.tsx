import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtNum(v: any) {
  return parseFloat(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function firstDay() {
  const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function lastDay() { return new Date().toISOString().split("T")[0]; }

export default function ProcessOutwardRegister() {
  const [from, setFrom] = useState(firstDay());
  const [to,   setTo]   = useState(lastDay());

  const params = new URLSearchParams({ from, to }).toString();
  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/reports/process-outward-register", from, to],
    queryFn: () => fetch(`/api/reports/process-outward-register?${params}`, { credentials: "include" }).then(r => r.json()),
  });

  const totQty = (rows as any[]).reduce((s: number, r: any) => s + parseFloat(r.total_qty || 0), 0);

  function printReport() {
    const w = window.open("", "_blank");
    if (!w) return;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Process Outward Register</title>
    <style>*{box-sizing:border-box;margin:0;padding:0;}body{font-family:Arial,sans-serif;font-size:10px;}
    table{width:100%;border-collapse:collapse;}th,td{border:1px solid #000;padding:3px 5px;}
    th{background:#f0f0f0;font-weight:700;}h2{font-size:14px;text-align:center;margin-bottom:8px;}
    .sub{text-align:center;font-size:10px;margin-bottom:6px;color:#555;}
    @page{size:A4;margin:10mm;}</style></head><body>
    <h2>Process Outward Register</h2>
    <div class="sub">Period: ${fmtDate(from)} to ${fmtDate(to)}</div>
    <table><thead><tr><th>#</th><th>DC No.</th><th>Date</th><th>Supplier / Agency</th><th>Purpose</th><th>Vehicle No</th><th>Items</th><th>Total Qty</th></tr></thead>
    <tbody>${(rows as any[]).map((r: any, i: number) => `<tr>
      <td style="text-align:center">${i+1}</td>
      <td>${r.voucher_no}</td><td>${fmtDate(r.outward_date)}</td>
      <td>${r.supplier_name||""}</td><td>${r.purpose||""}</td><td>${r.vehicle_no||""}</td>
      <td style="text-align:center">${r.item_count}</td>
      <td style="text-align:right">${fmtNum(r.total_qty)}</td>
    </tr>`).join("")}</tbody>
    <tfoot><tr><td colspan="7" style="text-align:right;font-weight:700">Total</td><td style="text-align:right;font-weight:700">${fmtNum(totQty)}</td></tr></tfoot>
    </table></body></html>`;
    w.document.write(html); w.document.close(); setTimeout(() => w.print(), 400);
  }

  return (
    <div className="flex flex-col h-full" style={{ background: SC.bg, fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white">
        <div>
          <div className="text-xl font-bold" style={{ color: SC.primary }}>Process Outward Register</div>
          <div className="text-xs text-gray-500">DC register for items sent for testing / calibration</div>
        </div>
        <div className="flex gap-2">
          <button onClick={printReport} className="flex items-center gap-1 px-3 py-1.5 rounded border text-sm">
            <Printer size={14} /> Print
          </button>
        </div>
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
                  <th className="px-3 py-2 text-left text-xs font-semibold">DC No.</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Supplier / Agency</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Purpose</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Vehicle No</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold">Items</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">Total Qty</th>
                </tr>
              </thead>
              <tbody>
                {(rows as any[]).length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">No records for selected period</td></tr>
                ) : (rows as any[]).map((r: any, i: number) => (
                  <tr key={r.voucher_no} className="border-t hover:bg-blue-50">
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    <td className="px-3 py-2 font-semibold" style={{ color: SC.primary }}>{r.voucher_no}</td>
                    <td className="px-3 py-2">{fmtDate(r.outward_date)}</td>
                    <td className="px-3 py-2">{r.supplier_name || "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{r.purpose || "—"}</td>
                    <td className="px-3 py-2 text-gray-500">{r.vehicle_no || "—"}</td>
                    <td className="px-3 py-2 text-center">{r.item_count}</td>
                    <td className="px-3 py-2 text-right font-medium">{fmtNum(r.total_qty)}</td>
                  </tr>
                ))}
              </tbody>
              {(rows as any[]).length > 0 && (
                <tfoot>
                  <tr style={{ background: SC.tonal }}>
                    <td colSpan={7} className="px-3 py-2 text-right text-xs font-bold">Total</td>
                    <td className="px-3 py-2 text-right text-xs font-bold">{fmtNum(totQty)}</td>
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
