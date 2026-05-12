import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Trash2, Info, ChevronDown, ArrowLeft, Send, Search,
  CheckCircle2, Plus, AlertCircle, X, FileText,
} from "lucide-react";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

function today() { return new Date().toISOString().slice(0, 10); }
function fmtAmt(v: number | string) {
  const n = parseFloat(String(v) || "0");
  return isNaN(n) ? "0.00" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function parseAmt(v: string) { return parseFloat(v.replace(/,/g, "")) || 0; }
function uuid() { return crypto.randomUUID(); }

// ── Types ─────────────────────────────────────────────────────────────────────
type Nature     = "payment" | "receipt" | "contra" | "journal";
type FilterType = "bank" | "cash" | "bank_cash" | "sundry_creditors" | "sundry_debtors" | "all";

type VLine = {
  _key: string;
  isMain: boolean;
  drCr: "DR" | "CR";
  subLedgerId: string;
  subLedgerName: string;
  amount: string;
  narration: string;
  _err?: string;
};

type BillAdjRow = {
  id: string;
  source: "purchase_invoice" | "opening_bill";
  sourceId: string;
  billDate: string;
  billNo: string;
  billAmount: number;
  paidAmount: number;
  balanceAmount: number;
  crDr: string;
  adjustAmount: string;
};

function fmtDate(d: string) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Bill to Bill Adjustment Dialog ────────────────────────────────────────────
// Opens immediately when a party (Sundry Creditor/Debtor) is selected.
// User types partial or double-clicks row to fill full balance for N bills.
// On confirm → total becomes the voucher amount for that party line.
function BillAdjustmentDialog({
  open, subLedgerId, prevRows, partyName, onConfirm, onClose,
}: {
  open: boolean;
  subLedgerId: string;
  prevRows: BillAdjRow[];
  partyName: string;
  onConfirm: (rows: BillAdjRow[], total: number) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<BillAdjRow[]>([]);

  const { data: bills = [], isLoading } = useQuery<BillAdjRow[]>({
    queryKey: ["/api/bill-adjustments/outstanding", subLedgerId],
    queryFn: () =>
      fetch(`/api/bill-adjustments/outstanding?subLedgerId=${subLedgerId}`, { credentials: "include" })
        .then(r => r.json()),
    enabled: open && !!subLedgerId,
  });

  useEffect(() => {
    if (bills.length > 0) {
      setRows(bills.map(b => {
        const prev = prevRows.find(p => p.sourceId === b.sourceId);
        return { ...b, adjustAmount: prev ? prev.adjustAmount : "" };
      }));
    } else if (!isLoading) {
      setRows([]);
    }
  }, [bills, isLoading]);

  const totalAdj = rows.reduce((s, r) => s + parseAmt(r.adjustAmount || "0"), 0);

  function setAmt(id: string, val: string) {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      const num = parseFloat(val);
      if (!isNaN(num) && num > r.balanceAmount) return { ...r, adjustAmount: r.balanceAmount.toFixed(2) };
      return { ...r, adjustAmount: val };
    }));
  }

  function fillBalance(row: BillAdjRow) {
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, adjustAmount: r.balanceAmount.toFixed(2) } : r));
  }

  function handleConfirm() {
    const confirmed = rows.filter(r => parseAmt(r.adjustAmount || "0") > 0);
    onConfirm(confirmed, totalAdj);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl mx-4 overflow-hidden flex flex-col" style={{ maxHeight: "82vh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100" style={{ background: SC.tonal }}>
          <div className="flex items-center gap-3">
            <FileText size={18} style={{ color: SC.primary }} />
            <div>
              <h2 className="font-bold text-gray-800 text-base leading-tight">Bill to Bill Adjustment</h2>
              {partyName && <div className="text-xs text-gray-500 mt-0.5">{partyName}</div>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 bg-white/70 px-2.5 py-1 rounded-full border border-gray-200">
              Double-click any row to fill full balance
            </span>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-white/70 text-gray-500 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm gap-2">
              <div className="w-4 h-4 border-2 border-[#027fa5] border-t-transparent rounded-full animate-spin" />
              Loading outstanding bills…
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
              <FileText size={36} className="opacity-20" />
              <div className="text-sm font-medium">No outstanding bills for this party</div>
              <div className="text-xs text-gray-400">All bills may already be paid or no bills exist</div>
              <button type="button" onClick={() => onConfirm([], 0)}
                className="mt-2 text-sm px-5 py-2 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 font-semibold">
                Continue without adjustment
              </button>
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0">
                <tr style={{ background: SC.primary }}>
                  {["Bill Date", "Bill No", "Bill Amt ₹", "Paid ₹", "Balance ₹", "Cr/Dr", "Amount ₹"].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-semibold text-white text-xs whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.id}
                    className={`border-b border-gray-100 hover:bg-[#d2f1fa]/40 transition-colors cursor-pointer select-none ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                    onDoubleClick={() => fillBalance(row)}
                    title="Double-click to fill full balance"
                    data-testid={`row-bill-adj-${i}`}>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(row.billDate)}</td>
                    <td className="px-4 py-3 font-mono text-gray-800 font-semibold">{row.billNo || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-800">{fmtAmt(row.billAmount)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500">{fmtAmt(row.paidAmount)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold" style={{ color: SC.primary }}>
                      {fmtAmt(row.balanceAmount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">{row.crDr}</span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="number" min={0} max={row.balanceAmount}
                        value={row.adjustAmount}
                        onChange={e => setAmt(row.id, e.target.value)}
                        onFocus={e => e.target.select()}
                        placeholder="0.00"
                        className="w-28 border border-gray-300 rounded px-2 py-1.5 text-right text-sm font-mono outline-none focus:border-[#027fa5] focus:ring-1 focus:ring-[#027fa5]/20"
                        data-testid={`input-adj-amount-${i}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        {rows.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/70">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="text-sm">
                  <span className="text-gray-500">Total Adjusted Amount:</span>
                  <span className="font-bold font-mono text-base ml-2" style={{ color: SC.orange }}>
                    ₹{fmtAmt(totalAdj)}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  This total will be set as the voucher amount
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={onClose}
                  className="px-5 py-2 rounded border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="button" onClick={handleConfirm} disabled={totalAdj <= 0}
                  className="px-7 py-2 rounded text-sm font-bold text-white disabled:opacity-40 transition-opacity"
                  style={{ background: SC.orange }}
                  data-testid="btn-bill-adj-save">
                  Save & Set Amount
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Voucher nature helpers ────────────────────────────────────────────────────
function getNature(name: string): Nature {
  const n = name.toLowerCase();
  if (n.includes("payment")) return "payment";
  if (n.includes("receipt")) return "receipt";
  if (n.includes("contra"))  return "contra";
  return "journal";
}

// By = Debit / To = Credit  (Tally convention)
function drCrLabel(drCr: "DR" | "CR") {
  return drCr === "DR" ? "By" : "To";
}

function getMainDrCr(nature: Nature): "DR" | "CR" {
  // Payment → Party is Credited (To)  Receipt/Contra → Bank is Debited (By)
  return nature === "payment" ? "CR" : "DR";
}

// ── Per-line ledger filter (by row index) ─────────────────────────────────────
function getLineFilter(vtName: string, idx: number): FilterType {
  const n      = vtName.toLowerCase();
  const nature = getNature(vtName);
  if (n.includes("contra")) return "bank_cash";
  if (nature === "payment") {
    // Row 0 = party (Sundry Creditors — supplier), Row 1+ = Bank or Cash
    if (idx === 0) return "sundry_creditors";
    return n.includes("bank") ? "bank" : n.includes("cash") ? "cash" : "bank_cash";
  }
  if (nature === "receipt") {
    // Row 0 = Bank or Cash, Row 1+ = party (Sundry Debtors — customer)
    if (idx === 0) return n.includes("bank") ? "bank" : n.includes("cash") ? "cash" : "bank_cash";
    return "sundry_debtors";
  }
  return "all";
}

function applyFilter(sls: any[], f: FilterType) {
  if (f === "all") return sls;
  return sls.filter(s => {
    const g = (s.gl_name || "").toLowerCase();
    if (f === "bank")             return g.includes("bank");
    if (f === "cash")             return g.includes("cash");
    if (f === "bank_cash")        return g.includes("bank") || g.includes("cash");
    if (f === "sundry_creditors") return g.includes("sundry creditor");
    if (f === "sundry_debtors")   return g.includes("sundry debtor");
    return true;
  });
}

function filterLabel(f: FilterType): string | undefined {
  if (f === "bank")             return "Bank only";
  if (f === "cash")             return "Cash only";
  if (f === "bank_cash")        return "Bank / Cash";
  if (f === "sundry_creditors") return "Sundry Creditors";
  if (f === "sundry_debtors")   return "Sundry Debtors";
  return undefined;
}

// ── Default lines ─────────────────────────────────────────────────────────────
function mkLine(isMain: boolean, drCr: "DR" | "CR", extra: Partial<VLine> = {}): VLine {
  return { _key: uuid(), isMain, drCr, subLedgerId: "", subLedgerName: "", amount: "", narration: "", ...extra };
}

function buildDefaultLines(vtName: string): VLine[] {
  const nature    = getNature(vtName);
  const mainDrCr  = getMainDrCr(nature);
  const detDrCr: "DR" | "CR" = mainDrCr === "DR" ? "CR" : "DR";
  return [mkLine(true, mainDrCr), mkLine(false, detDrCr)];
}

// ── Inline account picker (Tally-style: type to search) ───────────────────────
function SlPicker({
  value, name, onChange, subLedgers, hint, autoOpen, amountRef, onEnterAmount,
}: {
  value: string; name: string;
  onChange: (id: string, name: string) => void;
  subLedgers: any[];
  hint?: string;
  autoOpen?: boolean;
  amountRef?: React.RefObject<HTMLInputElement>;
  onEnterAmount?: () => void;
}) {
  const [open, setOpen]   = useState(false);
  const [q, setQ]         = useState("");
  const containerRef      = useRef<HTMLDivElement>(null);
  const inputRef          = useRef<HTMLInputElement>(null);
  const [rect, setRect]   = useState<DOMRect | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (autoOpen) { openDrop(); }
  }, [autoOpen]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = subLedgers.filter(s =>
    !q || s.name.toLowerCase().includes(q.toLowerCase()) || (s.code || "").toLowerCase().includes(q.toLowerCase())
  ).slice(0, 80);

  useEffect(() => { setActiveIdx(0); }, [q]);

  function openDrop() {
    if (containerRef.current) setRect(containerRef.current.getBoundingClientRect());
    setQ(""); setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 40);
  }

  function select(s: any) {
    onChange(s.id, s.name);
    setOpen(false);
    // After selecting, jump to amount
    setTimeout(() => amountRef?.current?.focus(), 60);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && filtered[activeIdx]) { e.preventDefault(); select(filtered[activeIdx]); }
    if (e.key === "Escape") setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <button type="button" onClick={openDrop}
        className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 border rounded text-sm bg-white text-left min-h-[32px] transition-colors ${
          open ? "border-[#027fa5] ring-1 ring-[#027fa5]/30" : "border-gray-200 hover:border-[#027fa5]"
        }`} data-testid="btn-pick-sl">
        {name
          ? <span className="flex-1 truncate text-gray-800 font-medium">{name}</span>
          : <span className="flex-1 text-gray-400 text-sm">Select ledger…</span>}
        <ChevronDown size={12} className="text-gray-400 flex-shrink-0" />
      </button>

      {open && rect && (
        <div className="fixed z-[200] bg-white border border-[#027fa5]/30 rounded-lg shadow-2xl overflow-hidden"
          style={{ top: rect.bottom + 2, left: rect.left, width: Math.max(rect.width, 340), maxHeight: 340 }}>
          {/* Search row */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/60">
            <Search size={13} className="text-gray-400 flex-shrink-0" />
            <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Type to search ledger…"
              className="flex-1 text-sm outline-none py-0.5 bg-transparent" />
            {hint && (
              <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                style={{ background: "#fef3c7", color: "#92400e" }}>{hint}</span>
            )}
            <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          </div>
          {/* Results */}
          <div className="overflow-y-auto" style={{ maxHeight: 280 }}>
            {filtered.length === 0 && (
              <div className="px-4 py-6 text-sm text-gray-400 text-center">
                {hint ? `No ${hint} ledger found` : "No matching ledger"}
              </div>
            )}
            {filtered.map((s, si) => (
              <button key={s.id} type="button"
                onClick={() => select(s)}
                className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-3 border-b border-gray-50 transition-colors ${
                  si === activeIdx ? "bg-[#d2f1fa] font-semibold" : "hover:bg-[#d2f1fa]/50"
                } ${s.id === value ? "text-[#027fa5]" : "text-gray-800"}`}>
                <span className="text-gray-400 font-mono text-xs w-16 flex-shrink-0">{s.code}</span>
                <div className="flex flex-col min-w-0">
                  <span className="truncate">{s.name}</span>
                  {s.gl_name && <span className="text-gray-400 text-[11px] truncate">{s.gl_name}</span>}
                </div>
                {s.id === value && <CheckCircle2 size={13} className="ml-auto text-[#027fa5] flex-shrink-0" />}
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
  const [submitErr, setSubmitErr] = useState("");
  const [saved,     setSaved]     = useState(false);
  const [touched,   setTouched]   = useState(false); // track if user tried to save

  const nature    = vtName ? getNature(vtName) : "journal";
  const mainDrCr  = getMainDrCr(nature);
  const detDrCr: "DR" | "CR" = mainDrCr === "DR" ? "CR" : "DR";

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

  // Bill Adjustment state
  const [showBillAdj,       setShowBillAdj]       = useState(false);
  const [billAdjRows,       setBillAdjRows]       = useState<BillAdjRow[]>([]);
  const [billAdjSlId,       setBillAdjSlId]       = useState("");
  const [billAdjPartyLineKey, setBillAdjPartyLineKey] = useState("");

  // Amount input refs for keyboard jump
  const amtRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // ── Recalculate totals ──────────────────────────────────────────────────────
  const totalDr  = lines.filter(l => l.drCr === "DR").reduce((s, l) => s + parseAmt(l.amount), 0);
  const totalCr  = lines.filter(l => l.drCr === "CR").reduce((s, l) => s + parseAmt(l.amount), 0);
  const diff     = totalDr - totalCr; // positive = Dr excess, negative = Cr excess
  const balanced = Math.abs(diff) < 0.005 && totalDr > 0;
  const mainAmt  = parseAmt(lines[0]?.amount || "0");

  // ── Reset when voucher type changes ────────────────────────────────────────
  useEffect(() => {
    if (!vtName || isEdit) return;
    setLines(buildDefaultLines(vtName));
    setTouched(false);
  }, [vtName]);

  // ── Auto-fetch voucher number ───────────────────────────────────────────────
  useEffect(() => {
    if (!vtCode || isEdit) return;
    fetch(`/api/voucher-series/next/${vtCode}`, { credentials: "include" })
      .then(r => r.json()).then(d => { if (d.voucher_no) setVoucherNo(d.voucher_no); }).catch(() => {});
  }, [vtCode, isEdit]);

  // ── Line operations ────────────────────────────────────────────────────────
  function selectAccount(key: string, id: string, name: string) {
    setLines(prev => {
      const updated = prev.map(l => l._key === key
        ? { ...l, subLedgerId: id, subLedgerName: name, _err: undefined }
        : l);
      const last = updated[updated.length - 1];
      if (last.subLedgerId) {
        updated.push(mkLine(false, nature === "journal" ? "CR" : detDrCr));
      }
      return updated;
    });

    // Trigger bill adjustment dialog immediately when a party ledger is selected
    if (id && vtName) {
      const idx = lines.findIndex(l => l._key === key);
      const f = getLineFilter(vtName, idx);
      if (f === "sundry_creditors" || f === "sundry_debtors") {
        setBillAdjSlId(id);
        setBillAdjPartyLineKey(key);
        setBillAdjRows([]); // reset previous for new party
        setTimeout(() => setShowBillAdj(true), 80);
      }
    }
  }

  function setAmount(key: string, val: string) {
    setLines(prev => prev.map(l => l._key === key ? { ...l, amount: val, _err: undefined } : l));
  }

  // Tab/Enter on amount → just advance to next row
  function handleAmountTab(key: string, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Tab" && e.key !== "Enter") return;
    const idx = lines.findIndex(l => l._key === key);
    if (idx === lines.length - 1 && lines[idx].subLedgerId) {
      e.preventDefault();
      const newLine = mkLine(false, nature === "journal" ? "CR" : detDrCr);
      setLines(prev => [...prev, newLine]);
    }
  }

  function removeLine(key: string) {
    setLines(prev => {
      const remain = prev.filter(l => l._key !== key);
      if (remain.length < 2) return prev;
      const last = remain[remain.length - 1];
      if (last.subLedgerId) remain.push(mkLine(false, nature === "journal" ? "CR" : detDrCr));
      return remain;
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

  // ── Suggest amount for pending empty rows ───────────────────────────────────
  function suggestedAmount(l: VLine, idx: number): string {
    if (l.amount || !l.subLedgerId) return "";
    // If last meaningful detail row and there's a remaining difference
    const remaining = Math.abs(diff);
    if (remaining > 0.005) return fmt2(remaining).toString();
    return "";
  }

  function fmt2(n: number) { return n.toFixed(2); }

  // ── Inline validation ───────────────────────────────────────────────────────
  type ValidationError = { field: "account" | "amount" | "general"; key?: string; msg: string };

  function validate(): ValidationError[] {
    const errs: ValidationError[] = [];
    if (!vtId) errs.push({ field: "general", msg: "Select a Voucher Type to proceed." });
    const nonEmpty = lines.filter(l => l.subLedgerId || l.amount);
    if (nonEmpty.length < 2) errs.push({ field: "general", msg: "At least two ledger entries are required." });
    nonEmpty.forEach(l => {
      if (!l.subLedgerId) errs.push({ field: "account", key: l._key, msg: "Ledger not selected." });
      if (!l.amount || parseAmt(l.amount) <= 0) errs.push({ field: "amount", key: l._key, msg: "Amount must be > 0." });
    });
    // Duplicate ledger check
    const ids = nonEmpty.map(l => l.subLedgerId).filter(Boolean);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    if (dupes.length) errs.push({ field: "general", msg: "Same ledger appears more than once. Remove duplicates." });
    if (!balanced && totalDr + totalCr > 0) {
      errs.push({ field: "general", msg: `Voucher is not balanced. Difference: ₹${fmtAmt(Math.abs(diff))} (${diff > 0 ? "Debit" : "Credit"} excess).` });
    }
    return errs;
  }

  const validationErrors = touched ? validate() : [];
  const generalErrors    = validationErrors.filter(e => e.field === "general");

  // ── Save ────────────────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async () => {
      const errs = validate();
      if (errs.length) {
        setTouched(true);
        throw new Error(errs.filter(e => e.field === "general").map(e => e.msg).join(" "));
      }
      const nonEmpty = lines.filter(l => l.subLedgerId && parseAmt(l.amount) > 0);

      // Identify party and bank/cash sub-ledgers for balance updates
      // Payment: Row 0 = Sundry Creditor (party), Row 1+ = Bank/Cash
      // Receipt:  Row 0 = Bank/Cash, Row 1+ = Sundry Debtor (party)
      const partyLine = (nature === "payment" || nature === "receipt")
        ? nonEmpty.find(l => {
            const sl = (allSubs as any[]).find((s: any) => s.id === l.subLedgerId);
            const g = (sl?.gl_name || "").toLowerCase();
            return g.includes("sundry creditor") || g.includes("sundry debtor");
          })
        : undefined;
      const bankLine = (nature === "payment" || nature === "receipt")
        ? nonEmpty.find(l => {
            const sl = (allSubs as any[]).find((s: any) => s.id === l.subLedgerId);
            const g = (sl?.gl_name || "").toLowerCase();
            return g.includes("bank") || g.includes("cash");
          })
        : undefined;

      const payload = {
        voucherTypeCode: vtCode, voucherTypeName: vtName,
        referenceNo: refNo, referenceDate: refDate,
        voucherDate: vDate, narration,
        lines: nonEmpty.map(l => ({
          drCr: l.drCr, subLedgerId: l.subLedgerId,
          amount: String(parseAmt(l.amount)), narration: l.narration || narration,
        })),
        // Bill adjustment data
        billAdjustments: billAdjRows.map(b => ({
          source: b.source, sourceId: b.sourceId,
          billNo: b.billNo, billDate: b.billDate,
          billAmount: b.billAmount, adjustedAmount: parseAmt(b.adjustAmount || "0"),
        })),
        partySubLedgerId: partyLine?.subLedgerId || "",
        bankSubLedgerId: bankLine?.subLedgerId || "",
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
      qc.invalidateQueries({ queryKey: ["/api/bill-adjustments/outstanding"] });
      setVoucherNo(data.voucherNo || voucherNo);
      setSaved(true); setSubmitErr(""); setTouched(false);
      setBillAdjRows([]); setBillAdjSlId(""); setBillAdjPartyLineKey("");
      setTimeout(() => setSaved(false), 3500);
      setRefNo(""); setNarration("");
      setLines(vtName ? buildDefaultLines(vtName) : [mkLine(true, "DR"), mkLine(false, "CR")]);
      if (vtCode) {
        fetch(`/api/voucher-series/next/${vtCode}`, { credentials: "include" })
          .then(r => r.json()).then(d => { if (d.voucher_no) setVoucherNo(d.voucher_no); });
      }
    },
    onError: (e: any) => setSubmitErr(e.message),
  });

  // ── Totals for display ─────────────────────────────────────────────────────
  const mainAmtDisplay   = lines[0]?.amount ? fmtAmt(parseAmt(lines[0].amount)) : "—";
  const detailTotal      = lines.slice(1).reduce((s, l) => s + parseAmt(l.amount), 0);
  const splitRemaining   = mainAmt > 0 ? mainAmt - detailTotal : 0;

  return (
    <div className="p-4" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onBack}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700" data-testid="btn-back-voucher">
              <ArrowLeft size={16} />
            </button>
            <div>
              <h2 className="font-semibold text-gray-800 text-base leading-tight">
                {vtName ? vtName : "Accounting"} Voucher
              </h2>
              {voucherNo && <div className="text-xs text-gray-400 font-mono">{voucherNo}</div>}
            </div>
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

        {/* ── Fields ─────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 space-y-4 border-b border-gray-100">
          <div className="grid grid-cols-3 gap-4">
            {/* Voucher Type */}
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Voucher Type</label>
              <select value={vtId}
                onChange={e => {
                  const vt = voucherTypes.find((v: any) => v.id === e.target.value);
                  setVtId(e.target.value); setVtCode(vt?.code || ""); setVtName(vt?.name || "");
                }}
                className="w-full border border-gray-300 rounded px-3 h-[34px] text-sm bg-white outline-none focus:border-[#027fa5] appearance-none"
                data-testid="select-voucher-type">
                <option value="">— Select Type —</option>
                {voucherTypes.map((vt: any) => <option key={vt.id} value={vt.id}>{vt.name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Voucher No */}
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Voucher No</label>
              <input value={voucherNo} readOnly placeholder="Auto-generated"
                className="w-full border border-gray-300 rounded px-3 h-[34px] text-sm bg-gray-50 text-gray-500 outline-none"
                data-testid="input-voucher-no" />
            </div>

            {/* Ref No */}
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Reference No</label>
              <input value={refNo} onChange={e => setRefNo(e.target.value)} placeholder="REF0215001"
                className="w-full border border-gray-300 rounded px-3 h-[34px] text-sm outline-none focus:border-[#027fa5]"
                data-testid="input-ref-no" />
            </div>
          </div>

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
        </div>

        {/* ── Entry Grid ─────────────────────────────────────────────────── */}
        <div className="px-6 pt-4 pb-2">

          {/* Nature strip */}
          {vtName && (
            <div className="mb-3 flex items-center gap-2 text-xs">
              {nature === "payment" && <>
                <span className="font-semibold text-gray-500">Nature:</span>
                <span className="px-2 py-0.5 rounded font-bold bg-orange-50 text-orange-700">Payment</span>
                <span className="text-gray-400">·  <b className="text-green-700">To</b> Party (Credit)  ·  <b className="text-red-700">By</b> Cash/Bank (Debit)</span>
              </>}
              {nature === "receipt" && <>
                <span className="font-semibold text-gray-500">Nature:</span>
                <span className="px-2 py-0.5 rounded font-bold bg-green-50 text-green-700">Receipt</span>
                <span className="text-gray-400">·  <b className="text-red-700">By</b> Cash/Bank (Debit)  ·  <b className="text-green-700">To</b> Party (Credit)</span>
              </>}
              {nature === "contra"  && <>
                <span className="font-semibold text-gray-500">Nature:</span>
                <span className="px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-700">Contra</span>
                <span className="text-gray-400">·  Bank ↔ Cash Transfer</span>
              </>}
              {nature === "journal" && <>
                <span className="font-semibold text-gray-500">Nature:</span>
                <span className="px-2 py-0.5 rounded font-bold bg-purple-50 text-purple-700">Journal</span>
                <span className="text-gray-400">·  Click <b>By/To</b> on each line to toggle Dr/Cr</span>
              </>}
            </div>
          )}

          {/* Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ background: SC.tonal }}>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-600 w-10">#</th>
                  <th className="px-2 py-2.5 text-left text-xs font-bold text-gray-600 w-12">Dr/Cr</th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-gray-600">Particulars / Account</th>
                  <th className="px-3 py-2.5 text-right text-xs font-bold text-gray-600 w-36">Amount (₹)</th>
                  <th className="w-7"></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const f          = vtName ? getLineFilter(vtName, i) : "all";
                  const filtSls    = applyFilter(allSubs, f);
                  const fhint      = filterLabel(f);
                  const isDr       = l.drCr === "DR";
                  const label      = drCrLabel(l.drCr);
                  const suggested  = !l.amount && l.subLedgerId ? suggestedAmount(l, i) : "";
                  const isEmpty    = !l.subLedgerId && !l.amount;
                  const isLast     = i === lines.length - 1;
                  const canToggle  = nature === "journal";
                  const lineErr    = touched ? validationErrors.find(e => e.key === l._key) : null;

                  return (
                    <tr key={l._key}
                      className={`border-t border-gray-100 transition-colors ${
                        l.isMain
                          ? "bg-[#f0f9ff]"
                          : isEmpty && isLast
                            ? "bg-gray-50/30"
                            : "bg-white"
                      }`}
                      data-testid={`row-voucher-line-${i}`}>

                      {/* # */}
                      <td className="px-3 py-2 text-center text-gray-400 text-xs font-mono">
                        {String(i + 1).padStart(2, "0")}
                      </td>

                      {/* By / To badge */}
                      <td className="px-2 py-2 text-center">
                        <button type="button"
                          onClick={() => canToggle && toggleJournalDrCr(l._key)}
                          disabled={!canToggle}
                          title={canToggle ? "Click to toggle Debit/Credit" : (isDr ? "Debit (By)" : "Credit (To)")}
                          className="text-xs font-bold px-2 py-1 rounded w-10 transition-colors"
                          style={isDr
                            ? { background: "#fef2f2", color: "#b91c1c", border: "1px solid #fca5a5", cursor: canToggle ? "pointer" : "default" }
                            : { background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac", cursor: canToggle ? "pointer" : "default" }}
                          data-testid={`badge-dr-cr-${i}`}>
                          {label}
                        </button>
                      </td>

                      {/* Account */}
                      <td className="px-2 py-2">
                        <SlPicker
                          value={l.subLedgerId} name={l.subLedgerName}
                          onChange={(id, name) => selectAccount(l._key, id, name)}
                          subLedgers={filtSls} hint={fhint}
                          amountRef={{ current: amtRefs.current[l._key] }}
                        />
                        {/* Inline: split remaining hint */}
                        {l.isMain && nature !== "journal" && mainAmt > 0 && splitRemaining > 0.005 && (
                          <div className="text-[11px] text-amber-600 mt-0.5 pl-1 flex items-center gap-1">
                            <AlertCircle size={10} /> Remaining to split: ₹{fmtAmt(splitRemaining)}
                          </div>
                        )}
                        {lineErr?.field === "account" && (
                          <div className="text-[11px] text-red-500 mt-0.5 pl-1">{lineErr.msg}</div>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="px-2 py-2">
                        <div className="relative">
                          <input
                            ref={el => { amtRefs.current[l._key] = el; }}
                            type="number" min={0} value={l.amount}
                            onChange={e => setAmount(l._key, e.target.value)}
                            onKeyDown={e => handleAmountTab(l._key, e)}
                            placeholder={suggested || "0.00"}
                            className={`w-full border rounded px-2 h-[32px] text-sm text-right outline-none transition-colors font-mono ${
                              lineErr?.field === "amount"
                                ? "border-red-400 bg-red-50 focus:border-red-500"
                                : "border-gray-200 focus:border-[#027fa5] bg-white"
                            }`}
                            data-testid={`input-amount-${i}`}
                          />
                          {suggested && !l.amount && (
                            <span className="absolute right-7 top-1/2 -translate-y-1/2 text-[10px] text-amber-500 pointer-events-none">↑ suggested</span>
                          )}
                        </div>
                        {lineErr?.field === "amount" && (
                          <div className="text-[11px] text-red-500 mt-0.5 text-right">{lineErr.msg}</div>
                        )}
                      </td>

                      {/* Delete */}
                      <td className="px-1 py-2 text-center">
                        {!l.isMain && (
                          <button type="button" onClick={() => removeLine(l._key)}
                            className="p-1 text-gray-300 hover:text-red-500 rounded transition-colors"
                            data-testid={`btn-remove-line-${i}`}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Totals footer */}
              <tfoot>
                <tr className="border-t-2 border-gray-200" style={{ background: "#f8fafc" }}>
                  <td colSpan={3} className="px-4 py-2.5 text-sm font-bold text-gray-700">Grand Total</td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-red-700 font-mono font-bold">Dr ₹{fmtAmt(totalDr)}</span>
                        <span className="text-gray-300">|</span>
                        <span className="text-green-700 font-mono font-bold">Cr ₹{fmtAmt(totalCr)}</span>
                      </div>
                      {!balanced && totalDr + totalCr > 0 && (
                        <div className="text-[11px] font-semibold text-amber-600">
                          Diff: ₹{fmtAmt(Math.abs(diff))} {diff > 0 ? "(Dr excess)" : "(Cr excess)"}
                        </div>
                      )}
                    </div>
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            {/* Status bar */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50/40">
              <div className="flex items-center gap-2">
                {nature === "journal" && (
                  <>
                    <button type="button" onClick={() => addJournalLine("DR")}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border font-semibold"
                      style={{ color: "#b91c1c", borderColor: "#fca5a5" }} data-testid="btn-add-dr">
                      <Plus size={10} /> By (Dr)
                    </button>
                    <button type="button" onClick={() => addJournalLine("CR")}
                      className="flex items-center gap-1 text-xs px-2.5 py-1 rounded border font-semibold"
                      style={{ color: "#15803d", borderColor: "#86efac" }} data-testid="btn-add-cr">
                      <Plus size={10} /> To (Cr)
                    </button>
                  </>
                )}
              </div>
              <div>
                {balanced
                  ? <span className="flex items-center gap-1 text-xs font-bold text-green-600">
                      <CheckCircle2 size={13} /> Balanced ✓
                    </span>
                  : totalDr + totalCr > 0
                    ? <span className="text-xs text-amber-600 font-semibold flex items-center gap-1">
                        <AlertCircle size={12} /> Not balanced — Difference: ₹{fmtAmt(Math.abs(diff))}
                      </span>
                    : null
                }
              </div>
            </div>
          </div>

          {/* Bill Adjustment Summary — shown after dialog confirms */}
          {billAdjRows.length > 0 && (nature === "payment" || nature === "receipt") && (
            <div className="mt-3 rounded-lg border overflow-hidden" style={{ borderColor: SC.primary + "55" }}>
              <div className="flex items-center justify-between px-4 py-2" style={{ background: SC.tonal }}>
                <span className="text-xs font-bold" style={{ color: SC.primary }}>
                  Bill to Bill Adjustment — {billAdjRows.length} bill{billAdjRows.length > 1 ? "s" : ""} selected
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-700">
                    Total: ₹{fmtAmt(billAdjRows.reduce((s, r) => s + parseAmt(r.adjustAmount || "0"), 0))}
                  </span>
                  <button type="button" onClick={() => setShowBillAdj(true)}
                    className="text-xs px-2 py-0.5 rounded border font-semibold"
                    style={{ color: SC.primary, borderColor: SC.primary + "66" }}>
                    Edit
                  </button>
                  <button type="button" onClick={() => { setBillAdjRows([]); setBillAdjPartyLineKey(""); setBillAdjSlId(""); }}
                    className="text-gray-400 hover:text-red-500 p-0.5 rounded">
                    <X size={13} />
                  </button>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["Bill Date", "Bill No", "Bill Amt ₹", "Adjusted ₹"].map(h => (
                      <th key={h} className="px-3 py-1.5 text-left text-gray-500 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {billAdjRows.map((r, i) => (
                    <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-3 py-1.5 text-gray-600">{fmtDate(r.billDate)}</td>
                      <td className="px-3 py-1.5 font-mono text-gray-800 font-semibold">{r.billNo || "—"}</td>
                      <td className="px-3 py-1.5 text-right font-mono text-gray-600">{fmtAmt(r.billAmount)}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold" style={{ color: SC.orange }}>
                        {fmtAmt(parseAmt(r.adjustAmount || "0"))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Narration */}
          <div className="mt-4 relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Narration</label>
            <input value={narration} onChange={e => setNarration(e.target.value)}
              placeholder="e.g. Bill no : INV2014 (Dt: 28-02-2026)"
              className="w-full border border-gray-300 rounded px-3 h-[34px] text-sm outline-none focus:border-[#027fa5]"
              data-testid="input-narration" />
          </div>

          {/* General validation errors */}
          {generalErrors.length > 0 && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3 space-y-1">
              {generalErrors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-red-700">
                  <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                  <span>{e.msg}</span>
                </div>
              ))}
            </div>
          )}
          {submitErr && !generalErrors.length && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle size={13} /> {submitErr}
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-400">
              Select a party ledger to open Bill Adjustment automatically
            </div>
            {/* Manual re-open bill adjustment for payment or receipt */}
            {(nature === "payment" || nature === "receipt") && billAdjPartyLineKey && billAdjSlId && (
              <button type="button"
                onClick={() => setShowBillAdj(true)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border font-semibold"
                style={{ color: SC.primary, borderColor: SC.primary + "55", background: SC.tonal }}
                data-testid="btn-bill-adjustment">
                <FileText size={12} /> Bill Adjustment
                {billAdjRows.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full text-white text-[10px] font-bold"
                    style={{ background: SC.orange }}>
                    {billAdjRows.length}
                  </span>
                )}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onBack}
              className="px-7 py-2 rounded border text-sm font-semibold text-gray-700 hover:bg-gray-50 border-gray-300"
              data-testid="btn-back">Back</button>
            <button type="button"
              onClick={() => { setTouched(true); saveMut.mutate(); }}
              disabled={saveMut.isPending}
              className="px-8 py-2 rounded text-sm font-bold text-white shadow-sm disabled:opacity-50 transition-opacity"
              style={{ background: balanced ? SC.orange : "#9ca3af" }}
              data-testid="btn-accept">
              {saveMut.isPending ? "Saving…" : "Accept"}
            </button>
          </div>
        </div>
      </div>

      {/* Bill to Bill Adjustment Dialog */}
      <BillAdjustmentDialog
        open={showBillAdj}
        subLedgerId={billAdjSlId}
        prevRows={billAdjRows}
        partyName={lines.find(l => l._key === billAdjPartyLineKey)?.subLedgerName || ""}
        onConfirm={(rows, total) => {
          setBillAdjRows(rows);
          setShowBillAdj(false);
          // Set the party line amount to the total adjusted
          if (billAdjPartyLineKey && total > 0) {
            setLines(prev => prev.map(l =>
              l._key === billAdjPartyLineKey ? { ...l, amount: total.toFixed(2) } : l
            ));
          }
        }}
        onClose={() => setShowBillAdj(false)}
      />
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
    !search ||
    [v.voucher_no, v.voucher_type_name, v.narration, v.ref_no]
      .join(" ").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
        {/* List Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h1 className="font-semibold text-gray-800 text-base">Accounting Vouchers</h1>
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

        {/* List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: SC.tonal }}>
                {["#","Voucher No","Type","Date","Ref No","Narration","Amount ₹",""].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-bold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Loading vouchers…</td></tr>}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  No vouchers found.{!search && " Click \"New Voucher\" to create one."}
                </td></tr>
              )}
              {filtered.map((v, i) => (
                <tr key={v.id} className="border-b border-gray-50 hover:bg-blue-50/20 transition-colors"
                  data-testid={`row-voucher-${v.id}`}>
                  <td className="px-4 py-3 text-gray-500 text-xs">{i + 1}</td>
                  <td className="px-4 py-3 font-bold text-sm" style={{ color: SC.primary }}>{v.voucher_no}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded font-semibold" style={{ background: SC.tonal, color: SC.primary }}>
                      {v.voucher_type_name || v.voucher_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{v.voucher_date?.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-gray-500 text-sm">{v.ref_no || "—"}</td>
                  <td className="px-4 py-3 text-gray-600 text-sm max-w-[160px] truncate">{v.narration || "—"}</td>
                  <td className="px-4 py-3 font-mono font-bold text-gray-800">₹{fmtAmt(v.total_amount)}</td>
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
