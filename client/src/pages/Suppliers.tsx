import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DatePicker from "@/components/DatePicker";
import { Plus, Edit, Trash2, Search, List, Info, ChevronDown, Link2, CheckCircle2 } from "lucide-react";
import type { Supplier } from "@shared/schema";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

const EMPTY_FORM = {
  name: "", shortName: "",
  address1: "", address2: "", city: "", state: "", gstStateCode: "",
  contactName: "", contactRole: "", email: "", telephone: "", websiteUrl: "",
  creditLimit: "", creditDays: "",
  accountNo: "", accountHolderName: "", accountType: "", bankName: "", branchName: "", ifscCode: "",
  gstRegisteredType: "", gstin: "", gstinDate: "", gstState: "",
  category: "", deliveryAddress: "", termOfDelivery: "", transport: "", sameAsCompany: false,
  notes: "",
  subLedgerId: "",
};

function Field({ label, value, onChange, type = "text", className = "", readOnly = false }: any) {
  if (type === "date") {
    return <DatePicker label={label} value={value} onChange={onChange} className={className}
      data-testid={`input-${label.toLowerCase().replace(/\s+/g, "-")}`} />;
  }
  return (
    <div className={`relative ${className}`}>
      <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">{label}</label>
      <input type={type} value={value} onChange={onChange} readOnly={readOnly}
        className="w-full border border-gray-300 rounded px-3 pt-4 pb-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400 bg-white"
        style={{ borderColor: "#d1d5db" }}
        data-testid={`input-${label.toLowerCase().replace(/\s+/g, "-")}`} />
    </div>
  );
}

function TextArea({ label, value, onChange, className = "" }: any) {
  return (
    <div className={`relative ${className}`}>
      <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">{label}</label>
      <textarea value={value} onChange={onChange} rows={3}
        className="w-full border border-gray-300 rounded px-3 pt-4 pb-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400 bg-white resize-none"
        data-testid={`textarea-${label.toLowerCase().replace(/\s+/g, "-")}`} />
    </div>
  );
}

