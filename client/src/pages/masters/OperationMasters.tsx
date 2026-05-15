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

// Floating-label dropdown select with a "+" quick-add button
function MSelectWithAdd({ label, value, onSelect, options = [], onQuickAdd, error = false }: any) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = options.filter((s: string) => !search || s.toLowerCase().includes(search.toLowerCase()));
  const tid = label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex items-center gap-1.5 flex-1">
      {/* Dropdown trigger + list */}
      <div className="relative flex-1">
        <label className={`absolute -top-2 left-3 bg-white px-1 text-xs z-10 leading-none ${error ? "text-red-500 font-semibold" : "text-gray-500"}`}>
          {label}{error && " *"}
        </label>
        {/* Trigger button */}
        <button type="button"
          onClick={() => { setOpen(o => !o); setSearch(""); }}
          onBlur={() => setTimeout(() => { setOpen(false); setSearch(""); }, 180)}
          className={`w-full border rounded px-3 pt-3.5 pb-2 text-sm text-left flex items-center justify-between focus:outline-none bg-white
            ${error ? "border-red-400" : open ? "border-[#027fa5]" : "border-gray-300 hover:border-[#027fa5]"}`}
          data-testid={`select-${tid}`}>
          <span className={value ? "text-gray-800" : "text-gray-400"}>{value || "Select…"}</span>
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {/* Dropdown panel */}
        {open && (
          <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl z-40 mt-0.5">
            {/* Search */}
            <div className="p-2 border-b border-gray-100">
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={`Search ${label}…`}
                  className="w-full pl-6 pr-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-[#027fa5]"
                  data-testid={`input-search-${tid}`}
                  onKeyDown={e => {
                    if (e.key === "Enter" && filtered.length > 0) {
                      onSelect(filtered[0]); setOpen(false); setSearch("");
                    }
                    if (e.key === "Escape") { setOpen(false); setSearch(""); }
                  }} />
              </div>
            </div>

            {/* Options */}
            <div className="max-h-40 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-2.5 text-xs text-gray-400 text-center">No options found</p>
              ) : filtered.map((s: string, i: number) => (
                <button key={i} type="button"
                  onMouseDown={() => { onSelect(s); setOpen(false); setSearch(""); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-[#d2f1fa] flex items-center gap-2
                    ${value === s ? "bg-[#e8f6fb] font-semibold text-[#027fa5]" : "text-gray-700"}`}>
                  {value === s && <span className="w-1.5 h-1.5 rounded-full bg-[#027fa5] flex-shrink-0" />}
                  {s}
                </button>
              ))}
            </div>

            {/* Quick-add from dropdown footer */}
            <div className="border-t border-gray-100 p-2">
              <button type="button" onMouseDown={onQuickAdd}
                className="w-full flex items-center gap-2 px-3 py-1.5 rounded text-xs font-semibold text-[#d74700] hover:bg-orange-50"
                data-testid={`button-quick-add-${tid}`}>
                <Plus size={13} /> Add new {label.toLowerCase()}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Standalone "+" button outside dropdown */}
      <button type="button" onClick={() => { setOpen(false); onQuickAdd(); }}
        title={`Add new ${label}`}
        className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded border border-dashed border-[#027fa5] text-[#027fa5] hover:bg-[#d2f1fa] transition-colors"
        data-testid={`button-add-${tid}`}>
        <Plus size={14} />
      </button>
    </div>
  );
}

// Inline quick-add popover for Group / Sub Group
function QuickAddInline({ label, onAdd, onCancel }: any) {
  const [val, setVal] = useState("");
  return (
    <div className="border border-[#027fa5] rounded-lg p-3 bg-[#f0faff] space-y-2">
      <p className="text-xs font-semibold text-[#027fa5]">Add new {label}</p>
      <input autoFocus value={val} onChange={e => setVal(e.target.value)}
        placeholder={`Enter ${label} name…`}
        className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-sm focus:outline-none focus:border-[#027fa5]"
        onKeyDown={e => {
          if (e.key === "Enter" && val.trim()) onAdd(val.trim());
          if (e.key === "Escape") onCancel();
        }}
        data-testid={`input-quick-add-${label.toLowerCase().replace(/\s+/g, "-")}`} />
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel}
          className="px-3 py-1 text-xs rounded border text-gray-600 hover:bg-gray-50" style={{ borderColor: "#9ca3af" }}>
          Cancel
        </button>
        <button type="button" onClick={() => val.trim() && onAdd(val.trim())}
          disabled={!val.trim()}
          className="px-4 py-1 text-xs rounded font-semibold text-white disabled:opacity-40"
          style={{ background: "#d74700" }}>
          Add
        </button>
      </div>
    </div>
  );
}

function MachineModal({ initial, onClose }: any) {
  const EMPTY = { machineId: "", name: "", machineGroup: "", subGroup: "", dueTime: "", calibrationDate: "", company: "", notes: "", code: "" };
  const [form, setForm]   = useState<any>({ ...EMPTY, ...initial, machineId: initial?.machineId || initial?.code || "" });
  const [errs, setErrs]   = useState<Record<string, string>>({});
  const [addingGroup, setAddingGroup]       = useState(false);
  const [addingSubGroup, setAddingSubGroup] = useState(false);
  const [extraGroups, setExtraGroups]       = useState<string[]>([]);
  const [extraSubGroups, setExtraSubGroups] = useState<string[]>([]);
  const qc = useQueryClient();

  const { data: allMachines = [] } = useQuery<any[]>({ queryKey: ["/api/machines"] });
  const baseGroups    = [...new Set((allMachines as any[]).map((m: any) => m.machineGroup).filter(Boolean))] as string[];
  const baseSubGroups = [...new Set((allMachines as any[]).map((m: any) => m.subGroup).filter(Boolean))] as string[];
  const allGroups    = [...new Set([...baseGroups,    ...extraGroups])];
  const allSubGroups = [...new Set([...baseSubGroups, ...extraSubGroups])];

  const setField = (key: string, val: string) => {
    setErrs(p => ({ ...p, [key]: "" }));
    setForm((p: any) => ({ ...p, [key]: val }));
  };
  const f = (key: string) => (e: any) => setField(key, e.target.value);

  function handleSave() {
    const e: Record<string, string> = {};
    if (!form.machineId.trim())    e.machineId    = "Required";
    if (!form.machineGroup.trim()) e.machineGroup = "Required";
    if (!form.subGroup.trim())     e.subGroup     = "Required";
    if (Object.keys(e).length) { setErrs(e); return; }
    saveMut.mutate(form);
  }

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
            <MFField label="Machine ID"   value={form.machineId} onChange={f("machineId")} placeholder="Enter Id..." />
            <MFField label="Machine Name" value={form.name}      onChange={f("name")}      placeholder="Enter Machine Name Here..." />
          </div>

          {/* Row 2: Group + Sub Group with quick-add */}
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              <MSelectWithAdd
                label="Group"
                value={form.machineGroup}
                options={allGroups}
                onSelect={(v: string) => { setField("machineGroup", v); setAddingGroup(false); }}
                onQuickAdd={() => { setAddingGroup(true); setAddingSubGroup(false); }}
                error={!!errs.machineGroup}
              />
              {addingGroup && (
                <QuickAddInline label="Group"
                  onAdd={(v: string) => { setExtraGroups(p => [...p, v]); setField("machineGroup", v); setAddingGroup(false); }}
                  onCancel={() => setAddingGroup(false)} />
              )}
            </div>
            <div className="flex-1 space-y-2">
              <MSelectWithAdd
                label="Sub Group"
                value={form.subGroup}
                options={allSubGroups}
                onSelect={(v: string) => { setField("subGroup", v); setAddingSubGroup(false); }}
                onQuickAdd={() => { setAddingSubGroup(true); setAddingGroup(false); }}
                error={!!errs.subGroup}
              />
              {addingSubGroup && (
                <QuickAddInline label="Sub Group"
                  onAdd={(v: string) => { setExtraSubGroups(p => [...p, v]); setField("subGroup", v); setAddingSubGroup(false); }}
                  onCancel={() => setAddingSubGroup(false)} />
              )}
            </div>
          </div>

          {/* Row 3: Due Time + Calibration Date + Company */}
          <div className="grid grid-cols-3 gap-4">
            <MFField label="Due Time"         value={form.dueTime}         onChange={f("dueTime")}         placeholder="Type Here..." />
            <MFField label="Calibration Date" value={form.calibrationDate} onChange={f("calibrationDate")} placeholder="Type Here..." />
            <MFField label="Company"          value={form.company}         onChange={f("company")}          placeholder="Type Here..." />
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
          <button onClick={handleSave} disabled={saveMut.isPending}
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

// Floating-label field helper
function FField({ label, value, onChange, placeholder = "", type = "text", className = "" }: any) {
  return (
    <div className={`relative ${className}`}>
      <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none whitespace-nowrap">{label}</label>
      <input type={type} value={value ?? ""} onChange={onChange} placeholder={placeholder}
        className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none focus:border-[#027fa5]"
        data-testid={`input-${label.toLowerCase().replace(/[\s/]+/g, "-")}`} />
    </div>
  );
}

// Floating-label select helper
function FSelect({ label, value, onChange, children, className = "" }: any) {
  return (
    <div className={`relative ${className}`}>
      <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none whitespace-nowrap">{label}</label>
      <select value={value ?? ""} onChange={onChange}
        className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none focus:border-[#027fa5] bg-white appearance-none pr-7"
        data-testid={`select-${label.toLowerCase().replace(/[\s/]+/g, "-")}`}>
        {children}
      </select>
      <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

// Floating-label select with + button
function FSelectPlus({ label, value, onChange, children }: any) {
  return (
    <div className="flex items-center gap-1.5 flex-1">
      <FSelect label={label} value={value} onChange={onChange} className="flex-1">
        {children}
      </FSelect>
      <button type="button" className="flex-shrink-0 w-7 h-7 rounded flex items-center justify-center text-white font-bold mt-0.5 text-base"
        style={{ background: SC.primary }}>+</button>
    </div>
  );
}

function PurchaseStoreItemForm({ initial, onClose }: any) {
  const EMPTY = {
    code: "", name: "", uom: "", itemGroupId: "", itemSubGroupId: "",
    batchNo: "", expDate: "", qty: "0", hsnCode: "",
    minNo: 0, maxNo: 0, location: "",
    conversion: false, conversionUnit: "", conversionValue: "0",
    expiryRequired: false, description: "", isActive: true,
  };
  const [form, setForm] = useState<any>({ ...EMPTY, ...initial });
  const qc = useQueryClient();

  const { data: uoms = [] }      = useQuery<any[]>({ queryKey: ["/api/uom"] });
  const { data: groups = [] }    = useQuery<any[]>({ queryKey: ["/api/store-item-groups"] });
  const { data: subGroups = [] } = useQuery<any[]>({ queryKey: ["/api/store-item-sub-groups"] });

  const filteredSubs = subGroups.filter((sg: any) => !form.itemGroupId || sg.groupId === form.itemGroupId);

  const f = (key: string) => (e: any) => setForm((p: any) => ({ ...p, [key]: e.target.value }));
  const fChk = (key: string) => (e: any) => setForm((p: any) => ({ ...p, [key]: e.target.checked }));

  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      const code   = data.code?.trim() || `SAP${Date.now()}`;
      const url    = initial?.id ? `/api/purchase-store-items/${initial.id}` : "/api/purchase-store-items";
      const method = initial?.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data, code,
          minNo: Number(data.minNo) || 0,
          maxNo: Number(data.maxNo) || 0,
          conversionValue: String(data.conversionValue || "0"),
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Save failed"); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/purchase-store-items"] }); onClose(); },
  });

  const selectedUomLabel = uoms.find((u: any) => (u.shortForm || u.name) === form.uom)?.shortForm || form.uom || "unit";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-xl shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-800">Purchase Store Item</h2>
        </div>

        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1">
          {/* Row 1: Item Code | Item Name | Unit */}
          <div className="flex gap-3">
            <FField label="Item Code" value={form.code} onChange={f("code")} placeholder="Enter Code" className="w-32" />
            <FField label="Item Name" value={form.name} onChange={f("name")} placeholder="Enter Item Name here..." className="flex-1" />
            <FSelect label="Unit" value={form.uom} onChange={f("uom")} className="w-32">
              <option value="">Select</option>
              {uoms.map((u: any) => <option key={u.id} value={u.shortForm || u.name}>{u.shortForm || u.name}</option>)}
            </FSelect>
          </div>

          {/* Conversion section */}
          <div className="border border-gray-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <input type="checkbox" id="conv-chk" checked={!!form.conversion} onChange={fChk("conversion")}
                className="mt-0.5 w-4 h-4 accent-[#027fa5]" data-testid="chk-conversion" />
              <div className="flex-1 min-w-0">
                <label htmlFor="conv-chk" className="text-sm font-medium text-gray-800 cursor-pointer">Conversion</label>
                <p className="text-xs text-gray-400 leading-snug mt-0.5">
                  (Converting the Existing unit into another Unit)<br />The Conversion value is depend upon the Density.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <FSelect label="Conversion Unit" value={form.conversionUnit} onChange={f("conversionUnit")} className="w-32">
                  <option value="">Select</option>
                  {uoms.map((u: any) => <option key={u.id} value={u.shortForm || u.name}>{u.shortForm || u.name}</option>)}
                </FSelect>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-xs font-medium text-gray-600 whitespace-nowrap">1{selectedUomLabel}</span>
                  <input type="number" value={form.conversionValue} onChange={f("conversionValue")}
                    step="0.01" placeholder="0.00"
                    className="w-16 border border-gray-300 rounded px-2 py-1.5 text-sm text-center focus:outline-none focus:border-[#027fa5]"
                    data-testid="input-conversion-value" />
                  <span className="text-xs text-gray-500">{form.conversionUnit || "lit"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Group + Sub Group */}
          <div className="flex gap-3">
            <FSelectPlus label="Group" value={form.itemGroupId}
              onChange={(e: any) => setForm((p: any) => ({ ...p, itemGroupId: e.target.value, itemSubGroupId: "" }))}>
              <option value="">Select</option>
              {groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </FSelectPlus>
            <FSelectPlus label="Sub Group" value={form.itemSubGroupId} onChange={f("itemSubGroupId")}>
              <option value="">Select</option>
              {filteredSubs.map((sg: any) => <option key={sg.id} value={sg.id}>{sg.name}</option>)}
            </FSelectPlus>
          </div>

          {/* Row 3: HSN Code | Batch no | Min Qty | Max Qty */}
          <div className="grid grid-cols-4 gap-3">
            <FField label="HSN Code"   value={form.hsnCode}  onChange={f("hsnCode")}  placeholder="Type Here..." />
            <FField label="Batch no"   value={form.batchNo}  onChange={f("batchNo")}  placeholder="00.00" />
            <FField label="Min Qty"    value={form.minNo}    onChange={f("minNo")}    placeholder="00" type="number" />
            <FField label="Max Qty"    value={form.maxNo}    onChange={f("maxNo")}    placeholder="000" type="number" />
          </div>

          {/* Row 4: Expiry Date checkbox | Description | Active */}
          <div className="flex items-start gap-4">
            <label className="flex items-center gap-2 cursor-pointer mt-1 flex-shrink-0">
              <input type="checkbox" checked={!!form.expiryRequired} onChange={fChk("expiryRequired")}
                className="w-4 h-4 accent-[#027fa5]" data-testid="chk-expiry" />
              <span className="text-sm text-gray-700">Expiry Date is Required</span>
            </label>
            <FField label="Description" value={form.description} onChange={f("description")} placeholder="Type Here..." className="flex-1" />
            <label className="flex items-center gap-2 cursor-pointer mt-1 flex-shrink-0">
              <input type="checkbox" checked={!!form.isActive} onChange={fChk("isActive")}
                className="w-4 h-4 accent-[#027fa5]" data-testid="chk-is-active" />
              <span className="text-sm text-gray-700">Active</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0">
          <button onClick={onClose}
            className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
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

export function PurchaseStoreItems() {
  const [search, setSearch]    = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]  = useState<any>(null);
  const [notes, setNotes]       = useState("");

  const { rows, isLoading } = useSimpleCRUD("/api/purchase-store-items", "/api/purchase-store-items");
  const { data: uoms = [] } = useQuery<any[]>({ queryKey: ["/api/uom"] });

  const filtered = rows.filter((r: any) =>
    !search || [r.code, r.name, r.batchNo, r.hsnCode, r.expDate].some(v =>
      String(v || "").toLowerCase().includes(search.toLowerCase())
    )
  );

  const COLS = ["S.no", "Item Code", "Batch no", "Exp Date", "Item Name", "Qty", "Unit", "HSN code", "Min No", "Max No", "Location", "Status", ""];

  return (
    <div className="flex flex-col h-full">
      <div className="bg-white rounded-xl flex-1 flex flex-col overflow-hidden" style={{ boxShadow: "1px 1px 4px rgba(0,0,0,0.12)" }}>
        {/* Header */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-100">
          <span className="font-semibold text-gray-800 text-base whitespace-nowrap">Purchase Store Item</span>
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search Item name, code, batch, HSN and Exp ..."
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none"
              data-testid="input-search" />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr style={{ background: SC.tonal }}>
                {COLS.map(h => <th key={h} className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? (
                <tr><td colSpan={13} className="px-5 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={13} className="px-5 py-10 text-center text-gray-400">No items found. Click <strong>Add</strong> to create one.</td></tr>
              ) : filtered.map((r: any, i: number) => (
                <tr key={r.id} className="hover:bg-gray-50" data-testid={`row-item-${r.id}`}>
                  <td className="px-3 py-2.5 text-gray-500">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-3 py-2.5 font-mono text-xs font-semibold" style={{ color: SC.primary }}>{r.code}</td>
                  <td className="px-3 py-2.5 text-gray-600">{r.batchNo || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{r.expDate || "—"}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-800">{r.name}</td>
                  <td className="px-3 py-2.5 text-gray-600">{r.qty ?? "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600">{r.uom || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600">{r.hsnCode || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600">{r.minNo ?? "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600">{r.maxNo ?? "—"}</td>
                  <td className="px-3 py-2.5 text-gray-600">{r.location || "—"}</td>
                  <td className="px-3 py-2.5 text-sm" style={{ color: r.isActive ? "#16a34a" : "#9ca3af" }}>
                    {r.isActive ? "Active" : "Inactive"}
                  </td>
                  <td className="px-3 py-2.5">
                    <button onClick={() => { setEditing(r); setShowForm(true); }}
                      className="p-1.5 rounded hover:bg-blue-50" style={{ color: SC.primary }}
                      data-testid={`button-edit-${r.id}`}><PencilLine size={14} /></button>
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

      {showForm && <PurchaseStoreItemForm initial={editing} onClose={() => { setShowForm(false); setEditing(null); }} />}
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
