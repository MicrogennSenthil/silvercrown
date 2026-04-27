import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Search, Edit2, FileText, X, CheckSquare, Square } from "lucide-react";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700" };
const today = () => new Date().toISOString().slice(0, 10);
const n2 = (v: any) => Number(v || 0).toFixed(2);

// Fixed-position dropdown — escapes overflow:hidden/overflow-x-auto clipping
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
    width: Math.max(anchorRect.width, 260),
    zIndex: 9999,
    maxHeight: 200,
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
            <div className="text-gray-400 text-[10px]">Stock: {parseFloat(p.current_stock) || 0} · {p.uom || p.unit || "Nos"}</div>
          </div>
          <span className="text-gray-400 text-[10px] ml-2 shrink-0">{p.code}</span>
        </div>
      ))}
    </div>
  );
}

interface SiiItem {
  sno: number;
  item_code: string;
  item_name: string;
  stock: number;
  issued_qty: number;
  unit: string;
  rate: number;
  amount: number;
  srn_id?: string;
}
interface LinkedSrn { srn_id: string; srn_no: string; srn_date: string; }
interface SiiForm {
  issue_date: string;
  store_id: string;
  department_id: string;
  issue_type: "Direct" | "Goods Request";
  status: string;
  remark: string;
  items: SiiItem[];
  linked_srns: LinkedSrn[];
}

const blankItem = (): SiiItem => ({ sno: 1, item_code: "", item_name: "", stock: 0, issued_qty: 0, unit: "Nos", rate: 0, amount: 0 });
const blankForm = (): SiiForm => ({
  issue_date: today(), store_id: "", department_id: "", issue_type: "Goods Request",
  status: "Draft", remark: "", items: [], linked_srns: [],
});

function calcItem(it: SiiItem): SiiItem {
  return { ...it, amount: +(it.issued_qty * it.rate).toFixed(2) };
}

