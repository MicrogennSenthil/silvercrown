import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Printer, PencilLine, Search, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import DatePicker from "@/components/DatePicker";
import { buildProcessInwardHTML } from "@/lib/printProcessInward";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

function today() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtAmt(v: any) {
  return parseFloat(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const INPUT  = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#027fa5] focus:ring-1 focus:ring-[#027fa5]/20 bg-white";
const SELECT = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#027fa5] bg-white";
const LABEL  = "block text-xs font-semibold text-gray-500 mb-1";

type PiItem = {
  _key: string;
  outward_item_id: string; item_id: string; item_code: string; item_name: string;
  hsn: string; qty: string; unit: string; rate: string;
  taxable_amount: string;
  cgst_rate: string; sgst_rate: string; igst_rate: string;
  cgst_amount: string; sgst_amount: string; igst_amount: string;
  amount: string;
};

function newRow(): PiItem {
  return {
    _key: crypto.randomUUID(),
    outward_item_id: "", item_id: "", item_code: "",
    item_name: "", hsn: "", qty: "", unit: "", rate: "",
    taxable_amount: "", cgst_rate: "", sgst_rate: "", igst_rate: "",
    cgst_amount: "", sgst_amount: "", igst_amount: "", amount: "",
  };
}

function calcRow(row: PiItem): PiItem {
  const qty   = parseFloat(row.qty)       || 0;
  const rate  = parseFloat(row.rate)      || 0;
  const cgstR = parseFloat(row.cgst_rate) || 0;
  const sgstR = parseFloat(row.sgst_rate) || 0;
  const igstR = parseFloat(row.igst_rate) || 0;
  const taxable = qty * rate;
  const cgst    = (taxable * cgstR) / 100;
  const sgst    = (taxable * sgstR) / 100;
  const igst    = (taxable * igstR) / 100;
  return {
    ...row,
    taxable_amount: taxable.toFixed(2),
    cgst_amount:    cgst.toFixed(2),
    sgst_amount:    sgst.toFixed(2),
    igst_amount:    igst.toFixed(2),
    amount:         (taxable + cgst + sgst + igst).toFixed(2),
  };
}

/* ── Supplier searchable combo ──────────────────────────────────────── */
function SuppCombo({ value, display, onChange, onSelect, options }: {
  value: string; display: string;
  onChange: (v: string) => void; onSelect: (s: any) => void;
  options: any[];
}) {
  const [open, setOpen] = useState(false);
  const filtered = options.filter((s: any) =>
    !value || s.name?.toLowerCase().includes(value.toLowerCase())
  );
  return (
    <div className="relative">
      <div className={`${INPUT} flex items-center gap-1`}>
        <input
          value={display || value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          placeholder="Search supplier…"
          className="flex-1 outline-none bg-transparent text-sm min-w-0"
        />
        <ChevronDown size={13} className="text-gray-300 flex-shrink-0" />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-40 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-auto mt-0.5">
          {filtered.slice(0, 30).map((s: any) => (
            <div key={s.id} onMouseDown={() => { onSelect(s); setOpen(false); }}
              className="px-3 py-2 hover:bg-[#d2f1fa] cursor-pointer text-sm">
              <div className="font-medium text-gray-800">{s.name}</div>
              {s.gstin && <div className="text-xs text-gray-400">{s.gstin}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Form ─────────────────────────────────────────────────────────── */
function PiForm({ editData, onBack }: { editData?: any; onBack: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!editData?.id;

  const { data: suppliers  = [] } = useQuery<any[]>({ queryKey: ["/api/suppliers"] });
  const { data: outwardsAll = [] } = useQuery<any[]>({ queryKey: ["/api/process-outward"] });
  const outwards = (outwardsAll as any[]).filter((o: any) => o.is_returnable === true);
  const { data: products   = [] } = useQuery<any[]>({ queryKey: ["/api/products"] });

  const [voucherNo,   setVoucherNo]   = useState(editData?.voucher_no || "");
  const [inwardDate,  setInwardDate]  = useState(editData?.inward_date?.split("T")[0] || today());
  const [outwardId,   setOutwardId]   = useState(editData?.outward_id || "");
  const [outwardOpen, setOutwardOpen] = useState(false);
  const [supplierId,  setSupplierId]  = useState(editData?.supplier_id || "");
  const [suppSearch,  setSuppSearch]  = useState(editData?.supplier_name || "");
  const [supInvNo,    setSupInvNo]    = useState(editData?.supplier_invoice_no || "");
  const [supInvDate,  setSupInvDate]  = useState(editData?.supplier_invoice_date?.split("T")[0] || "");
  const payMode     = "Credit";   // always silent credit posting
  const payAccId    = "";
  const expenseGlId = "";
  const [notes,       setNotes]       = useState(editData?.notes || "");

  const [items, setItems] = useState<PiItem[]>(
    editData?.items?.length
      ? editData.items.map((it: any) => ({
          _key: crypto.randomUUID(), ...it,
          qty: String(it.qty || ""), rate: String(it.rate || ""),
          taxable_amount: String(it.taxable_amount || ""),
          cgst_rate: String(it.cgst_rate || ""), sgst_rate: String(it.sgst_rate || ""),
          igst_rate: String(it.igst_rate || ""),
          cgst_amount: String(it.cgst_amount || ""), sgst_amount: String(it.sgst_amount || ""),
          igst_amount: String(it.igst_amount || ""), amount: String(it.amount || ""),
        }))
      : [newRow()]
  );
  const [itemSearch,   setItemSearch]   = useState<Record<string, string>>({});
  const [itemDropOpen, setItemDropOpen] = useState<string | null>(null);
  const [procSearch,   setProcSearch]   = useState<Record<string, string>>({});
  const [procDropOpen, setProcDropOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit && !voucherNo) {
      fetch("/api/voucher-series/next/process_inward", { credentials: "include" })
        .then(r => r.json()).then(d => { if (d.voucher_no) setVoucherNo(d.voucher_no); }).catch(() => {});
    }
  }, [isEdit, voucherNo]);

  async function selectOutward(o: any) {
    setOutwardId(o.id);
    if (o.supplier_id) { setSupplierId(o.supplier_id); setSuppSearch(o.supplier_name || ""); }
    setOutwardOpen(false);
    // Auto-fill items from the selected DC
    try {
      const full = await fetch(`/api/process-outward/${o.id}`, { credentials: "include" }).then(r => r.json());
      if (full.items?.length) {
        const newRows = full.items.map((it: any) => {
          const key = crypto.randomUUID();
          return { key, row: calcRow({
            _key: key,
            outward_item_id: it.id || "",
            item_id: it.item_id || "",
            item_code: it.item_code || "",
            item_name: it.item_name || "",
            hsn: it.hsn || "",
            qty: String(it.qty || ""),
            unit: it.unit || "",
            rate: "",
            taxable_amount: "", cgst_rate: "", sgst_rate: "", igst_rate: "",
            cgst_amount: "", sgst_amount: "", igst_amount: "", amount: "",
          })};
        });
        setItems(newRows.map(r => r.row));
        // Pre-fill itemSearch so inputs show the name (not empty)
        const searchMap: Record<string, string> = {};
        newRows.forEach(({ key, row }) => { searchMap[key] = row.item_name; });
        setItemSearch(searchMap);
        setItemDropOpen(null);
      }
    } catch { /* silently ignore */ }
  }

  const selectedOutward = (outwards as any[]).find((o: any) => o.id === outwardId);

  function updateRow(key: string, field: keyof PiItem, val: string) {
    setItems(prev => prev.map(r => r._key === key ? calcRow({ ...r, [field]: val }) : r));
  }

  function selectItem(key: string, item: any) {
    setItems(prev => prev.map(r => r._key === key
      ? calcRow({ ...r, item_id: item.id, item_code: item.code, item_name: item.name,
                  hsn: item.hsnCode || item.hsn_code || r.hsn,
                  unit: (item.uom || item.unit || r.unit || "").toUpperCase() })
      : r
    ));
    setItemSearch(prev => ({ ...prev, [key]: item.name }));
    setItemDropOpen(null);
  }

  function selectProcess(key: string, proc: any) {
    setItems(prev => prev.map(r => r._key === key
      ? calcRow({ ...r, process_nature: proc.name } as any)
      : r
    ));
    setProcSearch(prev => ({ ...prev, [key]: proc.name }));
    setProcDropOpen(null);
  }

  const totTaxable = items.reduce((s, r) => s + (parseFloat(r.taxable_amount) || 0), 0);
  const totCgst    = items.reduce((s, r) => s + (parseFloat(r.cgst_amount)    || 0), 0);
  const totSgst    = items.reduce((s, r) => s + (parseFloat(r.sgst_amount)    || 0), 0);
  const totIgst    = items.reduce((s, r) => s + (parseFloat(r.igst_amount)    || 0), 0);
  const totAmount  = items.reduce((s, r) => s + (parseFloat(r.amount)         || 0), 0);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        inward_date: inwardDate, outward_id: outwardId || null,
        supplier_id: supplierId || null,
        supplier_name_manual: !supplierId ? suppSearch : "",
        supplier_invoice_no: supInvNo, supplier_invoice_date: supInvDate || null,
        taxable_amount: totTaxable.toFixed(2),
        cgst_amount: totCgst.toFixed(2), sgst_amount: totSgst.toFixed(2),
        igst_amount: totIgst.toFixed(2), total_amount: totAmount.toFixed(2),
        payment_mode: payMode,
        payment_account_id: payMode !== "Credit" ? (payAccId || null) : null,
        expense_gl_id: expenseGlId || null, notes,
        items: items.filter(r => r.item_name || r.qty).map(r => ({
          outward_item_id: r.outward_item_id || null,
          item_id: r.item_id || null, item_code: r.item_code, item_name: r.item_name,
          hsn: r.hsn, qty: parseFloat(r.qty) || 0, unit: r.unit, rate: parseFloat(r.rate) || 0,
          taxable_amount: parseFloat(r.taxable_amount) || 0,
          cgst_rate: parseFloat(r.cgst_rate) || 0, sgst_rate: parseFloat(r.sgst_rate) || 0,
          igst_rate: parseFloat(r.igst_rate) || 0,
          cgst_amount: parseFloat(r.cgst_amount) || 0, sgst_amount: parseFloat(r.sgst_amount) || 0,
          igst_amount: parseFloat(r.igst_amount) || 0, amount: parseFloat(r.amount) || 0,
        })),
      };
      if (isEdit) return apiRequest("PATCH", `/api/process-inward/${editData.id}`, payload);
      return apiRequest("POST", "/api/process-inward", payload);
    },
    onSuccess: async (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/process-inward"] });
      toast({ title: isEdit ? "Updated" : "Saved", description: `${data.voucher_no} saved. Accounts posted.` });
      if (!isEdit && confirm(`${data.voucher_no} saved. Print invoice now?`)) {
        const full = await fetch(`/api/process-inward/${data.id}`, { credentials: "include" }).then(r => r.json());
        const w = window.open("", "_blank");
        if (w) { w.document.write(buildProcessInwardHTML(full)); w.document.close(); setTimeout(() => w.print(), 600); }
      }
      onBack();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cellRO  = "border-b border-gray-100 px-1.5 py-1 text-right text-xs text-gray-500 tabular-nums";
  const cellIn  = "border-b border-gray-100 px-1.5 py-1";
  const inpCls  = "w-full px-1.5 py-1 text-xs border border-transparent rounded focus:outline-none focus:border-[#027fa5] bg-transparent";

  return (
    <div className="p-3 sm:p-5" style={{ background: SC.bg, minHeight: "100%", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100">

        {/* ── Header bar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b border-gray-100 gap-3">
          <div>
            <div className="text-lg font-bold" style={{ color: SC.primary }}>
              {isEdit ? "Edit Process Inward" : "New Process Inward"}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">Record supplier invoice + post to accounts</div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={onBack}
              className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
              className="px-5 py-2 rounded-lg text-sm font-bold text-white flex items-center gap-2 disabled:opacity-60 transition-colors"
              style={{ background: SC.orange }}>
              {saveMut.isPending
                ? <><div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Saving…</>
                : "Save & Post"}
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="p-5">

          {/* Row 1: Invoice No, Date, Against DC, Supplier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className={LABEL}>Invoice No.</label>
              <input value={voucherNo} readOnly
                className={`${INPUT} bg-gray-50 font-bold`}
                style={{ color: SC.primary }} />
            </div>
            <div>
              <label className={LABEL}>Date *</label>
              <DatePicker value={inwardDate} onChange={setInwardDate} className={INPUT} />
            </div>

            {/* Against DC combo */}
            <div className="relative">
              <label className={LABEL}>Against DC (Process Outward)</label>
              <button onClick={() => setOutwardOpen(p => !p)} onBlur={() => setTimeout(() => setOutwardOpen(false), 180)}
                className={`${INPUT} text-left flex items-center justify-between`}>
                <span className={selectedOutward ? "text-gray-800 font-semibold" : "text-gray-400"}>
                  {selectedOutward ? selectedOutward.voucher_no : "Select DC…"}
                </span>
                <ChevronDown size={13} className="text-gray-300 flex-shrink-0" />
              </button>
              {outwardOpen && (
                <div className="absolute z-40 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl max-h-52 overflow-auto mt-0.5">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-400 border-b flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    Returnable DCs only
                  </div>
                  {(outwards as any[]).length === 0 && (
                    <div className="px-3 py-4 text-xs text-gray-400 text-center">
                      No returnable Process Outward DCs found.<br/>
                      <span className="text-gray-300">Mark outward entries as Returnable first.</span>
                    </div>
                  )}
                  {(outwards as any[]).map((o: any) => (
                    <div key={o.id} onMouseDown={() => selectOutward(o)}
                      className="px-3 py-2 hover:bg-[#d2f1fa] cursor-pointer text-xs">
                      <span className="font-bold" style={{ color: SC.primary }}>{o.voucher_no}</span>
                      <span className="text-gray-500 ml-1">— {o.supplier_name} ({fmtDate(o.outward_date)})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Supplier */}
            <div>
              <label className={LABEL}>Supplier *</label>
              <SuppCombo
                value={suppSearch}
                display={suppSearch}
                onChange={v => { setSuppSearch(v); setSupplierId(""); }}
                onSelect={s => { setSupplierId(s.id); setSuppSearch(s.name); }}
                options={suppliers as any[]}
              />
            </div>
          </div>

          {/* Row 2: Supplier Inv No, Supplier Inv Date, Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <div>
              <label className={LABEL}>Supplier Invoice No.</label>
              <input value={supInvNo} onChange={e => setSupInvNo(e.target.value)}
                className={INPUT} placeholder="e.g. SI-2024-001" />
            </div>
            <div>
              <label className={LABEL}>Supplier Invoice Date</label>
              <DatePicker value={supInvDate} onChange={setSupInvDate} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                className={INPUT} placeholder="Additional notes…" />
            </div>
          </div>

          {/* ── Items Table ── */}
          <div className="mb-4">
            <div className="text-sm font-bold text-gray-700 mb-2">Items</div>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full border-collapse text-xs" style={{ minWidth: 920 }}>
                <thead>
                  <tr style={{ background: SC.primary }}>
                    <th className="px-2 py-2.5 text-center text-white font-semibold w-8">#</th>
                    <th className="px-2 py-2.5 text-left text-white font-semibold" style={{ minWidth: 160 }}>Item / Description</th>
                    <th className="px-2 py-2.5 text-center text-white font-semibold w-16">HSN</th>
                    <th className="px-2 py-2.5 text-center text-white font-semibold w-14">UOM</th>
                    <th className="px-2 py-2.5 text-right text-white font-semibold w-16">Qty</th>
                    <th className="px-2 py-2.5 text-right text-white font-semibold w-20">Rate</th>
                    <th className="px-2 py-2.5 text-right text-white font-semibold w-22">Taxable</th>
                    <th className="px-2 py-2.5 text-center text-white font-semibold w-14">CGST%</th>
                    <th className="px-2 py-2.5 text-right text-white font-semibold w-20">CGST ₹</th>
                    <th className="px-2 py-2.5 text-center text-white font-semibold w-14">SGST%</th>
                    <th className="px-2 py-2.5 text-right text-white font-semibold w-20">SGST ₹</th>
                    <th className="px-2 py-2.5 text-center text-white font-semibold w-14">IGST%</th>
                    <th className="px-2 py-2.5 text-right text-white font-semibold w-20">IGST ₹</th>
                    <th className="px-2 py-2.5 text-right text-white font-semibold w-24">Amount</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row, idx) => {
                    const filtItems = (products as any[]).filter((p: any) =>
                      !itemSearch[row._key] ||
                      p.name?.toLowerCase().includes((itemSearch[row._key] || "").toLowerCase()) ||
                      p.code?.toLowerCase().includes((itemSearch[row._key] || "").toLowerCase())
                    );
                    return (
                      <tr key={row._key} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                        <td className="border-b border-gray-100 px-2 py-1 text-center text-gray-400">{idx + 1}</td>

                        {/* Item search */}
                        <td className={`${cellIn} relative`}>
                          <input
                            value={itemSearch[row._key] ?? row.item_name}
                            onChange={e => {
                              setItemSearch(p => ({ ...p, [row._key]: e.target.value }));
                              updateRow(row._key, "item_name", e.target.value);
                              setItemDropOpen(row._key);
                            }}
                            onFocus={() => setItemDropOpen(row._key)}
                            onBlur={() => setTimeout(() => setItemDropOpen(null), 180)}
                            className={inpCls} placeholder="Search item…"
                          />
                          {itemDropOpen === row._key && filtItems.length > 0 && (
                            <div className="absolute z-40 left-0 top-full bg-white border border-gray-200 rounded-lg shadow-xl w-60 max-h-40 overflow-auto">
                              {filtItems.slice(0, 20).map((p: any) => (
                                <div key={p.id} onMouseDown={() => selectItem(row._key, p)}
                                  className="px-2.5 py-1.5 hover:bg-[#d2f1fa] cursor-pointer text-xs">
                                  <span className="font-medium text-gray-800">{p.name}</span>
                                  {p.code && <span className="text-gray-400 ml-1">{p.code}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>

                        <td className={cellIn}>
                          <input value={row.hsn} onChange={e => updateRow(row._key, "hsn", e.target.value)}
                            className={`${inpCls} text-center`} />
                        </td>
                        <td className={cellIn}>
                          <input value={row.unit} onChange={e => updateRow(row._key, "unit", e.target.value.toUpperCase())}
                            className={`${inpCls} text-center uppercase`} />
                        </td>
                        <td className={cellIn}>
                          <input type="number" value={row.qty} onChange={e => updateRow(row._key, "qty", e.target.value)}
                            className={`${inpCls} text-right`} />
                        </td>
                        <td className={cellIn}>
                          <input type="number" value={row.rate} onChange={e => updateRow(row._key, "rate", e.target.value)}
                            className={`${inpCls} text-right`} />
                        </td>
                        <td className={cellRO}>{row.taxable_amount ? parseFloat(row.taxable_amount).toFixed(2) : ""}</td>
                        <td className={cellIn}>
                          <input type="number" value={row.cgst_rate} onChange={e => updateRow(row._key, "cgst_rate", e.target.value)}
                            className={`${inpCls} text-center`} />
                        </td>
                        <td className={cellRO}>{row.cgst_amount ? parseFloat(row.cgst_amount).toFixed(2) : ""}</td>
                        <td className={cellIn}>
                          <input type="number" value={row.sgst_rate} onChange={e => updateRow(row._key, "sgst_rate", e.target.value)}
                            className={`${inpCls} text-center`} />
                        </td>
                        <td className={cellRO}>{row.sgst_amount ? parseFloat(row.sgst_amount).toFixed(2) : ""}</td>
                        <td className={cellIn}>
                          <input type="number" value={row.igst_rate} onChange={e => updateRow(row._key, "igst_rate", e.target.value)}
                            className={`${inpCls} text-center`} />
                        </td>
                        <td className={cellRO}>{row.igst_amount ? parseFloat(row.igst_amount).toFixed(2) : ""}</td>
                        <td className="border-b border-gray-100 px-1.5 py-1 text-right font-bold text-gray-800 tabular-nums text-xs">
                          {row.amount ? parseFloat(row.amount).toFixed(2) : ""}
                        </td>
                        <td className="border-b border-gray-100 px-1 text-center">
                          <button onClick={() => setItems(p => p.filter(r => r._key !== row._key))}
                            className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <button onClick={() => setItems(p => [...p, newRow()])}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-semibold mb-6 transition-colors hover:bg-[#d2f1fa]"
            style={{ color: SC.primary, borderColor: SC.primary }}>
            <Plus size={13} /> Add Row
          </button>

          {/* ── Totals Summary ── */}
          <div className="flex justify-end">
            <div className="w-full sm:w-80 rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-4 py-2 border-b border-gray-100 flex justify-between text-sm">
                <span className="text-gray-500">Taxable Amount</span>
                <span className="font-semibold tabular-nums">₹ {fmtAmt(totTaxable)}</span>
              </div>
              {totCgst > 0 && (
                <div className="px-4 py-2 border-b border-gray-100 flex justify-between text-sm">
                  <span className="text-gray-500">CGST</span>
                  <span className="tabular-nums">₹ {fmtAmt(totCgst)}</span>
                </div>
              )}
              {totSgst > 0 && (
                <div className="px-4 py-2 border-b border-gray-100 flex justify-between text-sm">
                  <span className="text-gray-500">SGST</span>
                  <span className="tabular-nums">₹ {fmtAmt(totSgst)}</span>
                </div>
              )}
              {totIgst > 0 && (
                <div className="px-4 py-2 border-b border-gray-100 flex justify-between text-sm">
                  <span className="text-gray-500">IGST</span>
                  <span className="tabular-nums">₹ {fmtAmt(totIgst)}</span>
                </div>
              )}
              <div className="px-4 py-3 flex justify-between text-sm font-bold" style={{ background: SC.tonal, color: SC.primary }}>
                <span>Total Amount</span>
                <span className="tabular-nums">₹ {fmtAmt(totAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── List ─────────────────────────────────────────────────────────── */
export default function ProcessInward() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [view, setView]         = useState<"list" | "form">("list");
  const [editData, setEditData] = useState<any>(null);
  const [search, setSearch]     = useState("");

  const { data: records = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/process-inward"] });

  const delMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/process-inward/${id}`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/process-inward"] }); toast({ title: "Deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function printRecord(id: string) {
    const doc = await fetch(`/api/process-inward/${id}`, { credentials: "include" }).then(r => r.json());
    const w = window.open("", "_blank");
    if (w) { w.document.write(buildProcessInwardHTML(doc)); w.document.close(); setTimeout(() => w.print(), 600); }
  }

  function openNew() { setEditData(null); setView("form"); }
  async function openEdit(r: any) {
    try {
      const full = await fetch(`/api/process-inward/${r.id}`, { credentials: "include" }).then(res => res.json());
      setEditData(full);
    } catch {
      setEditData(r);
    }
    setView("form");
  }
  function back() { setEditData(null); setView("list"); qc.invalidateQueries({ queryKey: ["/api/process-inward"] }); }

  if (view === "form") return <PiForm editData={editData} onBack={back} />;

  const filtered = (records as any[]).filter((r: any) =>
    !search ||
    r.voucher_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.supplier_invoice_no?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "Source Sans Pro, sans-serif", background: SC.bg }}>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b bg-white gap-3">
        <div>
          <div className="text-xl font-bold" style={{ color: SC.primary }}>Process Inward</div>
          <div className="text-xs text-gray-400 mt-0.5">Supplier invoices for process / calibration services</div>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-bold self-start sm:self-auto"
          style={{ background: SC.orange }}>
          <Plus size={15} /> New Entry
        </button>
      </div>

      {/* Search */}
      <div className="px-5 py-3 bg-white border-b">
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#027fa5]"
            placeholder="Search invoice no, supplier…" />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto p-4 sm:p-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <div className="w-7 h-7 rounded-full animate-spin mr-3"
              style={{ border: "3px solid #d2f1fa", borderTopColor: SC.primary }} />
            Loading…
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ background: SC.primary }}>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white">Invoice No.</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white">Supplier</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white hidden md:table-cell">Supplier Inv No.</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-white hidden lg:table-cell">Amount ₹</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white hidden lg:table-cell">Payment</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-white">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-14 text-gray-400">No records found</td></tr>
                  ) : filtered.map((r: any, idx: number) => (
                    <tr key={r.id}
                      className={`border-t border-gray-50 hover:bg-[#f0f9ff] transition-colors ${idx % 2 === 0 ? "" : "bg-gray-50/30"}`}>
                      <td className="px-4 py-2.5 font-bold text-sm" style={{ color: SC.primary }}>{r.voucher_no}</td>
                      <td className="px-4 py-2.5 text-gray-700">{fmtDate(r.inward_date)}</td>
                      <td className="px-4 py-2.5 text-gray-800">{r.supplier_name || "—"}</td>
                      <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell">{r.supplier_invoice_no || "—"}</td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums hidden lg:table-cell">
                        {r.total_amount ? `₹ ${fmtAmt(r.total_amount)}` : "—"}
                      </td>
                      <td className="px-4 py-2.5 hidden lg:table-cell">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          r.payment_mode === "Credit"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-green-50 text-green-700"
                        }`}>
                          {r.payment_mode || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => printRecord(r.id)} title="Print Invoice"
                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-blue-50 text-[#027fa5] transition-colors">
                            <Printer size={14} />
                          </button>
                          <button onClick={() => openEdit(r)} title="Edit"
                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-orange-50 text-orange-500 transition-colors">
                            <PencilLine size={14} />
                          </button>
                          <button onClick={() => { if (confirm("Delete this entry?")) delMut.mutate(r.id); }}
                            title="Delete"
                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-50 text-red-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
