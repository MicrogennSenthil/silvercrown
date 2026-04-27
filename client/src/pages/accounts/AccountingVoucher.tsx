import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, Info, ChevronDown, ArrowLeft, Send, Search, CheckCircle2, Plus } from "lucide-react";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

function today() { return new Date().toISOString().slice(0, 10); }
function fmt2(v: number | string) { return parseFloat(String(v) || "0").toFixed(2); }
function uuid() { return crypto.randomUUID(); }

type Nature = "payment" | "receipt" | "contra" | "journal";
type FilterType = "bank" | "cash" | "bank_cash" | "all";

// ── Nature detection ─────────────────────────────────────────────────────────
function getNature(name: string): Nature {
  const n = name.toLowerCase();
  if (n.includes("payment")) return "payment";
  if (n.includes("receipt")) return "receipt";
  if (n.includes("contra"))  return "contra";
  return "journal";
}

// Main line drCr: Payment → party gets CR; Receipt/Contra/Journal → DR first
function getMainDrCr(nature: Nature): "DR" | "CR" {
  return nature === "payment" ? "CR" : "DR";
}

// ── Per-line account filter (by position in table) ────────────────────────────
function getLineFilterByIndex(vtName: string, idx: number): FilterType {
  const n = vtName.toLowerCase();
  const nature = getNature(vtName);
  if (n.includes("contra")) return "bank_cash";
  if (nature === "payment") {
    if (idx === 0) return "all";          // Row 1: party — any ledger
    if (idx === 1) {
      if (n.includes("bank")) return "bank";
      if (n.includes("cash")) return "cash";
    }
    return "all";                          // Row 3+: splits — any ledger
  }
  if (nature === "receipt") {
    if (idx === 0) {                       // Row 1: bank/cash
      if (n.includes("bank")) return "bank";
      if (n.includes("cash")) return "cash";
    }
    return "all";                          // Row 2+: party / splits
  }
  return "all";
}

function applyFilter(sls: any[], f: FilterType): any[] {
  if (f === "all") return sls;
  return sls.filter(s => {
    const g = (s.gl_name || "").toLowerCase();
    if (f === "bank")      return g.includes("bank");
    if (f === "cash")      return g.includes("cash");
    if (f === "bank_cash") return g.includes("bank") || g.includes("cash");
    return true;
  });
}

function filterHint(f: FilterType): string | undefined {
  if (f === "bank")      return "Bank only";
  if (f === "cash")      return "Cash only";
  if (f === "bank_cash") return "Bank / Cash";
  return undefined;
}

// ── Line type ─────────────────────────────────────────────────────────────────
type VLine = {
  _key: string;
  isMain: boolean;
  drCr: "DR" | "CR";
  subLedgerId: string;
  subLedgerName: string;
  amount: string;
  narration: string;
};

function mkLine(isMain: boolean, drCr: "DR" | "CR", partial: Partial<VLine> = {}): VLine {
  return { _key: uuid(), isMain, drCr, subLedgerId: "", subLedgerName: "", amount: "", narration: "", ...partial };
}

function buildDefaultLines(vtName: string): VLine[] {
  const nature = getNature(vtName);
  const mainDrCr = getMainDrCr(nature);
  const detDrCr: "DR" | "CR" = mainDrCr === "DR" ? "CR" : "DR";
  return [
    mkLine(true,  mainDrCr),
    mkLine(false, detDrCr),
  ];
}

