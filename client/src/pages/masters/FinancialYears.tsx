import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, CheckCircle, Calendar } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

const EMPTY = { label: "", start_date: "", end_date: "", is_current: false };

export default function FinancialYears() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/financial-years"] });
  const [modal, setModal] = useState<null | "add" | "edit">(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  function openAdd() { setForm({ ...EMPTY }); setEditId(null); setError(""); setModal("add"); }
  function openEdit(r: any) {
    setForm({ label: r.label, start_date: r.start_date?.split("T")[0] || r.start_date, end_date: r.end_date?.split("T")[0] || r.end_date, is_current: r.is_current });
    setEditId(r.id); setError(""); setModal("edit");
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.label || !form.start_date || !form.end_date) throw new Error("Label, Start Date and End Date are required.");
      const url = editId ? `/api/financial-years/${editId}` : "/api/financial-years";
      const method = editId ? "PATCH" : "POST";
      const res = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/financial-years"] }); setModal(null); },
    onError: (e: any) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/financial-years/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/financial-years"] }),
  });

  const filtered = rows.filter(r => !search || r.label?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Calendar size={16} style={{ color: SC.primary }} />
            <h1 className="font-semibold text-gray-800">Financial Years</h1>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search..." className="text-sm border border-gray-200 rounded px-3 py-1.5 w-44 outline-none focus:border-[#027fa5]"
            data-testid="input-search" />
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: SC.tonal }}>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Label</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Start Date</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">End Date</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Current</th>
              <th className="px-3 py-2.5 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">Loading...</td></tr>}
            {!isLoading && filtered.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">No financial years found</td></tr>}
            {filtered.map((r, i) => (
              <tr key={r.id} className={`border-t border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                data-testid={`row-fy-${r.id}`}>
                <td className="px-5 py-2.5 font-semibold" style={{ color: SC.primary }}>{r.label}</td>
                <td className="px-5 py-2.5 text-gray-600 text-xs">{r.start_date ? new Date(r.start_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                <td className="px-5 py-2.5 text-gray-600 text-xs">{r.end_date ? new Date(r.end_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                <td className="px-5 py-2.5">
                  {r.is_current ? (
                    <span className="flex items-center gap-1 text-green-700 font-semibold text-xs"><CheckCircle size={13} /> Active</span>
                  ) : <span className="text-gray-400 text-xs">—</span>}
                </td>
                <td className="px-3 py-2.5 flex items-center gap-1">
                  <button onClick={() => openEdit(r)} className="p-1.5 rounded hover:bg-blue-50 transition-colors" style={{ color: SC.primary }} data-testid={`btn-edit-${r.id}`}><Pencil size={13} /></button>
                  <button onClick={() => { if (confirm("Delete this financial year?")) deleteMut.mutate(r.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors" data-testid={`btn-delete-${r.id}`}><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end gap-3 px-5 py-3 border-t border-gray-100">
          <button className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50" style={{ borderColor: "#9ca3af" }}>Cancel</button>
          <button onClick={openAdd} className="px-8 py-2 rounded text-sm font-semibold text-white flex items-center gap-1.5" style={{ background: SC.orange }} data-testid="btn-add"><Plus size={14} /> Add</button>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 overflow-hidden" style={{ fontFamily: "Source Sans Pro, sans-serif" }}>
            <div className="px-5 py-3.5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 text-sm">{modal === "edit" ? "Edit" : "Add"} Financial Year</h3>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="relative">
                <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Label <span className="text-red-400">*</span></label>
                <input value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                  placeholder="e.g. 2025-26"
                  className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                  autoFocus data-testid="input-fy-label" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Start Date <span className="text-red-400">*</span></label>
                  <input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                    data-testid="input-fy-start" />
                </div>
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">End Date <span className="text-red-400">*</span></label>
                  <input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                    data-testid="input-fy-end" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer" data-testid="toggle-is-current">
                <input type="checkbox" checked={form.is_current} onChange={e => setForm(p => ({ ...p, is_current: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[#027fa5]" />
                <span className="text-sm text-gray-700">Set as Current Financial Year</span>
              </label>
              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
            <div className="flex justify-end gap-3 px-5 py-3.5 border-t border-gray-100">
              <button onClick={() => setModal(null)} className="px-6 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700">Cancel</button>
              <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
                className="px-6 py-2 rounded text-sm font-semibold text-white disabled:opacity-50" style={{ background: SC.orange }}
                data-testid="btn-save">{saveMut.isPending ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
