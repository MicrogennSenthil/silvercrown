import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Hash, RefreshCw } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

const DEFAULT_TYPES = [
  { type: "job_work_inward", label: "Job Work Inward", prefix: "JWI" },
  { type: "job_work_despatch", label: "Job Work Despatch", prefix: "JWD" },
  { type: "job_work_invoice", label: "Job Work Invoice", prefix: "JWIV" },
  { type: "returnable_inward", label: "Returnable Inward", prefix: "RI" },
  { type: "returnable_outward", label: "Returnable Outward", prefix: "RO" },
  { type: "gate_pass", label: "Gate Pass", prefix: "GP" },
  { type: "purchase_order", label: "Purchase Order", prefix: "PO" },
  { type: "purchase_receipt", label: "Purchase Receipt", prefix: "GRN" },
  { type: "sales_invoice", label: "Sales Invoice", prefix: "SI" },
  { type: "delivery_challan", label: "Delivery Challan", prefix: "DC" },
  { type: "payment_voucher", label: "Payment Voucher", prefix: "PV" },
  { type: "receipt_voucher", label: "Receipt Voucher", prefix: "RV" },
  { type: "journal_voucher", label: "Journal Voucher", prefix: "JV" },
  { type: "contra_voucher", label: "Contra Voucher", prefix: "CV" },
];

const EMPTY_FORM = {
  transaction_type: "", transaction_label: "", prefix: "",
  digits: 5, starting_number: 1, current_number: 1,
  financial_year_id: "", is_active: true,
};

function Preview({ prefix, digits, start }: { prefix: string; digits: number; start: number }) {
  const p = prefix || "XXX";
  const d = Math.max(1, Math.min(10, digits || 5));
  const n = start || 1;
  return (
    <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: SC.tonal, color: SC.primary }}>
      {p}{String(n).padStart(d, "0")}
    </span>
  );
}

