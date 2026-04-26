import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Search, List, Info, ChevronDown } from "lucide-react";
import type { Customer } from "@shared/schema";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

const EMPTY_FORM = {
  name: "", shortName: "",
  // Address
  address1: "", address2: "", city: "", state: "", gstStateCode: "",
  contactName: "", contactRole: "", email: "", telephone: "", websiteUrl: "",
  // Account Info
  creditLimit: "", creditDays: "", termOfPayment: "",
  accountNo: "", accountHolderName: "", accountType: "", bankName: "", branchName: "", ifscCode: "",
  // Other Info
  gstRegisteredType: "", gstin: "", gstinDate: "", gstState: "",
  category: "", deliveryAddress: "", termOfDelivery: "", transport: "", sameAsCompany: false,
  freight: "to_pay",
  notes: "",
};

// ─── Shared form primitives ───────────────────────────────────────────────────
function Field({ label, value, onChange, type = "text", className = "" }: any) {
  if (type === "date") {
    return (
      <DatePicker
        label={label}
        value={value}
        onChange={onChange}
        className={className}
        data-testid={`input-${label.toLowerCase().replace(/\s+/g, "-")}`}
      />
    );
  }
  return (
    <div className={`relative ${className}`}>
      <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">{label}</label>
      <input type={type} value={value} onChange={onChange}
        className="w-full border border-gray-300 rounded px-3 pt-4 pb-2 text-sm text-gray-800 focus:outline-none focus:border-blue-400 bg-white"
        data-testid={`input-${label.toLowerCase().replace(/\s+/g, "-")}`} />
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 3, className = "" }: any) {
  return (
    <div className={`relative ${className}`}>
      <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">{label}</label>
      <textarea value={value} onChange={onChange} rows={rows}
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

function DropPlus({ label, value, onChange, options, className = "" }: any) {
  return (
    <div className={`flex items-start gap-2 ${className}`}>
      <SelectField label={label} value={value} onChange={onChange} options={options} className="flex-1" />
      <button className="flex-shrink-0 w-7 h-7 rounded mt-3 flex items-center justify-center text-white font-bold text-base"
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

// ─── 3-Tab Form ───────────────────────────────────────────────────────────────
function CustomerForm({ initial, cities, states, onClose }: any) {
  const [form, setForm] = useState<any>({ ...EMPTY_FORM, ...initial });
  const [tab, setTab] = useState<"address" | "account" | "other">("address");
  const qc = useQueryClient();

  const f = (key: string) => (e: any) =>
    setForm((p: any) => ({ ...p, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      const url = initial?.id ? `/api/customers/${initial.id}` : "/api/customers";
      const method = initial?.id ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message || "Save failed");
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/customers"] }); onClose(); },
  });

  const TABS = [
    { key: "address", label: "Address" },
    { key: "account", label: "Account Info" },
    { key: "other",   label: "Other Info" },
  ] as const;

  const cityOptions  = (cities  || []).map((c: any) => ({ value: c.name, label: c.name }));
  const stateOptions = (states  || []).map((s: any) => ({ value: s.name, label: s.name }));

  return (
    <div className="bg-white rounded-xl" style={{ boxShadow: "1px 1px 4px rgba(0,0,0,0.12)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-800">Customer</h2>
        <div className="flex items-center gap-2">
          <button onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm font-medium"
            style={{ borderColor: SC.primary, color: SC.primary }} data-testid="button-list-view">
            <List size={14} /> List
          </button>
          <button className="p-1.5 rounded border hover:bg-gray-50" style={{ borderColor: "#d1d5db" }} data-testid="button-info">
            <Info size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        {/* Company Name + Short Name */}
        <div className="flex gap-4 mb-5">
          <Field label="Company Name" value={form.name}      onChange={f("name")}      className="flex-1" />
          <Field label="Short Name"   value={form.shortName} onChange={f("shortName")} className="w-56" />
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-4">
          <div className="flex">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className="px-5 py-2.5 text-sm font-medium border-b-2 transition-colors"
                style={tab === t.key
                  ? { borderColor: SC.primary, background: SC.primary, color: "#fff", borderRadius: "4px 4px 0 0" }
                  : { borderColor: "transparent", color: "#6b7280" }}
                data-testid={`tab-${t.key}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── ADDRESS TAB ── */}
        {tab === "address" && (
          <div className="flex gap-4">
            <div className="flex-1 rounded-lg p-4" style={{ background: SC.bg }}>
              <div className="font-semibold text-gray-700 mb-4">Company Address</div>
              <div className="space-y-4">
                <Field label="Address 1" value={form.address1} onChange={f("address1")} />
                <Field label="Address 2" value={form.address2} onChange={f("address2")} />
                <div className="flex gap-3">
                  <DropPlus label="City"  value={form.city}  onChange={f("city")}  options={cityOptions}  className="flex-1" />
                  <DropPlus label="State" value={form.state} onChange={f("state")} options={stateOptions} className="flex-1" />
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

        {/* ── ACCOUNT INFO TAB ── */}
        {tab === "account" && (
          <div className="flex gap-4">
            {/* Credits — Customer has extra "Term of Payment" */}
            <div className="w-60 flex-shrink-0 rounded-lg p-4" style={{ background: SC.bg }}>
              <div className="font-semibold text-gray-700 mb-4">Credits</div>
              <div className="space-y-4">
                <Field label="Credit limit"    value={form.creditLimit}    onChange={f("creditLimit")}    type="number" />
                <Field label="Credit Days"     value={form.creditDays}     onChange={f("creditDays")}     type="number" />
                <Field label="Term of Payment" value={form.termOfPayment}  onChange={f("termOfPayment")} />
              </div>
            </div>
            {/* Bank Details */}
            <div className="flex-1 rounded-lg p-4" style={{ background: SC.bg }}>
              <div className="font-semibold text-gray-700 mb-4">Bank Details</div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Account No"          value={form.accountNo}         onChange={f("accountNo")} />
                <Field label="Account Holder Name" value={form.accountHolderName} onChange={f("accountHolderName")} />
                <Field label="Account Type"        value={form.accountType}       onChange={f("accountType")} />
                <Field label="Bank Name"           value={form.bankName}          onChange={f("bankName")} />
                <Field label="Branch Name"         value={form.branchName}        onChange={f("branchName")} />
                <Field label="IFSC Code"           value={form.ifscCode}          onChange={f("ifscCode")} />
              </div>
            </div>
          </div>
        )}

        {/* ── OTHER INFO TAB ── */}
        {tab === "other" && (
          <div className="flex gap-4">
            {/* Tax Type */}
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
            {/* Delivery — Customer has Freight radio buttons */}
            <div className="flex-1 rounded-lg p-4" style={{ background: SC.bg }}>
              <div className="font-semibold text-gray-700 mb-4">Delivery</div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-4">
                  <Field label="Category"         value={form.category}      onChange={f("category")} />
                  <Field label="Term of Delivery" value={form.termOfDelivery} onChange={f("termOfDelivery")} />
                  <Field label="Transport"        value={form.transport}     onChange={f("transport")} />
                  {/* Freight radio */}
                  <div className="flex items-center gap-4 pt-1">
                    <span className="text-sm font-semibold text-gray-700">Freight:</span>
                    {[{ value: "to_pay", label: "To Pay" }, { value: "paid", label: "Paid" }].map(opt => (
                      <label key={opt.value} className="flex items-center gap-1.5 cursor-pointer text-sm text-gray-700">
                        <input type="radio" name="freight" value={opt.value} checked={form.freight === opt.value}
                          onChange={f("freight")}
                          className="w-4 h-4 accent-orange-500"
                          data-testid={`radio-freight-${opt.value}`} />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
                <div className="relative">
                  <label className="absolute -top-2 left-3 bg-transparent px-1 text-xs text-gray-500 z-10 leading-none">Delivery Address</label>
                  <textarea value={form.deliveryAddress} onChange={f("deliveryAddress")} rows={7}
                    className="w-full border border-gray-300 rounded px-3 pt-4 pb-2 text-sm text-gray-800 focus:outline-none bg-white resize-none"
                    style={{ minHeight: "160px" }} data-testid="textarea-delivery-address" />
                  <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer mt-2">
                    <input type="checkbox" checked={form.sameAsCompany} onChange={f("sameAsCompany")}
                      className="w-4 h-4 rounded" data-testid="checkbox-same-as-company" />
                    Same as Company
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div className="mt-4">
          <TextArea label="Notes" value={form.notes} onChange={f("notes")} />
        </div>

        {/* Buttons */}
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose}
            className="px-8 py-2 rounded border text-sm font-semibold text-gray-700 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }} data-testid="button-cancel">
            Cancel
          </button>
          <button onClick={() => saveMut.mutate(form)}
            disabled={saveMut.isPending || !form.name.trim()}
            className="px-8 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }} data-testid="button-save">
            {saveMut.isPending ? "Saving…" : "Save"}
          </button>
        </div>
        {saveMut.isError && (
          <p className="text-red-500 text-xs mt-2 text-right">{(saveMut.error as Error).message}</p>
        )}
      </div>
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────
function CustomerList({ customers, onEdit, onDelete, onNew }: any) {
  const [search, setSearch] = useState("");
  const filtered = (customers || []).filter((c: Customer) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.gstin || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 4px rgba(0,0,0,0.12)" }}>
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
        <h2 className="text-lg font-bold text-gray-800">Customers</h2>
        <button onClick={onNew}
          className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white"
          style={{ background: SC.orange }} data-testid="button-new-customer">
          <Plus size={14} /> New Customer
        </button>
      </div>
      <div className="px-5 py-3 border-b border-gray-100">
        <div className="relative w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers…"
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-400"
            data-testid="input-search-customers" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: SC.tonal }}>
              {["S.No", "Company Name", "Short Name", "City", "State", "GSTIN", "Phone", "Email", "Actions"].map(h =>
                <th key={h} className="text-left px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap">{h}</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0
              ? <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No customers found</td></tr>
              : filtered.map((c: Customer, i: number) => (
                <tr key={c.id} className="hover:bg-gray-50" data-testid={`row-customer-${c.id}`}>
                  <td className="px-4 py-2.5 text-gray-500">{i + 1}</td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: SC.primary }}>{c.name}</td>
                  <td className="px-4 py-2.5 text-gray-600">{(c as any).shortName || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600">{(c as any).city || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600">{(c as any).state || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.gstin || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600">{(c as any).telephone || c.phone || "—"}</td>
                  <td className="px-4 py-2.5 text-gray-600">{c.email || "—"}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2">
                      <button onClick={() => onEdit(c)} className="p-1.5 rounded hover:bg-blue-50"
                        style={{ color: SC.primary }} data-testid={`button-edit-${c.id}`}>
                        <Edit size={14} />
                      </button>
                      <button onClick={() => onDelete(c.id)} className="p-1.5 rounded hover:bg-red-50 text-red-400"
                        data-testid={`button-delete-${c.id}`}>
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

// ─── Delete Modal ─────────────────────────────────────────────────────────────
function DeleteModal({ onConfirm, onCancel }: any) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl p-6 w-80 text-center" style={{ boxShadow: "2px 2px 8px rgba(0,0,0,0.3)" }}>
        <div className="text-gray-800 font-semibold mb-2">Delete Customer?</div>
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Customers() {
  const [view, setView]       = useState<"list" | "form">("list");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: customers = [], isLoading } = useQuery<Customer[]>({ queryKey: ["/api/customers"] });
  const { data: cities    = [] }            = useQuery<any[]>({ queryKey: ["/api/cities"] });
  const { data: states    = [] }            = useQuery<any[]>({ queryKey: ["/api/states"] });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/customers"] }); setDeleteId(null); },
  });

  const openNew   = () => { setEditing(null);  setView("form"); };
  const openEdit  = (c: Customer) => { setEditing(c); setView("form"); };
  const closeForm = () => { setEditing(null);  setView("list"); };

  if (isLoading) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: SC.primary, borderTopColor: "transparent" }} />
    </div>
  );

  return (
    <>
      {deleteId && <DeleteModal onConfirm={() => deleteMut.mutate(deleteId)} onCancel={() => setDeleteId(null)} />}
      {view === "list"
        ? <CustomerList customers={customers} onNew={openNew} onEdit={openEdit} onDelete={setDeleteId} />
        : <CustomerForm initial={editing} cities={cities} states={states} onClose={closeForm} />
      }
    </>
  );
}
