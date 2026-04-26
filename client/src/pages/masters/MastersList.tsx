import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit, X, Loader2, CheckCircle, XCircle, Search, PencilLine } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700" };

function GenericForm({ title, fields, initial, apiBase, queryKey, onClose }: any) {
  const initForm: any = {};
  for (const f of fields) initForm[f.name] = f.default ?? "";
  const [form, setForm] = useState({ ...initForm, ...initial });
  const qc = useQueryClient();
  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      const url = initial?.id ? `${apiBase}/${initial.id}` : apiBase;
      const res = await fetch(url, { method: initial?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [queryKey] }); onClose(); }
  });
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md" style={{ boxShadow: "2px 2px 4px 2px rgba(0,0,0,0.3)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#b8d2da" }}>
          <h2 className="text-lg font-bold" style={{ color: SC.primary }}>{initial?.id ? "Edit" : "New"} {title}</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {fields.map((f: any) => (
            <div key={f.name}>
              <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>{f.label}</label>
              {f.type === "checkbox" ? (
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form[f.name]} onChange={e => setForm((s: any) => ({ ...s, [f.name]: e.target.checked }))}
                    className="w-4 h-4 rounded" data-testid={`input-${f.name}`} />
                  <span className="text-sm text-gray-600">{f.checkLabel || f.label}</span>
                </div>
              ) : f.type === "textarea" ? (
                <textarea value={form[f.name] || ""} onChange={e => setForm((s: any) => ({ ...s, [f.name]: e.target.value }))} rows={2}
                  className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid={`input-${f.name}`} />
              ) : (
                <input type={f.type || "text"} value={form[f.name] ?? ""} onChange={e => setForm((s: any) => ({ ...s, [f.name]: e.target.value }))}
                  className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid={`input-${f.name}`} />
              )}
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

interface MasterConfig {
  title: string;
  apiBase: string;
  queryKey: string;
  fields: any[];
  columns: { label: string; key: string; render?: (row: any) => any }[];
}

export function MasterPage({ config }: { config: MasterConfig }) {
  const [search, setSearch] = useState(""); const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null);
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: [config.queryKey] });
  const del = useMutation({
    mutationFn: (id: string) => fetch(`${config.apiBase}/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: [config.queryKey] })
  });
  const searchKeys = config.columns.slice(0, 2).map(c => c.key);
  const filtered = rows.filter((r: any) => searchKeys.some(k => String(r[k] || "").toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-800">{config.title}</h1><p className="text-sm text-gray-500 mt-0.5">{config.title} master data</p></div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }} data-testid="button-new">
          <Plus size={16} /> New {config.title}
        </button>
      </div>
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
        <div className="px-5 py-3 border-b border-gray-100">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${config.title.toLowerCase()}...`}
            className="w-full max-w-xs border rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="input-search" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ background: "#d2f1fa" }}>
              {config.columns.map(col => <th key={col.key} className="text-left px-5 py-3 font-semibold text-gray-600">{col.label}</th>)}
              <th className="px-5 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? [...Array(3)].map((_, i) => <tr key={i}><td colSpan={config.columns.length + 1} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>) :
                filtered.length ? filtered.map((row: any) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    {config.columns.map(col => (
                      <td key={col.key} className="px-5 py-3 text-gray-700">
                        {col.render ? col.render(row) : row[col.key] ?? "—"}
                      </td>
                    ))}
                    <td className="px-5 py-3"><div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditing(row); setShowForm(true); }} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" data-testid={`button-edit-${row.id}`}><Edit size={15} /></button>
                      <button onClick={() => { if (confirm(`Delete this ${config.title}?`)) del.mutate(row.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`button-delete-${row.id}`}><Trash2 size={15} /></button>
                    </div></td>
                  </tr>
                )) : <tr><td colSpan={config.columns.length + 1} className="px-5 py-12 text-center text-gray-400">No {config.title.toLowerCase()} found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && <GenericForm title={config.title} fields={config.fields} initial={editing} apiBase={config.apiBase} queryKey={config.queryKey} onClose={() => setShowForm(false)} />}
    </div>
  );
}

// --- Warehouses ---
export function Warehouses() {
  return <MasterPage config={{
    title: "Warehouses",
    apiBase: "/api/warehouses",
    queryKey: "/api/warehouses",
    fields: [
      { name: "code", label: "Warehouse Code *" },
      { name: "name", label: "Warehouse Name *" },
      { name: "location", label: "Location" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "isActive", label: "Status", type: "checkbox", checkLabel: "Active", default: true },
    ],
    columns: [
      { label: "Code", key: "code", render: (r: any) => <span className="font-mono text-xs font-semibold" style={{ color: "#027fa5" }}>{r.code}</span> },
      { label: "Name", key: "name", render: (r: any) => <span className="font-medium">{r.name}</span> },
      { label: "Location", key: "location" },
      { label: "Description", key: "description" },
      { label: "Status", key: "isActive", render: (r: any) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{r.isActive ? "Active" : "Inactive"}</span> },
    ]
  }} />;
}