export default function VoucherSeries() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/voucher-series"] });
  const { data: fys = [] } = useQuery<any[]>({ queryKey: ["/api/financial-years"] });

  const [modal, setModal] = useState<null | "add" | "edit">(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterFy, setFilterFy] = useState("");

  function openAdd() {
    const currentFy = (fys as any[]).find(f => f.is_current);
    setForm({ ...EMPTY_FORM, financial_year_id: currentFy?.id || "" });
    setEditId(null); setError(""); setModal("add");
  }
  function openEdit(r: any) {
    setForm({
      transaction_type: r.transaction_type, transaction_label: r.transaction_label,
      prefix: r.prefix, digits: r.digits, starting_number: r.starting_number,
      current_number: r.current_number, financial_year_id: r.financial_year_id || "",
      is_active: r.is_active,
    });
    setEditId(r.id); setError(""); setModal("edit");
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!form.transaction_type || !form.prefix) throw new Error("Transaction type and Prefix are required.");
      const url = editId ? `/api/voucher-series/${editId}` : "/api/voucher-series";
      const method = editId ? "PATCH" : "POST";
      const payload = { ...form, digits: Number(form.digits), starting_number: Number(form.starting_number), current_number: Number(form.current_number), financial_year_id: form.financial_year_id || null };
      const res = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/voucher-series"] }); setModal(null); },
    onError: (e: any) => setError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/voucher-series/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/voucher-series"] }),
  });

  const resetMut = useMutation({
    mutationFn: async (r: any) => {
      const res = await fetch(`/api/voucher-series/${r.id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...r, current_number: r.starting_number }) });
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/voucher-series"] }),
  });

  const filtered = (rows as any[]).filter(r => {
    if (search && !r.transaction_label?.toLowerCase().includes(search.toLowerCase()) && !r.prefix?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterFy && r.financial_year_id !== filterFy) return false;
    return true;
  });

  return (
    <div className="p-6" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Hash size={16} style={{ color: SC.primary }} />
            <h1 className="font-semibold text-gray-800">Voucher Numbering Series</h1>
          </div>
          <div className="flex items-center gap-2">
            <select value={filterFy} onChange={e => setFilterFy(e.target.value)}
              className="text-sm border border-gray-200 rounded px-3 py-1.5 outline-none focus:border-[#027fa5]"
              data-testid="select-fy-filter">
              <option value="">All Financial Years</option>
              {(fys as any[]).map((f: any) => <option key={f.id} value={f.id}>{f.label}{f.is_current ? " (Current)" : ""}</option>)}
            </select>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search..." className="text-sm border border-gray-200 rounded px-3 py-1.5 w-36 outline-none focus:border-[#027fa5]"
              data-testid="input-search" />
          </div>
        </div>

        {/* Tip banner */}
        <div className="mx-5 mt-4 mb-0 px-3 py-2 rounded-lg text-xs text-blue-700 bg-blue-50 border border-blue-100 flex items-start gap-2">
          <Hash size={13} className="flex-shrink-0 mt-0.5" />
          <span>Each transaction type gets its own number series per financial year. Example: prefix <b>JWI</b>, 5 digits, start <b>1</b> → <span className="font-mono">JWI00001</span></span>
        </div>

        {/* Table */}
        <table className="w-full text-sm mt-3">
          <thead>
            <tr style={{ background: SC.tonal }}>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Transaction</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Financial Year</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Prefix</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Digits</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Start No</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Current No</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Preview</th>
              <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Active</th>
              <th className="px-3 py-2.5 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-400 text-sm">Loading...</td></tr>}
            {!isLoading && filtered.length === 0 && <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-400 text-sm">No series found</td></tr>}
            {filtered.map((r: any, i: number) => (
              <tr key={r.id} className={`border-t border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                data-testid={`row-vs-${r.id}`}>
                <td className="px-4 py-2.5 font-medium text-gray-800">{r.transaction_label}</td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">{r.fy_label || <span className="text-gray-300">—</span>}</td>
                <td className="px-4 py-2.5 font-mono font-semibold text-sm" style={{ color: SC.primary }}>{r.prefix}</td>
                <td className="px-4 py-2.5 text-gray-600 text-center">{r.digits}</td>
                <td className="px-4 py-2.5 text-gray-600 text-center">{r.starting_number}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className="font-semibold text-sm" style={{ color: SC.orange }}>{r.current_number}</span>
                </td>
                <td className="px-4 py-2.5">
                  <Preview prefix={r.prefix} digits={r.digits} start={r.current_number} />
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${r.is_active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {r.is_active ? "Yes" : "No"}
                  </span>
                </td>
                <td className="px-3 py-2.5 flex items-center gap-1">
                  <button onClick={() => openEdit(r)} className="p-1.5 rounded hover:bg-blue-50 transition-colors" style={{ color: SC.primary }} title="Edit" data-testid={`btn-edit-${r.id}`}><Pencil size={13} /></button>
                  <button onClick={() => { if (confirm(`Reset counter to ${r.starting_number}?`)) resetMut.mutate(r); }}
                    className="p-1.5 rounded hover:bg-amber-50 text-amber-500 hover:text-amber-700 transition-colors" title="Reset counter" data-testid={`btn-reset-${r.id}`}><RefreshCw size={13} /></button>
                  <button onClick={() => { if (confirm("Delete this series?")) deleteMut.mutate(r.id); }}
                    className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors" title="Delete" data-testid={`btn-delete-${r.id}`}><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end gap-3 px-5 py-3 border-t border-gray-100">
          <button className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50" style={{ borderColor: "#9ca3af" }}>Cancel</button>
          <button onClick={openAdd} className="px-8 py-2 rounded text-sm font-semibold text-white flex items-center gap-1.5" style={{ background: SC.orange }} data-testid="btn-add"><Plus size={14} /> Add New</button>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden" style={{ fontFamily: "Source Sans Pro, sans-serif" }}>
            <div className="px-5 py-3.5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800 text-sm">{modal === "edit" ? "Edit" : "Add"} Voucher Series</h3>
            </div>
            <div className="px-5 py-5 space-y-3">
              {/* Transaction Type */}
              <div className="relative">
                <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Transaction Type <span className="text-red-400">*</span></label>
                {modal === "add" ? (
                  <select value={form.transaction_type}
                    onChange={e => {
                      const dt = DEFAULT_TYPES.find(d => d.type === e.target.value);
                      setForm(p => ({ ...p, transaction_type: e.target.value, transaction_label: dt?.label || p.transaction_label, prefix: p.prefix || dt?.prefix || "" }));
                    }}
                    className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                    data-testid="select-txn-type">
                    <option value="">Select type...</option>
                    {DEFAULT_TYPES.map(d => <option key={d.type} value={d.type}>{d.label}</option>)}
                    <option value="custom">Custom (enter below)</option>
                  </select>
                ) : (
                  <input value={form.transaction_label} readOnly
                    className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm bg-gray-50 text-gray-500 outline-none" />
                )}
              </div>

              {/* Label — shown for custom */}
              {(modal === "add" && form.transaction_type === "custom") && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative">
                    <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Custom Type Key</label>
                    <input value={form.transaction_type === "custom" ? "" : form.transaction_type}
                      onChange={e => setForm(p => ({ ...p, transaction_type: e.target.value }))}
                      placeholder="e.g. sales_return"
                      className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                      data-testid="input-txn-type-key" />
                  </div>
                  <div className="relative">
                    <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Display Label</label>
                    <input value={form.transaction_label} onChange={e => setForm(p => ({ ...p, transaction_label: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                      data-testid="input-txn-label" />
                  </div>
                </div>
              )}

              {/* Financial Year */}
              <div className="relative">
                <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Financial Year</label>
                <select value={form.financial_year_id} onChange={e => setForm(p => ({ ...p, financial_year_id: e.target.value }))}
                  className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                  data-testid="select-fy">
                  <option value="">— No Year —</option>
                  {(fys as any[]).map((f: any) => <option key={f.id} value={f.id}>{f.label}{f.is_current ? " ★ Current" : ""}</option>)}
                </select>
              </div>

              {/* Prefix + Digits */}
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Prefix <span className="text-red-400">*</span></label>
                  <input value={form.prefix} onChange={e => setForm(p => ({ ...p, prefix: e.target.value.toUpperCase() }))}
                    placeholder="e.g. JWI"
                    className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm font-mono outline-none focus:border-[#027fa5]"
                    data-testid="input-prefix" />
                </div>
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">No. of Digits</label>
                  <input type="number" min={1} max={10} value={form.digits}
                    onChange={e => setForm(p => ({ ...p, digits: parseInt(e.target.value) || 5 }))}
                    className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                    data-testid="input-digits" />
                </div>
              </div>

              {/* Starting Number + Current Number */}
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Starting Number</label>
                  <input type="number" min={1} value={form.starting_number}
                    onChange={e => setForm(p => ({ ...p, starting_number: parseInt(e.target.value) || 1, current_number: modal === "add" ? parseInt(e.target.value) || 1 : p.current_number }))}
                    className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                    data-testid="input-starting-no" />
                </div>
                {modal === "edit" && (
                  <div className="relative">
                    <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Current Counter</label>
                    <input type="number" min={1} value={form.current_number}
                      onChange={e => setForm(p => ({ ...p, current_number: parseInt(e.target.value) || 1 }))}
                      className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                      data-testid="input-current-no" />
                  </div>
                )}
              </div>

              {/* Active toggle */}
              <label className="flex items-center gap-2 cursor-pointer" data-testid="toggle-active">
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[#027fa5]" />
                <span className="text-sm text-gray-700">Active</span>
              </label>

              {/* Live Preview */}
              {form.prefix && (
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-xs text-gray-500">Next voucher will look like:</span>
                  <Preview prefix={form.prefix} digits={form.digits} start={modal === "add" ? form.starting_number : form.current_number} />
                </div>
              )}

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