function SelectField({ label, value, onChange, options, className = "" }: any) {
  return (
    <div className={`relative ${className}`}>
      <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">{label}</label>
      <select value={value} onChange={onChange}
        className="w-full border border-gray-300 rounded px-3 pt-4 pb-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400 bg-white appearance-none"
        data-testid={`select-${label.toLowerCase().replace(/\s+/g, "-")}`}>
        <option value="">Select</option>
        {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
    </div>
  );
}

function DropPlus({ label, value, onChange, options, onPlus, className = "" }: any) {
  return (
    <div className={`flex items-start gap-2 ${className}`}>
      <SelectField label={label} value={value} onChange={onChange} options={options} className="flex-1" />
      <button onClick={onPlus} className="flex-shrink-0 w-7 h-7 rounded mt-3 flex items-center justify-center text-white text-base font-bold"
        style={{ background: SC.primary }} data-testid={`button-add-${label.toLowerCase()}`}>+</button>
    </div>
  );
}

const GST_TYPES = [
  { value: "registered_regular",      label: "Registered Regular" },
  { value: "registered_composition",  label: "Registered Composition" },
  { value: "unregistered",            label: "Unregistered" },
  { value: "consumer",                label: "Consumer" },
  { value: "overseas",                label: "Overseas" },
];

// ─── Ledger Mapping Panel ─────────────────────────────────────────────────────
function LedgerPanel({ isEdit, subLedgerId, subLedgerName, createLedger, onSubLedgerChange, onCreateLedgerChange, subledgers }: any) {
  const [showDrop, setShowDrop] = useState(false);
  const linked = subLedgerId ? subledgers.find((s: any) => s.id === subLedgerId) : null;
  const linkedName = linked?.name || subLedgerName || "";

  return (
    <div className="mt-4 rounded-lg p-4 border border-dashed border-[#027fa5]/40 bg-[#eaf7fb]">
      <div className="flex items-center gap-2 mb-3">
        <Link2 size={15} className="text-[#027fa5]" />
        <span className="text-sm font-semibold text-gray-700">Ledger Account — Sundry Creditors</span>
      </div>

      {linkedName ? (
        <div className="flex items-center gap-3 mb-3">
          <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
          <span className="text-sm text-gray-800 font-medium">{linkedName}</span>
          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Linked</span>
          <button onClick={() => { onSubLedgerChange(""); setShowDrop(true); }}
            className="ml-auto text-xs text-[#027fa5] underline" data-testid="btn-change-ledger">
            Change
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-500 mb-3">No ledger account linked.</p>
      )}

      {!linkedName && (
        <>
          <div className="flex items-center gap-3 mb-2">
            {!isEdit && (
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={createLedger} onChange={e => onCreateLedgerChange(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#027fa5]" data-testid="checkbox-create-ledger" />
                Auto-create ledger account on save
              </label>
            )}
            {isEdit && (
              <button onClick={() => onCreateLedgerChange(true)}
                className="px-3 py-1.5 rounded text-sm font-medium text-white"
                style={{ background: SC.primary }} data-testid="btn-create-ledger">
                Create Ledger Account
              </button>
            )}
            <button onClick={() => setShowDrop(v => !v)}
              className="text-xs text-[#027fa5] underline ml-auto" data-testid="btn-select-existing-ledger">
              {showDrop ? "Hide" : "Select existing"}
            </button>
          </div>

          {showDrop && (
            <div className="mt-2">
              <select value={subLedgerId} onChange={e => { onSubLedgerChange(e.target.value); setShowDrop(false); }}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#027fa5]"
                data-testid="select-sub-ledger">
                <option value="">— select sub-ledger —</option>
                {subledgers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
        </>
      )}

      {linkedName && showDrop && (
        <div className="mt-2">
          <select value={subLedgerId} onChange={e => { onSubLedgerChange(e.target.value); setShowDrop(false); }}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#027fa5]"
            data-testid="select-sub-ledger-change">
            <option value="">— select sub-ledger —</option>
            {subledgers.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

// ─── Supplier Form (3 tabs) ───────────────────────────────────────────────────
function SupplierForm({ initial, cities, states, onClose }: any) {
  const [form, setForm] = useState<any>({
    ...EMPTY_FORM,
    ...initial,
    subLedgerId: initial?.sub_ledger_id || initial?.subLedgerId || "",
  });
  const [tab, setTab] = useState<"address" | "account" | "other">("address");
  const [createLedger, setCreateLedger] = useState(!initial?.id);
  const qc = useQueryClient();

  const { data: creditors = [] } = useQuery<any[]>({ queryKey: ["/api/sub-ledgers/creditors"] });

  const f = (key: string) => (e: any) => setForm((p: any) => ({ ...p, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      const url = initial?.id ? `/api/suppliers/${initial.id}` : "/api/suppliers";
      const method = initial?.id ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message || "Save failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/suppliers"] });
      qc.invalidateQueries({ queryKey: ["/api/sub-ledgers/creditors"] });
      onClose();
    },
  });

  const handleSave = () => {
    saveMut.mutate({ ...form, createLedger: createLedger && !form.subLedgerId });
  };

  const TABS = [
    { key: "address", label: "Address" },
    { key: "account", label: "Account Info" },
    { key: "other",   label: "Other Info" },
  ] as const;

  const cityOptions  = (cities || []).map((c: any) => ({ value: c.name, label: c.name }));
  const stateOptions = (states || []).map((s: any) => ({ value: s.name, label: s.name }));

  return (
    <div className="bg-white rounded-xl" style={{ boxShadow: "1px 1px 4px rgba(0,0,0,0.12)" }}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-800">Supplier</h2>
        <div className="flex items-center gap-2">
          <button onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm font-medium text-gray-600 hover:bg-gray-50"
            style={{ borderColor: SC.primary, color: SC.primary }} data-testid="button-list-view">
            <List size={14} /> List
          </button>
          <button className="p-1.5 rounded border hover:bg-gray-50" style={{ borderColor: "#d1d5db" }} data-testid="button-info">
            <Info size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="flex gap-4 mb-5">
          <Field label="Company Name" value={form.name}      onChange={f("name")}      className="flex-1" />
          <Field label="Short Name"   value={form.shortName} onChange={f("shortName")} className="w-56" />
        </div>

        <div className="border-b border-gray-200 mb-4">
          <div className="flex">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? "border-blue-500 text-white" : "border-transparent text-gray-500 hover:text-gray-700"}`}
                style={tab === t.key ? { borderColor: SC.primary, background: SC.primary, borderRadius: "4px 4px 0 0" } : {}}
                data-testid={`tab-${t.key}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "address" && (
          <div className="flex gap-4">
            <div className="flex-1 rounded-lg p-4" style={{ background: SC.bg }}>
              <div className="font-semibold text-gray-700 mb-4">Company Address</div>
              <div className="space-y-4">
                <Field label="Address 1" value={form.address1} onChange={f("address1")} />
                <Field label="Address 2" value={form.address2} onChange={f("address2")} />
                <div className="flex gap-3">
                  <DropPlus label="City"  value={form.city}  onChange={f("city")}  options={cityOptions}  onPlus={() => {}} className="flex-1" />
                  <DropPlus label="State" value={form.state} onChange={f("state")} options={stateOptions} onPlus={() => {}} className="flex-1" />
                </div>
                <Field label="GST State Code" value={form.gstStateCode} onChange={f("gstStateCode")} className="w-40" />
              </div>
            </div>
            <div className="flex-1 rounded-lg p-4" style={{ background: SC.bg }}>
              <div className="font-semibold text-gray-700 mb-4">Contact Details</div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Name"        value={form.contactName} onChange={f("contactName")} />
                <Field label="Role"        value={form.contactRole} onChange={f("contactRole")} />
                <Field label="Email"       value={form.email}       onChange={f("email")} />
                <Field label="Telephone"   value={form.telephone}   onChange={f("telephone")} />
                <Field label="Website URL" value={form.websiteUrl}  onChange={f("websiteUrl")} className="col-span-2" />
              </div>
            </div>
          </div>
        )}

        {tab === "account" && (
          <div>
            <div className="flex gap-4">
              <div className="w-56 flex-shrink-0 rounded-lg p-4" style={{ background: SC.bg }}>
                <div className="font-semibold text-gray-700 mb-4">Credits</div>
                <div className="space-y-4">
                  <Field label="Credit limit" value={form.creditLimit} onChange={f("creditLimit")} type="number" />
                  <Field label="Credit Days"  value={form.creditDays}  onChange={f("creditDays")}  type="number" />
                </div>
              </div>
              <div className="flex-1 rounded-lg p-4" style={{ background: SC.bg }}>
                <div className="font-semibold text-gray-700 mb-4">Bank Details</div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Account No"          value={form.accountNo}          onChange={f("accountNo")} />
                  <Field label="Account Holder Name" value={form.accountHolderName}  onChange={f("accountHolderName")} />
                  <Field label="Account Type"        value={form.accountType}        onChange={f("accountType")} />
                  <Field label="Bank Name"           value={form.bankName}           onChange={f("bankName")} />
                  <Field label="Branch Name"         value={form.branchName}         onChange={f("branchName")} />
                  <Field label="IFSC Code"           value={form.ifscCode}           onChange={f("ifscCode")} />
                </div>
              </div>
            </div>
            <LedgerPanel
              isEdit={!!initial?.id}
              subLedgerId={form.subLedgerId}
              subLedgerName={initial?.sub_ledger_name || ""}
              createLedger={createLedger}
              onSubLedgerChange={(id: string) => setForm((p: any) => ({ ...p, subLedgerId: id }))}
              onCreateLedgerChange={setCreateLedger}
              subledgers={creditors}
            />
          </div>
        )}

        {tab === "other" && (
          <div className="flex gap-4">
            <div className="flex-1 rounded-lg p-4" style={{ background: SC.bg }}>
              <div className="font-semibold text-gray-700 mb-4">Tax Type</div>
              <div className="space-y-4">
                <SelectField label="GST Registered Type" value={form.gstRegisteredType} onChange={f("gstRegisteredType")} options={GST_TYPES} />
                <Field label="GSTIN" value={form.gstin} onChange={f("gstin")} />
                <div className="flex gap-3">
                  <Field label="GSTIN Date" value={form.gstinDate} onChange={f("gstinDate")} type="date" className="flex-1" />
                  <Field label="State"      value={form.gstState}  onChange={f("gstState")} className="flex-1" />
                </div>
              </div>
            </div>
            <div className="flex-1 rounded-lg p-4" style={{ background: SC.bg }}>
              <div className="font-semibold text-gray-700 mb-4">Delivery</div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Category"        value={form.category}       onChange={f("category")} />
                <div className="row-span-3 relative">
                  <label className="absolute -top-2 left-3 bg-transparent px-1 text-xs text-gray-500 z-10 leading-none">Delivery Address</label>
                  <textarea value={form.deliveryAddress} onChange={f("deliveryAddress")} rows={6}
                    className="w-full h-full border border-gray-300 rounded px-3 pt-4 pb-2 text-sm text-gray-800 focus:outline-none bg-white resize-none"
                    style={{ minHeight: "130px" }} data-testid="textarea-delivery-address" />
                </div>
                <Field label="Term of Delivery" value={form.termOfDelivery} onChange={f("termOfDelivery")} />
                <Field label="Transport"        value={form.transport}      onChange={f("transport")} />
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={form.sameAsCompany} onChange={f("sameAsCompany")}
                    className="w-4 h-4 rounded" data-testid="checkbox-same-as-company" />
                  Same as Company
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4">
          <TextArea label="Notes" value={form.notes} onChange={f("notes")} />
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose}
            className="px-8 py-2 rounded border text-sm font-semibold text-gray-700 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }} data-testid="button-cancel">
            Cancel
          </button>
          <button onClick={handleSave}
            disabled={saveMut.isPending || !form.name.trim()}
            className="px-8 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }} data-testid="button-save">
            {saveMut.isPending ? "Saving…" : "Save"}
          </button>
        </div>
        {saveMut.isError && <p className="text-red-500 text-xs mt-2 text-right">{(saveMut.error as Error).message}</p>}
      </div>
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────
function SupplierList({ suppliers, onEdit, onDelete, onNew }: any) {
  const [search, setSearch] = useState("");
  const filtered = (suppliers || []).filter((s: Supplier) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.gstin || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 4px rgba(0,0,0,0.12)" }}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-800">Suppliers</h2>
        <button onClick={onNew}
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white"
          style={{ background: SC.orange }} data-testid="button-new-supplier">
          <Plus size={14} /> New Supplier
        </button>
      </div>
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="relative w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers…"
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-400"
            data-testid="input-search-suppliers" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: SC.tonal }}>
              {["S.No", "Company Name", "Short Name", "City", "State", "GSTIN", "Phone", "Email", "Ledger Account", "Actions"].map(h =>
                <th key={h} className="text-left px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0
              ? <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">No suppliers found</td></tr>
              : filtered.map((s: any, i: number) => (
                <tr key={s.id} className="hover:bg-gray-50" data-testid={`row-supplier-${s.id}`}>
                  <td className="px-4 py-2.5 text-gray-500">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: SC.primary }}>{s.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{s.shortName || s.short_name || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600">{s.city || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600">{s.state || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600">{s.gstin || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600">{s.telephone || s.phone || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600">{s.email || "—"}</td>
                  <td className="px-4 py-2.5">
                    {s.sub_ledger_name
                      ? <span className="flex items-center gap-1 text-green-700 text-xs"><CheckCircle2 size={12} />{s.sub_ledger_name}</span>
                      : <span className="text-xs text-gray-400">Not linked</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2">
                      <button onClick={() => onEdit(s)} className="p-1.5 rounded hover:bg-blue-50"
                        style={{ color: SC.primary }} data-testid={`button-edit-${s.id}`}>
                        <Edit size={14} />
                      </button>
                      <button onClick={() => onDelete(s.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400"
                        data-testid={`button-delete-${s.id}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DeleteModal({ onConfirm, onCancel }: any) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-80 text-center" style={{ boxShadow: "2px 2px 8px rgba(0,0,0,0.3)" }}>
        <div className="text-gray-800 font-semibold mb-2">Delete Supplier?</div>
        <div className="text-sm text-gray-500 mb-5">This action cannot be undone.</div>
        <div className="flex gap-3 justify-center">
          <button onClick={onCancel} className="px-6 py-2 rounded border text-sm font-medium text-gray-600 hover:bg-gray-50"
            data-testid="button-cancel-delete">Cancel</button>
          <button onClick={onConfirm} className="px-6 py-2 rounded text-sm font-semibold text-white"
            style={{ background: SC.orange }} data-testid="button-confirm-delete">Delete</button>
        </div>
      </div>
    </div>
  );
}

export default function Suppliers() {
  const [view, setView]     = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: suppliers = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/suppliers"] });
  const { data: cities  = [] } = useQuery<any[]>({ queryKey: ["/api/cities"] });
  const { data: states  = [] } = useQuery<any[]>({ queryKey: ["/api/states"] });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/suppliers"] }); setDeleteId(null); },
  });

  const openNew   = () => { setEditing(null);  setView("form"); };
  const openEdit  = (s: any) => { setEditing(s); setView("form"); };
  const closeForm = () => { setEditing(null); setView("list"); };

  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: SC.primary, borderTopColor: "transparent" }} />
    </div>
  );

  return (
    <>
      {deleteId && <DeleteModal onConfirm={() => deleteMut.mutate(deleteId!)} onCancel={() => setDeleteId(null)} />}
      {view === "list"
        ? <SupplierList suppliers={suppliers} onNew={openNew} onEdit={openEdit} onDelete={setDeleteId} />
        : <SupplierForm initial={editing} cities={cities} states={states} onClose={closeForm} />
      }
    </>
  );
}
