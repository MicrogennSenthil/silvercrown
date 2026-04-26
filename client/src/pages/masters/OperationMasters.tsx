import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit, X, Loader2, Search, Info, ChevronDown, PencilLine } from "lucide-react";

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

// Floating-label text input
function MFField({ label, value, onChange, placeholder = "", type = "text" }: any) {
  return (
    <div className="relative">
      <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">{label}</label>
      <input type={type} value={value ?? ""} onChange={onChange} placeholder={placeholder}
        className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400 bg-white"
        data-testid={`input-${label.toLowerCase().replace(/\s+/g, "-")}`} />
    </div>
  );
}

// Floating-label text dropdown with + button
function MDropPlus({ label, value, onChange, options = [] }: any) {
  return (
    <div className="flex items-center gap-1.5 flex-1">
      <div className="relative flex-1">
        <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">{label}</label>
        <select value={value ?? ""} onChange={onChange}
          className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none appearance-none bg-white pr-8"
          data-testid={`select-${label.toLowerCase().replace(/\s+/g, "-")}`}>
          <option value="">Select</option>
          {options.map((o: string, i: number) => <option key={i} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
      <button className="flex-shrink-0 w-7 h-7 rounded flex items-center justify-center text-white font-bold mt-0.5"
        style={{ background: SC.primary }}>+</button>
    </div>
  );
}

function MachineModal({ initial, onClose }: any) {
  const EMPTY = { machineId: "", name: "", machineGroup: "", subGroup: "", dueTime: "", calibrationDate: "", company: "", notes: "", code: "" };
  const [form, setForm] = useState<any>({ ...EMPTY, ...initial, machineId: initial?.machineId || initial?.code || "" });
  const qc = useQueryClient();

  const f = (key: string) => (e: any) => setForm((p: any) => ({ ...p, [key]: e.target.value }));

  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      const payload = { ...data, code: data.machineId || data.code || `MCH-${Date.now()}`, name: data.name || data.machineId };
      const url    = initial?.id ? `/api/machines/${initial.id}` : "/api/machines";
      const method = initial?.id ? "PATCH" : "POST";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), credentials: "include" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Save failed"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/machines"] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-xl shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">{initial?.id ? "Edit Machine" : "New Machines"}</h2>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Row 1: Machine ID + Machine Name */}
          <div className="flex gap-4">
            <MFField label="Machine ID" value={form.machineId} onChange={f("machineId")} placeholder="Enter Id..." className="flex-1" />
            <MFField label="Machine Name" value={form.name} onChange={f("name")} placeholder="Enter Machine Name Here..." className="flex-1" />
          </div>

          {/* Row 2: Group + Sub Group */}
          <div className="flex gap-4">
            <MDropPlus label="Group"     value={form.machineGroup} onChange={f("machineGroup")} />
            <MDropPlus label="Sub Group" value={form.subGroup}     onChange={f("subGroup")} />
          </div>

          {/* Row 3: Due Time + Calibration Date + Company */}
          <div className="grid grid-cols-3 gap-4">
            <MFField label="Due Time"         value={form.dueTime}          onChange={f("dueTime")}          placeholder="Type Here..." />
            <MFField label="Calibration Date" value={form.calibrationDate}  onChange={f("calibrationDate")}  placeholder="Type Here..." />
            <MFField label="Company"          value={form.company}          onChange={f("company")}           placeholder="Type Here..." />
          </div>

          {/* Row 4: Notes */}
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Notes</label>
            <textarea value={form.notes ?? ""} onChange={f("notes")} placeholder="Type here..." rows={2}
              className="w-full border border-gray-300 rounded px-3 pt-4 pb-2 text-sm text-gray-700 focus:outline-none resize-none"
              data-testid="input-notes" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }} data-testid="button-cancel">Cancel</button>
          <button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending || !form.machineId.trim()}
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