export default function StoreIssueIndent() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"list" | "form">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<SiiForm>(blankForm());
  const [issueNo, setIssueNo] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [itemQuery, setItemQuery] = useState<Record<number, string>>({});
  const [openDropIdx, setOpenDropIdx] = useState<number | null>(null);
  const [dropAnchor, setDropAnchor] = useState<DOMRect | null>(null);
  // (tableRef removed — using fixed-position dropdown instead)

  const { data: siis = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/store-issue-indents"] });
  const { data: warehouses = [] } = useQuery<any[]>({ queryKey: ["/api/warehouses"] });
  const { data: departments = [] } = useQuery<any[]>({ queryKey: ["/api/departments"] });
  const { data: allProducts = [] } = useQuery<any[]>({ queryKey: ["/api/products"] });
  const { data: allSrns = [] } = useQuery<any[]>({ queryKey: ["/api/store-request-notes"] });

  const products = (allProducts as any[]).filter((p: any) => p.is_active !== false);

  // For Goods Request mode: SRNs filtered by selected store
  const selectedStoreName = (warehouses as any[]).find((w: any) => w.id === form.store_id)?.name || "";
  const availableSrns = (allSrns as any[]).filter((s: any) => s.status !== "Issued");
  const storeSrns = form.store_id
    ? availableSrns.filter((s: any) => s.store_id === form.store_id || s.store_name === selectedStoreName)
    : [];

  const closeDropdown = useCallback(() => { setOpenDropIdx(null); setDropAnchor(null); }, []);

  const totalQty = form.items.reduce((s, it) => s + (+it.issued_qty || 0), 0);
  const grandTotal = form.items.reduce((s, it) => s + (+it.amount || 0), 0);

  const filtered = (siis as any[]).filter((s: any) => {
    if (!search) return true;
    return [s.voucher_no, s.store_name, s.dept_name, s.issue_type, s.status].join(" ").toLowerCase().includes(search.toLowerCase());
  });

  function openNew() {
    setForm(blankForm()); setEditId(null); setErr(""); setIssueNo(""); setMode("form"); closeDropdown();
    fetch("/api/voucher-series/next/store_issue", { credentials: "include" })
      .then(r => r.json()).then(d => { if (d.voucher_no) setIssueNo(d.voucher_no); });
  }

  async function openEdit(sii: any) {
    setIssueNo(sii.voucher_no || ""); closeDropdown();
    const r = await fetch(`/api/store-issue-indents/${sii.id}`, { credentials: "include" });
    const data = await r.json();
    const items = (data.items || []).map((it: any, i: number) => ({
      sno: i + 1, item_code: it.item_code || "", item_name: it.item_name || "",
      stock: +it.stock || 0, issued_qty: +it.issued_qty || 0, unit: it.unit || "Nos",
      rate: +it.rate || 0, amount: +it.amount || 0, srn_id: it.srn_id || undefined,
    }));
    setForm({
      issue_date: data.issue_date?.slice(0, 10) || today(),
      store_id: data.store_id || "",
      department_id: data.department_id || "",
      issue_type: data.issue_type || "Goods Request",
      status: data.status || "Draft",
      remark: data.remark || "",
      items: items,
      linked_srns: (data.linked_srns || []).map((s: any) => ({ srn_id: s.srn_id, srn_no: s.srn_no, srn_date: s.srn_date?.slice(0, 10) || "" })),
    });
    setEditId(sii.id); setErr(""); setMode("form");
  }

  // Toggle SRN link — when checked, load its items into the grid
  async function toggleSrn(srn: any, checked: boolean) {
    if (checked) {
      // Load SRN items
      try {
        const r = await fetch(`/api/store-request-notes/${srn.id}`, { credentials: "include" });
        const data = await r.json();
        const newItems: SiiItem[] = (data.items || []).map((it: any, i: number) => ({
          sno: 0, item_code: it.item_code || "", item_name: it.item_name || "",
          stock: +it.stock || 0, issued_qty: +it.qty || 0, unit: it.unit || "Nos",
          rate: +it.rate || 0, amount: +(it.qty * it.rate) || 0, srn_id: srn.id,
        }));
        setForm(f => {
          // Remove any existing items from this SRN, then append new
          const existing = f.items.filter(it => it.srn_id !== srn.id);
          const merged = [...existing, ...newItems].map((it, i) => ({ ...it, sno: i + 1 }));
          return {
            ...f,
            linked_srns: [...f.linked_srns, { srn_id: srn.id, srn_no: srn.voucher_no, srn_date: srn.request_date?.slice(0, 10) || "" }],
            items: merged,
          };
        });
      } catch (e) { console.error(e); }
    } else {
      setForm(f => ({
        ...f,
        linked_srns: f.linked_srns.filter(s => s.srn_id !== srn.id),
        items: f.items.filter(it => it.srn_id !== srn.id).map((it, i) => ({ ...it, sno: i + 1 })),
      }));
    }
  }

  function isLinked(srnId: string) { return form.linked_srns.some(s => s.srn_id === srnId); }

  function updItem(i: number, key: keyof SiiItem, val: any) {
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
    setItemQuery(p => ({ ...p, [i]: prod.name }));
    closeDropdown();
  }

  async function handleSave() {
    setErr(""); setSaving(true);

    // Stock validation — common for both Direct and Goods Request
    const overStock = form.items.filter(it => it.issued_qty > 0 && it.issued_qty > it.stock);
    if (overStock.length > 0) {
      setErr(`Insufficient stock for: ${overStock.map(it => it.item_name || it.item_code).join(", ")}. Cannot issue more than available stock.`);
      setSaving(false);
      return;
    }
    const zeroQty = form.items.filter(it => it.issued_qty <= 0);
    if (form.items.length > 0 && zeroQty.length === form.items.length) {
      setErr("Please enter issued quantity for at least one item.");
      setSaving(false);
      return;
    }

    const payload = { ...form, total_qty: totalQty, grand_total: grandTotal };
    const url = editId ? `/api/store-issue-indents/${editId}` : "/api/store-issue-indents";
    const method = editId ? "PATCH" : "POST";
    try {
      const r = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) { const d = await r.json(); setErr(d.message || "Save failed"); return; }
      qc.invalidateQueries({ queryKey: ["/api/store-issue-indents"] });
      setMode("list");
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this Store Issue Indent?")) return;
    await fetch(`/api/store-issue-indents/${id}`, { method: "DELETE", credentials: "include" });
    qc.invalidateQueries({ queryKey: ["/api/store-issue-indents"] });
  }

  const statusColor: Record<string, string> = {
    Draft: "bg-gray-100 text-gray-600", Approved: "bg-green-100 text-green-700",
    Issued: "bg-blue-100 text-blue-700", Rejected: "bg-red-100 text-red-700",
  };

  // ── List ──────────────────────────────────────────────────────────────────
  if (mode === "list") return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Store Issue Indent</h1>
          <p className="text-sm text-gray-500">Issue raw materials against store requests or directly</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg text-white"
          style={{ background: SC.primary }} data-testid="btn-new-sii">
          <Plus size={15}/> New Issue
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#027fa5]"
            placeholder="Search Issue No, Store, Type…" data-testid="input-search"/>
        </div>
        <span className="text-xs text-gray-400">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            <FileText size={32} className="mx-auto mb-2 opacity-30"/>
            No store issue indents yet. Click "New Issue" to create one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ background: "#e8f6fb" }}>
                {["Issue No", "Date", "Store", "Department", "Type", "Total ₹", "Status", ""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s: any) => (
                <tr key={s.id} className="border-b hover:bg-[#f0f9ff] transition-colors">
                  <td className="px-4 py-3 font-semibold" style={{ color: SC.primary }}>{s.voucher_no}</td>
                  <td className="px-4 py-3 text-gray-600">{s.issue_date?.slice(0, 10)}</td>
                  <td className="px-4 py-3 text-gray-700">{s.store_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{s.dept_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.issue_type === "Direct" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                      {s.issue_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-800">₹ {n2(s.grand_total)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[s.status] || "bg-gray-100 text-gray-600"}`}>{s.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(s)} className="text-[#027fa5] hover:text-[#025f80]" data-testid={`btn-edit-${s.id}`}><Edit2 size={14}/></button>
                      <button onClick={() => handleDelete(s.id)} className="text-red-400 hover:text-red-600" data-testid={`btn-del-${s.id}`}><Trash2 size={14}/></button>
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
  const isDirect = form.issue_type === "Direct";

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

      {/* Top bar */}
      <div className="flex items-center gap-3">
        <button onClick={() => setMode("list")} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            {editId ? `Edit Issue — ${issueNo}` : "New Store Issue Indent"}
          </h1>
          <p className="text-xs text-gray-400">Issue materials from store inventory</p>
        </div>
      </div>

      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">{err}</div>}

      {/* Header + Issue type panel */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left — header fields */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium">Issue No</label>
              <input readOnly value={issueNo || "Loading…"}
                className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2.5 text-sm font-semibold"
                style={{ color: issueNo ? SC.primary : "#9ca3af" }} data-testid="input-issue-no"/>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Issue Date</label>
              <DatePicker value={form.issue_date} onChange={v => setForm(f => ({ ...f, issue_date: v }))}/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium">Store</label>
              <select value={form.store_id}
                onChange={e => {
                  const newStore = e.target.value;
                  setForm(f => ({
                    ...f,
                    store_id: newStore,
                    // clear linked SRNs/items when store changes in Goods Request mode
                    ...(f.issue_type === "Goods Request" ? { linked_srns: [], items: [] } : {}),
                  }));
                }}
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                data-testid="select-store">
                <option value="">Select Store</option>
                {(warehouses as any[]).map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Department</label>
              <select value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                data-testid="select-dept">
                <option value="">Select Department</option>
                {(departments as any[]).map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Right — issue type + SRN selector */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          {/* Radio toggle */}
          <div className="flex items-center gap-6">
            {(["Direct", "Goods Request"] as const).map(t => (
              <label key={t} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="radio" checked={form.issue_type === t}
                  onChange={() => setForm(f => ({ ...f, issue_type: t, items: [], linked_srns: [] }))}
                  className="accent-[#d74700]" data-testid={`radio-type-${t.replace(" ", "")}`}/>
                <span className={`font-medium ${form.issue_type === t ? "" : "text-gray-500"}`}>{t}</span>
              </label>
            ))}
          </div>

          {isDirect ? (
            <div className="flex items-center justify-center h-20 border border-dashed border-gray-200 rounded-lg text-sm text-gray-400">
              Select items directly in the grid below
            </div>
          ) : !form.store_id ? (
            <div className="flex items-center justify-center h-20 border border-dashed border-amber-200 rounded-lg bg-amber-50">
              <p className="text-xs text-amber-600 font-medium">Please select a store first to view pending requests</p>
            </div>
          ) : storeSrns.length === 0 ? (
            <div className="flex items-center justify-center h-20 border border-dashed border-red-200 rounded-lg bg-red-50">
              <p className="text-xs text-red-500 font-medium">No pending requests found for <span className="font-bold">{selectedStoreName}</span></p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-40">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">GR No</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">GR Date</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Store</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-600">Select</th>
                  </tr>
                </thead>
                <tbody>
                  {storeSrns.map((srn: any) => {
                    const linked = isLinked(srn.id);
                    return (
                      <tr key={srn.id} className={`border-b cursor-pointer ${linked ? "bg-[#e8f6fb]" : "hover:bg-gray-50"}`}
                        onClick={() => toggleSrn(srn, !linked)}>
                        <td className="px-3 py-2 font-semibold" style={{ color: SC.primary }}>{srn.voucher_no}</td>
                        <td className="px-3 py-2 text-gray-600">{srn.request_date?.slice(0, 10)}</td>
                        <td className="px-3 py-2 text-gray-600">{srn.store_name || "—"}</td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={e => { e.stopPropagation(); toggleSrn(srn, !linked); }}
                            className={linked ? "text-[#027fa5]" : "text-gray-300"} data-testid={`chk-srn-${srn.id}`}>
                            {linked ? <CheckSquare size={15}/> : <Square size={15}/>}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {form.linked_srns.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {form.linked_srns.map(s => (
                <span key={s.srn_id} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#d2f1fa] text-[#027fa5] font-semibold">
                  {s.srn_no}
                  <button onClick={() => toggleSrn({ id: s.srn_id, voucher_no: s.srn_no }, false)} className="hover:text-red-500"><X size={9}/></button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b" style={{ background: "#e8f6fb" }}>
                {["S.no", "Item Code", "Item Name", "Stock", "Issued Qty", "Unit", "Rate ₹", "Amount ₹", ""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-gray-400 text-xs">
                    {isDirect ? 'Click \u201c+ Add Item\u201d to add materials' : "Select store requests above to load items"}
                  </td>
                </tr>
              ) : form.items.map((it, i) => (
                <tr key={i} className="border-b hover:bg-[#f0f9ff]">
                  <td className="px-3 py-1.5 text-gray-500 text-center w-8">{it.sno}</td>

                  {/* Item Code */}
                  <td className="px-1 py-1">
                    <input readOnly value={it.item_code}
                      className="border border-gray-200 bg-gray-50 rounded px-2 py-1.5 w-24 text-xs text-gray-600"/>
                  </td>

                  {/* Item Name — fixed-position dropdown in Direct mode, read-only in Goods Request */}
                  <td className="px-1 py-1">
                    {isDirect ? (
                      <div className="relative w-48">
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
                    ) : (
                      <input readOnly value={it.item_name}
                        className="border border-gray-200 bg-gray-50 rounded px-2 py-1.5 w-48 text-xs text-gray-700"/>
                    )}
                  </td>

                  {/* Stock */}
                  <td className="px-2 py-1 text-right w-14">
                    <span className={it.stock < it.issued_qty && it.issued_qty > 0 ? "text-red-500 font-semibold" : "text-gray-600"}>{it.stock}</span>
                  </td>

                  {/* Issued Qty */}
                  <td className="px-1 py-1">
                    <input type="number" value={it.issued_qty || ""}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        updItem(i, "issued_qty", val);
                      }}
                      className={`border rounded px-2 py-1.5 w-16 outline-none text-xs text-right ${it.issued_qty > it.stock && it.issued_qty > 0 ? "border-red-400 bg-red-50 focus:border-red-500" : "border-gray-300 focus:border-[#027fa5]"}`}
                      data-testid={`input-qty-${i}`}/>
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
                    <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600" data-testid={`btn-del-item-${i}`}>
                      <Trash2 size={12}/>
                    </button>
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

      {/* Remark */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <label className="text-xs text-gray-500 font-medium block mb-1">Remark</label>
        <textarea value={form.remark} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))}
          rows={3} placeholder="Optional remark…"
          className="w-full border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-[#027fa5] resize-none"
          data-testid="textarea-remark"/>
      </div>

      {/* Save / Cancel */}
      <div className="flex items-center justify-end gap-2 pb-2">
        <button onClick={() => setMode("list")}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          data-testid="btn-cancel-sii">
          Cancel
        </button>
        <button onClick={handleSave} disabled={saving}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: SC.primary }} data-testid="btn-save-sii">
          {saving ? "Saving…" : editId ? "Update" : "Save"}
        </button>
      </div>
    </div>
  );
}
