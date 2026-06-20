import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Printer, PencilLine, Search, ChevronDown, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import DatePicker from "@/components/DatePicker";
import { buildProcessOutwardHTML } from "@/lib/printProcessOutward";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

function today() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtNum(v: any, dp = 2) {
  const n = parseFloat(v || 0);
  return n.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

const INPUT = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#027fa5] focus:ring-1 focus:ring-[#027fa5]/20 bg-white";
const LABEL = "block text-xs font-semibold text-gray-500 mb-1";

type PoItem = {
  _key: string;
  customer_id: string; customer_name: string;
  item_id: string; item_code: string; item_name: string;
  drawing_no: string; hsn: string;
  process_nature: string; bill_ref: string;
  qty: string; unit: string;
};

function newRow(): PoItem {
  return {
    _key: crypto.randomUUID(),
    customer_id: "", customer_name: "",
    item_id: "", item_code: "", item_name: "",
    drawing_no: "", hsn: "", process_nature: "",
    bill_ref: "", qty: "", unit: "",
  };
}

/* ── SearchCombo: reusable searchable dropdown ──────────────────────── */
function SearchCombo({
  value, onChange, onSelect, options, placeholder, display,
  keyFn, labelFn, sublabelFn,
}: {
  value: string; onChange: (v: string) => void; onSelect: (item: any) => void;
  options: any[]; placeholder: string; display: string;
  keyFn: (o: any) => string; labelFn: (o: any) => string; sublabelFn?: (o: any) => string;
}) {
  const [open, setOpen] = useState(false);
  const filtered = options.filter(o =>
    !value || labelFn(o).toLowerCase().includes(value.toLowerCase())
  );
  return (
    <div className="relative">
      <div className={`${INPUT} flex items-center gap-1 cursor-text`}>
        <input
          value={display || value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 180)}
          placeholder={placeholder}
          className="flex-1 outline-none bg-transparent text-sm min-w-0"
        />
        <ChevronDown size={13} className="text-gray-300 flex-shrink-0" />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute z-40 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-auto mt-0.5">
          {filtered.slice(0, 30).map(o => (
            <div key={keyFn(o)} onMouseDown={() => { onSelect(o); setOpen(false); }}
              className="px-3 py-2 hover:bg-[#d2f1fa] cursor-pointer text-sm">
              <div className="font-medium text-gray-800">{labelFn(o)}</div>
              {sublabelFn && <div className="text-xs text-gray-400">{sublabelFn(o)}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Form ──────────────────────────────────────────────────────────── */
function PoForm({ editData, onBack }: { editData?: any; onBack: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!editData?.id;

  const { data: suppliers  = [] } = useQuery<any[]>({ queryKey: ["/api/suppliers"] });
  const { data: products   = [] } = useQuery<any[]>({ queryKey: ["/api/products"] });
  const { data: customers  = [] } = useQuery<any[]>({ queryKey: ["/api/customers"] });
  const { data: processes  = [] } = useQuery<any[]>({ queryKey: ["/api/processes"] });

  const [voucherNo,     setVoucherNo]     = useState(editData?.voucher_no || "");
  const [outwardDate,   setOutwardDate]   = useState(editData?.outward_date?.split("T")[0] || today());
  const [supplierId,    setSupplierId]    = useState(editData?.supplier_id || "");
  const [suppSearch,    setSuppSearch]    = useState(editData?.supplier_name || "");
  const [vehicleNo,     setVehicleNo]     = useState(editData?.vehicle_no || "");
  const [purpose,       setPurpose]       = useState(editData?.purpose || "");
  const [notes,         setNotes]         = useState(editData?.notes || "");
  const [isReturnable,  setIsReturnable]  = useState<boolean>(editData?.is_returnable === true);

  const [items, setItems] = useState<PoItem[]>(
    editData?.items?.length
      ? editData.items.map((it: any) => ({
          _key: crypto.randomUUID(),
          customer_id: it.customer_id || "",
          customer_name: it.customer_ref || "",
          ...it,
          qty: String(it.qty || ""),
        }))
      : [newRow()]
  );

  const [itemSearch,    setItemSearch]    = useState<Record<string, string>>({});
  const [itemDropOpen,  setItemDropOpen]  = useState<string | null>(null);
  const [custSearch,    setCustSearch]    = useState<Record<string, string>>({});
  const [custDropOpen,  setCustDropOpen]  = useState<string | null>(null);
  const [procSearch,    setProcSearch]    = useState<Record<string, string>>({});
  const [procDropOpen,  setProcDropOpen]  = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit && !voucherNo) {
      fetch("/api/voucher-series/next/process_outward", { credentials: "include" })
        .then(r => r.json()).then(d => { if (d.voucher_no) setVoucherNo(d.voucher_no); }).catch(() => {});
    }
  }, [isEdit, voucherNo]);

  function updateRow(key: string, field: keyof PoItem, val: string) {
    setItems(prev => prev.map(r => r._key === key ? { ...r, [field]: val } : r));
  }

  function selectItem(key: string, item: any) {
    setItems(prev => prev.map(r => r._key === key ? {
      ...r,
      item_id: item.id, item_code: item.code, item_name: item.name,
      hsn: item.hsnCode || item.hsn_code || r.hsn,
      unit: (item.uom || item.unit || r.unit || "").toUpperCase(),
    } : r));
    setItemSearch(prev => ({ ...prev, [key]: item.name }));
    setItemDropOpen(null);
  }

  function selectProcess(key: string, proc: any) {
    setItems(prev => prev.map(r => r._key === key
      ? { ...r, process_nature: proc.name }
      : r
    ));
    setProcSearch(prev => ({ ...prev, [key]: proc.name }));
    setProcDropOpen(null);
  }

  function selectCustomer(key: string, cust: any) {
    setItems(prev => prev.map(r => r._key === key
      ? { ...r, customer_id: cust.id, customer_name: cust.name }
      : r
    ));
    setCustSearch(prev => ({ ...prev, [key]: cust.name }));
    setCustDropOpen(null);
  }

  const totalQty = items.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        outward_date: outwardDate,
        supplier_id: supplierId || null,
        supplier_name_manual: !supplierId ? suppSearch : "",
        vehicle_no: vehicleNo, purpose, notes,
        is_returnable: isReturnable,
        items: items.filter(r => r.item_name || r.qty).map(r => ({
          item_id: r.item_id || null, item_code: r.item_code, item_name: r.item_name,
          customer_ref: r.customer_name,
          drawing_no: r.drawing_no, hsn: r.hsn,
          process_nature: r.process_nature, bill_ref: r.bill_ref,
          qty: parseFloat(r.qty) || 0, unit: r.unit,
        })),
      };
      if (isEdit) return apiRequest("PATCH", `/api/process-outward/${editData.id}`, payload);
      return apiRequest("POST", "/api/process-outward", payload);
    },
    onSuccess: async (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/process-outward"] });
      toast({ title: isEdit ? "Updated" : "Saved", description: `${data.voucher_no} saved.` });
      if (!isEdit && confirm(`${data.voucher_no} saved. Print DC now?`)) {
        const full = await fetch(`/api/process-outward/${data.id}`, { credentials: "include" }).then(r => r.json());
        const w = window.open("", "_blank");
        if (w) { w.document.write(buildProcessOutwardHTML(full)); w.document.close(); setTimeout(() => w.print(), 600); }
      }
      onBack();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-3 sm:p-5" style={{ background: SC.bg, minHeight: "100%", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100">

        {/* ── Header bar ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b border-gray-100 gap-3">
          <div>
            <div className="text-lg font-bold" style={{ color: SC.primary }}>
              {isEdit ? "Edit Process Outward" : "New Process Outward"}
            </div>
            <div className="text-xs text-gray-400 mt-0.5">DC for items sent for testing / calibration / plating</div>
          </div>
          {/* Returnable toggle only in header */}
          <button
            type="button"
            onClick={() => setIsReturnable(p => !p)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
              isReturnable
                ? "border-green-400 bg-green-50 text-green-700"
                : "border-gray-300 bg-white text-gray-500"
            }`}
          >
            <RotateCcw size={14} className={isReturnable ? "text-green-600" : "text-gray-400"} />
            {isReturnable ? "Returnable" : "Non-Returnable"}
          </button>
        </div>

        {/* ── Body ── */}
        <div className="p-5">

          {/* Row 1: DC No, Date, Supplier, Vehicle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className={LABEL}>DC No.</label>
              <input value={voucherNo} readOnly
                className={`${INPUT} bg-gray-50 font-bold`}
                style={{ color: SC.primary }} />
            </div>
            <div>
              <label className={LABEL}>Date *</label>
              <DatePicker value={outwardDate} onChange={setOutwardDate} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Supplier / Agency *</label>
              <SearchCombo
                value={suppSearch}
                display={suppSearch}
                onChange={v => { setSuppSearch(v); setSupplierId(""); }}
                onSelect={s => { setSupplierId(s.id); setSuppSearch(s.name); }}
                options={suppliers as any[]}
                placeholder="Search supplier…"
                keyFn={s => s.id}
                labelFn={s => s.name}
                sublabelFn={s => s.gstin || ""}
              />
            </div>
            <div>
              <label className={LABEL}>Vehicle No.</label>
              <input value={vehicleNo} onChange={e => setVehicleNo(e.target.value)}
                className={INPUT} placeholder="TN 12 AB 3456" />
            </div>
          </div>

          {/* Row 2: Purpose, Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label className={LABEL}>Purpose</label>
              <input value={purpose} onChange={e => setPurpose(e.target.value)}
                className={INPUT} placeholder="Testing / Calibration / Plating / etc." />
            </div>
            <div>
              <label className={LABEL}>Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)}
                className={INPUT} placeholder="Additional notes…" />
            </div>
          </div>

          {/* ── Items Table ── */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-700">Items</span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full border-collapse" style={{ minWidth: 860 }}>
                <thead>
                  <tr style={{ background: SC.primary }}>
                    <th className="px-2 py-2.5 text-center text-white text-xs font-semibold w-8">#</th>
                    <th className="px-2 py-2.5 text-left text-white text-xs font-semibold" style={{ minWidth: 150 }}>Customer</th>
                    <th className="px-2 py-2.5 text-left text-white text-xs font-semibold" style={{ minWidth: 160 }}>Item / Description</th>
                    <th className="px-2 py-2.5 text-left text-white text-xs font-semibold w-24">Drawing No</th>
                    <th className="px-2 py-2.5 text-left text-white text-xs font-semibold w-16">HSN</th>
                    <th className="px-2 py-2.5 text-left text-white text-xs font-semibold" style={{ minWidth: 140 }}>Process / Nature</th>
                    <th className="px-2 py-2.5 text-left text-white text-xs font-semibold w-24">Bill / Ref No</th>
                    <th className="px-2 py-2.5 text-center text-white text-xs font-semibold w-14">UOM</th>
                    <th className="px-2 py-2.5 text-right text-white text-xs font-semibold w-20">Qty</th>
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
                    const filtCusts = (customers as any[]).filter((c: any) =>
                      !custSearch[row._key] ||
                      c.name?.toLowerCase().includes((custSearch[row._key] || "").toLowerCase())
                    );
                    const filtProcs = (processes as any[]).filter((p: any) =>
                      !procSearch[row._key] ||
                      p.name?.toLowerCase().includes((procSearch[row._key] || "").toLowerCase())
                    );
                    const cellCls = "border-b border-gray-100 px-1.5 py-1 align-middle";
                    const inpCls  = "w-full px-1.5 py-1 text-xs border border-transparent rounded focus:outline-none focus:border-[#027fa5] bg-transparent";
                    return (
                      <tr key={row._key} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                        <td className={`${cellCls} text-center text-gray-400 text-xs`}>{idx + 1}</td>

                        {/* Customer combo */}
                        <td className={`${cellCls} relative`}>
                          <div className="flex items-center gap-1">
                            <input
                              value={custSearch[row._key] ?? row.customer_name}
                              onChange={e => {
                                setCustSearch(p => ({ ...p, [row._key]: e.target.value }));
                                updateRow(row._key, "customer_name", e.target.value);
                                updateRow(row._key, "customer_id", "");
                                setCustDropOpen(row._key);
                              }}
                              onFocus={() => setCustDropOpen(row._key)}
                              onBlur={() => setTimeout(() => setCustDropOpen(null), 200)}
                              className={inpCls} placeholder="Select customer…"
                            />
                            <ChevronDown size={10} className="text-gray-300 flex-shrink-0" />
                          </div>
                          {custDropOpen === row._key && (
                            <div className="absolute z-50 left-0 top-full mt-0.5 bg-white border border-[#027fa5]/30 rounded-xl shadow-2xl overflow-hidden"
                              style={{ minWidth: 260 }}>
                              {filtCusts.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-gray-400 italic">No customers match</div>
                              ) : (
                                <div className="max-h-52 overflow-auto">
                                  {filtCusts.slice(0, 25).map((c: any) => (
                                    <div key={c.id} onMouseDown={() => selectCustomer(row._key, c)}
                                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#d2f1fa] cursor-pointer border-b border-gray-50 last:border-0 transition-colors">
                                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                                        style={{ background: SC.primary }}>
                                        {c.name?.charAt(0).toUpperCase()}
                                      </div>
                                      <span className="text-sm font-semibold text-gray-800">{c.name}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Item search */}
                        <td className={`${cellCls} relative`}>
                          <input
                            value={itemSearch[row._key] ?? row.item_name}
                            onChange={e => {
                              setItemSearch(p => ({ ...p, [row._key]: e.target.value }));
                              updateRow(row._key, "item_name", e.target.value);
                              setItemDropOpen(row._key);
                            }}
                            onFocus={() => setItemDropOpen(row._key)}
                            onBlur={() => setTimeout(() => setItemDropOpen(null), 200)}
                            className={inpCls} placeholder="Search item…"
                          />
                          {itemDropOpen === row._key && (
                            <div className="absolute z-50 left-0 top-full mt-0.5 bg-white border border-[#027fa5]/30 rounded-xl shadow-2xl overflow-hidden"
                              style={{ minWidth: 300 }}>
                              {filtItems.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-gray-400 italic">No items match</div>
                              ) : (
                                <div className="max-h-56 overflow-auto">
                                  {filtItems.slice(0, 25).map((p: any) => (
                                    <div key={p.id} onMouseDown={() => selectItem(row._key, p)}
                                      className="px-4 py-2.5 hover:bg-[#d2f1fa] cursor-pointer border-b border-gray-50 last:border-0 transition-colors">
                                      <div className="text-sm font-semibold text-gray-800">{p.name}</div>
                                      <div className="flex items-center gap-3 mt-0.5">
                                        {p.code && <span className="text-xs text-[#027fa5] font-mono font-semibold">{p.code}</span>}
                                        {(p.hsnCode || p.hsn_code) && <span className="text-xs text-gray-400">HSN: {p.hsnCode || p.hsn_code}</span>}
                                        {p.uom && <span className="text-xs text-gray-400">{p.uom}</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        <td className={cellCls}>
                          <input value={row.drawing_no} onChange={e => updateRow(row._key, "drawing_no", e.target.value)}
                            className={inpCls} />
                        </td>
                        <td className={cellCls}>
                          <input value={row.hsn} onChange={e => updateRow(row._key, "hsn", e.target.value)}
                            className={inpCls} />
                        </td>
                        {/* Process / Nature combo */}
                        <td className={`${cellCls} relative`}>
                          <div className="flex items-center gap-1">
                            <input
                              value={procSearch[row._key] ?? row.process_nature}
                              onChange={e => {
                                setProcSearch(p => ({ ...p, [row._key]: e.target.value }));
                                updateRow(row._key, "process_nature", e.target.value);
                                setProcDropOpen(row._key);
                              }}
                              onFocus={() => setProcDropOpen(row._key)}
                              onBlur={() => setTimeout(() => setProcDropOpen(null), 200)}
                              className={inpCls} placeholder="Select process…"
                            />
                            <ChevronDown size={10} className="text-gray-300 flex-shrink-0" />
                          </div>
                          {procDropOpen === row._key && (
                            <div className="absolute z-50 left-0 top-full mt-0.5 bg-white border border-[#027fa5]/30 rounded-xl shadow-2xl overflow-hidden"
                              style={{ minWidth: 240 }}>
                              {filtProcs.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-gray-400 italic">No processes match</div>
                              ) : (
                                <div className="max-h-52 overflow-auto">
                                  {filtProcs.map((p: any) => (
                                    <div key={p.id} onMouseDown={() => selectProcess(row._key, p)}
                                      className="px-4 py-2.5 hover:bg-[#d2f1fa] cursor-pointer border-b border-gray-50 last:border-0 transition-colors">
                                      <div className="text-sm font-semibold text-gray-800">{p.name}</div>
                                      {p.code && <div className="text-xs text-[#027fa5] font-mono mt-0.5">{p.code}</div>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className={cellCls}>
                          <input value={row.bill_ref} onChange={e => updateRow(row._key, "bill_ref", e.target.value)}
                            className={inpCls} />
                        </td>
                        <td className={cellCls}>
                          <input value={row.unit} onChange={e => updateRow(row._key, "unit", e.target.value.toUpperCase())}
                            className={`${inpCls} text-center uppercase`} />
                        </td>
                        <td className={cellCls}>
                          <input type="number" value={row.qty} onChange={e => updateRow(row._key, "qty", e.target.value)}
                            className={`${inpCls} text-right`} />
                        </td>
                        <td className={`${cellCls} text-center`}>
                          <button onClick={() => setItems(p => p.filter(r => r._key !== row._key))}
                            className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: SC.tonal }}>
                    <td colSpan={8} className="px-3 py-2 text-right text-xs font-bold text-gray-700">Total Qty</td>
                    <td className="px-3 py-2 text-right text-xs font-bold text-gray-900">{fmtNum(totalQty, 3)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <button onClick={() => setItems(p => [...p, newRow()])}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors hover:bg-[#d2f1fa]"
            style={{ color: SC.primary, borderColor: SC.primary }}>
            <Plus size={13} /> Add Row
          </button>
        </div>

        {/* ── Bottom action bar ── */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/60 rounded-b-xl">
          <button onClick={onBack}
            className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
            className="px-7 py-2.5 rounded-lg text-sm font-bold text-white flex items-center gap-2 disabled:opacity-60 transition-colors shadow-sm"
            style={{ background: SC.orange }}>
            {saveMut.isPending
              ? <><div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />Saving…</>
              : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── List ─────────────────────────────────────────────────────────── */
export default function ProcessOutward() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "form">("list");
  const [editData, setEditData] = useState<any>(null);
  const [search, setSearch] = useState("");

  const { data: records = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/process-outward"] });

  const delMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/process-outward/${id}`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/process-outward"] }); toast({ title: "Deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function printRecord(id: string) {
    const doc = await fetch(`/api/process-outward/${id}`, { credentials: "include" }).then(r => r.json());
    const w = window.open("", "_blank");
    if (w) { w.document.write(buildProcessOutwardHTML(doc)); w.document.close(); setTimeout(() => w.print(), 600); }
  }

  function openNew()        { setEditData(null); setView("form"); }
  function openEdit(r: any) { setEditData(r);    setView("form"); }
  function back()           { setEditData(null); setView("list"); qc.invalidateQueries({ queryKey: ["/api/process-outward"] }); }

  if (view === "form") return <PoForm editData={editData} onBack={back} />;

  const filtered = (records as any[]).filter((r: any) =>
    !search ||
    r.voucher_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.purpose?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "Source Sans Pro, sans-serif", background: SC.bg }}>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 border-b bg-white gap-3">
        <div>
          <div className="text-xl font-bold" style={{ color: SC.primary }}>Process Outward</div>
          <div className="text-xs text-gray-400 mt-0.5">DC for items sent for testing / calibration</div>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-bold self-start sm:self-auto"
          style={{ background: SC.orange }}>
          <Plus size={15} /> New Entry
        </button>
      </div>

      {/* Search bar */}
      <div className="px-5 py-3 bg-white border-b">
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#027fa5]"
            placeholder="Search DC no, supplier, purpose…" />
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white">DC No.</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white">Supplier / Agency</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white hidden sm:table-cell">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white hidden md:table-cell">Purpose</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white hidden lg:table-cell">Vehicle No</th>
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
                      <td className="px-4 py-2.5 text-gray-700">{fmtDate(r.outward_date)}</td>
                      <td className="px-4 py-2.5 text-gray-800">{r.supplier_name || "—"}</td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        {r.is_returnable
                          ? <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-green-50 text-green-700 border border-green-200">Returnable</span>
                          : <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-500">Non-Returnable</span>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 hidden md:table-cell">{r.purpose || "—"}</td>
                      <td className="px-4 py-2.5 text-gray-400 hidden lg:table-cell">{r.vehicle_no || "—"}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => printRecord(r.id)} title="Print DC"
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
