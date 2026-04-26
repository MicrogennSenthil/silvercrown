import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit, X, Loader2, Search } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700", bg: "#f5f0ed" };

function apiReq(url: string, method: string, body?: any) {
  return fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  }).then(async r => {
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || "Request failed");
    return data;
  });
}

function FField({ label, value, onChange, type = "text", step }: any) {
  return (
    <div className="relative">
      <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">{label}</label>
      <input
        type={type}
        step={step}
        value={value ?? ""}
        onChange={onChange}
        className="w-full border border-gray-300 rounded px-3 pt-3.5 pb-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400 bg-white"
        data-testid={`input-${label.toLowerCase().replace(/\s+/g, "-")}`}
      />
    </div>
  );
}

interface ProcessForm {
  code: string;
  name: string;
  price: string;
  is_active: boolean;
}

function ProcessModal({ initial, onClose }: { initial?: any; onClose: () => void }) {
  const isEdit = !!initial?.id;
  const [form, setForm] = useState<ProcessForm>({
    code: initial?.code || "",
    name: initial?.name || "",
    price: initial?.price != null ? String(initial.price) : "0",
    is_active: initial?.is_active ?? true,
  });
  const qc = useQueryClient();

  const upd = (k: keyof ProcessForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {
        code: form.code.trim().toUpperCase() || form.name.trim().toUpperCase().replace(/\s+/g, "-"),
        name: form.name.trim(),
        price: parseFloat(form.price) || 0,
        is_active: form.is_active,
      };
      return isEdit
        ? apiReq(`/api/processes/${initial.id}`, "PATCH", payload)
        : apiReq("/api/processes", "POST", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/processes"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">{isEdit ? "Edit Process" : "New Process"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" data-testid="button-close-modal"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <FField label="Process Code" value={form.code} onChange={upd("code")} />
          <FField label="Process Name" value={form.name} onChange={upd("name")} />
          <FField label="Price (₹)" type="number" step="0.01" value={form.price} onChange={upd("price")} />
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              data-testid="checkbox-is-active"
              className="rounded"
            />
            Active
          </label>
          {saveMut.error && <p className="text-red-600 text-xs">{(saveMut.error as Error).message}</p>}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50" data-testid="button-cancel">Cancel</button>
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !form.name.trim()}
            className="px-5 py-2 rounded text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: SC.orange }}
            data-testid="button-save-process"
          >
            {saveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProcessMasters() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ open: boolean; data?: any }>({ open: false });

  const { data: processes = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/processes"] });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiReq(`/api/processes/${id}`, "DELETE"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/processes"] }),
  });

  const filtered = processes.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen p-6" style={{ background: SC.bg }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-gray-800">Process Master</h1>
          <button
            onClick={() => setModal({ open: true })}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: SC.orange }}
            data-testid="button-new-process"
          >
            <Plus size={16} /> New Process
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search processes..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-400"
            data-testid="input-search-process"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#d2f1fa] text-gray-700">
                <th className="px-4 py-3 text-left font-semibold w-12">S.No</th>
                <th className="px-4 py-3 text-left font-semibold">Process Code</th>
                <th className="px-4 py-3 text-left font-semibold">Process Name</th>
                <th className="px-4 py-3 text-right font-semibold">Price (₹)</th>
                <th className="px-4 py-3 text-center font-semibold w-20">Status</th>
                <th className="px-4 py-3 text-center font-semibold w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="py-10 text-center text-gray-400"><Loader2 size={20} className="animate-spin inline" /></td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-10 text-center text-gray-400">No processes found</td></tr>
              ) : filtered.map((p, i) => (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50 transition-colors" data-testid={`row-process-${p.id}`}>
                  <td className="px-4 py-3 text-gray-500">{String(i + 1).padStart(2, "0")}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{p.code}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                  <td className="px-4 py-3 text-right text-gray-700">₹{Number(p.price || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${p.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {p.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => setModal({ open: true, data: p })} className="text-[#027fa5] hover:text-[#015f7a]" data-testid={`button-edit-process-${p.id}`}><Edit size={15} /></button>
                      <button
                        onClick={() => { if (confirm("Delete this process?")) deleteMut.mutate(p.id); }}
                        className="text-red-500 hover:text-red-700"
                        data-testid={`button-delete-process-${p.id}`}
                      ><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal.open && <ProcessModal initial={modal.data} onClose={() => setModal({ open: false })} />}
    </div>
  );
}
