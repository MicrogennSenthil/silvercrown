import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Search, Edit2, FileText, X, CheckCircle } from "lucide-react";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700" };
const today = () => new Date().toISOString().slice(0, 10);
const p2 = (v: any) => parseFloat(v) || 0;
const n2 = (v: any) => Number(v || 0).toFixed(2);

interface GrrItem {
  sno: number;
  item_code: string;
  item_name: string;
  stock: number;
  grn_qty: number;
  return_qty: number;
  unit: string;
  rate: number;
  taxable_amt: number;
  cgst_pct: number; cgst_amt: number;
  sgst_pct: number; sgst_amt: number;
  igst_pct: number; igst_amt: number;
  total: number;
}

interface GrrForm {
  return_date: string;
  store_id: string;
  supplier_id: string;
  supplier_name: string;
  grn_id: string;
  grn_no: string;
  grn_date: string;
  remark: string;
  status: string;
  items: GrrItem[];
}

const blankForm = (): GrrForm => ({
  return_date: today(), store_id: "", supplier_id: "", supplier_name: "",
  grn_id: "", grn_no: "", grn_date: "", remark: "", status: "Draft", items: [],
});

function calcItem(it: GrrItem): GrrItem {
  const taxable_amt = p2(it.return_qty) * p2(it.rate);
  const cgst_amt    = taxable_amt * p2(it.cgst_pct) / 100;
  const sgst_amt    = taxable_amt * p2(it.sgst_pct) / 100;
  const igst_amt    = taxable_amt * p2(it.igst_pct) / 100;
  const total       = taxable_amt + cgst_amt + sgst_amt + igst_amt;
  return { ...it, taxable_amt, cgst_amt, sgst_amt, igst_amt, total };
}

