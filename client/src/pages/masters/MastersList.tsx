import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit, X, Loader2, CheckCircle, XCircle } from "lucide-react";

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

// --- Units of Measure ---
export function UnitsOfMeasure() {
  return <MasterPage config={{
    title: "Units of Measure",
    apiBase: "/api/uom",
    queryKey: "/api/uom",
    fields: [
      { name: "code", label: "UOM Code *" },
      { name: "name", label: "UOM Name *" },
      { name: "description", label: "Description" },
      { name: "isActive", label: "Status", type: "checkbox", checkLabel: "Active", default: true },
    ],
    columns: [
      { label: "Code", key: "code", render: (r: any) => <span className="font-mono text-xs font-semibold" style={{ color: "#027fa5" }}>{r.code}</span> },
      { label: "Name", key: "name", render: (r: any) => <span className="font-medium">{r.name}</span> },
      { label: "Description", key: "description" },
      { label: "Status", key: "isActive", render: (r: any) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{r.isActive ? "Active" : "Inactive"}</span> },
    ]
  }} />;
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

// --- Categories ---
export function Categories() {
  return <MasterPage config={{ title: "Categories", apiBase: "/api/categories", queryKey: "/api/categories", fields: baseFields(), columns: baseCols() }} />;
}

// --- Voucher Types ---
export function VoucherTypes() {
  return <MasterPage config={{ title: "Voucher Types", apiBase: "/api/voucher-types", queryKey: "/api/voucher-types", fields: baseFields(), columns: baseCols() }} />;
}

// --- Pay Mode Types ---
export function PayModeTypes() {
  return <MasterPage config={{ title: "Pay Mode Types", apiBase: "/api/pay-mode-types", queryKey: "/api/pay-mode-types", fields: baseFields(), columns: baseCols() }} />;
}

// --- Ledger Categories ---
export function LedgerCategories() {
  return <MasterPage config={{ title: "Ledger Categories", apiBase: "/api/ledger-categories", queryKey: "/api/ledger-categories", fields: baseFields(), columns: baseCols() }} />;
}

// --- Term Types ---
export function TermTypes() {
  return <MasterPage config={{ title: "Term Types", apiBase: "/api/term-types", queryKey: "/api/term-types", fields: baseFields(), columns: baseCols() }} />;
}

// --- Departments ---
export function Departments() {
  return <MasterPage config={{ title: "Departments", apiBase: "/api/departments", queryKey: "/api/departments", fields: baseFields(), columns: baseCols() }} />;
}

// --- Store Item Groups ---
export function StoreItemGroups() {
  return <MasterPage config={{ title: "Store Item Groups", apiBase: "/api/store-item-groups", queryKey: "/api/store-item-groups", fields: baseFields(), columns: baseCols() }} />;
}
