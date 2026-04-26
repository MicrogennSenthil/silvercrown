import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit, X, Loader2, ChevronDown } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

function apiReq(url: string, method: string, body?: any) {
  return fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, credentials: "include" }).then(r => r.json());
}

const StatusBadge = ({ v }: { v: boolean }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{v ? "Active" : "Inactive"}</span>
);

// ─── Sub Categories ──────────────────────────────────────────────────────────

function SubCategoryForm({ initial, categories, onClose }: any) {
  const [form, setForm] = useState({ categoryId: "", code: "", name: "", description: "", isActive: true, ...initial });
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (data: any) => apiReq(initial?.id ? `/api/sub-categories/${initial.id}` : "/api/sub-categories", initial?.id ? "PATCH" : "POST", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/sub-categories"] }); onClose(); }
  });
  const F = ({ label, name, type = "text" }: any) => (
    <div>
      <label className="block text-sm font-medium mb-1 text-gray-600">{label}</label>
      {type === "textarea" ? (
        <textarea value={form[name] || ""} onChange={e => setForm((s: any) => ({ ...s, [name]: e.target.value }))} rows={2}
          className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid={`input-${name}`} />
      ) : type === "checkbox" ? (
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={!!form[name]} onChange={e => setForm((s: any) => ({ ...s, [name]: e.target.checked }))} className="w-4 h-4" data-testid={`input-${name}`} />
          <span className="text-sm text-gray-600">Active</span>
        </div>
      ) : (
        <input type={type} value={form[name] ?? ""} onChange={e => setForm((s: any) => ({ ...s, [name]: e.target.value }))}
          className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid={`input-${name}`} />
      )}
    </div>
  );
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
              className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="input-categoryId">
              <option value="">— Select Category —</option>
              {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <F label="Code *" name="code" />
          <F label="Name *" name="name" />
          <F label="Description" name="description" type="textarea" />
          <F label="Status" name="isActive" type="checkbox" />
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-5 py-2 rounded border text-sm" style={{ borderColor: "#00000030" }}>Cancel</button>
          <button onClick={() => save.mutate(form)} disabled={save.isPending}
            className="px-5 py-2 rounded text-white text-sm font-medium flex items-center gap-2" style={{ background: SC.orange }} data-testid="button-save">
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-800">Sub Categories</h1><p className="text-sm text-gray-500 mt-0.5">Sub category master data</p></div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }} data-testid="button-new">
          <Plus size={16} /> New Sub Category
        </button>
      </div>
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sub categories..."
            className="border rounded px-3 py-2 text-sm focus:outline-none w-52" style={{ borderColor: "#00000030" }} data-testid="input-search" />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="border rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="filter-category">
            <option value="">All Categories</option>
            {cats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ background: SC.tonal }}>
              {["Code", "Name", "Category", "Description", "Status", ""].map(h => <th key={h} className="text-left px-5 py-3 font-semibold text-gray-600">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? [...Array(3)].map((_, i) => <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>) :
                filtered.length ? filtered.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3"><span className="font-mono text-xs font-semibold" style={{ color: SC.primary }}>{r.code}</span></td>
                    <td className="px-5 py-3 font-medium">{r.name}</td>
                    <td className="px-5 py-3 text-gray-600">{catMap[r.categoryId] || "—"}</td>
                    <td className="px-5 py-3 text-gray-500">{r.description || "—"}</td>
                    <td className="px-5 py-3"><StatusBadge v={r.isActive} /></td>
                    <td className="px-5 py-3"><div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditing(r); setShowForm(true); }} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" data-testid={`button-edit-${r.id}`}><Edit size={15} /></button>
                      <button onClick={() => { if (confirm("Delete this sub category?")) del.mutate(r.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`button-delete-${r.id}`}><Trash2 size={15} /></button>
                    </div></td>
                  </tr>
                )) : <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">No sub categories found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && <SubCategoryForm initial={editing} categories={cats} onClose={() => setShowForm(false)} />}
    </div>
  );
}

// ─── Products ────────────────────────────────────────────────────────────────

