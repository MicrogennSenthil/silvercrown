import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Search, Edit2, FileText, X, TrendingDown, TrendingUp, Minus, Info, AlertTriangle, CheckCircle } from "lucide-react";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700" };
const today = () => new Date().toISOString().slice(0, 10);
const n3 = (v: any) => Number(v || 0).toFixed(3);

// Fixed-position dropdown — escapes overflow:hidden / overflow-x-auto clipping
interface ItemDropdownProps {
  open: boolean;
  anchorRect: DOMRect | null;
  products: any[];
  query: string;
  onPick: (prod: any) => void;
  onClose: () => void;
}
function ItemDropdown({ open, anchorRect, products, query, onPick, onClose }: ItemDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);
  const q = query.toLowerCase();
  const opts = products.filter((p: any) =>
    !q || p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q)
  );

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  if (!open || !anchorRect) return null;

  const style: React.CSSProperties = {
    position: "fixed",
    top: anchorRect.bottom + 2,
    left: anchorRect.left,
    width: Math.max(anchorRect.width, 280),
    zIndex: 9999,
    maxHeight: 220,
    overflowY: "auto",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 8,
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    fontSize: 12,
  };

  return (
    <div ref={ref} style={style}>
      {opts.length === 0 ? (
        <div className="px-3 py-3 text-gray-400">No items found</div>
      ) : opts.map((p: any) => (
        <div key={p.id || p.code}
          onMouseDown={(e) => { e.preventDefault(); onPick(p); }}
          className="px-3 py-2 hover:bg-[#e8f6fb] cursor-pointer flex justify-between items-center border-b border-gray-50 last:border-b-0">
          <div>
            <div className="font-medium text-gray-800">{p.name}</div>
            <div className="text-gray-400 text-[10px]">
              Stock: {n3(p.current_stock)} · {p.uom || p.unit || "Nos"}
              {p.category_name ? ` · ${p.category_name}` : ""}
            </div>
          </div>
          <span className="text-gray-400 text-[10px] ml-2 shrink-0">{p.code}</span>
        </div>
      ))}
    </div>
  );
}

interface RecItem {
  sno: number;
  item_code: string;
  item_name: string;
  uom: string;
  system_qty: number;
  physical_qty: number;
  difference: number;
  adj_type: "Shortage" | "Surplus" | "Match";
  reason: string;
}

interface RecForm {
  rec_date: string;
  store_id: string;
  status: string;
  remark: string;
  items: RecItem[];
}

const blankItem = (sno = 1): RecItem => ({
  sno, item_code: "", item_name: "", uom: "Nos",
  system_qty: 0, physical_qty: 0, difference: 0, adj_type: "Match", reason: "",
});

const blankForm = (): RecForm => ({
  rec_date: today(), store_id: "", status: "Draft", remark: "", items: [blankItem()],
});

function calcRow(it: RecItem): RecItem {
  const difference = +(it.physical_qty || 0) - +(it.system_qty || 0);
  const adj_type = difference < 0 ? "Shortage" : difference > 0 ? "Surplus" : "Match";
  return { ...it, difference, adj_type };
}