// ── Sub-ledger searchable picker ──────────────────────────────────────────────
function SlPicker({ value, name, onChange, subLedgers, hint }: {
  value: string; name: string;
  onChange: (id: string, name: string) => void;
  subLedgers: any[];
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ]       = useState("");
  const ref      = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = subLedgers.filter(s =>
    !q || s.name.toLowerCase().includes(q.toLowerCase()) || (s.code || "").toLowerCase().includes(q.toLowerCase())
  ).slice(0, 80);

  function openDrop() {
    if (ref.current) setRect(ref.current.getBoundingClientRect());
    setQ(""); setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 40);
  }

  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={openDrop}
        className="w-full flex items-center gap-1.5 px-2 py-1.5 border border-gray-200 rounded text-xs bg-white hover:border-[#027fa5] text-left min-h-[30px]"
        data-testid="btn-pick-sl">
        {name
          ? <span className="flex-1 truncate text-gray-800 font-medium">{name}</span>
          : <span className="flex-1 text-gray-400">Select account…</span>}
        <ChevronDown size={11} className="text-gray-400 flex-shrink-0" />
      </button>
      {open && rect && (
        <div className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden"
          style={{ top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 300), maxHeight: 320 }}>
          <div className="px-2.5 py-1.5 border-b border-gray-100 flex items-center gap-1.5">
            <Search size={12} className="text-gray-400 flex-shrink-0" />
            <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search ledger…" className="flex-1 text-xs outline-none py-0.5 min-w-0" />
            {hint && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                style={{ background: "#fef3c7", color: "#92400e" }}>{hint}</span>
            )}
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 270 }}>
            {filtered.length === 0 && (
              <div className="px-3 py-5 text-xs text-gray-400 text-center">
                {hint ? `No ${hint} ledgers found` : "No results"}
              </div>
            )}
            {filtered.map(s => (
              <button key={s.id} type="button"
                onClick={() => { onChange(s.id, s.name); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-[#d2f1fa] flex items-center gap-2 ${s.id === value ? "bg-[#d2f1fa] font-semibold" : ""}`}>
                <span className="text-gray-400 font-mono text-[10px] w-14 flex-shrink-0">{s.code}</span>
                <div className="flex flex-col min-w-0">
                  <span className="text-gray-800 truncate">{s.name}</span>
                  {s.gl_name && <span className="text-gray-400 text-[10px] truncate">{s.gl_name}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Voucher Form ──────────────────────────────────────────────────────────────
function VoucherForm({ editData, onBack }: { editData?: any; onBack: () => void }) {
  const qc     = useQueryClient();
  const isEdit = !!editData?.id;

  const { data: voucherTypes = [] } = useQuery<any[]>({ queryKey: ["/api/voucher-types"] });
  const { data: allSubs = [] }      = useQuery<any[]>({ queryKey: ["/api/sub-ledgers/with-gl"] });

  const [vtId,      setVtId]      = useState(editData?.voucherTypeId || "");
  const [vtCode,    setVtCode]    = useState(editData?.voucher_type || "");
  const [vtName,    setVtName]    = useState(editData?.voucher_type_name || editData?.voucher_type || "");
  const [voucherNo, setVoucherNo] = useState(editData?.voucher_no || "");
  const [refNo,     setRefNo]     = useState(editData?.ref_no || "");
  const [vDate,     setVDate]     = useState(editData?.voucher_date?.slice(0, 10) || today());
  const [refDate,   setRefDate]   = useState(editData?.ref_date?.slice(0, 10) || today());
  const [narration, setNarration] = useState(editData?.narration || "");
  const [error,     setError]     = useState("");
  const [saved,     setSaved]     = useState(false);

  const nature = vtName ? getNature(vtName) : "journal";
  const mainDrCr: "DR" | "CR" = getMainDrCr(nature);
  const detDrCr: "DR" | "CR"  = mainDrCr === "DR" ? "CR" : "DR";

  const [lines, setLines] = useState<VLine[]>(() => {
    if (editData?.lines?.length) {
      return editData.lines.map((l: any, i: number) => ({
        _key: uuid(), isMain: i === 0,
        drCr: l.dr_cr as "DR" | "CR",
        subLedgerId: l.sub_ledger_id || "", subLedgerName: l.sl_name || "",
        amount: l.amount || "", narration: l.narration || "",
      }));
    }
    return [mkLine(true, "DR"), mkLine(false, "CR")];
  });

  // Reset lines when voucher type changes
  useEffect(() => {
    if (!vtName || isEdit) return;
    setLines(buildDefaultLines(vtName));
  }, [vtName]);

  // Auto-fetch voucher number
  useEffect(() => {
    if (!vtCode || isEdit) return;
    fetch(`/api/voucher-series/next/${vtCode}`, { credentials: "include" })
      .then(r => r.json()).then(d => { if (d.voucher_no) setVoucherNo(d.voucher_no); }).catch(() => {});
  }, [vtCode, isEdit]);

  // ── Line mutations ──────────────────────────────────────────────────────────
  function updateAmount(key: string, val: string) {
    setLines(prev => prev.map(l => l._key === key ? { ...l, amount: val } : l));
  }

  function setLineSl(key: string, id: string, name: string) {
    setLines(prev => {
      const updated = prev.map(l => l._key === key ? { ...l, subLedgerId: id, subLedgerName: name } : l);
      // Auto-add empty detail row if the last row is now filled
      const last = updated[updated.length - 1];
      if (last.subLedgerId) {
        updated.push(mkLine(false, nature === "journal" ? "CR" : detDrCr));
      }
      return updated;
    });
  }

  function removeLine(key: string) {
    setLines(prev => {
      const remaining = prev.filter(l => l._key !== key);
      // Keep at least: 1 main + 1 detail
      if (remaining.length < 2) return prev;
      // If last line is not empty, add one
      const last = remaining[remaining.length - 1];
      if (last.subLedgerId || last.amount) {
        remaining.push(mkLine(false, nature === "journal" ? "CR" : detDrCr));
      }
      return remaining;
    });
  }

  function toggleJournalDrCr(key: string) {
    if (nature !== "journal") return;
    setLines(prev => prev.map(l =>
      l._key === key ? { ...l, drCr: l.drCr === "DR" ? "CR" : "DR", subLedgerId: "", subLedgerName: "" } : l
    ));
  }

  function addJournalLine(drCr: "DR" | "CR") {
    setLines(prev => [...prev, mkLine(false, drCr)]);
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  const totalDr   = lines.filter(l => l.drCr === "DR").reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const totalCr   = lines.filter(l => l.drCr === "CR").reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const balanced  = Math.abs(totalDr - totalCr) < 0.01 && totalDr > 0;
  const diff      = Math.abs(totalDr - totalCr);

  // Main line amount (row 0)
  const mainAmt   = parseFloat(lines[0]?.amount || "0") || 0;
  // Detail total
  const detailAmt = lines.slice(1).reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
  const detailDiff = mainAmt > 0 ? mainAmt - detailAmt : 0;

  // ── Save ────────────────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        voucherTypeCode: vtCode, voucherTypeName: vtName,
        referenceNo: refNo, referenceDate: refDate,
        voucherDate: vDate, narration,
        lines: lines.filter(l => l.subLedgerId && parseFloat(l.amount || "0") > 0).map(l => ({
          drCr: l.drCr, subLedgerId: l.subLedgerId || null,
          amount: l.amount || "0", narration: l.narration || narration,
        })),
      };
      const res = await fetch("/api/accounting-vouchers", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Save failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/accounting-vouchers"] });
      setVoucherNo(data.voucherNo || voucherNo);
      setSaved(true); setError("");
      setTimeout(() => setSaved(false), 3000);
      setRefNo(""); setNarration("");
      setLines(vtName ? buildDefaultLines(vtName) : [mkLine(true, "DR"), mkLine(false, "CR")]);
      if (vtCode) {
        fetch(`/api/voucher-series/next/${vtCode}`, { credentials: "include" })
          .then(r => r.json()).then(d => { if (d.voucher_no) setVoucherNo(d.voucher_no); });
      }
    },
    onError: (e: any) => setError(e.message),
  });

  return (
    <div className="p-4" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onBack}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700" data-testid="btn-back-voucher">
              <ArrowLeft size={16} />
            </button>
            <h2 className="font-semibold text-gray-800 text-base">Accounting Voucher Creation</h2>
          </div>
          <div className="flex items-center gap-2">
            {saved && (
              <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
                <CheckCircle2 size={13} /> Voucher saved
              </div>
            )}
            <button type="button"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50">
              <Send size={12} /> Send Mail
            </button>
            <Info size={16} className="text-gray-400 cursor-pointer" />
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Row 1: Voucher Type | Voucher No | Ref No */}
          <div className="grid grid-cols-3 gap-4">
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Voucher Type</label>
              <select value={vtId}
                onChange={e => {
                  const vt = voucherTypes.find((v: any) => v.id === e.target.value);
                  setVtId(e.target.value); setVtCode(vt?.code || ""); setVtName(vt?.name || "");
                }}
                className="w-full border border-gray-300 rounded px-3 h-[34px] text-sm bg-white outline-none focus:border-[#027fa5] appearance-none"
                data-testid="select-voucher-type">
                <option value="">— Select Voucher Type —</option>
                {voucherTypes.map((vt: any) => <option key={vt.id} value={vt.id}>{vt.name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Voucher No</label>
              <input value={voucherNo} readOnly placeholder="Auto-generated"
                className="w-full border border-gray-300 rounded px-3 h-[34px] text-sm outline-none bg-gray-50 text-gray-500"
                data-testid="input-voucher-no" />
            </div>
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Reference No</label>
              <input value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="REF0215001"
                className="w-full border border-gray-300 rounded px-3 h-[34px] text-sm outline-none focus:border-[#027fa5]"
                data-testid="input-ref-no" />
            </div>
          </div>

          {/* Row 2: Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Voucher Date</label>
              <DatePicker value={vDate} onChange={setVDate} data-testid="input-voucher-date" />
            </div>
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Reference Date</label>
              <DatePicker value={refDate} onChange={setRefDate} data-testid="input-ref-date" />
            </div>
          </div>

          {/* Nature badge */}
          {vtName && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">Voucher nature:</span>
              {nature === "payment" && <span className="px-2 py-0.5 rounded font-semibold bg-red-50 text-red-700">Payment — Party Ct · Cash/Bank Dt</span>}
              {nature === "receipt" && <span className="px-2 py-0.5 rounded font-semibold bg-green-50 text-green-700">Receipt — Cash/Bank Dt · Party Ct</span>}
              {nature === "contra"  && <span className="px-2 py-0.5 rounded font-semibold bg-blue-50 text-blue-700">Contra — Bank↔Cash Transfer</span>}
              {nature === "journal" && <span className="px-2 py-0.5 rounded font-semibold bg-purple-50 text-purple-700">Journal — Free-form Dr/Cr</span>}
            </div>
          )}

          {/* Entry Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: SC.tonal }}>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-10">S.no</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700">Particulars</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-700 w-32">Debit ₹</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-gray-700 w-32">Credit ₹</th>
                  <th className="w-7"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const f        = vtName ? getLineFilterByIndex(vtName, i) : "all";
                  const filtSls  = applyFilter(allSubs, f);
                  const fhint    = filterHint(f);
                  const isDr     = l.drCr === "DR";
                  // For non-journal, drCr is fixed; for journal, it's toggleable on non-main rows
                  const canToggle = nature === "journal";
                  const isLast   = i === lines.length - 1;
                  const isEmpty  = !l.subLedgerId && !l.amount;

                  return (
                    <tr key={l._key}
                      className={`border-t border-gray-100 transition-colors ${
                        l.isMain ? "bg-blue-50/20" : isEmpty && isLast ? "bg-gray-50/40" : "bg-white"
                      }`}
                      data-testid={`row-voucher-line-${i}`}>

                      {/* S.no + Ct/Dt badge in one cell */}
                      <td className="px-2 py-2 text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="text-gray-400 text-[10px]">{String(i + 1).padStart(2, "0")}</span>
                          <button type="button"
                            onClick={() => canToggle && toggleJournalDrCr(l._key)}
                            disabled={!canToggle}
                            title={canToggle ? "Click to toggle Dr/Cr" : (isDr ? "Debit (fixed)" : "Credit (fixed)")}
                            className="text-[10px] px-1.5 py-0.5 rounded font-bold leading-tight"
                            style={isDr
                              ? { background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", cursor: canToggle ? "pointer" : "default" }
                              : { background: "#f0fdf4", color: "#16a34a", border: "1px solid #86efac", cursor: canToggle ? "pointer" : "default" }}
                            data-testid={`badge-dr-cr-${i}`}>
                            {isDr ? "Dt" : "Ct"}
                          </button>
                        </div>
                      </td>

                      {/* Particulars */}
                      <td className="px-2 py-2">
                        <SlPicker
                          value={l.subLedgerId} name={l.subLedgerName}
                          onChange={(id, name) => setLineSl(l._key, id, name)}
                          subLedgers={filtSls} hint={fhint}
                        />
                        {l.isMain && nature !== "journal" && mainAmt > 0 && detailDiff > 0.001 && (
                          <div className="text-[10px] text-amber-600 mt-0.5 pl-1">
                            Split remaining: ₹{fmt2(detailDiff)}
                          </div>
                        )}
                      </td>

                      {/* Debit */}
                      <td className="px-2 py-2">
                        {isDr
                          ? <input type="number" value={l.amount}
                              onChange={e => updateAmount(l._key, e.target.value)}
                              placeholder="0.00" min={0}
                              className="w-full border border-gray-200 rounded px-2 h-[30px] text-xs text-right outline-none focus:border-[#027fa5]"
                              data-testid={`input-debit-${i}`} />
                          : <div className="text-right text-gray-200 text-xs select-none">—</div>
                        }
                      </td>

                      {/* Credit */}
                      <td className="px-2 py-2">
                        {!isDr
                          ? <input type="number" value={l.amount}
                              onChange={e => updateAmount(l._key, e.target.value)}
                              placeholder="0.00" min={0}
                              className="w-full border border-gray-200 rounded px-2 h-[30px] text-xs text-right outline-none focus:border-[#027fa5]"
                              data-testid={`input-credit-${i}`} />
                          : <div className="text-right text-gray-200 text-xs select-none">—</div>
                        }
                      </td>

                      {/* Delete */}
                      <td className="px-1 py-2 text-center">
                        {!l.isMain && (
                          <button type="button" onClick={() => removeLine(l._key)}
                            className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
                            data-testid={`btn-remove-line-${i}`}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Grand Total */}
              <tfoot>
                <tr className="border-t-2 border-gray-200" style={{ background: SC.tonal }}>
                  <td colSpan={2} className="px-4 py-2.5 text-sm font-bold text-gray-700">Grand Total :</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-sm text-red-700">₹ {fmt2(totalDr)}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-bold text-sm text-green-700">₹ {fmt2(totalCr)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50/40">
              <div className="flex items-center gap-2">
                {/* Journal: allow manual add */}
                {nature === "journal" && (
                  <>
                    <button type="button" onClick={() => addJournalLine("DR")}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded border font-semibold"
                      style={{ color: "#dc2626", borderColor: "#fca5a5" }} data-testid="btn-add-dr">
                      <Plus size={10} /> Dr Line
                    </button>
                    <button type="button" onClick={() => addJournalLine("CR")}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded border font-semibold"
                      style={{ color: "#16a34a", borderColor: "#86efac" }} data-testid="btn-add-cr">
                      <Plus size={10} /> Cr Line
                    </button>
                  </>
                )}
              </div>
              <div className="text-xs font-semibold">
                {balanced
                  ? <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={12} /> Balanced</span>
                  : totalDr + totalCr > 0
                    ? <span className="text-amber-600">⚠ Difference: ₹{fmt2(diff)} — Voucher must balance</span>
                    : null
                }
              </div>
            </div>
          </div>

          {/* Narrations */}
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Narrations</label>
            <input value={narration} onChange={e => setNarration(e.target.value)}
              placeholder="Bill no : INV2014 (DT:28.02.2026)"
              className="w-full border border-gray-300 rounded px-3 h-[34px] text-sm outline-none focus:border-[#027fa5]"
              data-testid="input-narration" />
          </div>

          {error && <p className="text-red-500 text-xs bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onBack}
            className="px-8 py-2 rounded border text-sm font-semibold text-gray-700 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }} data-testid="btn-back">Back</button>
          <button type="button"
            onClick={() => saveMut.mutate()}
            disabled={!vtId || !balanced || saveMut.isPending}
            className="px-8 py-2 rounded text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: SC.orange }} data-testid="btn-accept">
            {saveMut.isPending ? "Saving…" : "Accept"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Voucher List ──────────────────────────────────────────────────────────────
export default function AccountingVoucher() {
  const [view,     setView]     = useState<"list" | "add" | "edit">("list");
  const [editData, setEditData] = useState<any>(null);
  const [search,   setSearch]   = useState("");

  const { data: vouchers = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/accounting-vouchers"] });
  const qc = useQueryClient();

  const delMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/accounting-vouchers/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/accounting-vouchers"] }),
  });

  async function handleEdit(v: any) {
    const res  = await fetch(`/api/accounting-vouchers/${v.id}`, { credentials: "include" });
    const data = await res.json();
    setEditData(data); setView("edit");
  }

  function handleBack() { setEditData(null); setView("list"); }

  if (view === "add")  return <VoucherForm onBack={handleBack} />;
  if (view === "edit") return <VoucherForm editData={editData} onBack={handleBack} />;

  const filtered = vouchers.filter(v =>
    !search || [v.voucher_no, v.voucher_type_name, v.narration, v.ref_no].join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h1 className="font-semibold text-gray-800 text-base">Accounting Voucher</h1>
          <div className="flex items-center gap-3">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search vouchers…"
              className="border border-gray-200 rounded px-3 h-[34px] text-sm outline-none focus:border-[#027fa5] w-52"
              data-testid="input-search-voucher" />
            <button onClick={() => { setEditData(null); setView("add"); }}
              className="flex items-center gap-1.5 px-4 h-[34px] rounded text-sm font-semibold text-white"
              style={{ background: SC.primary }} data-testid="btn-new-voucher">
              <Plus size={14} /> New Voucher
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: SC.tonal }}>
                {["S.no","Voucher No","Type","Date","Ref No","Narration","Amount ₹","Actions"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-gray-700 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">No vouchers yet. Click "New Voucher" to create one.</td></tr>
              )}
              {filtered.map((v, i) => (
                <tr key={v.id} className="border-b border-gray-50 hover:bg-blue-50/20 transition-colors"
                  data-testid={`row-voucher-${v.id}`}>
                  <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                  <td className="px-4 py-3 font-semibold" style={{ color: SC.primary }}>{v.voucher_no}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ background: SC.tonal, color: SC.primary }}>
                      {v.voucher_type_name || v.voucher_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{v.voucher_date?.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-gray-600">{v.ref_no || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">{v.narration || "—"}</td>
                  <td className="px-4 py-3 font-mono text-gray-800">₹{fmt2(v.total_amount)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleEdit(v)}
                        className="text-xs px-3 py-1 rounded border font-medium text-[#027fa5] border-[#027fa5] hover:bg-[#d2f1fa]"
                        data-testid={`btn-edit-voucher-${v.id}`}>Edit</button>
                      <button onClick={() => { if (confirm("Delete this voucher?")) delMut.mutate(v.id); }}
                        className="text-xs px-3 py-1 rounded border font-medium text-red-500 border-red-200 hover:bg-red-50"
                        data-testid={`btn-del-voucher-${v.id}`}>Del</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