export function MachineMaster() {
  const [search, setSearch]    = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]  = useState<any>(null);
  const [notes, setNotes]       = useState("");
  const { rows, isLoading, del } = useSimpleCRUD("/api/machines", "/api/machines");

  const filtered = rows.filter((r: any) =>
    !search || [r.machineId, r.code, r.name, r.machineGroup, r.calibrationDate].some(v => String(v || "").toLowerCase().includes(search.toLowerCase()))
  );

  const COLS = ["S.no", "Machine Id", "Machine Name", "Group", "Sub Group", "Due Time", "Calibration Date", "Company", ""];

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white rounded-xl flex-1 flex flex-col overflow-hidden" style={{ boxShadow: "1px 1px 4px rgba(0,0,0,0.12)" }}>
        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-100">
          <span className="font-semibold text-gray-800 text-base whitespace-nowrap">Machine list</span>
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search Machine Name, ID, Group, Calibration........."
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
                <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-gray-400">No machines found. Click <strong>Add</strong> to create one.</td></tr>
              ) : filtered.map((r: any, i: number) => (
                <tr key={r.id} className="hover:bg-gray-50" data-testid={`row-machine-${r.id}`}>
                  <td className="px-3 py-2.5 text-gray-500">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-3 py-2.5 font-mono text-xs font-semibold" style={{ color: SC.primary }}>{r.machineId || r.code || "—"}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-800">{r.name}</td>
                  <td className="px-3 py-2.5 text-gray-600">{r.machineGroup || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600">{r.subGroup || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600">{r.dueTime || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600">{r.calibrationDate || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600">{r.company || "—"}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <button onClick={() => { setEditing(r); setShowForm(true); }}
                        className="p-1.5 rounded hover:bg-blue-50" style={{ color: SC.primary }}
                        data-testid={`button-edit-${r.id}`}><PencilLine size={13} /></button>
                      <button onClick={() => { if (confirm("Delete this machine?")) del.mutate(r.id); }}
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

      {showForm && <MachineModal initial={editing} onClose={() => { setShowForm(false); setEditing(null); }} />}
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

const DEFAULT_LEVELS = [
  { level: "Level - 1", selected: false, procedure: "" },
  { level: "Level - 2", selected: false, procedure: "" },
  { level: "Level - 3", selected: false, procedure: "" },
  { level: "Level - 4", selected: false, procedure: "" },
  { level: "Level - 5", selected: false, procedure: "" },
];

export function PurchaseApprovals() {
  const qc = useQueryClient();
  const { data: configs = [] } = useQuery<any[]>({ queryKey: ["/api/purchase-approval-config"] });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [transactionType, setTransactionType] = useState("");
  const [typeCode, setTypeCode] = useState("");
  const [levels, setLevels] = useState(DEFAULT_LEVELS.map(l => ({ ...l })));

  const saveMutation = useMutation({
    mutationFn: (payload: any) => editingId
      ? apiReq(`/api/purchase-approval-config/${editingId}`, "PATCH", payload)
      : apiReq("/api/purchase-approval-config", "POST", payload),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/purchase-approval-config"] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiReq(`/api/purchase-approval-config/${id}`, "DELETE", undefined),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/purchase-approval-config"] }); handleCancel(); },
  });

  function handleCancel() {
    setEditingId(null);
    setTransactionType("");
    setTypeCode("");
    setLevels(DEFAULT_LEVELS.map(l => ({ ...l })));
  }

  function loadConfig(cfg: any) {
    setEditingId(cfg.id);
    setTransactionType(cfg.transactionType);
    setTypeCode(cfg.typeCode);
    const loaded = DEFAULT_LEVELS.map(dl => {
      const found = (cfg.levels || []).find((l: any) => l.level === dl.level);
      return found ? { ...found } : { ...dl };
    });
    setLevels(loaded);
  }

  function toggleLevel(idx: number) {
    setLevels(ls => ls.map((l, i) => i === idx ? { ...l, selected: !l.selected } : l));
  }

  function setProcedure(idx: number, val: string) {
    setLevels(ls => ls.map((l, i) => i === idx ? { ...l, procedure: val } : l));
  }

  return (
    <div className="p-6 bg-[#f5f0ed] min-h-screen">
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-xl font-bold text-[#027fa5]">Purchase Approval</h1>
      </div>

      <div className="max-w-2xl bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Card Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <span className="font-semibold text-base text-gray-800">Approval Settings</span>
          <Info size={17} className="text-gray-400" />
        </div>

        <div className="px-5 pb-4 space-y-4">
          {/* Row: Transaction Type + Type */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <label className="absolute -top-2.5 left-3 bg-white px-1 text-xs text-gray-500">Transaction Type</label>
              <input
                data-testid="input-transaction-type"
                value={transactionType}
                onChange={e => setTransactionType(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 pt-3 pb-2 text-sm focus:outline-none focus:border-[#027fa5]"
                placeholder="e.g. Purchase Order"
              />
            </div>
            <div className="relative w-40">
              <label className="absolute -top-2.5 left-3 bg-white px-1 text-xs text-gray-500">Type</label>
              <input
                data-testid="input-type-code"
                value={typeCode}
                onChange={e => setTypeCode(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 pt-3 pb-2 text-sm focus:outline-none focus:border-[#027fa5]"
                placeholder="e.g. P.O"
              />
            </div>
          </div>

          {/* Levels Table */}
          <div className="border border-gray-200 rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#b8d9e8] text-gray-700">
                  <th className="px-4 py-2 text-left font-medium w-14">S.no</th>
                  <th className="px-4 py-2 text-left font-medium">Approval Level</th>
                  <th className="px-4 py-2 text-center font-medium w-16">Select</th>
                  <th className="px-4 py-2 text-left font-medium">Approval Procedure</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((lv, idx) => (
                  <tr key={lv.level} className="border-t border-gray-100">
                    <td className="px-4 py-2.5 text-gray-600">{String(idx + 1).padStart(2, "0")}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-700">{lv.level}</td>
                    <td className="px-4 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={lv.selected}
                        onChange={() => toggleLevel(idx)}
                        data-testid={`checkbox-level-${idx}`}
                        className="w-4 h-4 accent-[#027fa5] cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-2 pr-4">
                      <input
                        value={lv.procedure}
                        onChange={e => setProcedure(idx, e.target.value)}
                        placeholder="Enter"
                        data-testid={`input-procedure-${idx}`}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-[#027fa5]"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Saved configs list */}
          {configs.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1 font-medium">Saved configurations:</p>
              <div className="flex flex-wrap gap-2">
                {configs.map((cfg: any) => (
                  <button
                    key={cfg.id}
                    onClick={() => loadConfig(cfg)}
                    data-testid={`btn-load-config-${cfg.id}`}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      editingId === cfg.id
                        ? "bg-[#027fa5] text-white border-[#027fa5]"
                        : "bg-white text-gray-600 border-gray-300 hover:border-[#027fa5] hover:text-[#027fa5]"
                    }`}
                  >
                    {cfg.transactionType || "Untitled"} ({cfg.typeCode})
                    {editingId === cfg.id && (
                      <span
                        onClick={e => { e.stopPropagation(); deleteMutation.mutate(cfg.id); }}
                        className="ml-2 text-red-300 hover:text-red-500"
                      >✕</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-4 px-5 py-4 border-t border-gray-100">
          <button
            onClick={handleCancel}
            data-testid="btn-cancel"
            className="px-8 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate({ transactionType, typeCode, levels })}
            disabled={saveMutation.isPending}
            data-testid="btn-save"
            className="px-8 py-2 bg-[#d74700] hover:bg-[#b83c00] text-white rounded text-sm font-medium transition-colors disabled:opacity-60"
          >
            {saveMutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
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
