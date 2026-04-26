import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Search, Edit2, FileText, X } from "lucide-react";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700", bg: "#f5f0ed" };

const today = () => new Date().toISOString().slice(0, 10);
const n2 = (v: any) => Number(v || 0).toFixed(2);

interface SrnItem {
  sno: number;
  item_code: string;
  item_name: string;
  qty: number;
  stock: number;
  unit: string;
  rate: number;
  amount: number;
}
interface SrnForm {
  request_date: string;
  store_id: string;
  required_before: string;
  status: string;
  remark: string;
  items: SrnItem[];
}

const blankItem = (): SrnItem => ({ sno: 1, item_code: "", item_name: "", qty: 0, stock: 0, unit: "Nos", rate: 0, amount: 0 });
const blankForm = (): SrnForm => ({
  request_date: today(), store_id: "", required_before: "", status: "Draft", remark: "", items: [blankItem()],
});

function calcItem(it: SrnItem): SrnItem {
  return { ...it, amount: +(it.qty * it.rate).toFixed(2) };
}

export default function StoreRequestNote() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<SrnForm>(blankForm());
  const [srnNo, setSrnNo] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [itemSearch, setItemSearch] = useState<Record<number, string>>({});
  const [itemDropOpen, setItemDropOpen] = useState<number | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const { data: srns = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/store-request-notes"] });
  const { data: warehouses = [] } = useQuery<any[]>({ queryKey: ["/api/warehouses"] });
  const { data: allProducts = [] } = useQuery<any[]>({ queryKey: ["/api/products"] });

  const products = (allProducts as any[]).filter((p: any) => p.is_active !== false);

  useEffect(() => {
    function h(e: MouseEvent) {
      if (!tableRef.current?.contains(e.target as Node)) setItemDropOpen(null);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const totalQty = form.items.reduce((s, it) => s + (+it.qty || 0), 0);
  const grandTotal = form.items.reduce((s, it) => s + (+it.amount || 0), 0);

  const filtered = (srns as any[]).filter((s: any) => {
    if (!search) return true;
    return [s.voucher_no, s.store_name, s.status, String(s.grand_total || "")].join(" ").toLowerCase().includes(search.toLowerCase());
  });

  function openNew() {
    setForm(blankForm()); setEditId(null); setErr(""); setSrnNo(""); setMode("form");
    fetch("/api/voucher-series/next/store_request", { credentials: "include" })
      .then(r => r.json()).then(d => { if (d.voucher_no) setSrnNo(d.voucher_no); });
  }

  async function openEdit(srn: any) {
    setSrnNo(srn.voucher_no || "");
    const r = await fetch(`/api/store-request-notes/${srn.id}`, { credentials: "include" });
    const data = await r.json();
    const items = (data.items || []).map((it: any, i: number) => ({
      sno: i + 1, item_code: it.item_code || "", item_name: it.item_name || "",
      qty: +it.qty || 0, stock: +it.stock || 0, unit: it.unit || "Nos", rate: +it.rate || 0, amount: +it.amount || 0,
    }));
    setForm({
      request_date: data.request_date?.slice(0, 10) || today(),
      store_id: data.store_id || "",
      required_before: data.required_before?.slice(0, 10) || "",
      status: data.status || "Draft",
      remark: data.remark || "",
      items: items.length > 0 ? items : [blankItem()],
    });
    setEditId(srn.id); setErr(""); setMode("form");
  }

  function updItem(i: number, key: keyof SrnItem, val: any) {
    setForm(f => {
      const items = [...f.items];
      items[i] = calcItem({ ...items[i], [key]: val });
      return { ...f, items };
    });
  }

  function addItem() {
    setForm(f => ({ ...f, items: [...f.items, { ...blankItem(), sno: f.items.length + 1 }] }));
  }

  function removeItem(i: number) {
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, sno: idx + 1 })) }));
  }

  function pickProduct(i: number, prod: any) {
    const rate = parseFloat(prod.purchase_price) || parseFloat(prod.cost_price) || 0;
    const stock = parseFloat(prod.current_stock) || parseFloat(prod.opening_stock) || 0;
    setForm(f => {
      const items = [...f.items];
      items[i] = calcItem({ ...items[i], item_code: prod.code || "", item_name: prod.name || "", unit: prod.uom || prod.unit || "Nos", rate, stock });
      return { ...f, items };
    });
    setItemSearch(p => ({ ...p, [i]: prod.name }));
    setItemDropOpen(null);
  }

  async function handleSave() {
    setErr(""); setSaving(true);
    const payload = { ...form, total_qty: totalQty, grand_total: grandTotal, items: form.items };
    const url = editId ? `/api/store-request-notes/${editId}` : "/api/store-request-notes";
    const method = editId ? "PATCH" : "POST";
    try {
      const r = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) { const d = await r.json(); setErr(d.message || "Save failed"); return; }
      qc.invalidateQueries({ queryKey: ["/api/store-request-notes"] });
      setMode("list");
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this Store Request Note?")) return;
    await fetch(`/api/store-request-notes/${id}`, { method: "DELETE", credentials: "include" });
    qc.invalidateQueries({ queryKey: ["/api/store-request-notes"] });
  }

  const statusColor: Record<string, string> = {
    Draft: "bg-gray-100 text-gray-600",
    Approved: "bg-green-100 text-green-700",
    Rejected: "bg-red-100 text-red-700",
    Issued: "bg-blue-100 text-blue-700",
  };

  // ── List ──
  if (mode === "list") return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Store Request Note</h1>
          <p className="text-sm text-gray-500">Request raw materials from the store</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg text-white"
          style={{ background: SC.primary }} data-testid="btn-new-srn">
          <Plus size={15}/> New Request
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#027fa5]"
            placeholder="Search SRN No, Store, Status…" data-testid="input-search"/>
        </div>
        <span className="text-xs text-gray-400">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            <FileText size={32} className="mx-auto mb-2 opacity-30"/>
            No store request notes yet. Click "New Request" to create one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ background: "#e8f6fb" }}>
                {["SRN No", "Date", "Store", "Req. Before", "Items", "Total ₹", "Status", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s: any) => (
                <tr key={s.id} className="border-b hover:bg-[#f0f9ff] transition-colors">
                  <td className="px-4 py-3 font-semibold" style={{ color: SC.primary }}>{s.voucher_no}</td>
                  <td className="px-4 py-3 text-gray-600">{s.request_date?.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-gray-700">{s.store_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{s.required_before?.slice(0, 10) || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">—</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">₹ {n2(s.grand_total)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[s.status] || "bg-gray-100 text-gray-600"}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(s)} className="text-[#027fa5] hover:text-[#025f80]"
                        data-testid={`btn-edit-${s.id}`}><Edit2 size={14}/></button>
                      <button onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-600"
                        data-testid={`btn-del-${s.id}`}><Trash2 size={14}/></button>
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

  // ── Form ──
  return (
    <div className="p-6 space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode("list")} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              {editId ? `Edit SRN — ${srnNo}` : "New Store Request Note"}
            </h1>
            <p className="text-xs text-gray-400">Request materials from store inventory</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMode("list")}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: SC.primary }} data-testid="btn-save-srn">
            {saving ? "Saving…" : editId ? "Update" : "Save"}
          </button>
        </div>
      </div>

      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">{err}</div>}

      {/* Header fields */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-gray-500 font-medium">GR No</label>
            <input readOnly value={srnNo || "Loading…"}
              className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2.5 text-sm font-semibold"
              style={{ color: srnNo ? SC.primary : "#9ca3af" }}
              data-testid="input-srn-no"/>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">GRN Date</label>
            <DatePicker value={form.request_date} onChange={v => setForm(f => ({ ...f, request_date: v }))}/>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Store</label>
            <select value={form.store_id} onChange={e => setForm(f => ({ ...f, store_id: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
              data-testid="select-store">
              <option value="">Select Store</option>
              {(warehouses as any[]).map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Required Before</label>
            <DatePicker value={form.required_before} onChange={v => setForm(f => ({ ...f, required_before: v }))}/>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <div className="overflow-x-auto" ref={tableRef}>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b" style={{ background: "#e8f6fb" }}>
                {["S.no", "Item Code", "Item Name", "Qty", "Stock", "Unit", "Rate ₹", "Amount ₹", ""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.items.map((it, i) => (
                <tr key={i} className="border-b hover:bg-[#f0f9ff]">
                  <td className="px-3 py-1.5 text-gray-500 text-center w-8">{it.sno}</td>

                  {/* Item Code — read-only auto-filled */}
                  <td className="px-1 py-1">
                    <input readOnly value={it.item_code}
                      className="border border-gray-200 bg-gray-50 rounded px-2 py-1.5 w-24 text-xs text-gray-600"/>
                  </td>

                  {/* Item Name — searchable dropdown */}
                  <td className="px-1 py-1 relative">
                    <div className="relative w-44">
                      <input
                        value={itemDropOpen === i ? (itemSearch[i] ?? it.item_name) : it.item_name}
                        onFocus={() => { setItemDropOpen(i); setItemSearch(p => ({ ...p, [i]: it.item_name })); }}
                        onChange={e => { setItemSearch(p => ({ ...p, [i]: e.target.value })); setItemDropOpen(i); }}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 outline-none focus:border-[#027fa5] text-xs pr-6"
                        placeholder="Search item…"
                        data-testid={`input-item-${i}`}
                      />
                      <Search size={10} className="absolute right-1.5 top-2.5 text-gray-400 pointer-events-none"/>
                    </div>
                    {itemDropOpen === i && (() => {
                      const q = (itemSearch[i] ?? "").toLowerCase();
                      const opts = products.filter((p: any) => !q || p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q));
                      return opts.length > 0 ? (
                        <div className="absolute z-50 left-1 top-full mt-0.5 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto text-xs">
                          {opts.map((p: any) => (
                            <div key={p.id} onMouseDown={() => pickProduct(i, p)}
                              className="px-3 py-2 hover:bg-[#e8f6fb] cursor-pointer flex justify-between items-center">
                              <span className="font-medium text-gray-800">{p.name}</span>
                              <span className="text-gray-400 text-[10px]">{p.code}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="absolute z-50 left-1 top-full mt-0.5 w-56 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs text-gray-400">
                          No items found
                        </div>
                      );
                    })()}
                  </td>

                  {/* Qty */}
                  <td className="px-1 py-1">
                    <input type="number" value={it.qty || ""}
                      onChange={e => updItem(i, "qty", parseFloat(e.target.value) || 0)}
                      className="border border-gray-300 rounded px-2 py-1.5 w-16 outline-none focus:border-[#027fa5] text-xs text-right"
                      data-testid={`input-qty-${i}`}/>
                  </td>

                  {/* Stock — read-only */}
                  <td className="px-2 py-1 text-right text-gray-600 w-14">
                    <span className={it.stock < it.qty && it.qty > 0 ? "text-red-500 font-semibold" : ""}>{it.stock}</span>
                  </td>

                  {/* Unit */}
                  <td className="px-1 py-1">
                    <input value={it.unit} onChange={e => updItem(i, "unit", e.target.value)}
                      className="border border-gray-200 rounded px-2 py-1.5 w-14 outline-none focus:border-[#027fa5] text-xs"/>
                  </td>

                  {/* Rate */}
                  <td className="px-1 py-1">
                    <input type="number" value={it.rate || ""}
                      onChange={e => updItem(i, "rate", parseFloat(e.target.value) || 0)}
                      className="border border-gray-300 rounded px-2 py-1.5 w-20 outline-none focus:border-[#027fa5] text-xs text-right"/>
                  </td>

                  {/* Amount */}
                  <td className="px-2 py-1 text-right font-semibold text-gray-800 w-20">{n2(it.amount)}</td>

                  {/* Delete */}
                  <td className="px-2 py-1">
                    <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600"
                      data-testid={`btn-del-item-${i}`}><Trash2 size={12}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add row + summary */}
        <div className="flex items-center justify-between px-3 py-2 border-t bg-gray-50">
          <button onClick={addItem}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded hover:bg-[#d2f1fa] transition-colors"
            style={{ color: SC.primary }} data-testid="btn-add-item">
            <Plus size={12}/> Add Item
          </button>
          <div className="flex items-center gap-8 text-xs text-gray-600">
            <span>Total Quantity : <span className="font-bold text-gray-800">{totalQty}</span></span>
            <span>Grand Total : <span className="font-bold text-gray-800 text-sm">₹ {n2(grandTotal)}</span></span>
          </div>
        </div>
      </div>

      {/* Remark + Status */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <label className="text-xs text-gray-500 font-medium block mb-1">Remark</label>
          <textarea value={form.remark} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))}
            rows={3} placeholder="Optional remark…"
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-[#027fa5] resize-none"
            data-testid="textarea-remark"/>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <label className="text-xs text-gray-500 font-medium block mb-2">Status</label>
          <div className="flex flex-wrap gap-3">
            {["Draft", "Approved", "Issued", "Rejected"].map(s => (
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
