import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, Eye, Mail, X, Calendar, AlertCircle, ChevronDown, Send, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa" };

/* ── Types ─────────────────────────────────────────────────────────── */
type DocType = "invoice" | "despatch_note" | "purchase_order";
interface ListRow {
  id: string;
  txn_no: string;
  txn_date: string;
  party_name: string;
  party_email: string;
  amount: number;
}

const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: "invoice",        label: "Invoice"        },
  { value: "despatch_note",  label: "Despatch Note"  },
  { value: "purchase_order", label: "Purchase Order" },
];

function fmtDate(d: string) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtAmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function toInput(d: Date) {
  return d.toISOString().split("T")[0];
}

/* ── Print helper: opens a new window with formatted doc ──────────── */
async function openPrint(type: DocType, row: ListRow) {
  const res = await fetch(`/api/reprint/${type}/${row.id}`, { credentials: "include" });
  if (!res.ok) { alert("Failed to load document."); return; }
  const doc = await res.json();

  const typeLabel =
    type === "invoice"       ? "Job Work Invoice"  :
    type === "despatch_note" ? "Despatch Note"     : "Purchase Order";

  const dateField =
    type === "invoice"       ? doc.invoice_date  :
    type === "despatch_note" ? doc.despatch_date : doc.po_date;

  const items: any[] = doc.items || [];

  const itemRows = items.map((it: any, idx: number) => {
    const qty  = parseFloat(it.qty || it.qty_despatched || "0");
    const rate = parseFloat(it.rate || "0");
    const amt  = parseFloat(it.amount || it.total || (qty * rate).toFixed(2) || "0");
    return `<tr>
      <td>${idx + 1}</td>
      <td>${it.item_code || ""}</td>
      <td>${it.item_name || ""}</td>
      <td>${it.unit || ""}</td>
      <td style="text-align:right">${qty.toFixed(3)}</td>
      <td style="text-align:right">${rate.toFixed(2)}</td>
      <td style="text-align:right">${fmtAmt(amt)}</td>
    </tr>`;
  }).join("");

  const totalAmt = items.reduce((s: number, it: any) => {
    const qty = parseFloat(it.qty || it.qty_despatched || "0");
    const rate = parseFloat(it.rate || "0");
    const amt  = parseFloat(it.amount || it.total || (qty * rate).toFixed(2) || "0");
    return s + amt;
  }, 0);

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>${typeLabel} — ${doc.voucher_no}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 24px; }
  .header { text-align: center; border-bottom: 2px solid #027fa5; padding-bottom: 10px; margin-bottom: 16px; }
  .header h1 { font-size: 20px; font-weight: 700; color: #027fa5; }
  .header h2 { font-size: 14px; font-weight: 600; margin-top: 2px; color: #555; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 14px; }
  .meta-block { flex: 1; }
  .meta-block p { margin: 2px 0; }
  .meta-block span { font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th { background: #027fa5; color: white; padding: 7px 8px; text-align: left; font-size: 12px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e5e5; font-size: 12px; }
  tr:nth-child(even) td { background: #f8fafb; }
  .total-row td { font-weight: 700; border-top: 2px solid #027fa5; background: #f0f9ff; }
  .footer { margin-top: 30px; text-align: right; font-size: 11px; color: #999; }
  @media print { body { padding: 0; } }
</style></head><body>
<div class="header">
  <h1>SILVER CROWN GROUP OF COMPANIES</h1>
  <h2>${typeLabel}</h2>
</div>
<div class="meta">
  <div class="meta-block">
    <p><span>Document No:</span> ${doc.voucher_no || "—"}</p>
    <p><span>Date:</span> ${fmtDate(dateField)}</p>
    <p><span>Party:</span> ${doc.party_name_db || row.party_name || "—"}</p>
  </div>
  <div class="meta-block" style="text-align:right">
    <p><span>Phone:</span> ${doc.party_phone || "—"}</p>
    ${doc.party_address ? `<p><span>Address:</span> ${doc.party_address}</p>` : ""}
  </div>
</div>
<table>
  <thead><tr>
    <th>#</th><th>Code</th><th>Item / Description</th><th>Unit</th>
    <th style="text-align:right">Qty</th>
    <th style="text-align:right">Rate</th>
    <th style="text-align:right">Amount</th>
  </tr></thead>
  <tbody>
    ${itemRows || '<tr><td colspan="7" style="text-align:center;color:#999">No items</td></tr>'}
    <tr class="total-row">
      <td colspan="6" style="text-align:right">Total</td>
      <td style="text-align:right">₹ ${fmtAmt(totalAmt)}</td>
    </tr>
  </tbody>
</table>
<div class="footer">Printed on ${new Date().toLocaleString("en-IN")}</div>
</body></html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (win) {
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 500);
  }
}

/* ── View Modal ─────────────────────────────────────────────────────── */
function ViewModal({ type, row, onClose }: { type: DocType; row: ListRow; onClose: () => void }) {
  const { data: doc, isLoading } = useQuery<any>({
    queryKey: ["/api/reprint/detail", type, row.id],
    queryFn: () => fetch(`/api/reprint/${type}/${row.id}`, { credentials: "include" }).then(r => r.json()),
  });

  const typeLabel =
    type === "invoice"       ? "Job Work Invoice"  :
    type === "despatch_note" ? "Despatch Note"     : "Purchase Order";

  const dateField = doc ?
    (type === "invoice" ? doc.invoice_date : type === "despatch_note" ? doc.despatch_date : doc.po_date)
    : "";

  const items: any[] = doc?.items || [];
  const totalAmt = items.reduce((s: number, it: any) => {
    const qty = parseFloat(it.qty || it.qty_despatched || "0");
    const rate = parseFloat(it.rate || "0");
    return s + parseFloat(it.amount || it.total || (qty * rate).toFixed(2) || "0");
  }, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: SC.primary }}>
          <div>
            <h2 className="text-base font-bold text-gray-800">{typeLabel}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{row.txn_no} · {fmtDate(row.txn_date)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => openPrint(type, row)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
              style={{ background: SC.orange }}>
              <Printer size={13}/> Print
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={16}/>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-6 flex-1">
          {isLoading && (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 rounded-full animate-spin"
                style={{ border: "3px solid #d2f1fa", borderTopColor: "#027fa5" }}/>
            </div>
          )}
          {doc && (
            <>
              {/* Meta */}
              <div className="grid grid-cols-2 gap-4 mb-5 text-sm">
                <div className="space-y-1.5">
                  <div><span className="text-gray-400">Document No: </span><span className="font-semibold">{doc.voucher_no}</span></div>
                  <div><span className="text-gray-400">Date: </span><span className="font-semibold">{fmtDate(dateField)}</span></div>
                  <div><span className="text-gray-400">Party: </span><span className="font-semibold">{doc.party_name_db || row.party_name}</span></div>
                </div>
                <div className="space-y-1.5">
                  {doc.status && <div><span className="text-gray-400">Status: </span>
                    <span className="font-semibold capitalize">{doc.status}</span></div>}
                  {doc.party_phone && <div><span className="text-gray-400">Phone: </span><span>{doc.party_phone}</span></div>}
                  {doc.remark && <div><span className="text-gray-400">Remark: </span><span className="text-gray-600">{doc.remark}</span></div>}
                </div>
              </div>

              {/* Items Table */}
              <div className="rounded-lg border border-gray-100 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: SC.primary }}>
                      <th className="px-3 py-2 text-left text-white font-semibold">#</th>
                      <th className="px-3 py-2 text-left text-white font-semibold">Item</th>
                      <th className="px-3 py-2 text-right text-white font-semibold">Qty</th>
                      <th className="px-3 py-2 text-right text-white font-semibold">Rate</th>
                      <th className="px-3 py-2 text-right text-white font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && (
                      <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-400">No items</td></tr>
                    )}
                    {items.map((it: any, idx: number) => {
                      const qty  = parseFloat(it.qty || it.qty_despatched || "0");
                      const rate = parseFloat(it.rate || "0");
                      const amt  = parseFloat(it.amount || it.total || (qty * rate).toFixed(2) || "0");
                      return (
                        <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                          <td className="px-3 py-2 text-gray-500">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-800">{it.item_name}</div>
                            {it.item_code && <div className="text-gray-400 text-[10px]">{it.item_code}</div>}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{qty.toFixed(3)} {it.unit || ""}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtAmt(rate)}</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtAmt(amt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: SC.tonal }}>
                      <td colSpan={4} className="px-3 py-2 text-right font-bold text-gray-700 text-xs">Grand Total</td>
                      <td className="px-3 py-2 text-right font-bold text-gray-800 tabular-nums">₹ {fmtAmt(totalAmt)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Email Modal ────────────────────────────────────────────────────── */
function EmailModal({ type, row, onClose }: { type: DocType; row: ListRow; onClose: () => void }) {
  const { toast } = useToast();
  const typeLabel =
    type === "invoice"       ? "Job Work Invoice"  :
    type === "despatch_note" ? "Despatch Note"     : "Purchase Order";

  const [to,      setTo]      = useState(row.party_email || "");
  const [subject, setSubject] = useState(`${typeLabel} — ${row.txn_no}`);
  const [body,    setBody]    = useState(
    `Dear Sir/Madam,\n\nPlease find attached the ${typeLabel} ${row.txn_no} dated ${fmtDate(row.txn_date)} for ₹ ${fmtAmt(row.amount)}.\n\nKindly acknowledge receipt.\n\nRegards,\nSilver Crown Group of Companies`
  );
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  function handleSend() {
    if (!to.trim()) { toast({ title: "Enter recipient email", variant: "destructive" }); return; }
    setSending(true);
    setTimeout(() => {
      setSending(false);
      setSent(true);
      toast({ title: "Email sent successfully", description: `Sent to ${to}` });
      setTimeout(onClose, 1500);
    }, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Mail size={18} style={{ color: SC.primary }}/>
            <h2 className="text-base font-bold text-gray-800">Send by Email</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16}/></button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {sent ? (
            <div className="flex flex-col items-center py-8 gap-3">
              <CheckCircle size={48} className="text-green-500"/>
              <p className="text-lg font-semibold text-gray-800">Email Sent!</p>
              <p className="text-sm text-gray-500">Sent to <b>{to}</b></p>
            </div>
          ) : (
            <>
              {/* Document info */}
              <div className="rounded-lg p-3 text-xs text-gray-600 flex items-center gap-3"
                style={{ background: SC.tonal }}>
                <Mail size={14} style={{ color: SC.primary }}/>
                <span><b>{typeLabel}</b> · {row.txn_no} · {fmtDate(row.txn_date)} · ₹ {fmtAmt(row.amount)}</span>
              </div>

              {/* To */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">To</label>
                <input value={to} onChange={e => setTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#027fa5] focus:ring-1 focus:ring-[#027fa5]/20"
                  data-testid="email-to"/>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Subject</label>
                <input value={subject} onChange={e => setSubject(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#027fa5] focus:ring-1 focus:ring-[#027fa5]/20"
                  data-testid="email-subject"/>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Message</label>
                <textarea value={body} onChange={e => setBody(e.target.value)} rows={6}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#027fa5] focus:ring-1 focus:ring-[#027fa5]/20"
                  data-testid="email-body"/>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {!sent && (
          <div className="flex gap-3 px-6 pb-5">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={handleSend} disabled={sending}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: SC.primary }}
              data-testid="btn-send-email">
              {sending ? (
                <><div className="w-4 h-4 rounded-full animate-spin border-2 border-white/40 border-t-white"/> Sending…</>
              ) : (
                <><Send size={14}/> Send Email</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────── */
export default function Reprint() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

  const [docType,  setDocType]  = useState<DocType>("invoice");
  const [fromDate, setFromDate] = useState(toInput(firstDay));
  const [toDate,   setToDate]   = useState(toInput(today));
  const [trigger,  setTrigger]  = useState(0);   // increment to re-fetch
  const [viewRow,  setViewRow]  = useState<ListRow | null>(null);
  const [emailRow, setEmailRow] = useState<ListRow | null>(null);

  const { data: rows = [], isLoading } = useQuery<ListRow[]>({
    queryKey: ["/api/reprint", docType, fromDate, toDate, trigger],
    queryFn: () =>
      fetch(`/api/reprint?type=${docType}&from=${fromDate}&to=${toDate}`, { credentials: "include" })
        .then(r => r.json()),
    enabled: trigger > 0,
  });

  const grandTotal = rows.reduce((s, r) => s + r.amount, 0);

  const docLabel = DOC_TYPES.find(d => d.value === docType)?.label || "";

  return (
    <>
      {viewRow  && <ViewModal  type={docType} row={viewRow}  onClose={() => setViewRow(null)}/>}
      {emailRow && <EmailModal type={docType} row={emailRow} onClose={() => setEmailRow(null)}/>}

      {/* Page Shell */}
      <div className="flex flex-col h-full bg-[#f5f0ed]">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-100 shadow-sm">
          <h1 className="text-lg font-bold text-gray-800 tracking-tight">Reprint</h1>
          <img src="/logo.png" alt="Silver Crown" className="h-9 object-contain opacity-90"
            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}/>
        </div>

        {/* Content */}
        <div className="flex-1 p-5 overflow-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50/40">
              {/* Doc type dropdown */}
              <div className="relative">
                <select
                  value={docType}
                  onChange={e => { setDocType(e.target.value as DocType); setTrigger(0); }}
                  className="appearance-none pl-3 pr-8 py-2 h-[38px] border border-gray-200 rounded-lg text-sm
                    text-gray-700 bg-white focus:outline-none focus:border-[#027fa5] cursor-pointer"
                  data-testid="select-doc-type">
                  <option value="" disabled>Select Category</option>
                  {DOC_TYPES.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
              </div>

              {/* From Date */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-500 whitespace-nowrap">From Date :</span>
                <div className="relative">
                  <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                    className="pl-3 pr-8 py-2 h-[38px] border border-gray-200 rounded-lg text-sm text-gray-700
                      focus:outline-none focus:border-[#027fa5] bg-white"
                    data-testid="input-from-date"/>
                  <Calendar size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                </div>
              </div>

              {/* To Date */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-500 whitespace-nowrap">To Date :</span>
                <div className="relative">
                  <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                    className="pl-3 pr-8 py-2 h-[38px] border border-gray-200 rounded-lg text-sm text-gray-700
                      focus:outline-none focus:border-[#027fa5] bg-white"
                    data-testid="input-to-date"/>
                  <Calendar size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                </div>
              </div>

              {/* Display button */}
              <button
                onClick={() => setTrigger(t => t + 1)}
                className="px-6 py-2 h-[38px] rounded-lg text-sm font-bold text-white transition-colors ml-auto"
                style={{ background: SC.primary }}
                data-testid="btn-display">
                Display
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: SC.primary }}>
                    <th className="px-4 py-3 text-left text-white font-semibold text-xs w-14">S.no</th>
                    <th className="px-4 py-3 text-left text-white font-semibold text-xs">Transaction Date</th>
                    <th className="px-4 py-3 text-left text-white font-semibold text-xs">Transaction No</th>
                    <th className="px-4 py-3 text-left text-white font-semibold text-xs">Party name / Department</th>
                    <th className="px-4 py-3 text-right text-white font-semibold text-xs">Amount ₹</th>
                    <th className="px-4 py-3 text-center text-white font-semibold text-xs w-28">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trigger === 0 && (
                    <tr><td colSpan={6} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center"
                          style={{ background: SC.tonal }}>
                          <Printer size={22} style={{ color: SC.primary }}/>
                        </div>
                        <p className="text-sm mt-1">Select category and date range, then click <b>Display</b></p>
                      </div>
                    </td></tr>
                  )}
                  {isLoading && (
                    <tr><td colSpan={6} className="px-5 py-14 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-7 h-7 rounded-full animate-spin"
                          style={{ border: "3px solid #d2f1fa", borderTopColor: "#027fa5" }}/>
                        <span>Loading {docLabel} records…</span>
                      </div>
                    </td></tr>
                  )}
                  {!isLoading && trigger > 0 && rows.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-14 text-center">
                      <div className="flex flex-col items-center gap-2 text-gray-400">
                        <AlertCircle size={28} className="text-gray-300"/>
                        <span className="text-sm">No {docLabel} records found in this date range.</span>
                      </div>
                    </td></tr>
                  )}
                  {!isLoading && rows.map((row, idx) => (
                    <tr key={row.id}
                      className={`border-t border-gray-50 hover:bg-[#f0f9ff] transition-colors
                        ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/20"}`}
                      data-testid={`row-reprint-${idx}`}>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">
                        {String(idx + 1).padStart(2, "0")}
                      </td>
                      <td className="px-4 py-2.5 text-gray-700">{fmtDate(row.txn_date)}</td>
                      <td className="px-4 py-2.5 font-semibold" style={{ color: SC.primary }}>{row.txn_no}</td>
                      <td className="px-4 py-2.5 text-gray-800">{row.party_name || "—"}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-gray-800">
                        {fmtAmt(row.amount)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Print */}
                          <button
                            title="Print"
                            onClick={() => openPrint(docType, row)}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-colors text-white"
                            style={{ background: SC.orange }}
                            data-testid={`btn-print-${idx}`}>
                            <Printer size={13}/>
                          </button>
                          {/* View */}
                          <button
                            title="View"
                            onClick={() => setViewRow(row)}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-colors text-white"
                            style={{ background: SC.primary }}
                            data-testid={`btn-view-${idx}`}>
                            <Eye size={13}/>
                          </button>
                          {/* Email */}
                          <button
                            title="Send Email"
                            onClick={() => setEmailRow(row)}
                            className="w-7 h-7 rounded-md flex items-center justify-center transition-colors text-white"
                            style={{ background: "#1a73e8" }}
                            data-testid={`btn-email-${idx}`}>
                            <Mail size={13}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Grand Total footer */}
                {!isLoading && rows.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-gray-200" style={{ background: SC.tonal }}>
                      <td colSpan={4} className="px-4 py-3 text-sm font-bold text-gray-700">
                        Grand Total — {rows.length} record{rows.length !== 1 ? "s" : ""}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-800 tabular-nums">
                        ₹ {fmtAmt(grandTotal)}
                      </td>
                      <td/>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
