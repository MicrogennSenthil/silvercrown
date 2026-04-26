import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit, X, Loader2 } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa" };

function apiReq(url: string, method: string, body?: any) {
  return fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, credentials: "include" }).then(r => r.json());
}

const StatusBadge = ({ v }: { v: boolean }) => (
  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{v ? "Active" : "Inactive"}</span>
);
const CodeSpan = ({ v }: { v: string }) => <span className="font-mono text-xs font-semibold" style={{ color: SC.primary }}>{v}</span>;

function useSimpleCRUD(apiBase: string, queryKey: string) {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: [queryKey] });
  const del = useMutation({
    mutationFn: (id: string) => apiReq(`${apiBase}/${id}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] })
  });
  return { rows, isLoading, del, qc };
}

// ─── Machine Master ───────────────────────────────────────────────────────────

function MachineForm({ initial, onClose }: any) {
  const [form, setForm] = useState({ code: "", name: "", department: "", description: "", capacity: "", location: "", isActive: true, ...initial });
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (data: any) => apiReq(initial?.id ? `/api/machines/${initial.id}` : "/api/machines", initial?.id ? "PATCH" : "POST", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/machines"] }); onClose(); }
  });
  const inp = (label: string, name: string, type = "text") => (
    <div>
      <label className="block text-xs font-medium mb-1 text-gray-600">{label}</label>
      {type === "textarea" ? (
        <textarea value={form[name] || ""} onChange={e => setForm((s: any) => ({ ...s, [name]: e.target.value }))} rows={2}
          className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid={`input-${name}`} />
      ) : (
        <input type={type} value={form[name] ?? ""} onChange={e => setForm((s: any) => ({ ...s, [name]: e.target.value }))}
          className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid={`input-${name}`} />
      )}
    </div>
  );
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#b8d2da" }}>
          <h2 className="text-lg font-bold" style={{ color: SC.primary }}>{initial?.id ? "Edit" : "New"} Machine</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">{inp("Machine Code *", "code")}{inp("Machine Name *", "name")}</div>
          <div className="grid grid-cols-2 gap-4">{inp("Department", "department")}{inp("Location", "location")}</div>
          {inp("Capacity", "capacity")}
          {inp("Description", "description", "textarea")}
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={!!form.isActive} onChange={e => setForm((s: any) => ({ ...s, isActive: e.target.checked }))} className="w-4 h-4" data-testid="input-isActive" />
            <span className="text-sm text-gray-600">Active</span>
          </div>
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

export function MachineMaster() {
  const [search, setSearch] = useState(""); const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null);
  const { rows, isLoading, del } = useSimpleCRUD("/api/machines", "/api/machines");
  const filtered = rows.filter((r: any) => [r.code, r.name, r.department].some(v => String(v || "").toLowerCase().includes(search.toLowerCase())));
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-800">Machine Master</h1><p className="text-sm text-gray-500 mt-0.5">Machine & equipment master data</p></div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }} data-testid="button-new">
          <Plus size={16} /> New Machine
        </button>
      </div>
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
        <div className="px-5 py-3 border-b border-gray-100">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search machines..."
            className="border rounded px-3 py-2 text-sm focus:outline-none w-52" style={{ borderColor: "#00000030" }} data-testid="input-search" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ background: SC.tonal }}>
              {["Code", "Name", "Department", "Location", "Capacity", "Status", ""].map(h => <th key={h} className="text-left px-5 py-3 font-semibold text-gray-600">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? [...Array(3)].map((_, i) => <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>) :
                filtered.length ? filtered.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3"><CodeSpan v={r.code} /></td>
                    <td className="px-5 py-3 font-medium">{r.name}</td>
                    <td className="px-5 py-3 text-gray-600">{r.department || "—"}</td>
                    <td className="px-5 py-3 text-gray-600">{r.location || "—"}</td>
                    <td className="px-5 py-3 text-gray-600">{r.capacity || "—"}</td>
                    <td className="px-5 py-3"><StatusBadge v={r.isActive} /></td>
                    <td className="px-5 py-3"><div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditing(r); setShowForm(true); }} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" data-testid={`button-edit-${r.id}`}><Edit size={15} /></button>
                      <button onClick={() => { if (confirm("Delete this machine?")) del.mutate(r.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`button-delete-${r.id}`}><Trash2 size={15} /></button>
                    </div></td>
                  </tr>
                )) : <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">No machines found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && <MachineForm initial={editing} onClose={() => setShowForm(false)} />}
    </div>
  );
}

// ─── Purchase Store Items ─────────────────────────────────────────────────────

function PurchaseStoreItemForm({ initial, groups, onClose }: any) {
  const [form, setForm] = useState({ code: "", name: "", itemGroupId: "", uom: "", description: "", isActive: true, ...initial });
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (data: any) => apiReq(initial?.id ? `/api/purchase-store-items/${initial.id}` : "/api/purchase-store-items", initial?.id ? "PATCH" : "POST", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/purchase-store-items"] }); onClose(); }
  });
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#b8d2da" }}>
          <h2 className="text-lg font-bold" style={{ color: SC.primary }}>{initial?.id ? "Edit" : "New"} Purchase Store Item</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {[["code", "Item Code *"], ["name", "Item Name *"], ["uom", "UOM"]].map(([name, label]) => (
            <div key={name}>
              <label className="block text-sm font-medium mb-1 text-gray-600">{label}</label>
              <input value={form[name] ?? ""} onChange={e => setForm((s: any) => ({ ...s, [name]: e.target.value }))}
                className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid={`input-${name}`} />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-600">Item Group</label>
            <select value={form.itemGroupId || ""} onChange={e => setForm((s: any) => ({ ...s, itemGroupId: e.target.value }))}
              className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="input-itemGroupId">
              <option value="">— Select Group —</option>
              {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-600">Description</label>
            <textarea value={form.description || ""} onChange={e => setForm((s: any) => ({ ...s, description: e.target.value }))} rows={2}
              className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="input-description" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={!!form.isActive} onChange={e => setForm((s: any) => ({ ...s, isActive: e.target.checked }))} className="w-4 h-4" data-testid="input-isActive" />
            <span className="text-sm text-gray-600">Active</span>
          </div>
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

export function PurchaseStoreItems() {
  const [search, setSearch] = useState(""); const [filterGroup, setFilterGroup] = useState("");
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null);
  const { rows, isLoading, del } = useSimpleCRUD("/api/purchase-store-items", "/api/purchase-store-items");
  const { data: groups = [] } = useQuery<any[]>({ queryKey: ["/api/store-item-groups"] });
  const groupMap = Object.fromEntries(groups.map((g: any) => [g.id, g.name]));
  const filtered = rows.filter((r: any) =>
    (!filterGroup || r.itemGroupId === filterGroup) &&
    (!search || [r.code, r.name].some(v => String(v || "").toLowerCase().includes(search.toLowerCase())))
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-800">Purchase Store Items</h1><p className="text-sm text-gray-500 mt-0.5">Purchase store item master</p></div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }} data-testid="button-new">
          <Plus size={16} /> New Item
        </button>
      </div>
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items..."
            className="border rounded px-3 py-2 text-sm focus:outline-none w-52" style={{ borderColor: "#00000030" }} data-testid="input-search" />
          <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)}
            className="border rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="filter-group">
            <option value="">All Groups</option>
            {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ background: SC.tonal }}>
              {["Code", "Name", "Group", "UOM", "Status", ""].map(h => <th key={h} className="text-left px-5 py-3 font-semibold text-gray-600">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? [...Array(3)].map((_, i) => <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>) :
                filtered.length ? filtered.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3"><CodeSpan v={r.code} /></td>
                    <td className="px-5 py-3 font-medium">{r.name}</td>
                    <td className="px-5 py-3 text-gray-600">{groupMap[r.itemGroupId] || "—"}</td>
                    <td className="px-5 py-3 text-gray-600">{r.uom || "—"}</td>
                    <td className="px-5 py-3"><StatusBadge v={r.isActive} /></td>
                    <td className="px-5 py-3"><div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditing(r); setShowForm(true); }} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" data-testid={`button-edit-${r.id}`}><Edit size={15} /></button>
                      <button onClick={() => { if (confirm("Delete this item?")) del.mutate(r.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`button-delete-${r.id}`}><Trash2 size={15} /></button>
                    </div></td>
                  </tr>
                )) : <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">No items found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && <PurchaseStoreItemForm initial={editing} groups={groups} onClose={() => setShowForm(false)} />}
    </div>
  );
}

// ─── Purchase Approval Levels ─────────────────────────────────────────────────

function PurchaseApprovalForm({ initial, onClose }: any) {
  const [form, setForm] = useState({ name: "", approvalLevel: "1", minAmount: "0", maxAmount: "0", approverRole: "", description: "", isActive: true, ...initial });
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (data: any) => apiReq(initial?.id ? `/api/purchase-approvals/${initial.id}` : "/api/purchase-approvals", initial?.id ? "PATCH" : "POST", {
      ...data, approvalLevel: Number(data.approvalLevel), minAmount: String(data.minAmount), maxAmount: String(data.maxAmount)
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/purchase-approvals"] }); onClose(); }
  });
  const inp = (label: string, name: string, type = "text") => (
    <div>
      <label className="block text-sm font-medium mb-1 text-gray-600">{label}</label>
      <input type={type} value={form[name] ?? ""} onChange={e => setForm((s: any) => ({ ...s, [name]: e.target.value }))}
        className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid={`input-${name}`} />
    </div>
  );
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#b8d2da" }}>
          <h2 className="text-lg font-bold" style={{ color: SC.primary }}>{initial?.id ? "Edit" : "New"} Approval Level</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {inp("Name *", "name")}
          <div className="grid grid-cols-2 gap-4">{inp("Approval Level *", "approvalLevel", "number")}{inp("Approver Role", "approverRole")}</div>
          <div className="grid grid-cols-2 gap-4">{inp("Min Amount", "minAmount", "number")}{inp("Max Amount", "maxAmount", "number")}</div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-600">Description</label>
            <textarea value={form.description || ""} onChange={e => setForm((s: any) => ({ ...s, description: e.target.value }))} rows={2}
              className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="input-description" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={!!form.isActive} onChange={e => setForm((s: any) => ({ ...s, isActive: e.target.checked }))} className="w-4 h-4" data-testid="input-isActive" />
            <span className="text-sm text-gray-600">Active</span>
          </div>
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

export function PurchaseApprovals() {
  const [search, setSearch] = useState(""); const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null);
  const { rows, isLoading, del } = useSimpleCRUD("/api/purchase-approvals", "/api/purchase-approvals");
  const filtered = rows.filter((r: any) => [r.name, r.approverRole].some(v => String(v || "").toLowerCase().includes(search.toLowerCase())));
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-800">Purchase Approval</h1><p className="text-sm text-gray-500 mt-0.5">Approval level configuration</p></div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }} data-testid="button-new">
          <Plus size={16} /> New Level
        </button>
      </div>
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
        <div className="px-5 py-3 border-b border-gray-100">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search approval levels..."
            className="border rounded px-3 py-2 text-sm focus:outline-none w-52" style={{ borderColor: "#00000030" }} data-testid="input-search" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ background: SC.tonal }}>
              {["Level", "Name", "Approver Role", "Min Amount", "Max Amount", "Status", ""].map(h => <th key={h} className="text-left px-5 py-3 font-semibold text-gray-600">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? [...Array(3)].map((_, i) => <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>) :
                filtered.length ? filtered.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3"><span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: SC.primary }}>{r.approvalLevel}</span></td>
                    <td className="px-5 py-3 font-medium">{r.name}</td>
                    <td className="px-5 py-3 text-gray-600">{r.approverRole || "—"}</td>
                    <td className="px-5 py-3 text-right font-mono">{Number(r.minAmount || 0).toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3 text-right font-mono">{Number(r.maxAmount || 0).toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3"><StatusBadge v={r.isActive} /></td>
                    <td className="px-5 py-3"><div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditing(r); setShowForm(true); }} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" data-testid={`button-edit-${r.id}`}><Edit size={15} /></button>
                      <button onClick={() => { if (confirm("Delete this approval level?")) del.mutate(r.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`button-delete-${r.id}`}><Trash2 size={15} /></button>
                    </div></td>
                  </tr>
                )) : <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">No approval levels configured</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && <PurchaseApprovalForm initial={editing} onClose={() => setShowForm(false)} />}
    </div>
  );
}

// ─── Terms ────────────────────────────────────────────────────────────────────

function TermForm({ initial, termTypes, onClose }: any) {
  const [form, setForm] = useState({ code: "", name: "", termTypeId: "", days: "0", description: "", isActive: true, ...initial });
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (data: any) => apiReq(initial?.id ? `/api/terms/${initial.id}` : "/api/terms", initial?.id ? "PATCH" : "POST", { ...data, days: Number(data.days) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/terms"] }); onClose(); }
  });
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#b8d2da" }}>
          <h2 className="text-lg font-bold" style={{ color: SC.primary }}>{initial?.id ? "Edit" : "New"} Term</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {[["code", "Code *"], ["name", "Name *"]].map(([name, label]) => (
              <div key={name}>
                <label className="block text-sm font-medium mb-1 text-gray-600">{label}</label>
                <input value={form[name] ?? ""} onChange={e => setForm((s: any) => ({ ...s, [name]: e.target.value }))}
                  className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid={`input-${name}`} />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600">Term Type</label>
              <select value={form.termTypeId || ""} onChange={e => setForm((s: any) => ({ ...s, termTypeId: e.target.value }))}
                className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="input-termTypeId">
                <option value="">— Select —</option>
                {termTypes.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600">Days</label>
              <input type="number" value={form.days ?? 0} onChange={e => setForm((s: any) => ({ ...s, days: e.target.value }))}
                className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="input-days" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-600">Description</label>
            <textarea value={form.description || ""} onChange={e => setForm((s: any) => ({ ...s, description: e.target.value }))} rows={2}
              className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="input-description" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" checked={!!form.isActive} onChange={e => setForm((s: any) => ({ ...s, isActive: e.target.checked }))} className="w-4 h-4" data-testid="input-isActive" />
            <span className="text-sm text-gray-600">Active</span>
          </div>
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

export function Terms() {
  const [search, setSearch] = useState(""); const [filterType, setFilterType] = useState("");
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null);
  const { rows, isLoading, del } = useSimpleCRUD("/api/terms", "/api/terms");
  const { data: termTypes = [] } = useQuery<any[]>({ queryKey: ["/api/term-types"] });
  const typeMap = Object.fromEntries(termTypes.map((t: any) => [t.id, t.name]));
  const filtered = rows.filter((r: any) =>
    (!filterType || r.termTypeId === filterType) &&
    (!search || [r.code, r.name].some(v => String(v || "").toLowerCase().includes(search.toLowerCase())))
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-800">Terms</h1><p className="text-sm text-gray-500 mt-0.5">Payment and delivery terms</p></div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }} data-testid="button-new">
          <Plus size={16} /> New Term
        </button>
      </div>
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search terms..."
            className="border rounded px-3 py-2 text-sm focus:outline-none w-52" style={{ borderColor: "#00000030" }} data-testid="input-search" />
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="border rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="filter-type">
            <option value="">All Term Types</option>
            {termTypes.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ background: SC.tonal }}>
              {["Code", "Name", "Type", "Days", "Description", "Status", ""].map(h => <th key={h} className="text-left px-5 py-3 font-semibold text-gray-600">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? [...Array(3)].map((_, i) => <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>) :
                filtered.length ? filtered.map((r: any) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3"><CodeSpan v={r.code} /></td>
                    <td className="px-5 py-3 font-medium">{r.name}</td>
                    <td className="px-5 py-3 text-gray-600">{typeMap[r.termTypeId] || "—"}</td>
                    <td className="px-5 py-3 text-center font-semibold" style={{ color: SC.primary }}>{r.days ?? 0}</td>
                    <td className="px-5 py-3 text-gray-500">{r.description || "—"}</td>
                    <td className="px-5 py-3"><StatusBadge v={r.isActive} /></td>
                    <td className="px-5 py-3"><div className="flex gap-2 justify-end">
                      <button onClick={() => { setEditing(r); setShowForm(true); }} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" data-testid={`button-edit-${r.id}`}><Edit size={15} /></button>
                      <button onClick={() => { if (confirm("Delete this term?")) del.mutate(r.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`button-delete-${r.id}`}><Trash2 size={15} /></button>
                    </div></td>
                  </tr>
                )) : <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">No terms found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && <TermForm initial={editing} termTypes={termTypes} onClose={() => setShowForm(false)} />}
    </div>
  );
}