export default function GoodsReceiptReturn() {
  const qc = useQueryClient();
  const [mode, setMode]     = useState<"list"|"form">("list");
  const [editId, setEditId] = useState<string|null>(null);
  const [form, setForm]     = useState<GrrForm>(blankForm());
  const [grrNo, setGrrNo]   = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  const { data: grrs = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/goods-receipt-returns"] });
  const { data: warehouses = [] }      = useQuery<any[]>({ queryKey: ["/api/warehouses"] });
  const { data: grns = [] }            = useQuery<any[]>({ queryKey: ["/api/goods-receipt-notes"] });
  const { data: allProducts = [] }     = useQuery<any[]>({ queryKey: ["/api/products"] });

  // Totals
  const totalQty     = form.items.reduce((s, it) => s + p2(it.return_qty), 0);
  const taxableTotal = form.items.reduce((s, it) => s + p2(it.taxable_amt), 0);
  const cgstTotal    = form.items.reduce((s, it) => s + p2(it.cgst_amt), 0);
  const sgstTotal    = form.items.reduce((s, it) => s + p2(it.sgst_amt), 0);
  const igstTotal    = form.items.reduce((s, it) => s + p2(it.igst_amt), 0);
  const grandTotal   = taxableTotal + cgstTotal + sgstTotal + igstTotal;

  const filtered = (grrs as any[]).filter((g: any) => {
    if (!search) return true;
    return [g.voucher_no, g.supplier_name, g.grn_no, g.store_name, g.status].join(" ").toLowerCase().includes(search.toLowerCase());
  });

  function openNew() {
    setForm(blankForm()); setEditId(null); setErr(""); setGrrNo(""); setMode("form");
    fetch("/api/voucher-series/next/goods_receipt_return", { credentials: "include" })
      .then(r => r.json()).then(d => { if (d.voucher_no) setGrrNo(d.voucher_no); });
  }

  async function openEdit(grr: any) {
    setGrrNo(grr.voucher_no || "");
    const r = await fetch(`/api/goods-receipt-returns/${grr.id}`, { credentials: "include" });
    const data = await r.json();
    setForm({
      return_date: data.return_date?.slice(0,10) || today(),
      store_id: data.store_id || "", supplier_id: data.supplier_id || "",
      supplier_name: data.supplier_name || "", grn_id: data.grn_id || "",
      grn_no: data.grn_no || "", grn_date: data.grn_date?.slice(0,10) || "",
      remark: data.remark || "", status: data.status || "Draft",
      items: (data.items || []).map((it: any, i: number) => calcItem({
        sno: i+1, item_code: it.item_code||"", item_name: it.item_name||"",
        stock: p2(it.stock), grn_qty: p2(it.grn_qty), return_qty: p2(it.return_qty),
        unit: it.unit||"Nos", rate: p2(it.rate),
        taxable_amt: p2(it.taxable_amt), cgst_pct: p2(it.cgst_pct), cgst_amt: p2(it.cgst_amt),
        sgst_pct: p2(it.sgst_pct), sgst_amt: p2(it.sgst_amt), igst_pct: p2(it.igst_pct), igst_amt: p2(it.igst_amt), total: p2(it.total),
      })),
    });
    setEditId(grr.id); setErr(""); setMode("form");
  }

  // Select a GRN and load its items
  async function selectGrn(grn: any) {
    if (form.grn_id === grn.id) {
      // Deselect
      setForm(f => ({ ...f, grn_id: "", grn_no: "", grn_date: "", supplier_id: "", supplier_name: "", store_id: "", items: [] }));
      return;
    }
    try {
      const r = await fetch(`/api/goods-receipt-notes/${grn.id}`, { credentials: "include" });
      const data = await r.json();
      const stockMap: Record<string, number> = {};
      (allProducts as any[]).forEach((p: any) => { stockMap[p.code] = p2(p.current_stock); });
      const items: GrrItem[] = (data.items || []).map((it: any, i: number) => calcItem({
        sno: i+1, item_code: it.item_code||"", item_name: it.item_name||"",
        stock: stockMap[it.item_code] ?? 0, grn_qty: p2(it.qty), return_qty: p2(it.qty), // default return = full qty
        unit: it.unit||"Nos", rate: p2(it.rate),
        taxable_amt: 0, cgst_pct: p2(it.cgst_pct), cgst_amt: 0,
        sgst_pct: p2(it.sgst_pct), sgst_amt: 0, igst_pct: p2(it.igst_pct), igst_amt: 0, total: 0,
      }));
      setForm(f => ({
        ...f, grn_id: grn.id, grn_no: grn.voucher_no, grn_date: grn.grn_date?.slice(0,10)||"",
        supplier_id: grn.supplier_id||"", supplier_name: grn.supplier_name||grn.supplier_name_manual||"",
        store_id: grn.store_id||"", items,
      }));
    } catch (e) { console.error(e); }
  }

  function updItem(i: number, key: keyof GrrItem, val: any) {
    setForm(f => {
      const items = [...f.items];
      items[i] = calcItem({ ...items[i], [key]: val });
      return { ...f, items };
    });
  }

  async function handleSave() {
    setErr(""); setSaving(true);
    const payload = { ...form, total_qty: totalQty, taxable_amount: taxableTotal, cgst_amount: cgstTotal, sgst_amount: sgstTotal, igst_amount: igstTotal, grand_total: grandTotal };
    const url = editId ? `/api/goods-receipt-returns/${editId}` : "/api/goods-receipt-returns";
    const method = editId ? "PATCH" : "POST";
    try {
      const r = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) { const d = await r.json(); setErr(d.message || "Save failed"); return; }
      qc.invalidateQueries({ queryKey: ["/api/goods-receipt-returns"] });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      setMode("list");
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this return? Stock will be restored.")) return;
    await fetch(`/api/goods-receipt-returns/${id}`, { method: "DELETE", credentials: "include" });
    qc.invalidateQueries({ queryKey: ["/api/goods-receipt-returns"] });
    qc.invalidateQueries({ queryKey: ["/api/products"] });
  }

  const statusColor: Record<string, string> = {
    Draft: "bg-gray-100 text-gray-600", Posted: "bg-green-100 text-green-700", Cancelled: "bg-red-100 text-red-700",
  };

  // ── List ──────────────────────────────────────────────────────────────────
  if (mode === "list") return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Goods Receipt Return</h1>
          <p className="text-sm text-gray-500">Return goods to supplier against a GRN</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg text-white"
          style={{ background: SC.primary }} data-testid="btn-new-grr">
          <Plus size={15}/> New Return
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#027fa5]"
            placeholder="Search GRR No, Supplier, GRN…" data-testid="input-search"/>
        </div>
        <span className="text-xs text-gray-400">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            <FileText size={32} className="mx-auto mb-2 opacity-30"/>
            No receipt returns yet. Click "New Return" to create one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ background: "#e8f6fb" }}>
                {["GRR No", "Date", "GRN No", "Supplier", "Store", "Total ₹", "Status", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((g: any) => (
                <tr key={g.id} className="border-b hover:bg-[#f0f9ff] transition-colors">
                  <td className="px-4 py-3 font-semibold" style={{ color: SC.primary }}>{g.voucher_no}</td>
                  <td className="px-4 py-3 text-gray-600">{g.return_date?.slice(0,10)}</td>
                  <td className="px-4 py-3 text-gray-600">{g.grn_no || "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{g.supplier_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{g.store_name || "—"}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">₹ {n2(g.grand_total)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[g.status] || "bg-gray-100 text-gray-600"}`}>{g.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(g)} className="text-[#027fa5] hover:text-[#025f80]" data-testid={`btn-edit-${g.id}`}><Edit2 size={14}/></button>
                      <button onClick={() => handleDelete(g.id)} className="text-red-400 hover:text-red-600" data-testid={`btn-del-${g.id}`}><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode("list")} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Receipt Return Note</h1>
            <p className="text-xs text-gray-400">{editId ? `Editing ${grrNo}` : "New return against a GRN"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMode("list")} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: SC.orange }} data-testid="btn-save-grr">
            {saving ? "Saving…" : editId ? "Update" : "Save"}
          </button>
        </div>
      </div>

      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">{err}</div>}

      {/* Header + GRN selector */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium">Receipt Return No</label>
              <input readOnly value={grrNo || "Loading…"}
                className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2.5 text-sm font-semibold"
                style={{ color: grrNo ? SC.primary : "#9ca3af" }} data-testid="input-grr-no"/>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Receipt Return Date</label>
              <DatePicker value={form.return_date} onChange={v => setForm(f => ({ ...f, return_date: v }))}/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium">Store</label>
              <input readOnly value={(warehouses as any[]).find((w: any) => w.id === form.store_id)?.name || (form.store_id ? "—" : "Auto from GRN")}
                className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2.5 text-sm text-gray-700"/>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Supplier Name</label>
              <input readOnly value={form.supplier_name || "Auto from GRN"}
                className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2.5 text-sm text-gray-700"/>
            </div>
          </div>
          {form.grn_no && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle size={13}/> GRN <span className="font-semibold">{form.grn_no}</span> selected — {form.items.length} item{form.items.length !== 1 ? "s" : ""} loaded
            </div>
          )}
        </div>

        {/* Right — GRN selector */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Select GRN to Return Against</div>
          <div className="overflow-y-auto max-h-40 border border-gray-100 rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Receipt No</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Receipt Date</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Supplier</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600">Select</th>
                </tr>
              </thead>
              <tbody>
                {(grns as any[]).length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400">No GRNs found</td></tr>
                ) : (grns as any[]).map((grn: any) => {
                  const sel = form.grn_id === grn.id;
                  return (
                    <tr key={grn.id} className={`border-b cursor-pointer ${sel ? "bg-[#e8f6fb]" : "hover:bg-gray-50"}`}
                      onClick={() => selectGrn(grn)}>
                      <td className="px-3 py-2 font-semibold" style={{ color: SC.primary }}>{grn.voucher_no}</td>
                      <td className="px-3 py-2 text-gray-600">{grn.grn_date?.slice(0,10)}</td>
                      <td className="px-3 py-2 text-gray-600 truncate max-w-[100px]">{grn.supplier_name || "—"}</td>
                      <td className="px-3 py-2 text-center">
                        <div className={`inline-flex w-4 h-4 rounded border-2 items-center justify-center mx-auto ${sel ? "border-[#d74700] bg-[#d74700]" : "border-gray-300"}`}>
                          {sel && <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 text-white fill-white"><path d="M1 5l3 3 5-5"/></svg>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Items grid */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b" style={{ background: "#e8f6fb" }}>
                {["S.no","Item Code","Item Name","Stock","GRN Qty","Return Qty","Unit","Rate ₹","Taxable ₹","CGST%","CGST ₹","SGST%","SGST ₹","IGST%","IGST ₹","Total ₹"].map(h => (
                  <th key={h} className="px-2 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.items.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-4 py-8 text-center text-gray-400 text-xs">
                    Select a GRN from the panel above to load its items
                  </td>
                </tr>
              ) : form.items.map((it, i) => (
                <tr key={i} className="border-b hover:bg-[#f0f9ff]">
                  <td className="px-2 py-1.5 text-gray-500 text-center w-8">{it.sno}</td>
                  <td className="px-1 py-1">
                    <input readOnly value={it.item_code}
                      className="border border-gray-200 bg-gray-50 rounded px-2 py-1.5 w-20 text-xs text-gray-600"/>
                  </td>
                  <td className="px-1 py-1">
                    <input readOnly value={it.item_name}
                      className="border border-gray-200 bg-gray-50 rounded px-2 py-1.5 w-36 text-xs text-gray-700"/>
                  </td>
                  {/* Stock */}
                  <td className="px-2 py-1 text-right text-gray-600 w-12 tabular-nums">{it.stock}</td>
                  {/* GRN Qty */}
                  <td className="px-2 py-1 text-right text-gray-600 w-14 tabular-nums">{it.grn_qty}</td>
                  {/* Return Qty — editable, capped at grn_qty */}
                  <td className="px-1 py-1">
                    <input type="number" step="0.001" value={it.return_qty || ""}
                      onChange={e => {
                        const v = Math.min(parseFloat(e.target.value)||0, it.grn_qty);
                        updItem(i, "return_qty", v);
                      }}
                      className="border-2 border-[#027fa5] rounded px-2 py-1.5 w-16 outline-none focus:border-[#d74700] text-xs text-right font-semibold"
                      data-testid={`input-rqty-${i}`}/>
                  </td>
                  <td className="px-1 py-1">
                    <input readOnly value={it.unit} className="border border-gray-200 bg-gray-50 rounded px-2 py-1.5 w-12 text-xs text-center"/>
                  </td>
                  <td className="px-2 py-1 text-right text-gray-600 tabular-nums">{n2(it.rate)}</td>
                  <td className="px-2 py-1 text-right text-gray-700 font-medium tabular-nums">{n2(it.taxable_amt)}</td>
                  <td className="px-1 py-1 text-center text-gray-500">{it.cgst_pct}%</td>
                  <td className="px-2 py-1 text-right text-gray-600 tabular-nums">{n2(it.cgst_amt)}</td>
                  <td className="px-1 py-1 text-center text-gray-500">{it.sgst_pct}%</td>
                  <td className="px-2 py-1 text-right text-gray-600 tabular-nums">{n2(it.sgst_amt)}</td>
                  <td className="px-1 py-1 text-center text-gray-500">{it.igst_pct ? `${it.igst_pct}%` : "—"}</td>
                  <td className="px-2 py-1 text-right text-gray-600 tabular-nums">{it.igst_pct ? n2(it.igst_amt) : "—"}</td>
                  <td className="px-2 py-1 text-right font-semibold text-gray-800 tabular-nums">{n2(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary row */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t bg-gray-50">
          <span className="text-xs text-gray-600">
            Total Quantity : <span className="font-bold text-gray-800">{totalQty}</span>
          </span>
          <div className="flex items-center gap-6 text-xs text-gray-600">
            <span>Taxable: <span className="font-semibold">₹ {n2(taxableTotal)}</span></span>
            <span>CGST: <span className="font-semibold">₹ {n2(cgstTotal)}</span></span>
            <span>SGST: <span className="font-semibold">₹ {n2(sgstTotal)}</span></span>
            <span>IGST: <span className="font-semibold">₹ {n2(igstTotal)}</span></span>
            <span className="text-sm font-bold text-gray-800">Total Amount : ₹ {n2(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Remark + Status */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <label className="text-xs text-gray-500 font-medium block mb-1">Remark</label>
          <textarea value={form.remark} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))}
            rows={2} placeholder="Reason for return…"
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-[#027fa5] resize-none"
            data-testid="textarea-remark"/>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <label className="text-xs text-gray-500 font-medium block mb-2">Status</label>
          <div className="flex gap-4">
            {["Draft", "Posted", "Cancelled"].map(s => (
              <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" checked={form.status === s} onChange={() => setForm(f => ({ ...f, status: s }))}
                  className="accent-[#027fa5]" data-testid={`radio-status-${s.toLowerCase()}`}/>
                <span className={form.status === s ? "font-semibold" : "text-gray-500"}>{s}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
