import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Search, Edit2, FileText, X, CheckCircle } from "lucide-react";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700" };
const today = () => new Date().toISOString().slice(0, 10);
const p2 = (v: any) => parseFloat(v) || 0;
const n2 = (v: any) => Number(v || 0).toFixed(2);
const n3 = (v: any) => Number(v || 0).toFixed(3);

interface IrrItem {
  sno: number;
  item_code: string;
  item_name: string;
  stock: number;
  issued_qty: number;
  return_qty: number;
  unit: string;
  rate: number;
  amount: number;
  reason: string;
}

interface IrrForm {
  return_date: string;
  store_id: string;
  department_id: string;
  sii_id: string;
  sii_no: string;
  sii_date: string;
  remark: string;
  items: IrrItem[];
}

const blankForm = (): IrrForm => ({
  return_date: today(), store_id: "", department_id: "",
  sii_id: "", sii_no: "", sii_date: "", remark: "", items: [],
});

function calcItem(it: IrrItem): IrrItem {
  return { ...it, amount: +(p2(it.return_qty) * p2(it.rate)).toFixed(2) };
}

export default function IssueIndentReturn() {
  const qc = useQueryClient();
  const [mode, setMode]     = useState<"list" | "form">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm]     = useState<IrrForm>(blankForm());
  const [irnNo, setIrnNo]   = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  const { data: irrs = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/issue-indent-returns"] });
  const { data: warehouses = [] }      = useQuery<any[]>({ queryKey: ["/api/warehouses"] });
  const { data: departments = [] }     = useQuery<any[]>({ queryKey: ["/api/departments"] });
  const { data: siis = [] }            = useQuery<any[]>({ queryKey: ["/api/store-issue-indents"] });
  const { data: allProducts = [] }     = useQuery<any[]>({ queryKey: ["/api/products"] });

  const totalQty    = form.items.reduce((s, it) => s + p2(it.return_qty), 0);
  const grandTotal  = form.items.reduce((s, it) => s + p2(it.amount), 0);

  const filtered = (irrs as any[]).filter((r: any) => {
    if (!search) return true;
    return [r.voucher_no, r.sii_no, r.store_name, r.dept_name, r.status].join(" ").toLowerCase().includes(search.toLowerCase());
  });

  function openNew() {
    setForm(blankForm()); setEditId(null); setErr(""); setIrnNo(""); setMode("form");
    fetch("/api/voucher-series/next/issue_indent_return", { credentials: "include" })
      .then(r => r.json()).then(d => { if (d.voucher_no) setIrnNo(d.voucher_no); });
  }

  async function openEdit(irr: any) {
    setIrnNo(irr.voucher_no || "");
    const r = await fetch(`/api/issue-indent-returns/${irr.id}`, { credentials: "include" });
    const data = await r.json();
    const stockMap: Record<string, number> = {};
    (allProducts as any[]).forEach((p: any) => { stockMap[p.code] = p2(p.current_stock); });
    setForm({
      return_date: data.return_date?.slice(0,10) || today(),
      store_id: data.store_id || "", department_id: data.department_id || "",
      sii_id: data.sii_id || "", sii_no: data.sii_no || "",
      sii_date: data.sii_date?.slice(0,10) || "", remark: data.remark || "",
      items: (data.items || []).map((it: any, i: number) => calcItem({
        sno: i+1, item_code: it.item_code||"", item_name: it.item_name||"",
        stock: stockMap[it.item_code] ?? p2(it.stock),
        issued_qty: p2(it.issued_qty), return_qty: p2(it.return_qty),
        unit: it.unit||"Nos", rate: p2(it.rate), amount: p2(it.amount), reason: it.reason||"",
      })),
    });
    setEditId(irr.id); setErr(""); setMode("form");
  }

  async function selectSii(sii: any) {
    if (form.sii_id === sii.id) {
      setForm(f => ({ ...f, sii_id: "", sii_no: "", sii_date: "", store_id: "", department_id: "", items: [] }));
      return;
    }
    try {
      const r = await fetch(`/api/store-issue-indents/${sii.id}`, { credentials: "include" });
      const data = await r.json();
      const stockMap: Record<string, number> = {};
      (allProducts as any[]).forEach((p: any) => { stockMap[p.code] = p2(p.current_stock); });
      const items: IrrItem[] = (data.items || []).map((it: any, i: number) => calcItem({
        sno: i+1, item_code: it.item_code||"", item_name: it.item_name||"",
        stock: stockMap[it.item_code] ?? 0,
        issued_qty: p2(it.issued_qty), return_qty: p2(it.issued_qty),
        unit: it.unit||"Nos", rate: p2(it.rate), amount: 0, reason: "",
      }));
      setForm(f => ({
        ...f, sii_id: sii.id, sii_no: sii.voucher_no, sii_date: sii.issue_date?.slice(0,10)||"",
        store_id: sii.store_id||"", department_id: sii.department_id||"", items,
      }));
    } catch (e) { console.error(e); }
  }

  function updItem(i: number, key: keyof IrrItem, val: any) {
    setForm(f => {
      const items = [...f.items];
      items[i] = calcItem({ ...items[i], [key]: val });
      return { ...f, items };
    });
  }

  async function handleSave() {
    setErr(""); setSaving(true);
    // Validate return qty ≤ issued qty for all items
    const overItems = form.items.filter(it => p2(it.return_qty) > p2(it.issued_qty));
    if (overItems.length > 0) {
      const msgs = overItems.map(it => `• ${it.item_name || it.item_code}: Return Qty ${it.return_qty} > Issued Qty ${it.issued_qty}`).join("\n");
      alert(`Return quantity exceeds issued quantity:\n\n${msgs}`);
      setSaving(false); return;
    }
    const payload = { ...form, total_qty: totalQty, grand_total: grandTotal };
    const url    = editId ? `/api/issue-indent-returns/${editId}` : "/api/issue-indent-returns";
    const method = editId ? "PATCH" : "POST";
    try {
      const r = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) { const d = await r.json(); setErr(d.message || "Save failed"); return; }
      qc.invalidateQueries({ queryKey: ["/api/issue-indent-returns"] });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      setMode("list");
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this return? Stock will be reversed.")) return;
    await fetch(`/api/issue-indent-returns/${id}`, { method: "DELETE", credentials: "include" });
    qc.invalidateQueries({ queryKey: ["/api/issue-indent-returns"] });
    qc.invalidateQueries({ queryKey: ["/api/products"] });
  }

  const statusColor: Record<string, string> = {
    Draft: "bg-gray-100 text-gray-600", Posted: "bg-green-100 text-green-700",
  };

  // ── List ──────────────────────────────────────────────────────────────────
  if (mode === "list") return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Issue Indent Return</h1>
          <p className="text-sm text-gray-500">Return issued items back to store — restores stock</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg text-white"
          style={{ background: SC.primary }} data-testid="btn-new-irr">
          <Plus size={15}/> New Return
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#027fa5]"
            placeholder="Search IRN No, SII No, Store…" data-testid="input-search"/>
        </div>
        <span className="text-xs text-gray-400">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            <FileText size={32} className="mx-auto mb-2 opacity-30"/>
            No returns yet. Click "New Return" to create one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ background: "#e8f6fb" }}>
                {["IRN No","Date","SII No","Store","Dept","Total Qty","Total ₹","Status",""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr key={r.id} className="border-b hover:bg-[#f0f9ff] transition-colors">
                  <td className="px-4 py-3 font-semibold" style={{ color: SC.primary }}>{r.voucher_no}</td>
                  <td className="px-4 py-3 text-gray-600">{r.return_date?.slice(0,10)}</td>
                  <td className="px-4 py-3 text-gray-600">{r.sii_no || "—"}</td>
                  <td className="px-4 py-3 text-gray-700">{r.store_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{r.dept_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{n3(r.total_qty)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">₹ {n2(r.grand_total)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[r.status] || "bg-gray-100 text-gray-600"}`}>{r.status}</span>
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
  const overReturn = form.items.some(it => p2(it.return_qty) > p2(it.issued_qty));

  return (
    <div className="p-6 space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode("list")} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Issue Return Note</h1>
            <p className="text-xs text-gray-400">{editId ? `Editing ${irnNo}` : "New return against an issue indent"}</p>
          </div>
        </div>
      </div>

      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">{err}</div>}
      {overReturn && (
        <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm px-4 py-2 rounded-lg flex items-start gap-2">
          <span className="font-bold mt-0.5">⚠</span>
          <span><strong>Return qty exceeds issued qty</strong> for one or more items (highlighted in red). Please correct before saving.</span>
        </div>
      )}

      {/* Header + SII selector */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium">Issue Return No</label>
              <input readOnly value={irnNo || "Loading…"}
                className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2.5 text-sm font-semibold"
                style={{ color: irnNo ? SC.primary : "#9ca3af" }} data-testid="input-irn-no"/>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Return Date</label>
              <DatePicker value={form.return_date} onChange={v => setForm(f => ({ ...f, return_date: v }))}/>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium">Store</label>
              <input readOnly
                value={(warehouses as any[]).find((w: any) => w.id === form.store_id)?.name || (form.store_id ? "—" : "Auto from SII")}
                className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2.5 text-sm text-gray-700"/>
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Department</label>
              <input readOnly
                value={(departments as any[]).find((d: any) => d.id === form.department_id)?.name || (form.department_id ? "—" : "Auto from SII")}
                className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2.5 text-sm text-gray-700"/>
            </div>
          </div>
          {form.sii_no && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <CheckCircle size={13}/> SII <span className="font-semibold">{form.sii_no}</span> selected — {form.items.length} item{form.items.length !== 1 ? "s" : ""} loaded
            </div>
          )}
        </div>

        {/* Right — SII selector */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Select Issue to Return Against</div>
          <div className="overflow-y-auto max-h-44 border border-gray-100 rounded-lg">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Issue No</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Issue Date</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-600">Store</th>
                  <th className="px-3 py-2 text-center font-semibold text-gray-600">Select</th>
                </tr>
              </thead>
              <tbody>
                {(siis as any[]).length === 0 ? (
                  <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400">No issue indents found</td></tr>
                ) : (siis as any[]).map((sii: any) => {
                  const sel = form.sii_id === sii.id;
                  return (
                    <tr key={sii.id} className={`border-b cursor-pointer ${sel ? "bg-[#e8f6fb]" : "hover:bg-gray-50"}`}
                      onClick={() => selectSii(sii)}>
                      <td className="px-3 py-2 font-semibold" style={{ color: SC.primary }}>{sii.voucher_no}</td>
                      <td className="px-3 py-2 text-gray-600">{sii.issue_date?.slice(0,10)}</td>
                      <td className="px-3 py-2 text-gray-600 truncate max-w-[100px]">{sii.store_name || "—"}</td>
                      <td className="px-3 py-2 text-center">
                        <div className={`inline-flex w-4 h-4 rounded border-2 items-center justify-center mx-auto ${sel ? "border-[#d74700] bg-[#d74700]" : "border-gray-300"}`}>
                          {sel && <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-white"><path d="M1 5l3 3 5-5"/></svg>}
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
                {["S.no","Item Code","Item Name","Stock","Issued Qty","Return Qty","Unit","Rate ₹","Amount ₹","Reason"].map(h => (
                  <th key={h} className="px-2 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.items.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-xs">
                    Select an Issue Indent from the panel above to load its items
                  </td>
                </tr>
              ) : form.items.map((it, i) => {
                const overQty = p2(it.return_qty) > p2(it.issued_qty);
                return (
                  <tr key={i} className="border-b hover:bg-[#f0f9ff]">
                    <td className="px-2 py-1.5 text-gray-500 text-center w-8">{it.sno}</td>
                    <td className="px-1 py-1">
                      <input readOnly value={it.item_code}
                        className="border border-gray-200 bg-gray-50 rounded px-2 py-1.5 w-20 text-xs text-gray-600"/>
                    </td>
                    <td className="px-1 py-1">
                      <input readOnly value={it.item_name}
                        className="border border-gray-200 bg-gray-50 rounded px-2 py-1.5 w-40 text-xs text-gray-700"/>
                    </td>
                    <td className="px-2 py-1 text-right text-gray-600 w-12 tabular-nums">{n3(it.stock)}</td>
                    <td className="px-2 py-1 text-right text-gray-600 w-14 tabular-nums">{n3(it.issued_qty)}</td>
                    {/* Return Qty */}
                    <td className="px-1 py-1">
                      <input type="number" step="0.001" min="0" value={it.return_qty || ""}
                        onChange={e => updItem(i, "return_qty", parseFloat(e.target.value) || 0)}
                        className={`border-2 rounded px-2 py-1.5 w-16 outline-none text-xs text-right font-semibold ${
                          overQty ? "border-red-500 bg-red-50 text-red-700" : "border-[#027fa5] focus:border-[#d74700]"
                        }`}
                        data-testid={`input-rqty-${i}`}/>
                      {overQty && <div className="text-red-600 text-[10px] mt-0.5 whitespace-nowrap">Max: {it.issued_qty}</div>}
                    </td>
                    <td className="px-1 py-1">
                      <input readOnly value={it.unit} className="border border-gray-200 bg-gray-50 rounded px-2 py-1.5 w-12 text-xs text-center"/>
                    </td>
                    <td className="px-2 py-1 text-right text-gray-600 tabular-nums">{n2(it.rate)}</td>
                    <td className="px-2 py-1 text-right font-semibold text-gray-800 tabular-nums">{n2(it.amount)}</td>
                    {/* Reason */}
                    <td className="px-1 py-1">
                      <input value={it.reason}
                        onChange={e => updItem(i, "reason", e.target.value)}
                        placeholder="e.g. Damaged"
                        className="border border-gray-300 rounded px-2 py-1.5 w-28 text-xs outline-none focus:border-[#027fa5]"
                        data-testid={`input-reason-${i}`}/>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Summary row */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t bg-gray-50">
          <span className="text-xs text-gray-600">
            Total Quantity : <span className="font-bold text-gray-800">{n3(totalQty)}</span>
          </span>
          <span className="text-sm font-bold text-gray-800">Grand Total : ₹ {n2(grandTotal)}</span>
        </div>
      </div>

      {/* Remark + Save/Cancel */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <label className="text-xs text-gray-500 font-medium block mb-1">Remark</label>
          <textarea value={form.remark} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))}
            rows={2} placeholder="Reason for return…"
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-[#027fa5] resize-none"
            data-testid="textarea-remark"/>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-end justify-end gap-2">
          <button onClick={() => setMode("list")}
            className="px-5 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            data-testid="btn-cancel-irr">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: SC.orange }} data-testid="btn-save-irr">
            {saving ? "Saving…" : editId ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
