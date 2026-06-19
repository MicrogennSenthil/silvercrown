import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Printer, PencilLine, Search } from "lucide-react";
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
  return { _key: crypto.randomUUID(), outward_item_id: "", item_id: "", item_code: "",
           item_name: "", hsn: "", qty: "", unit: "", rate: "",
           taxable_amount: "", cgst_rate: "", sgst_rate: "", igst_rate: "",
           cgst_amount: "", sgst_amount: "", igst_amount: "", amount: "" };
}

function calcRow(row: PiItem): PiItem {
  const qty   = parseFloat(row.qty)        || 0;
  const rate  = parseFloat(row.rate)       || 0;
  const cgstR = parseFloat(row.cgst_rate)  || 0;
  const sgstR = parseFloat(row.sgst_rate)  || 0;
  const igstR = parseFloat(row.igst_rate)  || 0;
  const taxable = qty * rate;
  const cgst    = (taxable * cgstR) / 100;
  const sgst    = (taxable * sgstR) / 100;
  const igst    = (taxable * igstR) / 100;
  const amount  = taxable + cgst + sgst + igst;
  return {
    ...row,
    taxable_amount: taxable.toFixed(2),
    cgst_amount:    cgst.toFixed(2),
    sgst_amount:    sgst.toFixed(2),
    igst_amount:    igst.toFixed(2),
    amount:         amount.toFixed(2),
  };
}