function ProductForm({ initial, categories, subCategories, onClose }: any) {
  const [form, setForm] = useState({
    code: "", name: "", categoryId: "", subCategoryId: "", uom: "", hsnCode: "",
    description: "", purchasePrice: "0", sellingPrice: "0", taxRate: "0",
    minStockLevel: "0", isActive: true, ...initial
  });
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (data: any) => apiReq(initial?.id ? `/api/products/${initial.id}` : "/api/products", initial?.id ? "PATCH" : "POST", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/products"] }); onClose(); }
  });
  const filteredSubs = subCategories.filter((s: any) => !form.categoryId || s.categoryId === form.categoryId);
  const inp = (label: string, name: string, type = "text") => (
    <div>
      <label className="block text-xs font-medium mb-1 text-gray-600">{label}</label>
      <input type={type} value={form[name] ?? ""} onChange={e => setForm((s: any) => ({ ...s, [name]: e.target.value }))}
        className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid={`input-${name}`} />
    </div>
  );
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10" style={{ borderColor: "#b8d2da" }}>
          <h2 className="text-lg font-bold" style={{ color: SC.primary }}>{initial?.id ? "Edit" : "New"} Product</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {inp("Product Code *", "code")}
            {inp("Product Name *", "name")}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-600">Category</label>
              <select value={form.categoryId || ""} onChange={e => setForm((s: any) => ({ ...s, categoryId: e.target.value, subCategoryId: "" }))}
                className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="input-categoryId">
                <option value="">— Select Category —</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1 text-gray-600">Sub Category</label>
              <select value={form.subCategoryId || ""} onChange={e => setForm((s: any) => ({ ...s, subCategoryId: e.target.value }))}
                className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="input-subCategoryId">
                <option value="">— Select Sub Category —</option>
                {filteredSubs.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {inp("UOM", "uom")}
            {inp("HSN Code", "hsnCode")}
          </div>
          <div className="grid grid-cols-3 gap-4">
            {inp("Purchase Price", "purchasePrice", "number")}
            {inp("Selling Price", "sellingPrice", "number")}
            {inp("Tax Rate (%)", "taxRate", "number")}
          </div>
          {inp("Min Stock Level", "minStockLevel", "number")}
          <div>
            <label className="block text-xs font-medium mb-1 text-gray-600">Description</label>
            <textarea value={form.description || ""} onChange={e => setForm((s: any) => ({ ...s, description: e.target.value }))} rows={2}
              className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="input-description" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={!!form.isActive} onChange={e => setForm((s: any) => ({ ...s, isActive: e.target.checked }))} className="w-4 h-4" data-testid="input-isActive" />
            <span className="text-sm text-gray-600">Active</span>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl sticky bottom-0">
          <button onClick={onClose} className="px-5 py-2 rounded border text-sm" style={{ borderColor: "#00000030" }}>Cancel</button>
          <button onClick={() => save.mutate(form)} disabled={save.isPending}
            className="px-5 py-2 rounded text-white text-sm font-medium flex items-center gap-2" style={{ background: SC.orange }} data-testid="button-save">
            {save.isPending && <Loader2 size={14} className="animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function Products() {
  const [search, setSearch] = useState(""); const [filterCat, setFilterCat] = useState("");
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null);
  const qc = useQueryClient();
  const { data: cats = [] } = useQuery<any[]>({ queryKey: ["/api/categories"] });
  const { data: subs = [] } = useQuery<any[]>({ queryKey: ["/api/sub-categories"] });
  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/products"] });
  const del = useMutation({
    mutationFn: (id: string) => apiReq(`/api/products/${id}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/products"] })
  });
  const catMap = Object.fromEntries(cats.map((c: any) => [c.id, c.name]));
  const subMap = Object.fromEntries(subs.map((s: any) => [s.id, s.name]));
  const filtered = rows.filter((r: any) =>
    (!filterCat || r.categoryId === filterCat) &&
    (!search || [r.code, r.name, r.hsnCode].some(v => String(v || "").toLowerCase().includes(search.toLowerCase())))
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-800">Products</h1><p className="text-sm text-gray-500 mt-0.5">Product master data</p></div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }} data-testid="button-new">
          <Plus size={16} /> New Product
        </button>
      </div>
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..."
            className="border rounded px-3 py-2 text-sm focus:outline-none w-52" style={{ borderColor: "#00000030" }} data-testid="input-search" />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="border rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="filter-category">
            <option value="">All Categories</option>
            {cats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ background: SC.tonal }}>
              {["Code", "Name", "Category", "Sub Category", "UOM", "HSN", "Purchase Price", "Sell Price", "Tax%", "Status", ""].map(h =>
                <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? [...Array(3)].map((_, i) => <tr key={i}><td colSpan={11} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>) :
                filtered.length ? filtered.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><span className="font-mono text-xs font-semibold" style={{ color: SC.primary }}>{r.code}</span></td>
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-gray-600">{catMap[r.categoryId] || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{subMap[r.subCategoryId] || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{r.uom || "—"}</td>
                    <td className="px-4 py-3 text-gray-600">{r.hsnCode || "—"}</td>
                    <td className="px-4 py-3 text-right font-mono">{Number(r.purchasePrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right font-mono">{Number(r.sellingPrice).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right">{r.taxRate}%</td>
                    <td className="px-4 py-3"><StatusBadge v={r.isActive} /></td>
                    <td className="px-4 py-3"><div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditing(r); setShowForm(true); }} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" data-testid={`button-edit-${r.id}`}><Edit size={15} /></button>
                      <button onClick={() => { if (confirm("Delete this product?")) del.mutate(r.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`button-delete-${r.id}`}><Trash2 size={15} /></button>
                    </div></td>
                  </tr>
                )) : <tr><td colSpan={11} className="px-5 py-12 text-center text-gray-400">No products found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && <ProductForm initial={editing} categories={cats} subCategories={subs} onClose={() => setShowForm(false)} />}
    </div>
  );
}