// ─── UOM Modal ────────────────────────────────────────────────────────────────
function UomModal({ item, onClose }: { item?: any; onClose: () => void }) {
  const [name,      setName]      = useState(item?.name || "");
  const [shortForm, setShortForm] = useState(item?.shortForm || "");
  const [decimals,  setDecimals]  = useState(item?.numberOfDecimals ?? 0);
  const qc = useQueryClient();
  const isEdit = !!item?.id;

  const saveMut = useMutation({
    mutationFn: async () => {
      const code = item?.code || name.trim().toUpperCase().replace(/\s+/g, "_") || `UOM-${Date.now()}`;
      const url    = isEdit ? `/api/uom/${item.id}` : "/api/uom";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name: name.trim(), shortForm: shortForm.trim(), numberOfDecimals: Number(decimals), isActive: true }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Save failed"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/uom"] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">Unit of Measurement</h2>
        </div>
        <div className="px-6 py-6 space-y-5">
          {/* Measurement Name */}
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Measurement name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Enter New Measurement"
              className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none focus:border-[#027fa5]"
              data-testid="input-uom-name" autoFocus />
          </div>
          {/* Short Form + Decimals side by side */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Short Form</label>
              <input value={shortForm} onChange={e => setShortForm(e.target.value)}
                placeholder="Enter Short form"
                className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none focus:border-[#027fa5]"
                data-testid="input-short-form" />
            </div>
            <div className="relative w-32">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none whitespace-nowrap">Number Of Decimals</label>
              <input type="number" min={0} max={10} value={decimals} onChange={e => setDecimals(Number(e.target.value))}
                placeholder="0"
                className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none focus:border-[#027fa5]"
                data-testid="input-decimals" />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }} data-testid="btn-cancel">Cancel</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !name.trim()}
            className="px-8 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }} data-testid="btn-save">
            {saveMut.isPending ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
            {isEdit ? "Update" : "Add"}
          </button>
        </div>
        {saveMut.isError && <p className="px-6 pb-3 text-red-500 text-xs">{(saveMut.error as Error).message}</p>}
      </div>
    </div>
  );
}

export function UnitsOfMeasure() {
  const [search, setSearch]   = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/uom"] });

  const filtered = rows.filter((r: any) =>
    !search ||
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.shortForm || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex justify-center p-6 bg-[#f5f0ed] min-h-screen">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 4px rgba(0,0,0,0.12)" }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800 text-base whitespace-nowrap">UOM</span>
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search Measurement and short form...."
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none"
                data-testid="input-search"
              />
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#d2f1fa" }}>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600 w-16">S.no</th>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Measurement Name</th>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Short Form</th>
                <th className="w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-400">No units of measure yet.</td></tr>
              ) : filtered.map((r: any, i: number) => (
                <tr key={r.id} className="hover:bg-gray-50" data-testid={`row-uom-${r.id}`}>
                  <td className="px-5 py-2.5 text-gray-500">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-5 py-2.5 font-medium text-gray-800 uppercase tracking-wide">{r.name}</td>
                  <td className="px-5 py-2.5 text-gray-600">{r.shortForm || "—"}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => setEditing(r)}
                      className="p-1.5 rounded hover:bg-blue-50" style={{ color: SC.primary }}
                      data-testid={`btn-edit-${r.id}`}>
                      <PencilLine size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-5 py-3 border-t border-gray-100">
            <button className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
              style={{ borderColor: "#9ca3af" }} data-testid="btn-cancel">Cancel</button>
            <button onClick={() => setShowAdd(true)}
              className="px-8 py-2 rounded text-sm font-semibold text-white"
              style={{ background: SC.orange }} data-testid="btn-add">Add</button>
          </div>
        </div>
      </div>

      {showAdd && <UomModal onClose={() => setShowAdd(false)} />}
      {editing && <UomModal item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// --- Tax Rates ---
export function TaxRates() {
  return <MasterPage config={{
    title: "Tax Rates",
    apiBase: "/api/tax-rates",
    queryKey: "/api/tax-rates",
    fields: [
      { name: "name", label: "Tax Name *" },
      { name: "rate", label: "Rate (%) *", type: "number" },
      { name: "hsnCode", label: "HSN Code" },
      { name: "description", label: "Description" },
      { name: "isActive", label: "Status", type: "checkbox", checkLabel: "Active", default: true },
    ],
    columns: [
      { label: "Name", key: "name", render: (r: any) => <span className="font-medium">{r.name}</span> },
      { label: "Rate", key: "rate", render: (r: any) => <span className="font-semibold" style={{ color: "#d74700" }}>{r.rate}%</span> },
      { label: "HSN Code", key: "hsnCode" },
      { label: "Description", key: "description" },
      { label: "Status", key: "isActive", render: (r: any) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{r.isActive ? "Active" : "Inactive"}</span> },
    ]
  }} />;
}

const StatusBadge = (r: any) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{r.isActive ? "Active" : "Inactive"}</span>;
const CodeCell = (r: any) => <span className="font-mono text-xs font-semibold" style={{ color: "#027fa5" }}>{r.code}</span>;
const NameCell = (r: any) => <span className="font-medium">{r.name}</span>;
const baseFields = (extra?: any[]) => [
  { name: "code", label: "Code *" },
  { name: "name", label: "Name *" },
  { name: "description", label: "Description", type: "textarea" },
  ...(extra || []),
  { name: "isActive", label: "Status", type: "checkbox", checkLabel: "Active", default: true },
];
const baseCols = (extra?: any[]) => [
  { label: "Code", key: "code", render: CodeCell },
  { label: "Name", key: "name", render: NameCell },
  ...(extra || []),
  { label: "Description", key: "description" },
  { label: "Status", key: "isActive", render: StatusBadge },
];

// --- Categories (Figma-matched compact card) ---
function NewCategoryModal({ onClose }: any) {
  const [name, setName] = useState("");
  const qc = useQueryClient();
  const saveMut = useMutation({
    mutationFn: async () => {
      const code = name.trim().toUpperCase().replace(/\s+/g, "_") || `CAT-${Date.now()}`;
      const res = await fetch("/api/categories", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name: name.trim(), description: "", isActive: true }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Save failed"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/categories"] }); onClose(); },
  });
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">New Category</h2>
        </div>
        <div className="px-6 py-6">
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Category type</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Type Category..."
              onKeyDown={e => e.key === "Enter" && name.trim() && saveMut.mutate()}
              className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400"
              data-testid="input-category-name" autoFocus />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }} data-testid="button-cancel">Cancel</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !name.trim()}
            className="px-8 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }} data-testid="button-add">
            {saveMut.isPending ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}Add
          </button>
        </div>
        {saveMut.isError && <p className="px-6 pb-3 text-red-500 text-xs">{(saveMut.error as Error).message}</p>}
      </div>
    </div>
  );
}

