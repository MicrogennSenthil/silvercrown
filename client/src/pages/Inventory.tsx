import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2, Edit, X, Loader2, AlertTriangle } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700" };

function ItemForm({ initial, categories, onClose }: any) {
  const [form, setForm] = useState({
    code: "", name: "", categoryId: "", unit: "Nos", description: "",
    purchasePrice: 0, sellingPrice: 0, stockQuantity: 0, minStockLevel: 0,
    hsnCode: "", taxRate: 18, ...initial
  });
  const qc = useQueryClient();
  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      const url = initial?.id ? `/api/inventory/items/${initial.id}` : "/api/inventory/items";
      const res = await fetch(url, { method: initial?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/inventory/items"] }); onClose(); }
  });

  const F = ({ label, name, type = "text", half = false }: any) => (
    <div className={half ? "" : "col-span-2 sm:col-span-1"}>
      <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>{label}</label>
      <input type={type} value={form[name] ?? ""} onChange={e => setForm((f: any) => ({ ...f, [name]: e.target.value }))}
        className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid={`input-${name}`} />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl" style={{ boxShadow: "2px 2px 4px 2px rgba(0,0,0,0.3)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#b8d2da" }}>
          <h2 className="text-lg font-bold" style={{ color: SC.primary }}>{initial?.id ? "Edit" : "New"} Inventory Item</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <F label="Item Code *" name="code" />
          <F label="Item Name *" name="name" />
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Category</label>
            <select value={form.categoryId || ""} onChange={e => setForm((f: any) => ({ ...f, categoryId: e.target.value }))}
              className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="select-category">
              <option value="">No Category</option>
              {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <F label="Unit" name="unit" />
          <F label="HSN Code" name="hsnCode" />
          <F label="Tax Rate (%)" name="taxRate" type="number" />
          <F label="Purchase Price" name="purchasePrice" type="number" />
          <F label="Selling Price" name="sellingPrice" type="number" />
          <F label="Stock Quantity" name="stockQuantity" type="number" />
          <F label="Min Stock Level" name="minStockLevel" type="number" />
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Description</label>
            <textarea value={form.description || ""} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))}
              className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} rows={2} data-testid="input-description" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-5 py-2 rounded border text-sm font-medium" style={{ borderColor: "#00000030" }}>Cancel</button>
          <button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}
            className="px-5 py-2 rounded text-white text-sm font-medium flex items-center gap-2" style={{ background: SC.orange }}
            data-testid="button-save-item">
            {saveMut.isPending && <Loader2 size={14} className="animate-spin" />} Save Item
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"items" | "categories">("items");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [catForm, setCatForm] = useState({ name: "", description: "" });
  const [showCatForm, setShowCatForm] = useState(false);
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/inventory/items"] });
  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["/api/inventory/categories"] });

  const deleteItem = useMutation({
    mutationFn: (id: string) => fetch(`/api/inventory/items/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/inventory/items"] })
  });
  const saveCat = useMutation({
    mutationFn: (data: any) => fetch("/api/inventory/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/inventory/categories"] }); setShowCatForm(false); setCatForm({ name: "", description: "" }); }
  });
  const deleteCat = useMutation({
    mutationFn: (id: string) => fetch(`/api/inventory/categories/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/inventory/categories"] })
  });

  const filtered = items.filter(i => i.name?.toLowerCase().includes(search.toLowerCase()) || i.code?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Inventory</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your stock items and categories</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }}
          data-testid="button-new-item">
          <Plus size={16} /> New Item
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-lg p-1 w-fit" style={{ boxShadow: "1px 1px 2px rgba(0,0,0,0.1)" }}>
        {(["items", "categories"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded text-sm font-medium capitalize transition-colors ${tab === t ? "text-white" : "text-gray-600 hover:bg-gray-100"}`}
            style={tab === t ? { background: SC.primary } : {}} data-testid={`tab-${t}`}>{t}</button>
        ))}
      </div>

      {tab === "items" ? (
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
          <div className="px-5 py-3 border-b border-gray-100">
            <div className="relative max-w-xs">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..."
                className="w-full pl-9 pr-3 py-2 border rounded text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="input-search" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ background: "#d2f1fa" }}>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Code</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Name</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Unit</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600">Stock</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600">Purchase ₹</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600">Selling ₹</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-5 py-3"></th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {isLoading ? [...Array(4)].map((_, i) => <tr key={i}><td colSpan={8} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>) :
                  filtered.length ? filtered.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-mono text-xs font-semibold" style={{ color: SC.primary }}>{item.code}</td>
                      <td className="px-5 py-3 font-medium text-gray-700">{item.name}</td>
                      <td className="px-5 py-3 text-gray-500">{item.unit}</td>
                      <td className="px-5 py-3 text-right">
                        <span className={`font-semibold ${Number(item.stockQuantity) <= Number(item.minStockLevel) ? "text-red-600" : "text-gray-800"}`}>{item.stockQuantity}</span>
                        {Number(item.stockQuantity) <= Number(item.minStockLevel) && <AlertTriangle size={12} className="inline ml-1 text-red-500" />}
                      </td>
                      <td className="px-5 py-3 text-right text-gray-700">₹{Number(item.purchasePrice).toFixed(2)}</td>
                      <td className="px-5 py-3 text-right text-gray-700">₹{Number(item.sellingPrice).toFixed(2)}</td>
                      <td className="px-5 py-3">
                        {Number(item.stockQuantity) <= Number(item.minStockLevel) ?
                          <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">Low Stock</span> :
                          <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">In Stock</span>}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => { setEditing(item); setShowForm(true); }} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" data-testid={`button-edit-${item.id}`}><Edit size={15} /></button>
                          <button onClick={() => { if (confirm("Delete item?")) deleteItem.mutate(item.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`button-delete-${item.id}`}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  )) : <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-400">No items found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowCatForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }}
              data-testid="button-new-category"><Plus size={16} /> New Category</button>
          </div>
          {showCatForm && (
            <div className="bg-white rounded-xl p-5 space-y-3" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
              <h3 className="font-semibold text-gray-700">New Category</h3>
              <input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} placeholder="Category name"
                className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="input-cat-name" />
              <input value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} placeholder="Description (optional)"
                className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="input-cat-description" />
              <div className="flex gap-2">
                <button onClick={() => saveCat.mutate(catForm)} disabled={saveCat.isPending}
                  className="px-4 py-2 rounded text-white text-sm" style={{ background: SC.orange }} data-testid="button-save-category">Save</button>
                <button onClick={() => setShowCatForm(false)} className="px-4 py-2 rounded border text-sm" style={{ borderColor: "#00000030" }}>Cancel</button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat: any) => (
              <div key={cat.id} className="bg-white rounded-xl p-5 flex items-start justify-between" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
                <div>
                  <div className="font-semibold text-gray-700">{cat.name}</div>
                  <div className="text-xs text-gray-400 mt-1">{cat.description || "No description"}</div>
                </div>
                <button onClick={() => { if (confirm("Delete category?")) deleteCat.mutate(cat.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`button-delete-cat-${cat.id}`}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {showForm && <ItemForm initial={editing} categories={categories} onClose={() => setShowForm(false)} />}
    </div>
  );
}
