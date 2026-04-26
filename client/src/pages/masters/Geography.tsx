import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, PencilLine, Trash2, Check, X } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

// ─── Inline-editable row ──────────────────────────────────────────────────────
function EditRow({ fields, initial, onSave, onCancel }: any) {
  const [vals, setVals] = useState<any>(initial || {});
  const firstRef = useRef<HTMLInputElement>(null);
  useEffect(() => { firstRef.current?.focus(); }, []);
  const f = (k: string) => (e: any) => setVals((p: any) => ({ ...p, [k]: e.target.value }));

  return (
    <tr className="bg-blue-50">
      <td className="px-4 py-2 text-gray-400 text-xs w-12">—</td>
      {fields.map((fld: any, i: number) => (
        <td key={fld.key} className="px-2 py-1.5">
          {fld.type === "select" ? (
            <select value={vals[fld.key] || ""} onChange={f(fld.key)}
              className="w-full border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none bg-white">
              <option value="">— Select —</option>
              {fld.options?.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input ref={i === 0 ? firstRef : undefined} type="text" value={vals[fld.key] || ""} onChange={f(fld.key)}
              placeholder={fld.label}
              className="w-full border border-blue-300 rounded px-2 py-1 text-sm focus:outline-none bg-white" />
          )}
        </td>
      ))}
      <td className="px-2 py-1.5 text-center">
        <span className="text-xs px-2 py-0.5 rounded text-gray-500">Active</span>
      </td>
      <td className="px-2 py-1.5">
        <div className="flex gap-1 justify-center">
          <button onClick={() => onSave(vals)} className="p-1.5 rounded hover:bg-green-100 text-green-600"
            data-testid="button-save-row"><Check size={14} /></button>
          <button onClick={onCancel} className="p-1.5 rounded hover:bg-red-50 text-red-400"
            data-testid="button-cancel-row"><X size={14} /></button>
        </div>
      </td>
    </tr>
  );
}

// ─── Compact card shell ───────────────────────────────────────────────────────
function GeoCard({ title, search, setSearch, placeholder, onAdd, onCancel, children }: any) {
  return (
    <div className="max-w-2xl">
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 4px rgba(0,0,0,0.12)" }}>
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-gray-100">
          <span className="font-semibold text-gray-800">{title}</span>
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={placeholder}
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-300"
              data-testid="input-search" />
          </div>
        </div>

        {/* Table */}
        {children}

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-3 border-t border-gray-100">
          <button onClick={onCancel}
            className="px-7 py-2 rounded border text-sm font-medium text-gray-600 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }} data-testid="button-cancel">
            Cancel
          </button>
          <button onClick={onAdd}
            className="px-8 py-2 rounded text-sm font-semibold text-white"
            style={{ background: SC.orange }} data-testid="button-add">
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COUNTRIES
// ═══════════════════════════════════════════════════════════════════════════════
export function Countries() {
  const [search, setSearch] = useState("");
  const [addRow, setAddRow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/countries"] });

  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      const url = data.id ? `/api/countries/${data.id}` : "/api/countries";
      const method = data.id ? "PATCH" : "POST";
      const { id, ...body } = data;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/countries"] }); setAddRow(false); setEditId(null); },
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => fetch(`/api/countries/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/countries"] }),
  });

  const filtered = rows.filter((r: any) => r.name?.toLowerCase().includes(search.toLowerCase()));

  const FIELDS = [
    { key: "name", label: "Country Name" },
    { key: "code", label: "Code (e.g. IN)" },
  ];

  return (
    <GeoCard title="Country" search={search} setSearch={setSearch}
      placeholder="Search Country name..." onAdd={() => { setAddRow(true); setEditId(null); }}
      onCancel={() => { setAddRow(false); setEditId(null); }}>
      <div className="overflow-y-auto" style={{ maxHeight: "380px" }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr style={{ background: SC.tonal }}>
              <th className="text-left px-5 py-2.5 font-semibold text-gray-700 w-20">S.no</th>
              <th className="text-left px-5 py-2.5 font-semibold text-gray-700">Country</th>
              <th className="text-left px-5 py-2.5 font-semibold text-gray-700">Status</th>
              <th className="px-4 py-2.5 w-16"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {addRow && (
              <EditRow fields={FIELDS} onSave={(v: any) => saveMut.mutate({ ...v, isActive: true })} onCancel={() => setAddRow(false)} />
            )}
            {isLoading ? (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-400 text-sm">No countries found</td></tr>
            ) : filtered.map((r: any, i: number) => (
              editId === r.id ? (
                <EditRow key={r.id} fields={FIELDS} initial={r}
                  onSave={(v: any) => saveMut.mutate({ id: r.id, ...v })} onCancel={() => setEditId(null)} />
              ) : (
                <tr key={r.id} className="hover:bg-gray-50" data-testid={`row-country-${r.id}`}>
                  <td className="px-5 py-3 text-gray-600">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{r.name}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">{r.isActive !== false ? "Active" : "Inactive"}</span>
                      <button onClick={() => { setEditId(r.id); setAddRow(false); }}
                        className="p-1 rounded hover:bg-blue-50" style={{ color: SC.primary }}
                        data-testid={`button-edit-${r.id}`}>
                        <PencilLine size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => { if (confirm("Delete this country?")) delMut.mutate(r.id); }}
                      className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`button-delete-${r.id}`}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </GeoCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATES
// ═══════════════════════════════════════════════════════════════════════════════
export function States() {
  const [search, setSearch] = useState("");
  const [addRow, setAddRow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: countries = [] } = useQuery<any[]>({ queryKey: ["/api/countries"] });
  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/states"] });

  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      const url = data.id ? `/api/states/${data.id}` : "/api/states";
      const method = data.id ? "PATCH" : "POST";
      const { id, ...body } = data;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/states"] }); setAddRow(false); setEditId(null); },
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => fetch(`/api/states/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/states"] }),
  });

  const getCountryName = (id: string) => countries.find((c: any) => c.id === id)?.name || "—";
  const filtered = rows.filter((r: any) => r.name?.toLowerCase().includes(search.toLowerCase()));

  const FIELDS = [
    { key: "name",      label: "State Name" },
    { key: "countryId", label: "Country", type: "select", options: countries.map((c: any) => ({ value: c.id, label: c.name })) },
    { key: "code",      label: "Code (e.g. TN)" },
  ];

  return (
    <GeoCard title="State" search={search} setSearch={setSearch}
      placeholder="Search State name..." onAdd={() => { setAddRow(true); setEditId(null); }}
      onCancel={() => { setAddRow(false); setEditId(null); }}>
      <div className="overflow-y-auto" style={{ maxHeight: "380px" }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr style={{ background: SC.tonal }}>
              <th className="text-left px-5 py-2.5 font-semibold text-gray-700 w-20">S.no</th>
              <th className="text-left px-5 py-2.5 font-semibold text-gray-700">State</th>
              <th className="text-left px-5 py-2.5 font-semibold text-gray-700">Country</th>
              <th className="px-4 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {addRow && (
              <EditRow fields={FIELDS} onSave={(v: any) => saveMut.mutate({ ...v, isActive: true })} onCancel={() => setAddRow(false)} />
            )}
            {isLoading ? (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-400 text-sm">No states found</td></tr>
            ) : filtered.map((r: any, i: number) => (
              editId === r.id ? (
                <EditRow key={r.id} fields={FIELDS} initial={r}
                  onSave={(v: any) => saveMut.mutate({ id: r.id, ...v })} onCancel={() => setEditId(null)} />
              ) : (
                <tr key={r.id} className="hover:bg-gray-50" data-testid={`row-state-${r.id}`}>
                  <td className="px-5 py-3 text-gray-600">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{r.name}</td>
                  <td className="px-5 py-3 text-gray-600">{getCountryName(r.countryId)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => { setEditId(r.id); setAddRow(false); }}
                        className="p-1.5 rounded hover:bg-blue-50" style={{ color: SC.primary }}
                        data-testid={`button-edit-${r.id}`}>
                        <PencilLine size={14} />
                      </button>
                      <button onClick={() => { if (confirm("Delete this state?")) delMut.mutate(r.id); }}
                        className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`button-delete-${r.id}`}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </GeoCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CITIES
// ═══════════════════════════════════════════════════════════════════════════════
export function Cities() {
  const [search, setSearch] = useState("");
  const [addRow, setAddRow] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: countries = [] } = useQuery<any[]>({ queryKey: ["/api/countries"] });
  const { data: stateList = [] } = useQuery<any[]>({ queryKey: ["/api/states"] });
  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/cities"] });

  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      const url = data.id ? `/api/cities/${data.id}` : "/api/cities";
      const method = data.id ? "PATCH" : "POST";
      const { id, ...body } = data;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/cities"] }); setAddRow(false); setEditId(null); },
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => fetch(`/api/cities/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/cities"] }),
  });

  const getStateName   = (id: string) => stateList.find((s: any) => s.id === id)?.name  || "—";
  const getCountryName = (id: string) => countries.find((c: any) => c.id === id)?.name  || "—";
  const filtered = rows.filter((r: any) => r.name?.toLowerCase().includes(search.toLowerCase()));

  const FIELDS = [
    { key: "name",      label: "City Name" },
    { key: "countryId", label: "Country", type: "select", options: countries.map((c: any) => ({ value: c.id, label: c.name })) },
    { key: "stateId",   label: "State",   type: "select", options: stateList.map((s: any) => ({ value: s.id, label: s.name })) },
    { key: "pinCode",   label: "PIN Code" },
  ];

  return (
    <GeoCard title="City" search={search} setSearch={setSearch}
      placeholder="Search City name..." onAdd={() => { setAddRow(true); setEditId(null); }}
      onCancel={() => { setAddRow(false); setEditId(null); }}>
      <div className="overflow-y-auto" style={{ maxHeight: "380px" }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr style={{ background: SC.tonal }}>
              <th className="text-left px-5 py-2.5 font-semibold text-gray-700 w-20">S.no</th>
              <th className="text-left px-5 py-2.5 font-semibold text-gray-700">City</th>
              <th className="text-left px-5 py-2.5 font-semibold text-gray-700">State</th>
              <th className="text-left px-5 py-2.5 font-semibold text-gray-700 w-20">State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {addRow && (
              <EditRow fields={FIELDS} onSave={(v: any) => saveMut.mutate({ ...v, isActive: true })} onCancel={() => setAddRow(false)} />
            )}
            {isLoading ? (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-5 py-10 text-center text-gray-400 text-sm">No cities found</td></tr>
            ) : filtered.map((r: any, i: number) => (
              editId === r.id ? (
                <EditRow key={r.id} fields={FIELDS} initial={r}
                  onSave={(v: any) => saveMut.mutate({ id: r.id, ...v })} onCancel={() => setEditId(null)} />
              ) : (
                <tr key={r.id} className="hover:bg-gray-50" data-testid={`row-city-${r.id}`}>
                  <td className="px-5 py-3 text-gray-600">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{r.name}</td>
                  <td className="px-5 py-3 text-gray-600">{getStateName(r.stateId)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => { setEditId(r.id); setAddRow(false); }}
                        className="p-1.5 rounded hover:bg-blue-50" style={{ color: SC.primary }}
                        data-testid={`button-edit-${r.id}`}>
                        <PencilLine size={14} />
                      </button>
                      <button onClick={() => { if (confirm("Delete this city?")) delMut.mutate(r.id); }}
                        className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`button-delete-${r.id}`}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </GeoCard>
  );
}
