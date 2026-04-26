import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Search, Loader2, Store, ChevronRight } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

const STORE_TYPES = ["Main Store", "Sub Store", "Warehouse", "Transit Store"];

function FField({ label, value, onChange, type = "text", placeholder = "", required = false }: any) {
  return (
    <div className="relative">
      <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5] bg-white"
      />
    </div>
  );
}

function FSelect({ label, value, onChange, options, required = false }: any) {
  return (
    <div className="relative">
      <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5] bg-white appearance-none">
        {options.map((o: any) =>
          <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
        )}
      </select>
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────
function StoreModal({ initial, stores, onClose }: { initial?: any; stores: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!initial?.id;

  const [form, setForm] = useState({
    code:        initial?.code        || "",
    name:        initial?.name        || "",
    store_type:  initial?.store_type  || "Main Store",
    parent_id:   initial?.parent_id   || "",
    location:    initial?.location    || "",
    description: initial?.description || "",
    is_active:   initial?.is_active   ?? true,
  });
  const [error, setError] = useState("");

  function f(field: string) { return (val: any) => setForm(p => ({ ...p, [field]: val })); }

  // Available parents: all Main Stores (excluding self)
  const parentOptions = [
    { value: "", label: "— None (Top Level) —" },
    ...stores
      .filter(s => s.id !== initial?.id && s.store_type === "Main Store")
      .map(s => ({ value: s.id, label: `${s.code} – ${s.name}` })),
  ];

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.code.trim() || !form.name.trim()) throw new Error("Code and Name are required.");
      const url  = isEdit ? `/api/stores/${initial.id}` : "/api/stores";
      const meth = isEdit ? "PATCH" : "POST";
      const res  = await fetch(url, {
        method: meth, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, parent_id: form.parent_id || null }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/stores"] }); onClose(); },
    onError: (e: any) => setError(e.message),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ background: SC.primary, borderRadius: "1rem 1rem 0 0" }}>
          <div className="flex items-center gap-2">
            <Store size={18} className="text-white" />
            <span className="text-white font-semibold text-base">{isEdit ? "Edit Store" : "New Store"}</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl font-bold leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2 text-sm">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FField label="Store Code" value={form.code} onChange={f("code")} required placeholder="e.g. MS01" />
            <FField label="Store Name" value={form.name} onChange={f("name")} required placeholder="e.g. Main Store A" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FSelect label="Store Type" value={form.store_type} onChange={f("store_type")}
              options={STORE_TYPES} required />
            <FSelect label="Parent Store" value={form.parent_id} onChange={f("parent_id")}
              options={parentOptions} />
          </div>

          <FField label="Location / Address" value={form.location} onChange={f("location")} placeholder="e.g. Block A, Shed 2" />

          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Description</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={2} placeholder="Optional notes..."
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5] resize-none" />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
              className="w-4 h-4 rounded accent-[#027fa5]" />
            <span className="text-sm text-gray-700">Active</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 px-6 pb-5">
          <button onClick={onClose}
            className="px-5 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
            className="px-6 py-2 rounded-lg text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
            style={{ background: SC.orange }}>
            {saveMut.isPending && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function StoreMaster() {
  const qc = useQueryClient();
  const { data: stores = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/stores"] });

  const [search, setSearch]   = useState("");
  const [modal,  setModal]    = useState<{ open: boolean; data?: any }>({ open: false });
  const [delId,  setDelId]    = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("");

  const del = useMutation({
    mutationFn: (id: string) => fetch(`/api/stores/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/stores"] }),
  });

  const filtered = (stores as any[]).filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.name?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q) || s.location?.toLowerCase().includes(q);
    const matchType   = !typeFilter || s.store_type === typeFilter;
    return matchSearch && matchType;
  });

  // Build parent name lookup
  const storeMap = Object.fromEntries((stores as any[]).map(s => [s.id, s]));

  const typeBadge: Record<string, string> = {
    "Main Store":     "bg-blue-100 text-blue-700",
    "Sub Store":      "bg-purple-100 text-purple-700",
    "Warehouse":      "bg-amber-100 text-amber-700",
    "Transit Store":  "bg-gray-100 text-gray-600",
  };

  return (
    <div className="p-6 space-y-5" style={{ background: SC.bg, minHeight: "100vh" }}>
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Masters</span>
          <ChevronRight size={14} />
          <span className="font-semibold" style={{ color: SC.primary }}>Store Master</span>
        </div>
        <button onClick={() => setModal({ open: true })}
          className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-semibold"
          style={{ background: SC.orange }} data-testid="btn-new-store">
          <Plus size={15} /> New Store
        </button>
      </div>

      {/* Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search store code, name, location..."
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#027fa5]"
              data-testid="input-search-store" />
          </div>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#027fa5] bg-white"
            data-testid="select-type-filter">
            <option value="">All Types</option>
            {STORE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <span className="text-xs text-gray-400 ml-auto">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-semibold text-gray-500 bg-gray-50 border-b">
                <th className="text-left px-4 py-3 w-10">S.No</th>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Parent Store</th>
                <th className="text-left px-4 py-3">Location</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-center px-4 py-3 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">
                  <Loader2 size={24} className="animate-spin mx-auto mb-2" style={{ color: SC.primary }} />
                  Loading stores...
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-16 text-gray-400">
                  <Store size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No stores found</p>
                  <p className="text-xs mt-1">Click "New Store" to add your first store</p>
                </td></tr>
              ) : filtered.map((s, i) => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  data-testid={`row-store-${s.id}`}>
                  <td className="px-4 py-3 text-gray-400 text-xs">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: SC.primary }}>{s.code}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeBadge[s.store_type] || "bg-gray-100 text-gray-600"}`}>
                      {s.store_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {s.parent_id && storeMap[s.parent_id]
                      ? <span className="flex items-center gap-1">
                          <ChevronRight size={12} className="text-gray-400" />
                          {storeMap[s.parent_id].name}
                        </span>
                      : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{s.location || "—"}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                      {s.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => setModal({ open: true, data: s })}
                        className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                        data-testid={`btn-edit-${s.id}`} title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDelId(s.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                        data-testid={`btn-del-${s.id}`} title="Delete">
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

      {/* New/Edit Modal */}
      {modal.open && (
        <StoreModal
          initial={modal.data}
          stores={stores as any[]}
          onClose={() => setModal({ open: false })}
        />
      )}

      {/* Delete Confirm */}
      {delId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-semibold text-gray-800">Delete Store?</h3>
            <p className="text-sm text-gray-500">
              This will permanently delete the store. Sub-stores linked to it will also be unlinked.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDelId(null)}
                className="px-5 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => { del.mutate(delId!); setDelId(null); }} disabled={del.isPending}
                className="px-5 py-2 rounded-lg text-white text-sm font-semibold flex items-center gap-2"
                style={{ background: "#dc2626" }}>
                {del.isPending && <Loader2 size={13} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
