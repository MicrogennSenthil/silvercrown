import { useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DatePicker from "@/components/DatePicker";
import { Plus, Edit, Trash2, Search, List, Info, ChevronDown, Link2, CheckCircle2, Users } from "lucide-react";
import type { Supplier } from "@shared/schema";
import { useFormValidation } from "@/hooks/useFormValidation";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

const EMPTY_FORM = {
  name: "", shortName: "",
  address1: "", address2: "", city: "", pincode: "", state: "", gstStateCode: "",
  contactName: "", contactRole: "", email: "", telephone: "", websiteUrl: "",
  creditLimit: "", creditDays: "",
  accountNo: "", accountHolderName: "", accountType: "", bankName: "", branchName: "", ifscCode: "",
  gstRegisteredType: "", gstin: "", gstinDate: "", gstState: "",
  category: "", deliveryAddress: "", termOfDelivery: "", transport: "", sameAsCompany: false,
  notes: "",
  subLedgerId: "",
};

function Field({ label, value, onChange, type = "text", className = "", readOnly = false, error = false }: any) {
  if (type === "date") {
    return <DatePicker label={label} value={value} onChange={onChange} className={className}
      data-testid={`input-${label.toLowerCase().replace(/\s+/g, "-")}`} />;
  }
  return (
    <div className={`relative ${className}`}>
      <label className={`absolute -top-2 left-3 bg-white px-1 text-xs z-10 leading-none ${error ? "text-red-500 font-semibold" : "text-gray-500"}`}>{label}{error && " *"}</label>
      <input type={type} value={value} onChange={onChange} readOnly={readOnly}
        className={`w-full rounded px-3 pt-4 pb-2 text-sm text-gray-800 focus:outline-none bg-white border ${error ? "border-red-400 focus:border-red-500 bg-red-50/30" : "border-gray-300 focus:border-blue-400"}`}
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
      <button type="button" onClick={onPlus} className="flex-shrink-0 w-7 h-7 rounded mt-3 flex items-center justify-center text-white text-base font-bold"
        style={{ background: SC.primary }} data-testid={`button-add-${label.toLowerCase()}`}>+</button>
    </div>
  );
}

function QuickAddModal({ type, stateList, onSaved, onCancel }: { type: "city" | "state" | "role"; stateList: any[]; onSaved: (name: string, stateId?: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [stateId, setStateId] = useState("");
  const qc = useQueryClient();

  const url  = type === "role" ? "/api/contact-roles" : type === "city" ? "/api/cities" : "/api/states";
  const body = type === "role" ? { name, isActive: true } : type === "city" ? { name, stateId: stateId || undefined, isActive: true } : { name, isActive: true };
  const qKey = type === "role" ? "/api/contact-roles" : type === "city" ? "/api/cities" : "/api/states";
  const label = type === "role" ? "Contact Role" : type === "city" ? "City" : "State";

  const mut = useMutation({
    mutationFn: async () => {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message || "Save failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [qKey] });
      onSaved(name.trim(), type === "city" ? stateId : undefined);
    },
  });

  return createPortal(
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-xl p-5 w-80" style={{ boxShadow: "2px 2px 10px rgba(0,0,0,0.25)" }}>
        <div className="font-semibold text-gray-800 mb-4">Add New {label}</div>
        <div className="space-y-3">
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">{label} Name</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 pt-4 pb-2 text-sm focus:outline-none focus:border-blue-400"
              data-testid="input-quick-add-name" />
          </div>
          {type === "city" && (
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">State *</label>
              <select value={stateId} onChange={e => setStateId(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 pt-4 pb-2 text-sm focus:outline-none bg-white appearance-none focus:border-blue-400"
                data-testid="select-quick-add-state">
                <option value="">— Select State —</option>
                {(stateList || []).map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          )}
        </div>
        {mut.isError && <p className="text-red-500 text-xs mt-2">{(mut.error as Error).message}</p>}
        <div className="flex gap-3 justify-end mt-4">
          <button type="button" onClick={onCancel} className="px-5 py-2 rounded border text-sm font-medium text-gray-600 hover:bg-gray-50"
            data-testid="button-quick-add-cancel">Cancel</button>
          <button type="button" onClick={() => mut.mutate()} disabled={!name.trim() || (type === "city" && !stateId) || mut.isPending}
            className="px-5 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }} data-testid="button-quick-add-save">
            {mut.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const GST_TYPES = [
  { value: "registered_regular",      label: "Registered Regular" },
  { value: "registered_composition",  label: "Registered Composition" },
  { value: "unregistered",            label: "Unregistered" },
  { value: "consumer",                label: "Consumer" },
  { value: "overseas",                label: "Overseas" },
  { value: "sez_tax_exempt",          label: "SEZ / Tax Exempt" },
];

// ─── Ledger Status Panel ──────────────────────────────────────────────────────
function LedgerStatusPanel({ subLedgerName, ledgerType }: { subLedgerName: string; ledgerType: string }) {
  return (
    <div className="mt-4 rounded-lg p-4 border border-dashed border-[#027fa5]/40 bg-[#eaf7fb]">
      <div className="flex items-center gap-2 mb-2">
        <Link2 size={15} className="text-[#027fa5]" />
        <span className="text-sm font-semibold text-gray-700">Ledger Account — {ledgerType}</span>
      </div>
      {subLedgerName ? (
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
          <span className="text-sm text-gray-800 font-medium">{subLedgerName}</span>
          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Linked</span>
        </div>
      ) : (
        <p className="text-xs text-gray-500">
          A ledger account will be automatically created and linked under <strong>{ledgerType}</strong> when you save.
        </p>
      )}
    </div>
  );
}

// ─── Supplier Form (3 tabs) ───────────────────────────────────────────────────
function normalizeSupplier(s: any) {
  if (!s) return {};
  return {
    name:              s.name              || "",
    shortName:         s.short_name        || s.shortName        || "",
    email:             s.email             || "",
    telephone:         s.telephone         || "",
    websiteUrl:        s.website_url       || s.websiteUrl       || "",
    address1:          s.address1          || "",
    address2:          s.address2          || "",
    city:              s.city              || "",
    pincode:           s.pincode           || "",
    state:             s.state             || "",
    gstStateCode:      s.gst_state_code    || s.gstStateCode     || "",
    contactName:       s.contact_name      || s.contactName      || "",
    contactRole:       s.contact_role      || s.contactRole      || "",
    creditLimit:       s.credit_limit      || s.creditLimit      || "0",
    creditDays:        s.credit_days       || s.creditDays       || 0,
    accountNo:         s.account_no        || s.accountNo        || "",
    accountHolderName: s.account_holder_name || s.accountHolderName || "",
    accountType:       s.account_type      || s.accountType      || "",
    bankName:          s.bank_name         || s.bankName         || "",
    branchName:        s.branch_name       || s.branchName       || "",
    ifscCode:          s.ifsc_code         || s.ifscCode         || "",
    gstin:             s.gstin             || "",
    gstRegisteredType: s.gst_registered_type || s.gstRegisteredType || "",
    gstinDate:         s.gstin_date        || s.gstinDate        || "",
    gstState:          s.gst_state         || s.gstState         || "",
    category:          s.category          || "",
    deliveryAddress:   s.delivery_address  || s.deliveryAddress  || "",
    termOfDelivery:    s.term_of_delivery  || s.termOfDelivery   || "",
    transport:         s.transport         || "",
    sameAsCompany:     s.same_as_company   ?? s.sameAsCompany    ?? false,
    notes:             s.notes             || "",
    subLedgerId:       s.sub_ledger_id     || s.subLedgerId      || "",
  };
}

function SupplierForm({ initial, onClose }: any) {
  const [form, setForm] = useState<any>({
    ...EMPTY_FORM,
    ...normalizeSupplier(initial),
  });
  const [tab, setTab] = useState<"address" | "account" | "other">("address");
  const [isAlsoCustomer, setIsAlsoCustomer] = useState(false);
  const [quickAdd, setQuickAdd] = useState<"city" | "state" | "role" | null>(null);
  const qc = useQueryClient();
  const { validate, hasError, clearError, showApiError } = useFormValidation();

  const { data: cities        = [] } = useQuery<any[]>({ queryKey: ["/api/cities"] });
  const { data: states        = [] } = useQuery<any[]>({ queryKey: ["/api/states"] });
  const { data: customers     = [] } = useQuery<any[]>({ queryKey: ["/api/customers"] });
  const { data: allSuppliers  = [] } = useQuery<any[]>({ queryKey: ["/api/suppliers"] });
  const { data: contactRoles  = [] } = useQuery<any[]>({ queryKey: ["/api/contact-roles"] });

  const counterpartExists = (customers as any[]).some(
    (c: any) => c.name?.toLowerCase() === form.name?.toLowerCase()
  );

  const f = (key: string) => (e: any) => { clearError(key); setForm((p: any) => ({ ...p, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value })); };

  const handleCityChange = (e: any) => {
    const cityName = e.target.value;
    const cityObj = (cities || []).find((c: any) => c.name === cityName);
    const stateName = cityObj
      ? ((states || []).find((s: any) => s.id === cityObj.stateId)?.name || "")
      : "";
    setForm((p: any) => ({ ...p, city: cityName, ...(stateName ? { state: stateName } : {}) }));
  };

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
      qc.invalidateQueries({ queryKey: ["/api/sub-ledgers"] });
      qc.invalidateQueries({ queryKey: ["/api/sub-ledgers/creditors"] });
      qc.invalidateQueries({ queryKey: ["/api/sub-ledgers/with-gl"] });
      qc.invalidateQueries({ queryKey: ["/api/ledger-accounts"] });
      onClose();
    },
    onError: (e: any) => {
      try {
        const parsed = JSON.parse(e.message);
        showApiError(Array.isArray(parsed) && parsed[0]?.message ? parsed[0].message : e.message);
      } catch { showApiError(e.message); }
    },
  });

  const handleSave = () => {
    const ok = validate([
      { key: "name", value: form.name, label: "Company Name" },
    ]);
    if (!ok) return;
    saveMut.mutate({
      ...form,
      creditDays: form.creditDays !== "" ? Number(form.creditDays) : 0,
      creditLimit: form.creditLimit !== "" ? String(Number(form.creditLimit)) : "0",
      isAlsoCustomer: isAlsoCustomer && !counterpartExists,
    });
  };

  const TABS = [
    { key: "address", label: "Address" },
    { key: "account", label: "Account Info" },
    { key: "other",   label: "Other Info" },
  ] as const;

  const cityOptions  = (cities        || []).map((c: any) => ({ value: c.name, label: c.name }));
  const stateOptions = (states        || []).map((s: any) => ({ value: s.name, label: s.name }));
  const roleOptions  = (contactRoles  || []).map((r: any) => ({ value: r.name, label: r.name }));

  return (
    <>
    {quickAdd && (
      <QuickAddModal
        type={quickAdd}
        stateList={states}
        onSaved={(name, savedStateId) => {
          if (quickAdd === "city" && savedStateId) {
            const stateName = (states || []).find((s: any) => s.id === savedStateId)?.name || "";
            setForm((p: any) => ({ ...p, city: name, ...(stateName ? { state: stateName } : {}) }));
          } else if (quickAdd === "role") {
            setForm((p: any) => ({ ...p, contactRole: name }));
          } else {
            setForm((p: any) => ({ ...p, [quickAdd!]: name }));
          }
          setQuickAdd(null);
        }}
        onCancel={() => setQuickAdd(null)}
      />
    )}
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
          {/* Company Name with live duplicate hint */}
          <div className="flex-1 relative">
            <Field label="Company Name" value={form.name} onChange={f("name")} error={hasError("name")} />
            {(() => {
              const q = (form.name || "").trim().toLowerCase();
              if (q.length < 2) return null;
              const matches = (allSuppliers as any[]).filter(
                s => s.id !== initial?.id && s.name?.toLowerCase().includes(q)
              );
              if (!matches.length) return null;
              return (
                <div className="absolute top-full left-0 right-0 z-30 mt-0.5 bg-white border border-amber-300 rounded-lg shadow-lg overflow-hidden">
                  <div className="px-3 py-1.5 bg-amber-50 border-b border-amber-200 flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-amber-700">⚠ Similar supplier names already exist</span>
                  </div>
                  <div className="max-h-36 overflow-y-auto">
                    {matches.slice(0, 8).map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between px-3 py-2 text-xs border-b last:border-0 border-gray-100 hover:bg-amber-50">
                        <span className="font-medium text-gray-800">{s.name}</span>
                        <span className="text-gray-400 ml-2">{s.city || ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
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
                  <DropPlus label="City"  value={form.city}  onChange={handleCityChange}  options={cityOptions}  onPlus={() => setQuickAdd("city")}  className="flex-1" />
                  <Field label="Pincode" value={form.pincode} onChange={f("pincode")} className="w-32" />
                  <DropPlus label="State" value={form.state} onChange={f("state")}       options={stateOptions} onPlus={() => setQuickAdd("state")} className="flex-1" />
                </div>
                <Field label="GST State Code" value={form.gstStateCode} onChange={f("gstStateCode")} className="w-40" />
                <div className="border-t border-gray-200 pt-4">
                  <div className="font-semibold text-gray-700 mb-3 text-sm">Tax Type</div>
                  <div className="space-y-3">
                    <SelectField label="GST Registered Type" value={form.gstRegisteredType} onChange={f("gstRegisteredType")} options={GST_TYPES} />
                    <Field label="GSTIN" value={form.gstin} onChange={f("gstin")} />
                    <div className="flex gap-3">
                      <Field label="GSTIN Date" value={form.gstinDate} onChange={f("gstinDate")} type="date" className="flex-1" />
                      <DropPlus label="GST State" value={form.gstState} onChange={f("gstState")} options={stateOptions} onPlus={() => setQuickAdd("state")} className="flex-1" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-1 rounded-lg p-4" style={{ background: SC.bg }}>
              <div className="font-semibold text-gray-700 mb-4">Contact Details</div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Name"        value={form.contactName} onChange={f("contactName")} />
                <DropPlus label="Role" value={form.contactRole} onChange={f("contactRole")} options={roleOptions} onPlus={() => setQuickAdd("role")} />
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
            <LedgerStatusPanel
              subLedgerName={initial?.sub_ledger_name || ""}
              ledgerType="Sundry Creditors"
            />
            <div className="mt-3 rounded-lg p-3 border border-dashed border-[#d74700]/40 bg-orange-50/50">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-[#d74700] flex-shrink-0" />
                <span className="text-sm font-semibold text-gray-700">Party Type</span>
              </div>
              <div className="mt-2">
                {counterpartExists ? (
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle2 size={14} className="text-green-600" />
                    <span>This party is <strong>also a Customer</strong> — already linked in Customers master</span>
                  </div>
                ) : (
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                    <input type="checkbox" checked={isAlsoCustomer} onChange={e => setIsAlsoCustomer(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#d74700]" data-testid="checkbox-also-customer" />
                    This party is <strong>also a Customer</strong> — create matching Customer record on save
                  </label>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "other" && (
          <div className="flex gap-4">
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
            disabled={saveMut.isPending}
            className="px-8 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }} data-testid="button-save">
            {saveMut.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
    </>
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
              {["S.No", "Company Name", "Short Name", "City", "State", "GSTIN", "Phone", "Email", "Ledger Account", "Outstanding Balance", "Actions"].map(h =>
                <th key={h} className={`text-left px-4 py-2.5 font-semibold text-gray-600 whitespace-nowrap ${h === "Outstanding Balance" ? "text-right" : ""}`}>{h}</th>
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
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    {(() => {
                      const bal = parseFloat(s.outstanding_balance || "0");
                      const type = s.outstanding_balance_type || "Cr";
                      if (!s.sub_ledger_id || bal === 0) return <span className="text-gray-300 text-xs">—</span>;
                      const color = bal > 0 ? "#d74700" : SC.primary;
                      return (
                        <span className="font-semibold text-xs tabular-nums" style={{ color }}>
                          ₹{Math.abs(bal).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="ml-1 text-gray-400 font-normal">{type}</span>
                        </span>
                      );
                    })()}
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
        : <SupplierForm initial={editing} onClose={closeForm} />
      }
    </>
  );
}
