import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit, X, Loader2, Globe, MapPin, Building2, ChevronRight } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700" };

function FormModal({ title, icon: Icon, fields, initial, onSave, onClose, saving }: any) {
  const initForm: any = {};
  for (const f of fields) initForm[f.name] = initial?.[f.name] ?? (f.type === "checkbox" ? true : "");
  const [form, setForm] = useState(initForm);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md" style={{ boxShadow: "2px 2px 8px 2px rgba(0,0,0,0.25)" }}>
        <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ borderColor: "#b8d2da" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#d2f1fa" }}>
            <Icon size={16} style={{ color: SC.primary }} />
          </div>
          <h2 className="text-lg font-bold" style={{ color: SC.primary }}>{initial?.id ? "Edit" : "New"} {title}</h2>
          <button onClick={onClose} className="ml-auto p-1.5 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          {fields.map((f: any) => (
            <div key={f.name}>
              <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>{f.label}</label>
              {f.type === "checkbox" ? (
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={!!form[f.name]}
                    onChange={e => setForm((s: any) => ({ ...s, [f.name]: e.target.checked }))}
                    className="w-4 h-4 rounded" style={{ accentColor: SC.primary }} data-testid={`input-${f.name}`} />
                  <span className="text-sm text-gray-600">Active</span>
                </div>
              ) : f.type === "select" ? (
                <select value={form[f.name] || ""} onChange={e => setForm((s: any) => ({ ...s, [f.name]: e.target.value }))}
                  className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid={`select-${f.name}`}>
                  <option value="">— Select {f.label} —</option>
                  {f.options?.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <input type={f.type || "text"} value={form[f.name] ?? ""}
                  onChange={e => setForm((s: any) => ({ ...s, [f.name]: e.target.value }))}
                  className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid={`input-${f.name}`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-5 py-2 rounded border text-sm" style={{ borderColor: "#00000030" }}>Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving}
            className="px-5 py-2 rounded text-white text-sm font-medium flex items-center gap-2" style={{ background: SC.orange }} data-testid="button-save">
            {saving && <Loader2 size={14} className="animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── COUNTRIES ─────────────────────────────────────────────────────────────
export function Countries() {
  const [search, setSearch] = useState(""); const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null);
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/countries"] });
  const save = useMutation({
    mutationFn: async (data: any) => {
      const url = editing?.id ? `/api/countries/${editing.id}` : "/api/countries";
      const res = await fetch(url, { method: editing?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/countries"] }); setShowForm(false); }
  });
  const del = useMutation({
    mutationFn: (id: string) => fetch(`/api/countries/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/countries"] })
  });
  const filtered = rows.filter((r: any) => r.name?.toLowerCase().includes(search.toLowerCase()) || r.code?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-800">Countries</h1><p className="text-sm text-gray-500 mt-0.5">Country master for geography setup</p></div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }} data-testid="button-new"><Plus size={16} /> New Country</button>
      </div>
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
        <div className="px-5 py-3 border-b border-gray-100">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search countries..." className="w-full max-w-xs border rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="input-search" />
        </div>
        <table className="w-full text-sm">
          <thead><tr style={{ background: "#d2f1fa" }}>
            <th className="text-left px-5 py-3 font-semibold text-gray-600">Code</th>
            <th className="text-left px-5 py-3 font-semibold text-gray-600">Country Name</th>
            <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
            <th className="px-5 py-3"></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? <tr><td colSpan={4} className="px-5 py-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-gray-300" /></td></tr> :
              filtered.length ? filtered.map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3"><span className="font-mono text-xs font-bold px-2 py-1 rounded" style={{ background: "#d2f1fa", color: SC.primary }}>{r.code}</span></td>
                  <td className="px-5 py-3 font-medium text-gray-800">{r.name}</td>
                  <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{r.isActive ? "Active" : "Inactive"}</span></td>
                  <td className="px-5 py-3"><div className="flex gap-2 justify-end">
                    <button onClick={() => { setEditing(r); setShowForm(true); }} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" data-testid={`btn-edit-${r.id}`}><Edit size={15} /></button>
                    <button onClick={() => { if (confirm("Delete this country?")) del.mutate(r.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`btn-del-${r.id}`}><Trash2 size={15} /></button>
                  </div></td>
                </tr>
              )) : <tr><td colSpan={4} className="px-5 py-12 text-center text-gray-400">No countries found</td></tr>}
          </tbody>
        </table>
      </div>
      {showForm && <FormModal title="Country" icon={Globe}
        fields={[
          { name: "code", label: "Country Code *" },
          { name: "name", label: "Country Name *" },
          { name: "isActive", label: "Status", type: "checkbox" },
        ]}
        initial={editing} onSave={save.mutate} onClose={() => setShowForm(false)} saving={save.isPending} />}
    </div>
  );
}

// ─── STATES ─────────────────────────────────────────────────────────────────
export function States() {
  const [search, setSearch] = useState(""); const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null);
  const [filterCountry, setFilterCountry] = useState("");
  const qc = useQueryClient();
  const { data: countries = [] } = useQuery<any[]>({ queryKey: ["/api/countries"] });
  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/states", filterCountry],
    queryFn: async () => {
      const url = filterCountry ? `/api/states?countryId=${filterCountry}` : "/api/states";
      return fetch(url, { credentials: "include" }).then(r => r.json());
    }
  });
  const save = useMutation({
    mutationFn: async (data: any) => {
      const url = editing?.id ? `/api/states/${editing.id}` : "/api/states";
      const res = await fetch(url, { method: editing?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/states"] }); setShowForm(false); }
  });
  const del = useMutation({
    mutationFn: (id: string) => fetch(`/api/states/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/states"] })
  });
  const filtered = rows.filter((r: any) => r.name?.toLowerCase().includes(search.toLowerCase()) || r.code?.toLowerCase().includes(search.toLowerCase()));
  const getCountryName = (id: string) => countries.find((c: any) => c.id === id)?.name || "—";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-800">States</h1><p className="text-sm text-gray-500 mt-0.5">State master linked to countries</p></div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }} data-testid="button-new"><Plus size={16} /> New State</button>
      </div>
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
        <div className="px-5 py-3 border-b border-gray-100 flex gap-3 flex-wrap">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search states..." className="border rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="input-search" />
          <select value={filterCountry} onChange={e => setFilterCountry(e.target.value)} className="border rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="select-filter-country">
            <option value="">All Countries</option>
            {countries.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <table className="w-full text-sm">
          <thead><tr style={{ background: "#d2f1fa" }}>
            <th className="text-left px-5 py-3 font-semibold text-gray-600">Code</th>
            <th className="text-left px-5 py-3 font-semibold text-gray-600">State Name</th>
            <th className="text-left px-5 py-3 font-semibold text-gray-600">Country</th>
            <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
            <th className="px-5 py-3"></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? <tr><td colSpan={5} className="px-5 py-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-gray-300" /></td></tr> :
              filtered.length ? filtered.map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3"><span className="font-mono text-xs font-bold px-2 py-1 rounded" style={{ background: "#d2f1fa", color: SC.primary }}>{r.code}</span></td>
                  <td className="px-5 py-3 font-medium text-gray-800">{r.name}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{getCountryName(r.countryId)}</td>
                  <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{r.isActive ? "Active" : "Inactive"}</span></td>
                  <td className="px-5 py-3"><div className="flex gap-2 justify-end">
                    <button onClick={() => { setEditing(r); setShowForm(true); }} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" data-testid={`btn-edit-${r.id}`}><Edit size={15} /></button>
                    <button onClick={() => { if (confirm("Delete?")) del.mutate(r.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`btn-del-${r.id}`}><Trash2 size={15} /></button>
                  </div></td>
                </tr>
              )) : <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">No states found</td></tr>}
          </tbody>
        </table>
      </div>
      {showForm && <FormModal title="State" icon={MapPin}
        fields={[
          { name: "countryId", label: "Country *", type: "select", options: countries.map((c: any) => ({ value: c.id, label: c.name })) },
          { name: "code", label: "State Code *" },
          { name: "name", label: "State Name *" },
          { name: "isActive", label: "Status", type: "checkbox" },
        ]}
        initial={editing} onSave={save.mutate} onClose={() => setShowForm(false)} saving={save.isPending} />}
    </div>
  );
}

// ─── CITIES ─────────────────────────────────────────────────────────────────
export function Cities() {
  const [search, setSearch] = useState(""); const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null);
  const [filterState, setFilterState] = useState("");
  const qc = useQueryClient();
  const { data: countries = [] } = useQuery<any[]>({ queryKey: ["/api/countries"] });
  const { data: stateList = [] } = useQuery<any[]>({ queryKey: ["/api/states"] });
  const { data: rows = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/cities", filterState],
    queryFn: async () => {
      const url = filterState ? `/api/cities?stateId=${filterState}` : "/api/cities";
      return fetch(url, { credentials: "include" }).then(r => r.json());
    }
  });
  const save = useMutation({
    mutationFn: async (data: any) => {
      const url = editing?.id ? `/api/cities/${editing.id}` : "/api/cities";
      const res = await fetch(url, { method: editing?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/cities"] }); setShowForm(false); }
  });
  const del = useMutation({
    mutationFn: (id: string) => fetch(`/api/cities/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/cities"] })
  });
  const filtered = rows.filter((r: any) => r.name?.toLowerCase().includes(search.toLowerCase()));
  const getStateName = (id: string) => stateList.find((s: any) => s.id === id)?.name || "—";
  const getCountryName = (id: string) => countries.find((c: any) => c.id === id)?.name || "—";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-800">Cities</h1><p className="text-sm text-gray-500 mt-0.5">City master linked to states and countries</p></div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }} data-testid="button-new"><Plus size={16} /> New City</button>
      </div>
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
        <div className="px-5 py-3 border-b border-gray-100 flex gap-3 flex-wrap">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cities..." className="border rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="input-search" />
          <select value={filterState} onChange={e => setFilterState(e.target.value)} className="border rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="select-filter-state">
            <option value="">All States</option>
            {stateList.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <table className="w-full text-sm">
          <thead><tr style={{ background: "#d2f1fa" }}>
            <th className="text-left px-5 py-3 font-semibold text-gray-600">City Name</th>
            <th className="text-left px-5 py-3 font-semibold text-gray-600">State</th>
            <th className="text-left px-5 py-3 font-semibold text-gray-600">Country</th>
            <th className="text-left px-5 py-3 font-semibold text-gray-600">PIN Code</th>
            <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
            <th className="px-5 py-3"></th>
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? <tr><td colSpan={6} className="px-5 py-8 text-center"><Loader2 size={20} className="animate-spin mx-auto text-gray-300" /></td></tr> :
              filtered.length ? filtered.map((r: any) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-800">{r.name}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{getStateName(r.stateId)}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{getCountryName(r.countryId)}</td>
                  <td className="px-5 py-3 text-gray-500 font-mono text-xs">{r.pinCode || "—"}</td>
                  <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{r.isActive ? "Active" : "Inactive"}</span></td>
                  <td className="px-5 py-3"><div className="flex gap-2 justify-end">
                    <button onClick={() => { setEditing(r); setShowForm(true); }} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" data-testid={`btn-edit-${r.id}`}><Edit size={15} /></button>
                    <button onClick={() => { if (confirm("Delete?")) del.mutate(r.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`btn-del-${r.id}`}><Trash2 size={15} /></button>
                  </div></td>
                </tr>
              )) : <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">No cities found</td></tr>}
          </tbody>
        </table>
      </div>
      {showForm && <FormModal title="City" icon={Building2}
        fields={[
          { name: "countryId", label: "Country *", type: "select", options: countries.map((c: any) => ({ value: c.id, label: c.name })) },
          { name: "stateId", label: "State *", type: "select", options: stateList.map((s: any) => ({ value: s.id, label: s.name })) },
          { name: "name", label: "City Name *" },
          { name: "pinCode", label: "PIN / ZIP Code" },
          { name: "isActive", label: "Status", type: "checkbox" },
        ]}
        initial={editing} onSave={save.mutate} onClose={() => setShowForm(false)} saving={save.isPending} />}
    </div>
  );
}