export default function PhyReconciliation() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<RecForm>(blankForm());
  const [recNo, setRecNo] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [itemQuery, setItemQuery] = useState<Record<number, string>>({});
  const [openDropIdx, setOpenDropIdx] = useState<number | null>(null);
  const [dropAnchor, setDropAnchor] = useState<DOMRect | null>(null);

  const { data: recs = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/phy-reconciliations"] });
  const { data: warehouses = [] } = useQuery<any[]>({ queryKey: ["/api/warehouses"] });
  const { data: allProducts = [] } = useQuery<any[]>({ queryKey: ["/api/products"] });

  const products = (allProducts as any[]).filter((p: any) => p.is_active !== false);

  const closeDropdown = useCallback(() => { setOpenDropIdx(null); setDropAnchor(null); }, []);

  const filtered = (recs as any[]).filter((r: any) => {
    if (!search) return true;
    return [r.voucher_no, r.store_name, r.status].join(" ").toLowerCase().includes(search.toLowerCase());
  });

  function openNew() {
    setForm(blankForm()); setEditId(null); setErr(""); setRecNo(""); setMode("form"); closeDropdown();
    fetch("/api/voucher-series/next/phy_reconciliation", { credentials: "include" })
      .then(r => r.json()).then(d => { if (d.voucher_no) setRecNo(d.voucher_no); });
  }

  async function openEdit(rec: any) {
    setRecNo(rec.voucher_no || ""); closeDropdown();
    const r = await fetch(`/api/phy-reconciliations/${rec.id}`, { credentials: "include" });
    const data = await r.json();
    const items = (data.items || []).map((it: any, i: number) => {
      // Always use the CURRENT live stock as system_qty so adjustments reflect reality
      const liveProd = (allProducts as any[]).find((p: any) => p.code === it.item_code);
      const liveStock = liveProd ? (parseFloat(liveProd.current_stock) || 0) : (+it.system_qty || 0);
      return calcRow({
        sno: i + 1, item_code: it.item_code || "", item_name: it.item_name || "",
        uom: it.uom || "Nos", system_qty: liveStock, physical_qty: +it.physical_qty || 0,
        difference: 0, adj_type: "Match", reason: it.reason || "",
      });
    });
    setForm({
      rec_date: data.rec_date?.slice(0, 10) || today(),
      store_id: data.store_id || "",
      status: data.status || "Draft",
      remark: data.remark || "",
      items: items.length > 0 ? items : [blankItem()],
    });
    setEditId(rec.id); setErr(""); setMode("form");
  }

  function pickProduct(i: number, prod: any) {
    const sys = parseFloat(prod.current_stock) || 0;
    setForm(f => {
      const items = [...f.items];
      items[i] = calcRow({ ...items[i], item_code: prod.code || "", item_name: prod.name || "", uom: prod.uom || prod.unit || "Nos", system_qty: sys });
      return { ...f, items };
    });
    setItemQuery(p => ({ ...p, [i]: prod.name }));
    closeDropdown();
  }

  function updItem(i: number, key: keyof RecItem, val: any) {
    setForm(f => {
      const items = [...f.items];
      items[i] = calcRow({ ...items[i], [key]: val });
      return { ...f, items };
    });
  }

  function addItem() {
    setForm(f => ({ ...f, items: [...f.items, blankItem(f.items.length + 1)] }));
  }

  function removeItem(i: number) {
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, sno: idx + 1 })) }));
  }

  async function handleSave(overrideStatus?: string) {
    setErr(""); setSaving(true);
    const payload = { ...form, ...(overrideStatus ? { status: overrideStatus } : {}) };
    const url = editId ? `/api/phy-reconciliations/${editId}` : "/api/phy-reconciliations";
    const method = editId ? "PATCH" : "POST";
    try {
      const r = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) { const d = await r.json(); setErr(d.message || "Save failed"); return; }
      qc.invalidateQueries({ queryKey: ["/api/phy-reconciliations"] });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      setMode("list");
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this reconciliation?")) return;
    await fetch(`/api/phy-reconciliations/${id}`, { method: "DELETE", credentials: "include" });
    qc.invalidateQueries({ queryKey: ["/api/phy-reconciliations"] });
    qc.invalidateQueries({ queryKey: ["/api/products"] });
  }

  // ── List ──────────────────────────────────────────────────────────────────
  if (mode === "list") return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Physical Inventory Reconciliation</h1>
          <p className="text-sm text-gray-500">Verify physical stock and adjust system quantities</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg text-white"
          style={{ background: SC.primary }} data-testid="btn-new-rec">
          <Plus size={15}/> New Reconciliation
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#027fa5]"
            placeholder="Search PHY No, Store, Status…" data-testid="input-search"/>
        </div>
        <span className="text-xs text-gray-400">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            <FileText size={32} className="mx-auto mb-2 opacity-30"/>
            No reconciliations yet. Click "New Reconciliation" to start.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ background: "#e8f6fb" }}>
                {["PHY No", "Date", "Store", "Items", "Status", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr key={r.id} className="border-b hover:bg-[#f0f9ff] transition-colors">
                  <td className="px-4 py-3 font-semibold" style={{ color: SC.primary }}>{r.voucher_no}</td>
                  <td className="px-4 py-3 text-gray-600">{r.rec_date?.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-gray-700">{r.store_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-500">—</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === "Posted" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(r)} className="text-[#027fa5] hover:text-[#025f80]" data-testid={`btn-edit-${r.id}`}><Edit2 size={14}/></button>
                      <button onClick={() => handleDelete(r.id)} className="text-red-400 hover:text-red-600" data-testid={`btn-del-${r.id}`}><Trash2 size={14}/></button>
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
  const totalShortage = form.items.filter(it => it.adj_type === "Shortage").reduce((s, it) => s + Math.abs(it.difference), 0);
  const totalSurplus  = form.items.filter(it => it.adj_type === "Surplus").reduce((s, it) => s + it.difference, 0);
  const isDraft = form.status === "Draft";

  return (
    <div className="p-6 space-y-4">
      {/* Fixed-position item dropdown — renders outside all overflow containers */}
      <ItemDropdown
        open={openDropIdx !== null}
        anchorRect={dropAnchor}
        products={products}
        query={itemQuery[openDropIdx ?? -1] ?? ""}
        onPick={(prod) => pickProduct(openDropIdx!, prod)}
        onClose={closeDropdown}
      />

      {/* Top bar — title left, status info badge right */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode("list")} className="text-gray-400 hover:text-gray-600 mt-0.5"><X size={18}/></button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Physical Inventory Reconciliation</h1>
            <p className="text-xs text-gray-400">
              {editId ? `Editing ${recNo}` : "New reconciliation — verify physical counts against system stock"}
            </p>
          </div>
        </div>

        {/* Inline status info — compact, right-aligned */}
        {isDraft ? (
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 text-blue-800 text-xs px-3 py-2 rounded-lg max-w-md shrink-0">
            <Info size={13} className="shrink-0 mt-0.5 text-blue-500"/>
            <span>
              <span className="font-semibold">Draft — stock not affected.</span>{" "}
              Reopen and Post when ready to apply adjustments to actual stock.
            </span>
          </div>
        ) : (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2 rounded-lg max-w-md shrink-0">
            <AlertTriangle size={13} className="shrink-0 mt-0.5 text-amber-500"/>
            <span>
              <span className="font-semibold">Post mode — stock will be adjusted.</span>{" "}
              Difference (Physical − System) is applied as the adjustment qty. Cannot be undone.
            </span>
          </div>
        )}
      </div>

      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">{err}</div>}

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-gray-500 font-medium">PHY No</label>
            <input readOnly value={recNo || "Loading…"}
              className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2.5 text-sm font-semibold"
              style={{ color: recNo ? SC.primary : "#9ca3af" }} data-testid="input-rec-no"/>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Date</label>
            <DatePicker value={form.rec_date} onChange={v => setForm(f => ({ ...f, rec_date: v }))}/>
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
            <label className="text-xs text-gray-500 font-medium">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
              data-testid="select-status">
              {["Draft", "Posted"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Items grid */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Items</span>
          <div className="flex items-center gap-5 text-[10px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-gray-300"></span>
              <span><b className="text-gray-600">System Qty</b> = current stock</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full border-2 border-[#027fa5]"></span>
              <span><b className="text-gray-600">Physical Qty</b> = actual count</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-[#d74700]"></span>
              <span><b className="text-gray-600">Difference</b> = Physical − System (adj qty ±)</span>
            </span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b" style={{ background: "#e8f6fb" }}>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600 w-8">S.no</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Item Code</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Item Name</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">UOM</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">System Qty</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Physical Qty</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Difference (Adj Qty)</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Type</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Reason</th>
                <th className="px-3 py-2.5 w-8"></th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((it, i) => (
                <tr key={i} className="border-b hover:bg-[#f0f9ff]">
                  <td className="px-3 py-1.5 text-gray-500 text-center">{it.sno}</td>

                  {/* Item Code — read-only */}
                  <td className="px-1 py-1">
                    <input readOnly value={it.item_code}
                      className="border border-gray-200 bg-gray-50 rounded px-2 py-1.5 w-24 text-xs text-gray-600"/>
                  </td>

                  {/* Item Name — fixed-position searchable dropdown */}
                  <td className="px-1 py-1">
                    <div className="relative w-44">
                      <input
                        value={openDropIdx === i ? (itemQuery[i] ?? it.item_name) : it.item_name}
                        onFocus={(e) => {
                          setOpenDropIdx(i);
                          setDropAnchor(e.currentTarget.getBoundingClientRect());
                          setItemQuery(p => ({ ...p, [i]: it.item_name }));
                        }}
                        onChange={e => {
                          const val = e.target.value;
                          setItemQuery(p => ({ ...p, [i]: val }));
                          if (openDropIdx !== i) {
                            setOpenDropIdx(i);
                            setDropAnchor(e.currentTarget.getBoundingClientRect());
                          }
                        }}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 outline-none focus:border-[#027fa5] text-xs pr-6"
                        placeholder="Search item…" data-testid={`input-item-${i}`}/>
                      <Search size={10} className="absolute right-1.5 top-2.5 text-gray-400 pointer-events-none"/>
                    </div>
                  </td>

                  {/* UOM */}
                  <td className="px-1 py-1">
                    <input readOnly value={it.uom}
                      className="border border-gray-200 bg-gray-50 rounded px-2 py-1.5 w-14 text-xs text-gray-600 text-center"/>
                  </td>

                  {/* System Qty — read-only */}
                  <td className="px-2 py-1 text-right">
                    <span className="font-medium text-gray-700 tabular-nums">{n3(it.system_qty)}</span>
                  </td>

                  {/* Physical Qty — editable */}
                  <td className="px-1 py-1">
                    <input type="number" step="0.001" value={it.physical_qty === 0 && !it.item_code ? "" : it.physical_qty}
                      onChange={e => updItem(i, "physical_qty", parseFloat(e.target.value) || 0)}
                      className="border-2 border-[#027fa5] rounded px-2 py-1.5 w-20 outline-none focus:border-[#d74700] text-xs text-right font-semibold"
                      placeholder="0.000" data-testid={`input-phy-${i}`}/>
                  </td>

                  {/* Difference / Adjustment Qty */}
                  <td className="px-2 py-1 text-right">
                    <span className={`font-semibold tabular-nums ${it.difference < 0 ? "text-red-600" : it.difference > 0 ? "text-green-600" : "text-gray-400"}`}>
                      {it.difference > 0 ? "+" : ""}{n3(it.difference)}
                    </span>
                  </td>

                  {/* Type badge */}
                  <td className="px-2 py-1">
                    <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold
                      ${it.adj_type === "Shortage" ? "bg-red-100 text-red-700" : it.adj_type === "Surplus" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {it.adj_type === "Shortage" ? <TrendingDown size={9}/> : it.adj_type === "Surplus" ? <TrendingUp size={9}/> : <Minus size={9}/>}
                      {it.adj_type}
                    </span>
                  </td>

                  {/* Reason */}
                  <td className="px-1 py-1">
                    <input value={it.reason}
                      onChange={e => updItem(i, "reason", e.target.value)}
                      className="border border-gray-200 rounded px-2 py-1.5 w-28 outline-none focus:border-[#027fa5] text-xs"
                      placeholder="Damage, Loss…" data-testid={`input-reason-${i}`}/>
                  </td>

                  {/* Delete */}
                  <td className="px-2 py-1">
                    <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600" data-testid={`btn-del-item-${i}`}>
                      <Trash2 size={12}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add row + totals */}
        <div className="flex items-center justify-between px-3 py-2 border-t bg-gray-50">
          <button onClick={addItem}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded hover:bg-[#d2f1fa] transition-colors"
            style={{ color: SC.primary }} data-testid="btn-add-item">
            <Plus size={12}/> Add Item
          </button>
          <div className="flex items-center gap-6 text-xs">
            <span className="flex items-center gap-1 text-red-600 font-semibold">
              <TrendingDown size={12}/> Total Shortage: {n3(totalShortage)}
            </span>
            <span className="flex items-center gap-1 text-green-600 font-semibold">
              <TrendingUp size={12}/> Total Surplus: {n3(totalSurplus)}
            </span>
          </div>
        </div>
      </div>

      {/* Remark + Save/Cancel side by side */}
      <div className="grid grid-cols-2 gap-4 pb-2">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <label className="text-xs text-gray-500 font-medium block mb-1">Remark</label>
          <textarea value={form.remark} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))}
            rows={2} placeholder="Optional overall remark for this reconciliation…"
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-[#027fa5] resize-none"
            data-testid="textarea-remark"/>
        </div>
        <div className="flex items-end justify-end gap-2">
          <button onClick={() => setMode("list")}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            data-testid="btn-cancel-rec">
            Cancel
          </button>
          {isDraft ? (
            <>
              <button onClick={() => handleSave("Draft")} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "#6b7280" }} data-testid="btn-save-draft">
                {saving ? "Saving…" : editId ? "Update Draft" : "Save as Draft"}
              </button>
              <button onClick={() => handleSave("Posted")} disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: SC.orange }} data-testid="btn-post-rec">
                <CheckCircle size={14}/>
                {saving ? "Posting…" : "Post & Adjust Stock"}
              </button>
            </>
          ) : (
            <button onClick={() => handleSave()} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
              style={{ background: SC.orange }} data-testid="btn-save-rec">
              <CheckCircle size={14}/>
              {saving ? "Saving…" : editId ? "Update & Adjust Stock" : "Post & Adjust Stock"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