// ── Form ──────────────────────────────────────────────────────────────────────
function PiForm({ editData, onBack }: { editData?: any; onBack: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!editData?.id;

  const { data: suppliers  = [] } = useQuery<any[]>({ queryKey: ["/api/suppliers"] });
  const { data: outwards   = [] } = useQuery<any[]>({ queryKey: ["/api/process-outward"] });
  const { data: glAccounts = [] } = useQuery<any[]>({ queryKey: ["/api/general-ledgers"] });
  const { data: products   = [] } = useQuery<any[]>({ queryKey: ["/api/products"] });

  const [voucherNo,    setVoucherNo]    = useState(editData?.voucher_no || "");
  const [inwardDate,   setInwardDate]   = useState(editData?.inward_date?.split("T")[0] || today());
  const [outwardId,    setOutwardId]    = useState(editData?.outward_id || "");
  const [outwardOpen,  setOutwardOpen]  = useState(false);
  const [supplierId,   setSupplierId]   = useState(editData?.supplier_id || "");
  const [suppSearch,   setSuppSearch]   = useState(editData?.supplier_name || "");
  const [suppOpen,     setSuppOpen]     = useState(false);
  const [supInvNo,     setSupInvNo]     = useState(editData?.supplier_invoice_no || "");
  const [supInvDate,   setSupInvDate]   = useState(editData?.supplier_invoice_date?.split("T")[0] || "");
  const [payMode,      setPayMode]      = useState(editData?.payment_mode || "Credit");
  const [payAccId,     setPayAccId]     = useState(editData?.payment_account_id || "");
  const [expenseGlId,  setExpenseGlId]  = useState(editData?.expense_gl_id || "");
  const [notes,        setNotes]        = useState(editData?.notes || "");
  const [items,        setItems]        = useState<PiItem[]>(
    editData?.items?.length
      ? editData.items.map((it: any) => ({ _key: crypto.randomUUID(), ...it,
          qty: String(it.qty||""), rate: String(it.rate||""),
          taxable_amount: String(it.taxable_amount||""),
          cgst_rate: String(it.cgst_rate||""), sgst_rate: String(it.sgst_rate||""),
          igst_rate: String(it.igst_rate||""),
          cgst_amount: String(it.cgst_amount||""), sgst_amount: String(it.sgst_amount||""),
          igst_amount: String(it.igst_amount||""), amount: String(it.amount||"") }))
      : [newRow()]
  );
  const [itemSearch,   setItemSearch]   = useState<Record<string, string>>({});
  const [itemDropOpen, setItemDropOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit && !voucherNo) {
      fetch("/api/voucher-series/next/process_inward", { credentials: "include" })
        .then(r => r.json()).then(d => { if (d.voucher_no) setVoucherNo(d.voucher_no); }).catch(() => {});
    }
  }, [isEdit, voucherNo]);

  // When outward is selected, prefill supplier
  function selectOutward(o: any) {
    setOutwardId(o.id);
    if (o.supplier_id) { setSupplierId(o.supplier_id); setSuppSearch(o.supplier_name || ""); }
    setOutwardOpen(false);
  }

  const filteredSuppliers = (suppliers as any[]).filter((s: any) =>
    !suppSearch || s.name.toLowerCase().includes(suppSearch.toLowerCase())
  );

  const bankCashGLs = (glAccounts as any[]).filter((gl: any) =>
    gl.glType === "bank" || gl.glType === "cash" || gl.gl_type === "bank" || gl.gl_type === "cash"
  );
  const expenseGLs  = (glAccounts as any[]).filter((gl: any) =>
    gl.glType === "expense" || gl.gl_type === "expense" ||
    gl.glType === "other"   || gl.gl_type === "other"
  );

  const selectedOutward = (outwards as any[]).find((o: any) => o.id === outwardId);

  function updateRow(key: string, field: keyof PiItem, val: string) {
    setItems(prev => prev.map(r => r._key === key
      ? calcRow({ ...r, [field]: val })
      : r
    ));
  }

  function selectItem(key: string, item: any) {
    setItems(prev => prev.map(r => r._key === key
      ? calcRow({ ...r, item_id: item.id, item_code: item.code, item_name: item.name,
                  hsn: item.hsn_code || r.hsn, unit: (item.unit || item.uom || r.unit || "").toUpperCase() })
      : r
    ));
    setItemSearch(prev => ({ ...prev, [key]: item.name }));
    setItemDropOpen(null);
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

  const th = "border border-gray-400 px-2 py-1.5 text-center text-xs font-semibold bg-gray-100";
  const td = "border border-gray-300 px-1 py-0.5";

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="flex items-center justify-between px-6 py-3 border-b" style={{ background: SC.tonal }}>
        <div>
          <div className="text-lg font-bold" style={{ color: SC.primary }}>Process Inward</div>
          <div className="text-xs text-gray-500">Record supplier invoice + post accounts</div>
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} className="px-4 py-1.5 rounded border text-sm bg-white">Cancel</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
            className="px-4 py-1.5 rounded text-sm font-semibold text-white" style={{ background: SC.orange }}>
            {saveMut.isPending ? "Saving…" : "Save & Post"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Header */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-xs font-semibold text-gray-600">Invoice No.</label>
            <input value={voucherNo} readOnly className="w-full border rounded px-2 py-1 text-sm bg-gray-50 font-semibold" style={{ color: SC.primary }} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Date *</label>
            <DatePicker value={inwardDate} onChange={setInwardDate} className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          {/* Against DC */}
          <div className="relative">
            <label className="text-xs font-semibold text-gray-600">Against DC (Process Outward)</label>
            <button onClick={() => setOutwardOpen(p => !p)}
              className="w-full border rounded px-2 py-1 text-sm text-left flex items-center justify-between bg-white">
              <span>{selectedOutward ? selectedOutward.voucher_no : "Select DC…"}</span>
              <Search size={12} className="text-gray-400" />
            </button>
            {outwardOpen && (
              <div className="absolute z-30 bg-white border rounded shadow-lg w-full max-h-48 overflow-auto mt-0.5">
                <div className="px-2 py-1 text-xs text-gray-400">Select Process Outward DC</div>
                {(outwards as any[]).map((o: any) => (
                  <div key={o.id} className="px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-xs"
                    onClick={() => selectOutward(o)}>
                    <span className="font-semibold">{o.voucher_no}</span> — {o.supplier_name} ({fmtDate(o.outward_date)})
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* Supplier */}
          <div className="relative">
            <label className="text-xs font-semibold text-gray-600">Supplier *</label>
            <input value={suppSearch} onChange={e => { setSuppSearch(e.target.value); setSuppOpen(true); setSupplierId(""); }}
              onFocus={() => setSuppOpen(true)} onBlur={() => setTimeout(() => setSuppOpen(false), 200)}
              className="w-full border rounded px-2 py-1 text-sm" placeholder="Search supplier…" />
            {suppOpen && filteredSuppliers.length > 0 && (
              <div className="absolute z-30 bg-white border rounded shadow-lg w-full max-h-48 overflow-auto mt-0.5">
                {filteredSuppliers.slice(0, 30).map((s: any) => (
                  <div key={s.id} className="px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-sm"
                    onMouseDown={() => { setSupplierId(s.id); setSuppSearch(s.name); setSuppOpen(false); }}>
                    {s.name}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Supplier Invoice No.</label>
            <input value={supInvNo} onChange={e => setSupInvNo(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Supplier Invoice Date</label>
            <DatePicker value={supInvDate} onChange={setSupInvDate} className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Expense GL Account</label>
            <select value={expenseGlId} onChange={e => setExpenseGlId(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm">
              <option value="">— select expense account —</option>
              {expenseGLs.map((gl: any) => (
                <option key={gl.id} value={gl.id}>{gl.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Payment Mode</label>
            <select value={payMode} onChange={e => setPayMode(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm">
              <option value="Credit">Credit (Book as payable)</option>
              <option value="Cash">Cash</option>
              <option value="Bank">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
            </select>
          </div>
          {payMode !== "Credit" && (
            <div>
              <label className="text-xs font-semibold text-gray-600">Bank / Cash Account</label>
              <select value={payAccId} onChange={e => setPayAccId(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm">
                <option value="">— select account —</option>
                {bankCashGLs.map((gl: any) => (
                  <option key={gl.id} value={gl.id}>{gl.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-gray-600">Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
        </div>

        {/* Items */}
        <div className="overflow-x-auto rounded border mb-3">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className={th} style={{ width: 32 }}>#</th>
                <th className={th} style={{ minWidth: 140 }}>Item / Service Description</th>
                <th className={th} style={{ width: 60 }}>HSN</th>
                <th className={th} style={{ width: 50 }}>UOM</th>
                <th className={th} style={{ width: 70 }}>Qty</th>
                <th className={th} style={{ width: 80 }}>Rate</th>
                <th className={th} style={{ width: 85 }}>Taxable Amt</th>
                <th className={th} style={{ width: 60 }}>CGST%</th>
                <th className={th} style={{ width: 75 }}>CGST Amt</th>
                <th className={th} style={{ width: 60 }}>SGST%</th>
                <th className={th} style={{ width: 75 }}>SGST Amt</th>
                <th className={th} style={{ width: 60 }}>IGST%</th>
                <th className={th} style={{ width: 75 }}>IGST Amt</th>
                <th className={th} style={{ width: 85 }}>Amount</th>
                <th className={th} style={{ width: 30 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, idx) => {
                const filtItems = (products as any[]).filter((p: any) =>
                  !itemSearch[row._key] || p.name.toLowerCase().includes((itemSearch[row._key] || "").toLowerCase()) ||
                  p.code.toLowerCase().includes((itemSearch[row._key] || "").toLowerCase())
                );
                return (
                  <tr key={row._key} className="hover:bg-blue-50">
                    <td className={`${td} text-center text-gray-400`}>{idx + 1}</td>
                    <td className={`${td} relative`}>
                      <input value={itemSearch[row._key] ?? row.item_name}
                        onChange={e => { setItemSearch(p => ({ ...p, [row._key]: e.target.value })); updateRow(row._key, "item_name", e.target.value); setItemDropOpen(row._key); }}
                        onFocus={() => setItemDropOpen(row._key)} onBlur={() => setTimeout(() => setItemDropOpen(null), 200)}
                        className="w-full px-1 py-0.5 text-xs border-0 focus:outline-none bg-transparent" placeholder="Search item…" />
                      {itemDropOpen === row._key && filtItems.length > 0 && (
                        <div className="absolute z-30 bg-white border rounded shadow-lg left-0 top-full w-56 max-h-40 overflow-auto">
                          {filtItems.slice(0, 20).map((p: any) => (
                            <div key={p.id} className="px-2 py-1 hover:bg-blue-50 cursor-pointer text-xs" onMouseDown={() => selectItem(row._key, p)}>
                              {p.name} <span className="text-gray-400">{p.code}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className={td}><input value={row.hsn} onChange={e => updateRow(row._key, "hsn", e.target.value)} className="w-full px-1 text-xs border-0 focus:outline-none bg-transparent" /></td>
                    <td className={td}><input value={row.unit} onChange={e => updateRow(row._key, "unit", e.target.value.toUpperCase())} className="w-full px-1 text-xs border-0 focus:outline-none bg-transparent text-center" /></td>
                    <td className={td}><input type="number" value={row.qty} onChange={e => updateRow(row._key, "qty", e.target.value)} className="w-full px-1 text-xs border-0 focus:outline-none bg-transparent text-right" /></td>
                    <td className={td}><input type="number" value={row.rate} onChange={e => updateRow(row._key, "rate", e.target.value)} className="w-full px-1 text-xs border-0 focus:outline-none bg-transparent text-right" /></td>
                    <td className={`${td} text-right text-gray-600`}>{row.taxable_amount ? parseFloat(row.taxable_amount).toFixed(2) : ""}</td>
                    <td className={td}><input type="number" value={row.cgst_rate} onChange={e => updateRow(row._key, "cgst_rate", e.target.value)} className="w-full px-1 text-xs border-0 focus:outline-none bg-transparent text-center" /></td>
                    <td className={`${td} text-right text-gray-600`}>{row.cgst_amount ? parseFloat(row.cgst_amount).toFixed(2) : ""}</td>
                    <td className={td}><input type="number" value={row.sgst_rate} onChange={e => updateRow(row._key, "sgst_rate", e.target.value)} className="w-full px-1 text-xs border-0 focus:outline-none bg-transparent text-center" /></td>
                    <td className={`${td} text-right text-gray-600`}>{row.sgst_amount ? parseFloat(row.sgst_amount).toFixed(2) : ""}</td>
                    <td className={td}><input type="number" value={row.igst_rate} onChange={e => updateRow(row._key, "igst_rate", e.target.value)} className="w-full px-1 text-xs border-0 focus:outline-none bg-transparent text-center" /></td>
                    <td className={`${td} text-right text-gray-600`}>{row.igst_amount ? parseFloat(row.igst_amount).toFixed(2) : ""}</td>
                    <td className={`${td} text-right font-semibold`}>{row.amount ? parseFloat(row.amount).toFixed(2) : ""}</td>
                    <td className={`${td} text-center`}>
                      <button onClick={() => setItems(p => p.filter(r => r._key !== row._key))} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <button onClick={() => setItems(p => [...p, newRow()])}
          className="flex items-center gap-1 text-xs px-3 py-1 rounded border mb-4"
          style={{ color: SC.primary, borderColor: SC.primary }}>
          <Plus size={13} /> Add Row
        </button>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-72 border rounded bg-white text-xs">
            <div className="flex justify-between px-3 py-1.5 border-b"><span className="text-gray-600">Taxable Amount</span><span className="font-semibold">{fmtAmt(totTaxable)}</span></div>
            {totCgst > 0 && <div className="flex justify-between px-3 py-1.5 border-b"><span className="text-gray-600">CGST</span><span>{fmtAmt(totCgst)}</span></div>}
            {totSgst > 0 && <div className="flex justify-between px-3 py-1.5 border-b"><span className="text-gray-600">SGST</span><span>{fmtAmt(totSgst)}</span></div>}
            {totIgst > 0 && <div className="flex justify-between px-3 py-1.5 border-b"><span className="text-gray-600">IGST</span><span>{fmtAmt(totIgst)}</span></div>}
            <div className="flex justify-between px-3 py-2 font-bold" style={{ color: SC.primary }}>
              <span>Total Amount</span><span>{fmtAmt(totAmount)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── List ──────────────────────────────────────────────────────────────────────
export default function ProcessInward() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "form">("list");
  const [editData, setEditData] = useState<any>(null);
  const [search, setSearch] = useState("");

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
  function openEdit(r: any) { setEditData(r); setView("form"); }
  function back() { setEditData(null); setView("list"); qc.invalidateQueries({ queryKey: ["/api/process-inward"] }); }

  if (view === "form") return <PiForm editData={editData} onBack={back} />;

  const filtered = (records as any[]).filter((r: any) =>
    !search || r.voucher_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.supplier_invoice_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.outward_voucher_no?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "Source Sans Pro, sans-serif", background: SC.bg }}>
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white">
        <div>
          <div className="text-xl font-bold" style={{ color: SC.primary }}>Process Inward</div>
          <div className="text-xs text-gray-500">Supplier invoice for testing/calibration services</div>
        </div>
        <button onClick={openNew} className="flex items-center gap-1 px-4 py-2 rounded text-white text-sm font-semibold"
          style={{ background: SC.orange }}>
          <Plus size={15} /> New Entry
        </button>
      </div>

      <div className="px-6 py-3 bg-white border-b">
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border rounded text-sm" placeholder="Search invoice, supplier, DC no…" />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: SC.tonal }}>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Invoice No.</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Supplier</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Supp. Invoice No.</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Against DC</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Payment</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">Total Amount</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-400">No records found</td></tr>
                ) : filtered.map((r: any) => (
                  <tr key={r.id} className="border-t hover:bg-blue-50">
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
                    <td className="px-3 py-2 text-right font-semibold">{fmtAmt(r.total_amount)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => printRecord(r.id)} title="Print Invoice"
                          className="p-1 rounded hover:bg-blue-100 text-blue-600"><Printer size={14} /></button>
                        <button onClick={() => openEdit(r)} title="Edit"
                          className="p-1 rounded hover:bg-orange-100 text-orange-600"><PencilLine size={14} /></button>
                        <button onClick={() => { if (confirm("Delete this entry?")) delMut.mutate(r.id); }}
                          title="Delete" className="p-1 rounded hover:bg-red-100 text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