function EditCategoryModal({ item, onClose }: any) {
  const [name, setName] = useState(item.name || "");
  const qc = useQueryClient();
  const saveMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/categories/${item.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), code: item.code }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Save failed"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/categories"] }); onClose(); },
  });
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">Edit Category</h2>
        </div>
        <div className="px-6 py-6">
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Category type</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Type Category..."
              className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400"
              data-testid="input-category-name" autoFocus />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }}>Cancel</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !name.trim()}
            className="px-8 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }}>
            {saveMut.isPending ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function Categories() {
  const [search, setSearch]    = useState("");
  const [showAdd, setShowAdd]  = useState(false);
  const [editing, setEditing]  = useState<any>(null);
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/categories"] });
  const delMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/categories/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/categories"] }),
  });

  const filtered = rows.filter((r: any) => !search || r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 4px rgba(0,0,0,0.12)" }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800 text-base whitespace-nowrap">Category</span>
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Category...."
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none"
                data-testid="input-search" />
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#d2f1fa" }}>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600 w-16">S.no</th>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Category</th>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-400">No categories yet.</td></tr>
              ) : filtered.map((r: any, i: number) => (
                <tr key={r.id} className="hover:bg-gray-50" data-testid={`row-category-${r.id}`}>
                  <td className="px-5 py-2.5 text-gray-500">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-5 py-2.5 font-medium text-gray-800 uppercase tracking-wide">{r.name}</td>
                  <td className="px-5 py-2.5 text-sm" style={{ color: r.isActive ? "#16a34a" : "#9ca3af" }}>
                    {r.isActive ? "Active" : "Inactive"}
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => setEditing(r)}
                      className="p-1.5 rounded hover:bg-blue-50" style={{ color: SC.primary }}
                      data-testid={`button-edit-${r.id}`}>
                      <PencilLine size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-5 py-3 border-t border-gray-100">
            <button className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
              style={{ borderColor: "#9ca3af" }} data-testid="button-cancel">Cancel</button>
            <button onClick={() => setShowAdd(true)}
              className="px-8 py-2 rounded text-sm font-semibold text-white"
              style={{ background: SC.orange }} data-testid="button-add">Add</button>
          </div>
        </div>
      </div>

      {showAdd  && <NewCategoryModal onClose={() => setShowAdd(false)} />}
      {editing  && <EditCategoryModal item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ─── Voucher Type Modal ───────────────────────────────────────────────────────
function VoucherTypeModal({ item, onClose }: { item?: any; onClose: () => void }) {
  const [name,      setName]      = useState(item?.name || "");
  const [prefix,    setPrefix]    = useState(item?.prefix || "");
  const [narration, setNarration] = useState(item?.defaultNarration || "");
  const qc = useQueryClient();
  const isEdit = !!item?.id;

  const saveMut = useMutation({
    mutationFn: async () => {
      const code   = item?.code || name.trim().toUpperCase().replace(/\s+/g, "_") || `VT-${Date.now()}`;
      const url    = isEdit ? `/api/voucher-types/${item.id}` : "/api/voucher-types";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name: name.trim(), prefix: prefix.trim(), defaultNarration: narration.trim(), isActive: true }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Save failed"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/voucher-types"] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">{isEdit ? "Edit Voucher Name" : "Create New Voucher Name"}</h2>
        </div>
        <div className="px-6 py-6 space-y-5">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Voucher Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter New Voucher name...."
                className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none focus:border-[#027fa5]"
                data-testid="input-voucher-name" autoFocus />
            </div>
            <div className="relative w-28">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Prefix</label>
              <input value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="Eg: PRe"
                className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none focus:border-[#027fa5]"
                data-testid="input-prefix" />
            </div>
          </div>
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Default Narration</label>
            <input value={narration} onChange={e => setNarration(e.target.value)} placeholder="Type here..."
              className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none focus:border-[#027fa5]"
              data-testid="input-narration" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }} data-testid="btn-cancel">Cancel</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !name.trim()}
            className="px-8 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }} data-testid="btn-add">
            {saveMut.isPending ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
            {isEdit ? "Save" : "Add"}
          </button>
        </div>
        {saveMut.isError && <p className="px-6 pb-3 text-red-500 text-xs">{(saveMut.error as Error).message}</p>}
      </div>
    </div>
  );
}

export function VoucherTypes() {
  const [search, setSearch]   = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/voucher-types"] });

  const filtered = rows.filter((r: any) =>
    !search ||
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.prefix || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex justify-center p-6 bg-[#f5f0ed] min-h-screen">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 4px rgba(0,0,0,0.12)" }}>
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800 text-base whitespace-nowrap">Voucher type</span>
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by Voucher name and Prefix ..."
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none"
                data-testid="input-search" />
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#d2f1fa" }}>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600 w-16">S.no</th>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Voucher Name</th>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Prefix</th>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Default Narrations</th>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No voucher types yet.</td></tr>
              ) : filtered.map((r: any, i: number) => (
                <tr key={r.id} className="hover:bg-gray-50" data-testid={`row-vt-${r.id}`}>
                  <td className="px-5 py-2.5 text-gray-500">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-5 py-2.5 font-medium text-gray-800">{r.name}</td>
                  <td className="px-5 py-2.5 text-gray-600">{r.prefix || "—"}</td>
                  <td className="px-5 py-2.5 text-gray-600">{r.defaultNarration || "—"}</td>
                  <td className="px-5 py-2.5 text-sm" style={{ color: r.isActive ? "#16a34a" : "#9ca3af" }}>
                    {r.isActive ? "Active" : "Inactive"}
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => setEditing(r)}
                      className="p-1.5 rounded hover:bg-blue-50" style={{ color: SC.primary }}
                      data-testid={`btn-edit-${r.id}`}>
                      <PencilLine size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end gap-3 px-5 py-3 border-t border-gray-100">
            <button className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
              style={{ borderColor: "#9ca3af" }} data-testid="btn-cancel">Cancel</button>
            <button onClick={() => setShowAdd(true)}
              className="px-8 py-2 rounded text-sm font-semibold text-white"
              style={{ background: SC.orange }} data-testid="btn-add">Add</button>
          </div>
        </div>
      </div>

      {showAdd && <VoucherTypeModal onClose={() => setShowAdd(false)} />}
      {editing && <VoucherTypeModal item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ─── Pay Mode Type Modal ──────────────────────────────────────────────────────
function PayModeTypeModal({ item, onClose }: { item?: any; onClose: () => void }) {
  const [name,     setName]     = useState(item?.name || "");
  const [prefix,   setPrefix]   = useState(item?.prefix || "");
  const [narration,setNarration]= useState(item?.defaultNarration || "");
  const qc = useQueryClient();
  const isEdit = !!item?.id;

  const saveMut = useMutation({
    mutationFn: async () => {
      const code   = item?.code || name.trim().toUpperCase().replace(/\s+/g, "_") || `PM-${Date.now()}`;
      const url    = isEdit ? `/api/pay-mode-types/${item.id}` : "/api/pay-mode-types";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name: name.trim(), prefix: prefix.trim(), defaultNarration: narration.trim(), isActive: true }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Save failed"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/pay-mode-types"] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">{isEdit ? "Edit Paymode Type" : "Create New Paymode Type"}</h2>
        </div>
        <div className="px-6 py-6 space-y-5">
          {/* Row 1: Paymode Name + Prefix */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Paymode Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter Paymode name...."
                className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none focus:border-[#027fa5]"
                data-testid="input-paymode-name" autoFocus />
            </div>
            <div className="relative w-28">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Prefix</label>
              <input value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="Eg: PR"
                className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none focus:border-[#027fa5]"
                data-testid="input-prefix" />
            </div>
          </div>
          {/* Row 2: Default Narration */}
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Default Narration</label>
            <input value={narration} onChange={e => setNarration(e.target.value)} placeholder="Type here..."
              className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none focus:border-[#027fa5]"
              data-testid="input-narration" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }} data-testid="btn-cancel">Cancel</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !name.trim()}
            className="px-8 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }} data-testid="btn-add">
            {saveMut.isPending ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
            {isEdit ? "Save" : "Add"}
          </button>
        </div>
        {saveMut.isError && <p className="px-6 pb-3 text-red-500 text-xs">{(saveMut.error as Error).message}</p>}
      </div>
    </div>
  );
}

export function PayModeTypes() {
  const [search, setSearch]   = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/pay-mode-types"] });

  const filtered = rows.filter((r: any) =>
    !search ||
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.prefix || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex justify-center p-6 bg-[#f5f0ed] min-h-screen">
      <div className="w-full max-w-2xl">
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 4px rgba(0,0,0,0.12)" }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800 text-base whitespace-nowrap">Paymode</span>
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by Voucher name and Prefix ..."
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none"
                data-testid="input-search" />
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#d2f1fa" }}>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600 w-16">S.no</th>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Paymode Types</th>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Prefix</th>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Default Narrations</th>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">No pay mode types yet.</td></tr>
              ) : filtered.map((r: any, i: number) => (
                <tr key={r.id} className="hover:bg-gray-50" data-testid={`row-pm-${r.id}`}>
                  <td className="px-5 py-2.5 text-gray-500">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-5 py-2.5 font-medium text-gray-800 uppercase tracking-wide">{r.name}</td>
                  <td className="px-5 py-2.5 text-gray-600">{r.prefix || "—"}</td>
                  <td className="px-5 py-2.5 text-gray-600">{r.defaultNarration || "—"}</td>
                  <td className="px-5 py-2.5 text-sm" style={{ color: r.isActive ? "#16a34a" : "#9ca3af" }}>
                    {r.isActive ? "Active" : "Inactive"}
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => setEditing(r)}
                      className="p-1.5 rounded hover:bg-blue-50" style={{ color: SC.primary }}
                      data-testid={`btn-edit-${r.id}`}>
                      <PencilLine size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-5 py-3 border-t border-gray-100">
            <button className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
              style={{ borderColor: "#9ca3af" }} data-testid="btn-cancel">Cancel</button>
            <button onClick={() => setShowAdd(true)}
              className="px-8 py-2 rounded text-sm font-semibold text-white"
              style={{ background: SC.orange }} data-testid="btn-add">Add</button>
          </div>
        </div>
      </div>

      {showAdd && <PayModeTypeModal onClose={() => setShowAdd(false)} />}
      {editing && <PayModeTypeModal item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ─── Ledger Category Modal ────────────────────────────────────────────────────
function LedgerCategoryModal({ item, onClose }: { item?: any; onClose: () => void }) {
  const [name, setName] = useState(item?.name || "");
  const qc = useQueryClient();
  const isEdit = !!item?.id;

  const saveMut = useMutation({
    mutationFn: async () => {
      const code   = item?.code || name.trim().toUpperCase().replace(/\s+/g, "_") || `LC-${Date.now()}`;
      const url    = isEdit ? `/api/ledger-categories/${item.id}` : "/api/ledger-categories";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name: name.trim(), isActive: true }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Save failed"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/ledger-categories"] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">{isEdit ? "Edit Ledger Category" : "Create New Ledger Category"}</h2>
        </div>
        <div className="px-6 py-6">
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Category</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter New Category..."
              className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none focus:border-[#027fa5]"
              data-testid="input-category" autoFocus />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }} data-testid="btn-cancel">Cancel</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !name.trim()}
            className="px-8 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }} data-testid="btn-add">
            {saveMut.isPending ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
            {isEdit ? "Save" : "Add"}
          </button>
        </div>
        {saveMut.isError && <p className="px-6 pb-3 text-red-500 text-xs">{(saveMut.error as Error).message}</p>}
      </div>
    </div>
  );
}

export function LedgerCategories() {
  const [search, setSearch]   = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/ledger-categories"] });

  const filtered = rows.filter((r: any) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex justify-center p-6 bg-[#f5f0ed] min-h-screen">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 4px rgba(0,0,0,0.12)" }}>
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800 text-base whitespace-nowrap">Ledger Category</span>
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search Category name...."
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none"
                data-testid="input-search" />
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#d2f1fa" }}>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600 w-16">S.no</th>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Category</th>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-400">No ledger categories yet.</td></tr>
              ) : filtered.map((r: any, i: number) => (
                <tr key={r.id} className="hover:bg-gray-50" data-testid={`row-lc-${r.id}`}>
                  <td className="px-5 py-2.5 text-gray-500">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-5 py-2.5 font-medium text-gray-800">{r.name}</td>
                  <td className="px-5 py-2.5 text-sm" style={{ color: r.isActive ? "#16a34a" : "#9ca3af" }}>
                    {r.isActive ? "Active" : "Inactive"}
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => setEditing(r)}
                      className="p-1.5 rounded hover:bg-blue-50" style={{ color: SC.primary }}
                      data-testid={`btn-edit-${r.id}`}>
                      <PencilLine size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end gap-3 px-5 py-3 border-t border-gray-100">
            <button className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
              style={{ borderColor: "#9ca3af" }} data-testid="btn-cancel">Cancel</button>
            <button onClick={() => setShowAdd(true)}
              className="px-8 py-2 rounded text-sm font-semibold text-white"
              style={{ background: SC.orange }} data-testid="btn-add">Add</button>
          </div>
        </div>
      </div>

      {showAdd && <LedgerCategoryModal onClose={() => setShowAdd(false)} />}
      {editing && <LedgerCategoryModal item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// --- Term Types ---
export function TermTypes() {
  return <MasterPage config={{ title: "Term Types", apiBase: "/api/term-types", queryKey: "/api/term-types", fields: baseFields(), columns: baseCols() }} />;
}

// ─── Department Modal ─────────────────────────────────────────────────────────
function DepartmentModal({ item, onClose }: { item?: any; onClose: () => void }) {
  const [name, setName] = useState(item?.name || "");
  const qc = useQueryClient();
  const isEdit = !!item?.id;

  const saveMut = useMutation({
    mutationFn: async () => {
      const code = item?.code || name.trim().toUpperCase().replace(/\s+/g, "_") || `DEPT-${Date.now()}`;
      const url    = isEdit ? `/api/departments/${item.id}` : "/api/departments";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name: name.trim(), description: "", isActive: true }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Save failed"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/departments"] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">{isEdit ? "Edit Department" : "New Department"}</h2>
        </div>
        <div className="px-6 py-6">
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Department Name</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Type Department..."
              className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none focus:border-[#027fa5]"
              data-testid="input-department-name" autoFocus
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }} data-testid="btn-cancel">Cancel</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !name.trim()}
            className="px-8 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }} data-testid="btn-add">
            {saveMut.isPending ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
            {isEdit ? "Save" : "Add"}
          </button>
        </div>
        {saveMut.isError && <p className="px-6 pb-3 text-red-500 text-xs">{(saveMut.error as Error).message}</p>}
      </div>
    </div>
  );
}

export function Departments() {
  const [search, setSearch]   = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/departments"] });

  const filtered = rows.filter((r: any) =>
    !search || r.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex justify-center p-6 bg-[#f5f0ed] min-h-screen">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 4px rgba(0,0,0,0.12)" }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800 text-base whitespace-nowrap">Department</span>
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search Category...."
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none"
                data-testid="input-search"
              />
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#d2f1fa" }}>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600 w-16">S.no</th>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Department</th>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-400">No departments yet.</td></tr>
              ) : filtered.map((r: any, i: number) => (
                <tr key={r.id} className="hover:bg-gray-50" data-testid={`row-dept-${r.id}`}>
                  <td className="px-5 py-2.5 text-gray-500">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-5 py-2.5 font-medium text-gray-800 uppercase tracking-wide">{r.name}</td>
                  <td className="px-5 py-2.5 text-sm" style={{ color: r.isActive ? "#16a34a" : "#9ca3af" }}>
                    {r.isActive ? "Active" : "Inactive"}
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => setEditing(r)}
                      className="p-1.5 rounded hover:bg-blue-50" style={{ color: SC.primary }}
                      data-testid={`btn-edit-${r.id}`}>
                      <PencilLine size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-5 py-3 border-t border-gray-100">
            <button className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
              style={{ borderColor: "#9ca3af" }} data-testid="btn-cancel">Cancel</button>
            <button onClick={() => setShowAdd(true)}
              className="px-8 py-2 rounded text-sm font-semibold text-white"
              style={{ background: SC.orange }} data-testid="btn-add">Add</button>
          </div>
        </div>
      </div>

      {showAdd && <DepartmentModal onClose={() => setShowAdd(false)} />}
      {editing && <DepartmentModal item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// --- Store Item Groups ---
// ─── Item Group Modal ─────────────────────────────────────────────────────────
function ItemGroupModal({ item, onClose }: { item?: any; onClose: () => void }) {
  const [name, setName] = useState(item?.name || "");
  const qc = useQueryClient();
  const isEdit = !!item?.id;
  const saveMut = useMutation({
    mutationFn: async () => {
      const code = item?.code || name.trim().toUpperCase().replace(/\s+/g, "_") || `GRP-${Date.now()}`;
      const url = isEdit ? `/api/store-item-groups/${item.id}` : "/api/store-item-groups";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name: name.trim(), description: "", isActive: true }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Save failed"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/store-item-groups"] }); onClose(); },
  });
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">Item Group</h2>
        </div>
        <div className="px-6 py-8">
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Item group</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Type Store Item Group..."
              onKeyDown={e => e.key === "Enter" && name.trim() && saveMut.mutate()}
              className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none focus:border-[#027fa5]"
              data-testid="input-item-group-name" autoFocus
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }} data-testid="btn-cancel">Cancel</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !name.trim()}
            className="px-8 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }} data-testid="btn-add">
            {saveMut.isPending ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
            {isEdit ? "Save" : "Add"}
          </button>
        </div>
        {saveMut.isError && <p className="px-6 pb-3 text-red-500 text-xs">{(saveMut.error as Error).message}</p>}
      </div>
    </div>
  );
}

export function StoreItemGroups() {
  const [search, setSearch]   = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/store-item-groups"] });
  const filtered = rows.filter((r: any) => !search || r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex justify-center p-6 bg-[#f5f0ed] min-h-screen">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 4px rgba(0,0,0,0.12)" }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800 text-base whitespace-nowrap">Item Group</span>
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search Company Item Group...."
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none"
                data-testid="input-search"
              />
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#d2f1fa" }}>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600 w-16">S.no</th>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Item Group</th>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Status</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-400">No item groups yet.</td></tr>
              ) : filtered.map((r: any, i: number) => (
                <tr key={r.id} className="hover:bg-gray-50" data-testid={`row-group-${r.id}`}>
                  <td className="px-5 py-2.5 text-gray-500">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-5 py-2.5 font-medium text-gray-800 uppercase tracking-wide">{r.name}</td>
                  <td className="px-5 py-2.5 text-sm" style={{ color: r.isActive ? "#16a34a" : "#9ca3af" }}>
                    {r.isActive ? "Active" : "Inactive"}
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => setEditing(r)}
                      className="p-1.5 rounded hover:bg-blue-50" style={{ color: SC.primary }}
                      data-testid={`btn-edit-${r.id}`}>
                      <PencilLine size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-5 py-3 border-t border-gray-100">
            <button className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
              style={{ borderColor: "#9ca3af" }} data-testid="btn-cancel">Cancel</button>
            <button onClick={() => setShowAdd(true)}
              className="px-8 py-2 rounded text-sm font-semibold text-white"
              style={{ background: SC.orange }} data-testid="btn-add">Add</button>
          </div>
        </div>
      </div>

      {showAdd  && <ItemGroupModal onClose={() => setShowAdd(false)} />}
      {editing  && <ItemGroupModal item={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ─── Store Item Sub Group Modal ───────────────────────────────────────────────
function ItemSubGroupModal({ item, groups, onClose }: { item?: any; groups: any[]; onClose: () => void }) {
  const [name, setName]       = useState(item?.name || "");
  const [groupId, setGroupId] = useState(item?.groupId || "");
  const qc = useQueryClient();
  const isEdit = !!item?.id;

  const saveMut = useMutation({
    mutationFn: async () => {
      const code = item?.code || name.trim().toUpperCase().replace(/\s+/g, "_") || `SUBGRP-${Date.now()}`;
      const url    = isEdit ? `/api/store-item-sub-groups/${item.id}` : "/api/store-item-sub-groups";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, name: name.trim(), groupId: groupId || null, isActive: true }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Save failed"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/store-item-sub-groups"] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">Item Sub Group</h2>
        </div>
        <div className="px-6 py-6 space-y-5">
          {/* Item Sub Group Name */}
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Item Sub Group Name</label>
            <input
              value={name} onChange={e => setName(e.target.value)}
              placeholder="Enter Item Sub Group"
              className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none focus:border-[#027fa5]"
              data-testid="input-sub-group-name" autoFocus
            />
          </div>
          {/* Group Dropdown */}
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Group</label>
            <select
              value={groupId} onChange={e => setGroupId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#027fa5] appearance-none"
              data-testid="select-group"
            >
              <option value="">Select</option>
              {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">▾</span>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }} data-testid="btn-cancel">Cancel</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !name.trim()}
            className="px-8 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }} data-testid="btn-add">
            {saveMut.isPending ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
            {isEdit ? "Save" : "Add"}
          </button>
        </div>
        {saveMut.isError && <p className="px-6 pb-3 text-red-500 text-xs">{(saveMut.error as Error).message}</p>}
      </div>
    </div>
  );
}

export function StoreItemSubGroups() {
  const [search, setSearch]   = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/store-item-sub-groups"] });
  const { data: groups = [] }          = useQuery<any[]>({ queryKey: ["/api/store-item-groups"] });
  const groupMap = Object.fromEntries(groups.map((g: any) => [g.id, g.name]));

  const filtered = rows.filter((r: any) =>
    !search ||
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (groupMap[r.groupId] || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex justify-center p-6 bg-[#f5f0ed] min-h-screen">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 4px rgba(0,0,0,0.12)" }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
            <span className="font-semibold text-gray-800 text-base whitespace-nowrap">Item Sub Group</span>
            <div className="relative flex-1">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search Item group and sub group...."
                className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none"
                data-testid="input-search"
              />
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "#d2f1fa" }}>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600 w-16">S.no</th>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Item Sub Group</th>
                <th className="text-left px-5 py-2.5 font-semibold text-gray-600">Item Group</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-400">No sub groups yet.</td></tr>
              ) : filtered.map((r: any, i: number) => (
                <tr key={r.id} className="hover:bg-gray-50" data-testid={`row-subgroup-${r.id}`}>
                  <td className="px-5 py-2.5 text-gray-500">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-5 py-2.5 font-medium text-gray-800 uppercase tracking-wide">{r.name}</td>
                  <td className="px-5 py-2.5 text-gray-600">{groupMap[r.groupId] || "—"}</td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => setEditing(r)}
                      className="p-1.5 rounded hover:bg-blue-50" style={{ color: SC.primary }}
                      data-testid={`btn-edit-${r.id}`}>
                      <PencilLine size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-5 py-3 border-t border-gray-100">
            <button className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
              style={{ borderColor: "#9ca3af" }} data-testid="btn-cancel">Cancel</button>
            <button onClick={() => setShowAdd(true)}
              className="px-8 py-2 rounded text-sm font-semibold text-white"
              style={{ background: SC.orange }} data-testid="btn-add">Add</button>
          </div>
        </div>
      </div>

      {showAdd && <ItemSubGroupModal groups={groups} onClose={() => setShowAdd(false)} />}
      {editing && <ItemSubGroupModal item={editing} groups={groups} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ─── General Ledger Modal ──────────────────────────────────────────────────────
function GeneralLedgerModal({ item, categories, onClose }: { item?: any; categories: any[]; onClose: () => void }) {
  const isEdit = !!item?.id;
  const qc = useQueryClient();

  const [name, setName]       = useState(item?.name || "");
  const [catId, setCatId]     = useState(item?.categoryId || "");
  const [desc, setDesc]       = useState(item?.description || "");

  const saveMut = useMutation({
    mutationFn: async () => {
      const code = item?.code || `GL-${Date.now()}`;
      const url    = isEdit ? `/api/general-ledgers/${item.id}` : "/api/general-ledgers";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code, name: name.trim(),
          categoryId: catId || null,
          description: desc,
          isActive: true,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Save failed"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/general-ledgers"] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)" }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4" style={{ fontFamily: "Source Sans Pro, sans-serif" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-base">{isEdit ? "Edit Ledger" : "Create New Ledger"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none" data-testid="btn-modal-close">✕</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Ledger Name */}
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Ledger Name *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Enter Ledger Name..."
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
              data-testid="input-ledger-name" />
          </div>

          {/* Category */}
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Ledger Category</label>
            <select value={catId} onChange={e => setCatId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm bg-white outline-none focus:border-[#027fa5] appearance-none"
              data-testid="select-category">
              <option value="">-- Select Category --</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Description */}
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              rows={2} placeholder="Optional description..."
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5] resize-none"
              data-testid="input-description" />
          </div>

          {saveMut.isError && <p className="text-red-500 text-xs">{(saveMut.error as any)?.message}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose}
            className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }} data-testid="btn-cancel">Cancel</button>
          <button onClick={() => saveMut.mutate()} disabled={!name.trim() || saveMut.isPending}
            className="px-8 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }} data-testid="btn-save">
            {saveMut.isPending ? "Saving..." : isEdit ? "Save" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── General Ledgers List ──────────────────────────────────────────────────────
export function GeneralLedgers() {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const { data: ledgers = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/general-ledgers"] });
  const { data: categories = [] } = useQuery<any[]>({ queryKey: ["/api/ledger-categories"] });

  const catMap: Record<string, string> = {};
  categories.forEach((c: any) => { catMap[c.id] = c.name; });

  const filtered = ledgers.filter(r => r.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h1 className="font-semibold text-gray-800 text-base">General Ledger</h1>
          <div className="relative w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search Ledger name..."
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded w-full outline-none focus:border-[#027fa5]"
              data-testid="input-search" />
          </div>
        </div>

        {/* Table */}
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: SC.tonal }}>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700 w-12">S.no</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Ledger Name</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Category</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Status</th>
              <th className="px-3 py-2.5 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">Loading...</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">No ledgers found</td></tr>
            )}
            {filtered.map((r, i) => (
              <tr key={r.id} className={`border-t border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                data-testid={`row-ledger-${r.id}`}>
                <td className="px-5 py-2.5 text-gray-500">{i + 1}</td>
                <td className="px-5 py-2.5 font-medium text-gray-800">{r.name}</td>
                <td className="px-5 py-2.5 text-gray-600">{catMap[r.categoryId] || <span className="text-gray-300">—</span>}</td>
                <td className="px-5 py-2.5">
                  <span className={`text-xs font-semibold ${r.isActive ? "text-green-600" : "text-red-400"}`}>
                    {r.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <button onClick={() => setEditing(r)}
                    className="p-1.5 rounded hover:bg-blue-50" style={{ color: SC.primary }}
                    data-testid={`btn-edit-${r.id}`}>
                    <PencilLine size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-3 border-t border-gray-100">
          <button className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }} data-testid="btn-cancel">Cancel</button>
          <button onClick={() => setShowAdd(true)}
            className="px-8 py-2 rounded text-sm font-semibold text-white"
            style={{ background: SC.orange }} data-testid="btn-add">Add</button>
        </div>
      </div>

      {showAdd && <GeneralLedgerModal categories={categories} onClose={() => setShowAdd(false)} />}
      {editing && <GeneralLedgerModal item={editing} categories={categories} onClose={() => setEditing(null)} />}
    </div>
  );
}
