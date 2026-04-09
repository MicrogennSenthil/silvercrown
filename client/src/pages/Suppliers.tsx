import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2, Edit, X, Loader2 } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700" };
const EMPTY = { name: "", email: "", phone: "", address: "", gstin: "", contactPerson: "" };

function SupplierForm({ initial, onClose }: any) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const qc = useQueryClient();
  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      const url = initial?.id ? `/api/suppliers/${initial.id}` : "/api/suppliers";
      const res = await fetch(url, { method: initial?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/suppliers"] }); onClose(); }
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg" style={{ boxShadow: "2px 2px 4px 2px rgba(0,0,0,0.3)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#b8d2da" }}>
          <h2 className="text-lg font-bold" style={{ color: SC.primary }}>{initial?.id ? "Edit" : "New"} Supplier</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          {[["Supplier Name *", "name", "col-span-2"], ["Contact Person", "contactPerson", "col-span-1"], ["Phone", "phone", "col-span-1"], ["Email", "email", "col-span-2"], ["GSTIN", "gstin", "col-span-1"], ["", "", ""], ["Address", "address", "col-span-2"]].filter(([, k]) => k).map(([label, key, span = "col-span-1"]) => (
            <div key={key} className={span}>
              <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>{label}</label>
              {key === "address" ?
                <textarea value={form[key] || ""} onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
                  className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} rows={2} data-testid={`input-${key}`} /> :
                <input value={form[key] || ""} onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
                  className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid={`input-${key}`} />}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-5 py-2 rounded border text-sm" style={{ borderColor: "#00000030" }}>Cancel</button>
          <button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}
            className="px-5 py-2 rounded text-white text-sm font-medium flex items-center gap-2" style={{ background: SC.orange }} data-testid="button-save">
            {saveMut.isPending && <Loader2 size={14} className="animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Suppliers() {
  const [search, setSearch] = useState(""); const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null);
  const qc = useQueryClient();
  const { data: suppliers = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/suppliers"] });
  const del = useMutation({ mutationFn: (id: string) => fetch(`/api/suppliers/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/suppliers"] }) });
  const filtered = suppliers.filter((s: any) => s.name?.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search) || s.email?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-800">Suppliers</h1><p className="text-sm text-gray-500 mt-0.5">Manage your supplier directory</p></div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }} data-testid="button-new-supplier">
          <Plus size={16} /> New Supplier
        </button>
      </div>
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="relative max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers..."
              className="w-full pl-9 pr-3 py-2 border rounded text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="input-search" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ background: "#d2f1fa" }}>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Name</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Contact</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Phone</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Email</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">GSTIN</th>
              <th className="px-5 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? [...Array(3)].map((_, i) => <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>) :
                filtered.length ? filtered.map((s: any) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-800">{s.name}</td>
                    <td className="px-5 py-3 text-gray-500">{s.contactPerson || "—"}</td>
                    <td className="px-5 py-3 text-gray-600">{s.phone || "—"}</td>
                    <td className="px-5 py-3 text-gray-600">{s.email || "—"}</td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{s.gstin || "—"}</td>
                    <td className="px-5 py-3"><div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditing(s); setShowForm(true); }} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" data-testid={`button-edit-${s.id}`}><Edit size={15} /></button>
                      <button onClick={() => { if (confirm("Delete supplier?")) del.mutate(s.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`button-delete-${s.id}`}><Trash2 size={15} /></button>
                    </div></td>
                  </tr>
                )) : <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">No suppliers found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && <SupplierForm initial={editing} onClose={() => setShowForm(false)} />}
    </div>
  );
}
