import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Info, PencilLine } from "lucide-react";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

function today() { return new Date().toISOString().split("T")[0]; }

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtAmt(n: number) {
  if (!n) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type ItemRow = {
  _key: string;
  item_id: string;
  item_code: string;
  item_name: string;
  hsn: string;
  qty: string;
  unit: string;
  unit_value: string;
  total_value: string;
};

function newRow(): ItemRow {
  return {
    _key: crypto.randomUUID(),
    item_id: "", item_code: "", item_name: "", hsn: "",
    qty: "", unit: "", unit_value: "", total_value: "",
  };
}

// ── Returnable Inward Form ───────────────────────────────────────────────────
function RInwardForm({ editData, onBack }: { editData?: any; onBack: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!editData?.id;

  const { data: customers = [] } = useQuery<any[]>({ queryKey: ["/api/customers"] });
  const { data: products = [] }  = useQuery<any[]>({ queryKey: ["/api/products"] });
  const { data: settingsList = [] } = useQuery<any[]>({ queryKey: ["/api/settings"] });

  const settingsMap = (settingsList as any[]).reduce((m: any, s: any) => { m[s.key] = s.value; return m; }, {});

  // Only non-Raw-Material products for engineering screens
  const filteredProducts = (products as any[]).filter(
    (p: any) => p.category_name?.toLowerCase() !== "raw material"
  );

  // ── Header state ────────────────────────────────────────────────────────────
  const [voucherNo,  setVoucherNo]  = useState(editData?.voucher_no || "");
  const [partyDcNo,  setPartyDcNo]  = useState(editData?.party_dc_no || "");
  const [partyDcDate, setPartyDcDate] = useState(editData?.party_dc_date?.split("T")[0] || "");
  const [inwardDate, setInwardDate] = useState(editData?.inward_date?.split("T")[0] || today());
  const [dueDate,    setDueDate]    = useState(editData?.due_date?.split("T")[0] || "");
  const [remark,     setRemark]     = useState(editData?.remark || "");

  // Party
  const [partyId,       setPartyId]       = useState(editData?.party_id || "");
  const [partySearch,   setPartySearch]   = useState(editData?.party_name_db || editData?.party_name_manual || "");
  const [partyDropOpen, setPartyDropOpen] = useState(false);

  // Vehicle No — 4 parts
  const rawVeh = (editData?.vehicle_no || "").toUpperCase();
  const [vehP1, setVehP1] = useState(rawVeh.slice(0, 2));
  const [vehP2, setVehP2] = useState(rawVeh.slice(2, 4));
  const [vehP3, setVehP3] = useState(rawVeh.slice(4, 6));
  const [vehP4, setVehP4] = useState(rawVeh.slice(6));
  const vehicleNo = `${vehP1}${vehP2}${vehP3}${vehP4}`;

  // Tabs
  const [tab, setTab] = useState<"item" | "delivery">("item");

  // Delivery Details
  const [sameAsCompany,   setSameAsCompany]   = useState(editData?.same_as_company !== false);
  const [contactPerson,   setContactPerson]   = useState(editData?.contact_person || "");
  const [mobileNo,        setMobileNo]        = useState(editData?.mobile_no || "");
  const [emailId,         setEmailId]         = useState(editData?.email_id || "");
  const [deliveryAddress, setDeliveryAddress] = useState(editData?.delivery_address || "");

  // Items
  const [items, setItems] = useState<ItemRow[]>(
    editData?.items?.length
      ? editData.items.map((it: any) => ({
          _key: crypto.randomUUID(),
          item_id: it.item_id || "",
          item_code: it.item_code || "",
          item_name: it.item_name || "",
          hsn: it.hsn || "",
          qty: String(it.qty || ""),
          unit: it.unit || "",
          unit_value: String(it.unit_value || ""),
          total_value: String(it.total_value || ""),
        }))
      : [newRow()]
  );

  // Item search per row
  const [itemSearch,   setItemSearch]   = useState<Record<string, string>>({});
  const [itemDropOpen, setItemDropOpen] = useState<string | null>(null);

  const [error, setError] = useState("");

  // Auto-generate voucher number for new entries
  useEffect(() => {
    if (!isEdit && !voucherNo) {
      fetch("/api/voucher-series/next/returnable_inward", { credentials: "include" })
        .then(r => r.json())
        .then(d => { if (d.voucher_no) setVoucherNo(d.voucher_no); })
        .catch(() => {});
    }
  }, []);

  // When "Same as Company" selected, populate from company settings
  useEffect(() => {
    if (sameAsCompany) {
      setDeliveryAddress([
        settingsMap["company_address"],
        settingsMap["company_city"],
        settingsMap["company_state"],
      ].filter(Boolean).join(", "));
      setContactPerson("");
      setMobileNo(settingsMap["company_phone"] || "");
      setEmailId(settingsMap["company_email"] || "");
    }
  }, [sameAsCompany]);

  function updateRow(key: string, field: keyof ItemRow, val: string) {
    setItems(prev => prev.map(r => {
      if (r._key !== key) return r;
      const updated = { ...r, [field]: val };
      if (field === "qty" || field === "unit_value") {
        const q = parseFloat(field === "qty" ? val : r.qty) || 0;
        const v = parseFloat(field === "unit_value" ? val : r.unit_value) || 0;
        updated.total_value = (q * v).toFixed(2);
      }
      return updated;
    }));
  }

  function selectProduct(rowKey: string, prod: any) {
    const sellingPrice = parseFloat(prod.selling_price || 0);
    setItems(prev => prev.map(r => {
      if (r._key !== rowKey) return r;
      const qty = parseFloat(r.qty) || 0;
      return {
        ...r,
        item_id: prod.id,
        item_code: prod.code || "",
        item_name: prod.name,
        hsn: prod.hsn_code || "",
        unit: prod.uom || prod.unit || "",
        unit_value: sellingPrice ? String(sellingPrice) : "",
        total_value: sellingPrice && qty ? (sellingPrice * qty).toFixed(2) : r.total_value,
      };
    }));
    setItemSearch(prev => ({ ...prev, [rowKey]: prod.name }));
    setItemDropOpen(null);
  }

  function addRow() { setItems(prev => [...prev, newRow()]); }
  function removeRow(key: string) { setItems(prev => prev.filter(r => r._key !== key)); }

  const totalQty   = items.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0);
  const grandTotal = items.reduce((s, r) => s + (parseFloat(r.total_value) || 0), 0);

  const filteredParties = (customers as any[]).filter((c: any) =>
    !partySearch || c.name?.toLowerCase().includes(partySearch.toLowerCase())
  );

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        party_id: partyId || null,
        party_name_manual: partyId ? "" : partySearch,
        party_dc_no: partyDcNo,
        party_dc_date: partyDcDate || null,
        inward_date: inwardDate,
        due_date: dueDate || null,
        vehicle_no: vehicleNo,
        contact_person: contactPerson,
        mobile_no: mobileNo,
        email_id: emailId,
        delivery_address: deliveryAddress,
        same_as_company: sameAsCompany,
        remark,
        items: items.filter(r => r.item_name || r.qty).map(r => ({
          item_id: r.item_id || null, item_code: r.item_code, item_name: r.item_name,
          hsn: r.hsn, qty: r.qty || "0", unit: r.unit,
          unit_value: parseFloat(r.unit_value) || 0,
          total_value: parseFloat(r.total_value) || 0,
        })),
      };
      const url    = isEdit ? `/api/returnable-inward/${editData.id}` : "/api/returnable-inward";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Save failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      if (!isEdit && data.voucher_no) setVoucherNo(data.voucher_no);
      qc.invalidateQueries({ queryKey: ["/api/returnable-inward"] });
      onBack();
    },
    onError: (e: any) => setError(e.message),
  });

  const tabBtn = (id: "item" | "delivery", label: string) => (
    <button
      onClick={() => setTab(id)}
      className="px-5 py-2 text-sm font-semibold rounded-t-lg transition-colors"
      style={tab === id
        ? { background: SC.primary, color: "#fff" }
        : { background: "#f0f9ff", color: SC.primary, border: `1px solid ${SC.primary}` }
      }
      data-testid={`tab-${id}`}
    >
      {label}
    </button>
  );

  return (
    <div className="p-4 md:p-6" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-base">Party Inward DC</h2>
          <Info size={16} className="text-gray-400 cursor-pointer" />
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Row 1 — Party DC | Party Date | Inward No | Inward Date | Due Date */}
          <div className="grid grid-cols-5 gap-3">
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Party DC</label>
              <input value={partyDcNo} onChange={e => setPartyDcNo(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                data-testid="input-party-dc-no" />
            </div>
            <DatePicker label="Party Date" value={partyDcDate} onChange={setPartyDcDate} />
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Inward No</label>
              <input value={voucherNo} readOnly
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm font-semibold outline-none bg-gray-50"
                style={{ color: SC.primary }} data-testid="input-inward-no" />
            </div>
            <DatePicker label="Inward Date" value={inwardDate} onChange={setInwardDate} />
            <DatePicker label="Due Date" value={dueDate} onChange={setDueDate} />
          </div>

          {/* Row 2 — Party Name | Vehicle No */}
          <div className="flex gap-4 items-start">
            {/* Party Name */}
            <div className="flex-1 relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Party Name</label>
              <input
                value={partySearch}
                onChange={e => { setPartySearch(e.target.value); setPartyId(""); setPartyDropOpen(true); }}
                onFocus={() => setPartyDropOpen(true)}
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                data-testid="input-party-search"
              />
              {partyDropOpen && partySearch && filteredParties.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto mt-0.5">
                  {filteredParties.slice(0, 8).map((c: any) => (
                    <button key={c.id} onClick={() => { setPartyId(c.id); setPartySearch(c.name); setPartyDropOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#d2f1fa] transition-colors"
                      data-testid={`opt-party-${c.id}`}>
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Vehicle No */}
            <div>
              <p className="text-xs text-gray-500 mb-1.5 pl-1">Vehicle No</p>
              <div className="flex items-center gap-1">
                {[
                  { val: vehP1, set: setVehP1, w: "w-14", ph: "TN",   max: 2 },
                  { val: vehP2, set: setVehP2, w: "w-12", ph: "00",   max: 2 },
                  { val: vehP3, set: setVehP3, w: "w-14", ph: "AB",   max: 2 },
                  { val: vehP4, set: setVehP4, w: "w-20", ph: "1234", max: 4 },
                ].map((p, i) => (
                  <input key={i} value={p.val} maxLength={p.max} placeholder={p.ph}
                    onChange={e => p.set(e.target.value.toUpperCase())}
                    className={`${p.w} border border-gray-300 rounded px-2 py-2.5 text-sm text-center uppercase outline-none focus:border-[#027fa5]`}
                    data-testid={`input-veh-p${i+1}`}
                  />
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-end gap-1 ml-4">
              {tabBtn("item", "Item")}
              {tabBtn("delivery", "Delivery Details")}
            </div>
          </div>

          {/* ── Item Tab ─────────────────────────────────────────────────────── */}
          {tab === "item" && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Column Headers */}
              <div className="grid text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-200"
                style={{ gridTemplateColumns: "44px 100px 1fr 90px 80px 70px 100px 110px 44px" }}>
                <div className="px-2 py-2 text-center">S.No</div>
                <div className="px-2 py-2">Item Code</div>
                <div className="px-2 py-2">Item Description</div>
                <div className="px-2 py-2">HSN/SAC</div>
                <div className="px-2 py-2 text-right">In Qty</div>
                <div className="px-2 py-2">Unit</div>
                <div className="px-2 py-2 text-right">Unit Value ₹</div>
                <div className="px-2 py-2 text-right">Total Value ₹</div>
                <div className="px-2 py-2"></div>
              </div>

              {/* Rows */}
              {items.map((row, idx) => {
                const searchVal = itemSearch[row._key] ?? row.item_name;
                const filteredProds = filteredProducts.filter((p: any) =>
                  !searchVal || p.name?.toLowerCase().includes(searchVal.toLowerCase()) || p.code?.toLowerCase().includes(searchVal.toLowerCase())
                );
                return (
                  <div key={row._key}
                    className="grid items-center border-b last:border-0"
                    style={{ gridTemplateColumns: "44px 100px 1fr 90px 80px 70px 100px 110px 44px" }}>

                    {/* S.No */}
                    <div className="px-2 py-1.5 text-xs text-gray-500 text-center">{String(idx + 1).padStart(2, "0")}</div>

                    {/* Item Code */}
                    <div className="px-1 py-1">
                      <input value={row.item_code} readOnly
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs bg-gray-50 outline-none"
                        data-testid={`input-item-code-${idx}`} />
                    </div>

                    {/* Item Description — searchable dropdown */}
                    <div className="px-1 py-1 relative">
                      <input
                        value={searchVal}
                        onChange={e => {
                          setItemSearch(prev => ({ ...prev, [row._key]: e.target.value }));
                          updateRow(row._key, "item_name", e.target.value);
                          setItemDropOpen(row._key);
                        }}
                        onFocus={() => setItemDropOpen(row._key)}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs outline-none focus:border-[#027fa5]"
                        placeholder="Select item..."
                        data-testid={`input-item-name-${idx}`}
                      />
                      {itemDropOpen === row._key && filteredProds.length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-40 overflow-y-auto">
                          {filteredProds.slice(0, 10).map((p: any) => (
                            <button key={p.id} onClick={() => selectProduct(row._key, p)}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#d2f1fa] transition-colors">
                              <span className="font-medium">{p.code}</span> — {p.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* HSN/SAC */}
                    <div className="px-1 py-1">
                      <input value={row.hsn} onChange={e => updateRow(row._key, "hsn", e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs outline-none focus:border-[#027fa5]"
                        data-testid={`input-hsn-${idx}`} />
                    </div>

                    {/* In Qty */}
                    <div className="px-1 py-1">
                      <input type="number" value={row.qty} onChange={e => updateRow(row._key, "qty", e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs text-right outline-none focus:border-[#027fa5]"
                        data-testid={`input-qty-${idx}`} />
                    </div>

                    {/* Unit */}
                    <div className="px-1 py-1">
                      <input value={row.unit} onChange={e => updateRow(row._key, "unit", e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs outline-none focus:border-[#027fa5]"
                        data-testid={`input-unit-${idx}`} />
                    </div>

                    {/* Unit Value — editable (pre-filled from product master) */}
                    <div className="px-1 py-1">
                      <input type="number" value={row.unit_value} onChange={e => updateRow(row._key, "unit_value", e.target.value)}
                        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs text-right outline-none focus:border-[#027fa5]"
                        data-testid={`input-unit-value-${idx}`} />
                    </div>

                    {/* Total Value — calculated */}
                    <div className="px-2 py-1.5 text-xs text-right font-semibold text-gray-700">
                      {parseFloat(row.total_value) > 0
                        ? parseFloat(row.total_value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : "—"}
                    </div>

                    {/* Delete */}
                    <div className="px-1 py-1 flex justify-center">
                      {items.length > 1 && (
                        <button onClick={() => removeRow(row._key)}
                          className="text-red-400 hover:text-red-600 p-1" data-testid={`btn-remove-row-${idx}`}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add Row */}
              <div className="flex justify-end px-3 py-2 border-t border-gray-100">
                <button onClick={addRow}
                  className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded"
                  style={{ color: SC.primary }}
                  data-testid="btn-add-row">
                  <Plus size={13} /> Add Row
                </button>
              </div>
            </div>
          )}

          {/* ── Delivery Details Tab ─────────────────────────────────────────── */}
          {tab === "delivery" && (
            <div className="border border-gray-200 rounded-lg p-5">
              <div className="flex items-center gap-8 mb-5">
                <span className="text-sm font-semibold text-gray-700">Delivery</span>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-500">Same as Company</span>
                  {[{ label: "Yes", val: true }, { label: "No", val: false }].map(opt => (
                    <label key={String(opt.val)} className="flex items-center gap-1.5 cursor-pointer">
                      <input type="radio" name="same_as_company"
                        checked={sameAsCompany === opt.val}
                        onChange={() => setSameAsCompany(opt.val)}
                        className="accent-[#d74700]"
                        data-testid={`radio-same-${opt.val}`}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-5">
                {/* Left — Contact fields */}
                <div className="w-64 space-y-4">
                  <div className="relative">
                    <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10">Contact Person</label>
                    <input value={contactPerson} onChange={e => setContactPerson(e.target.value)}
                      disabled={sameAsCompany}
                      className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5] disabled:bg-gray-50 disabled:text-gray-400"
                      data-testid="input-contact-person" />
                  </div>
                  <div className="relative">
                    <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10">Mobile No</label>
                    <input value={mobileNo} onChange={e => setMobileNo(e.target.value)}
                      disabled={sameAsCompany}
                      className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5] disabled:bg-gray-50 disabled:text-gray-400"
                      data-testid="input-mobile-no" />
                  </div>
                  <div className="relative">
                    <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10">Email Id</label>
                    <input value={emailId} onChange={e => setEmailId(e.target.value)}
                      disabled={sameAsCompany}
                      className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5] disabled:bg-gray-50 disabled:text-gray-400"
                      data-testid="input-email-id" />
                  </div>
                </div>

                {/* Right — Delivery Address */}
                <div className="flex-1 relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10">Delivery Address</label>
                  <textarea value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                    disabled={sameAsCompany}
                    rows={5}
                    className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5] resize-none disabled:bg-gray-50 disabled:text-gray-400"
                    data-testid="input-delivery-address" />
                </div>
              </div>
            </div>
          )}

          {/* Footer totals */}
          {tab === "item" && (
            <div className="flex items-center justify-between px-2 py-1 text-sm">
              <span className="text-gray-600">
                Total Quantity : <span className="font-bold text-gray-800">{totalQty > 0 ? totalQty.toLocaleString("en-IN", { maximumFractionDigits: 3 }) : "—"}</span>
              </span>
              <span className="font-bold text-gray-800">
                Grand Total : <span style={{ color: SC.primary }}>₹ {grandTotal > 0 ? grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}</span>
              </span>
            </div>
          )}

          {/* Remark */}
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10">Remark</label>
            <input value={remark} onChange={e => setRemark(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
              data-testid="input-remark" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onBack}
            className="px-8 py-2 border border-gray-300 rounded text-sm font-semibold text-gray-700 hover:bg-gray-50"
            data-testid="btn-cancel">Cancel</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
            className="px-10 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }} data-testid="btn-save">
            {saveMut.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── List View ────────────────────────────────────────────────────────────────
function RInwardList({ onNew, onEdit }: { onNew: () => void; onEdit: (d: any) => void }) {
  const { data: list = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/returnable-inward"] });
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const deleteMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/returnable-inward/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/returnable-inward"] }),
  });

  const filtered = (list as any[]).filter((r: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (r.voucher_no || "").toLowerCase().includes(s) || (r.party_name_db || r.party_name_manual || "").toLowerCase().includes(s);
  });

  return (
    <div className="p-4 md:p-6" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-base">Returnable Party Inward DC</h2>
          <button onClick={onNew}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white"
            style={{ background: SC.orange }} data-testid="btn-new">
            <Plus size={14} /> New
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by inward no or party..."
            className="w-full max-w-sm border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-[#027fa5]"
            data-testid="input-search" />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Inward No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Inward Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Party Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Party DC No</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Due Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Vehicle No</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Grand Total</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">No records found</td></tr>
              )}
              {filtered.map((r: any) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-[#f0f9ff] transition-colors">
                  <td className="px-4 py-3 font-semibold" style={{ color: SC.primary }}>{r.voucher_no}</td>
                  <td className="px-4 py-3 text-gray-700">{fmtDate(r.inward_date)}</td>
                  <td className="px-4 py-3 text-gray-700">{r.party_name_db || r.party_name_manual || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{r.party_dc_no || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(r.due_date)}</td>
                  <td className="px-4 py-3 text-gray-600">{r.vehicle_no || "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-700">—</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => onEdit(r)} className="text-[#027fa5] hover:text-[#015f7a] p-1" data-testid={`btn-edit-${r.id}`}>
                        <PencilLine size={14} />
                      </button>
                      <button onClick={() => deleteMut.mutate(r.id)} className="text-red-400 hover:text-red-600 p-1" data-testid={`btn-delete-${r.id}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function ReturnableInward() {
  const [view, setView] = useState<"list" | "form">("list");
  const [editData, setEditData] = useState<any>(null);

  async function handleEdit(row: any) {
    const res = await fetch(`/api/returnable-inward/${row.id}`, { credentials: "include" });
    const data = await res.json();
    setEditData(data);
    setView("form");
  }

  function handleNew() { setEditData(null); setView("form"); }
  function handleBack() { setEditData(null); setView("list"); }

  if (view === "form") return <RInwardForm editData={editData} onBack={handleBack} />;
  return <RInwardList onNew={handleNew} onEdit={handleEdit} />;
}
