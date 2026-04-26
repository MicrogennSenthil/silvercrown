import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit, X, Loader2, Search, Info, ChevronDown, PencilLine } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

function apiReq(url: string, method: string, body?: any) {
  return fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, credentials: "include" }).then(r => r.json());
}

// ─── Floating label field ─────────────────────────────────────────────────────
function FField({ label, value, onChange, type = "text", placeholder = "", className = "" }: any) {
  return (
    <div className={`relative ${className}`}>
      <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">{label}</label>
      <input type={type} value={value ?? ""} onChange={onChange} placeholder={placeholder}
        className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400 bg-white"
        data-testid={`input-${label.toLowerCase().replace(/\s+/g, "-")}`} />
    </div>
  );
}

function FSelect({ label, value, onChange, options, className = "" }: any) {
  return (
    <div className={`relative ${className}`}>
      <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">{label}</label>
      <select value={value ?? ""} onChange={onChange}
        className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400 bg-white appearance-none"
        data-testid={`select-${label.toLowerCase().replace(/\s+/g, "-")}`}>
        <option value="">Select</option>
        {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

function DropPlus({ label, value, onChange, options, onPlus, className = "" }: any) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <FSelect label={label} value={value} onChange={onChange} options={options} className="flex-1" />
      <button onClick={onPlus} className="flex-shrink-0 w-7 h-7 rounded flex items-center justify-center text-white font-bold text-base mt-0.5"
        style={{ background: SC.primary }} data-testid={`button-add-${label.toLowerCase()}`}>+</button>
    </div>
  );
}

// ─── Sub Categories ───────────────────────────────────────────────────────────
function SubCategoryForm({ initial, categories, onClose }: any) {
  const [form, setForm] = useState({ categoryId: "", code: "", name: "", description: "", isActive: true, ...initial });
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (data: any) => apiReq(initial?.id ? `/api/sub-categories/${initial.id}` : "/api/sub-categories", initial?.id ? "PATCH" : "POST", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/sub-categories"] }); onClose(); }
  });
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#b8d2da" }}>
          <h2 className="text-lg font-bold" style={{ color: SC.primary }}>{initial?.id ? "Edit" : "New"} Sub Category</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-600">Category *</label>
            <select value={form.categoryId || ""} onChange={e => setForm((s: any) => ({ ...s, categoryId: e.target.value }))}
              className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }}>
              <option value="">— Select Category —</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {[["Code *", "code"], ["Name *", "name"], ["Description", "description"]].map(([label, name]) => (
            <div key={name}>
              <label className="block text-sm font-medium mb-1 text-gray-600">{label}</label>
              <input value={form[name] ?? ""} onChange={e => setForm((s: any) => ({ ...s, [name]: e.target.value }))}
                className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={!!form.isActive} onChange={e => setForm((s: any) => ({ ...s, isActive: e.target.checked }))} className="w-4 h-4" />
            <span className="text-sm text-gray-600">Active</span>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-5 py-2 rounded border text-sm" style={{ borderColor: "#00000030" }}>Cancel</button>
          <button onClick={() => save.mutate(form)} disabled={save.isPending}
            className="px-5 py-2 rounded text-white text-sm font-medium flex items-center gap-2" style={{ background: SC.orange }}>
            {save.isPending && <Loader2 size={14} className="animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function SubCategories() {
  const [search, setSearch] = useState(""); const [filterCat, setFilterCat] = useState("");
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null);
  const qc = useQueryClient();
  const { data: cats = [] } = useQuery<any[]>({ queryKey: ["/api/categories"] });
  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/sub-categories"] });
  const del = useMutation({
    mutationFn: (id: string) => apiReq(`/api/sub-categories/${id}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/sub-categories"] })
  });
  const catMap = Object.fromEntries(cats.map((c: any) => [c.id, c.name]));
  const filtered = rows.filter((r: any) =>
    (!filterCat || r.categoryId === filterCat) &&
    (!search || [r.code, r.name].some(v => String(v || "").toLowerCase().includes(search.toLowerCase())))
  );
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">Sub Categories</h1>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }}>
          <Plus size={16} /> New Sub Category
        </button>
      </div>
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="border rounded px-3 py-2 text-sm focus:outline-none w-52" style={{ borderColor: "#00000030" }} />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="border rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }}>
            <option value="">All Categories</option>
            {cats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <table className="w-full text-sm">
          <thead><tr style={{ background: SC.tonal }}>
            {["Code", "Name", "Category", "Description", "Status", ""].map(h => <th key={h} className="text-left px-5 py-3 font-semibold text-gray-600">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr> :
              filtered.length ? filtered.map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono text-xs font-semibold" style={{ color: SC.primary }}>{r.code}</td>
                  <td className="px-5 py-3 font-medium">{r.name}</td>
                  <td className="px-5 py-3 text-gray-600">{catMap[r.categoryId] || "—"}</td>
                  <td className="px-5 py-3 text-gray-500">{r.description || "—"}</td>
                  <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{r.isActive ? "Active" : "Inactive"}</span></td>
                  <td className="px-5 py-3"><div className="flex gap-2 justify-end">
                    <button onClick={() => { setEditing(r); setShowForm(true); }} className="p-1.5 rounded hover:bg-blue-50" style={{ color: SC.primary }}><Edit size={14} /></button>
                    <button onClick={() => { if (confirm("Delete?")) del.mutate(r.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400"><Trash2 size={14} /></button>
                  </div></td>
                </tr>
              )) : <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">No sub categories found</td></tr>}
          </tbody>
        </table>
      </div>
      {showForm && <SubCategoryForm initial={editing} categories={cats} onClose={() => setShowForm(false)} />}
    </div>
  );
}

// ─── New Product Modal ────────────────────────────────────────────────────────
const EMPTY_PRODUCT = {
  name: "", unit: "", categoryId: "", subCategoryId: "",
  drgNo: "", sapNo: "", hsnCode: "", location: "",
  rate: "", costPrice: "", minStockLevel: "", maxStockLevel: "",
  isActive: true, code: "", description: "",
};

function ProductModal({ initial, categories, subCategories, uomList, onClose }: any) {
  const [form, setForm] = useState<any>({ ...EMPTY_PRODUCT, ...initial });
  const qc = useQueryClient();

  const f = (key: string) => (e: any) => setForm((p: any) => ({ ...p, [key]: e.target.value }));

  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      const auto = data.code || data.sapNo || data.drgNo || `PRD-${Date.now()}`;
      const payload = { ...data, code: auto };
      const url = initial?.id ? `/api/products/${initial.id}` : "/api/products";
      const method = initial?.id ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), credentials: "include" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Save failed"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/products"] }); onClose(); },
  });

  const filteredSubs = subCategories.filter((s: any) => !form.categoryId || s.categoryId === form.categoryId);
  const unitOptions = uomList.map((u: any) => ({ value: u.name || u.code, label: u.name || u.code }));
  const catOptions  = categories.map((c: any) => ({ value: c.id, label: c.name }));
  const subOptions  = filteredSubs.map((s: any) => ({ value: s.id, label: s.name }));

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">{initial?.id ? "Edit" : "New"} Product</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <select className="border border-gray-200 rounded px-3 py-1.5 text-sm text-gray-600 appearance-none pr-7 focus:outline-none bg-gray-50"
                value={form.isActive ? "active" : "inactive"} onChange={e => setForm((p: any) => ({ ...p, isActive: e.target.value === "active" }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Row 1: Item Name + Unit */}
          <div className="flex gap-3">
            <FField label="Item Name" value={form.name} onChange={f("name")} placeholder="Enter Item name Here..." className="flex-1" />
            <FSelect label="Unit" value={form.unit} onChange={f("unit")} options={unitOptions} className="w-36" />
          </div>

          {/* Row 2: Category + Sub Category */}
          <div className="flex gap-3">
            <DropPlus label="Category" value={form.categoryId}
              onChange={(e: any) => setForm((p: any) => ({ ...p, categoryId: e.target.value, subCategoryId: "" }))}
              options={catOptions} onPlus={() => {}} className="flex-1" />
            <DropPlus label="Sub Category" value={form.subCategoryId} onChange={f("subCategoryId")}
              options={subOptions} onPlus={() => {}} className="flex-1" />
          </div>

          {/* Row 3: DRG No, SAP No, HSN Code, Location */}
          <div className="grid grid-cols-4 gap-3">
            <FField label="DRG No"   value={form.drgNo}    onChange={f("drgNo")}    placeholder="0000000" />
            <FField label="SAP No"   value={form.sapNo}    onChange={f("sapNo")}    placeholder="00000000" />
            <FField label="HSN Code" value={form.hsnCode}  onChange={f("hsnCode")}  placeholder="HSN0000" />
            <FField label="Location" value={form.location} onChange={f("location")} placeholder="x-00-00" />
          </div>

          {/* Row 4: Rate ₹, Cost ₹, Min Qty, Max Qty */}
          <div className="grid grid-cols-4 gap-3">
            <FField label="Rate ₹"   value={form.rate}          onChange={f("rate")}          placeholder="00.00" type="number" />
            <FField label="Cost ₹"   value={form.costPrice}     onChange={f("costPrice")}     placeholder="00.00" type="number" />
            <FField label="Min Qty"  value={form.minStockLevel} onChange={f("minStockLevel")} placeholder="00.00" type="number" />
            <FField label="Max Qty"  value={form.maxStockLevel} onChange={f("maxStockLevel")} placeholder="00.00" type="number" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }} data-testid="button-cancel">Cancel</button>
          <button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending || !form.name.trim()}
            className="px-8 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }} data-testid="button-add">
            {saveMut.isPending ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
            {initial?.id ? "Save" : "Add"}
          </button>
        </div>
        {saveMut.isError && <p className="px-6 pb-3 text-red-500 text-xs">{(saveMut.error as Error).message}</p>}
      </div>
    </div>
  );
}

// ─── Products List Page ───────────────────────────────────────────────────────
export function Products() {
  const [search, setSearch]   = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]  = useState<any>(null);
  const [notes, setNotes]      = useState("");
  const qc = useQueryClient();

  const { data: cats  = [] } = useQuery<any[]>({ queryKey: ["/api/categories"] });
  const { data: subs  = [] } = useQuery<any[]>({ queryKey: ["/api/sub-categories"] });
  const { data: rows  = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/products"] });
  const { data: uoms  = [] } = useQuery<any[]>({ queryKey: ["/api/uom"] });

  const del = useMutation({
    mutationFn: (id: string) => apiReq(`/api/products/${id}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/products"] }),
  });

  const filtered = rows.filter((r: any) =>
    !search || [r.name, r.sapNo, r.drgNo, r.hsnCode].some(v => String(v || "").toLowerCase().includes(search.toLowerCase()))
  );

  const COLS = ["S.no", "SAP No", "DRG No", "HSN Code", "Name", "Unit", "Rate", "Min No", "Max No", "Status", "Location", ""];

  return (
    <div className="flex flex-col h-full">
      {/* Card */}
      <div className="bg-white rounded-xl flex-1 flex flex-col overflow-hidden" style={{ boxShadow: "1px 1px 4px rgba(0,0,0,0.12)" }}>
        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-100">
          <span className="font-semibold text-gray-800 text-base">Products</span>
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search Name, SAP No, DRG No and HSN no........"
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none"
              data-testid="input-search" />
          </div>
          <button className="p-1.5 rounded border hover:bg-gray-50" style={{ borderColor: "#d1d5db" }}><Info size={15} className="text-gray-500" /></button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: SC.tonal }}>
                {COLS.map(h => <th key={h} className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={12} className="px-5 py-8 text-center text-gray-400 text-sm">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={12} className="px-5 py-10 text-center text-gray-400 text-sm">No products found. Click <strong>Add</strong> to create one.</td></tr>
              ) : filtered.map((r: any, i: number) => (
                <tr key={r.id} className="hover:bg-gray-50" data-testid={`row-product-${r.id}`}>
                  <td className="px-3 py-2.5 text-gray-500">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-3 py-2.5 font-mono text-xs font-semibold" style={{ color: SC.primary }}>{r.sapNo || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600">{r.drgNo || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600">{r.hsnCode || "—"}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-800">{r.name}</td>
                  <td className="px-3 py-2.5 text-gray-600">{r.unit || r.uom || "—"}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-700">{r.rate ? Number(r.rate).toFixed(2) : "—"}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{r.minStockLevel ? Number(r.minStockLevel).toFixed(0) : "—"}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600">{r.maxStockLevel ? Number(r.maxStockLevel).toFixed(0) : "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={`text-xs font-medium ${r.isActive ? "text-green-600" : "text-gray-400"}`}>{r.isActive ? "Active" : "Inactive"}</span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-600">{r.location || "—"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <button onClick={() => { setEditing(r); setShowForm(true); }}
                        className="p-1.5 rounded hover:bg-blue-50" style={{ color: SC.primary }}
                        data-testid={`button-edit-${r.id}`}><PencilLine size={13} /></button>
                      <button onClick={() => { if (confirm("Delete this product?")) del.mutate(r.id); }}
                        className="p-1.5 rounded hover:bg-red-50 text-red-400"
                        data-testid={`button-delete-${r.id}`}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Notes + Footer */}
        <div className="px-5 py-3 border-t border-gray-100 space-y-3">
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded px-3 pt-4 pb-2 text-sm text-gray-700 focus:outline-none resize-none"
              data-testid="textarea-notes" />
          </div>
          <div className="flex justify-end gap-3">
            <button className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
              style={{ borderColor: "#9ca3af" }} data-testid="button-cancel">Cancel</button>
            <button onClick={() => { setEditing(null); setShowForm(true); }}
              className="px-8 py-2 rounded text-sm font-semibold text-white"
              style={{ background: SC.orange }} data-testid="button-add">Add</button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <ProductModal initial={editing} categories={cats} subCategories={subs} uomList={uoms}
          onClose={() => { setShowForm(false); setEditing(null); }} />
      )}
    </div>
  );
}
