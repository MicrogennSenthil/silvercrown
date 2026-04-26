import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Info, PencilLine, ChevronDown, Search } from "lucide-react";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

function today() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

const ENTRY_TYPES = [
  { value: "non_returnable_outward", label: "Non-Returnable Outward" },
  { value: "returnable_outward",     label: "Returnable Outward" },
  { value: "returnable_inward",      label: "Returnable Inward" },
];

type GpItem = {
  _key: string;
  item_type: string;
  item_id: string;
  item_code: string;
  item_name: string;
  hsn: string;
  out_qty: string;
  unit: string;
  rate: string;
  purpose: string;
  total_value: string;
};

function newGpRow(): GpItem {
  return { _key: crypto.randomUUID(), item_type: "", item_id: "", item_code: "", item_name: "", hsn: "", out_qty: "", unit: "", rate: "", purpose: "", total_value: "" };
}

function fromInwardItem(it: any): GpItem {
  return {
    _key: crypto.randomUUID(),
    item_type: "Returnable Inward",
    item_id: it.item_id || "",
    item_code: it.item_code || "",
    item_name: it.item_name || "",
    hsn: it.hsn || "",
    out_qty: String(it.qty || 0),
    unit: it.unit || "",
    rate: String(it.unit_value || 0),
    purpose: "",
    total_value: String((parseFloat(it.qty || 0) * parseFloat(it.unit_value || 0)).toFixed(2)),
  };
}

function fromOutwardItem(it: any): GpItem {
  return {
    _key: crypto.randomUUID(),
    item_type: "Returnable Outward",
    item_id: it.item_id || "",
    item_code: it.item_code || "",
    item_name: it.item_name || "",
    hsn: it.hsn || "",
    out_qty: String(it.qty_outward || 0),
    unit: it.unit || "",
    rate: String(it.unit_value || 0),
    purpose: "",
    total_value: String(it.total_value || 0),
  };
}

// ── Gate Pass Form ───────────────────────────────────────────────────────────
function GpForm({ editData, onBack }: { editData?: any; onBack: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!editData?.id;

  const { data: customers = [] }    = useQuery<any[]>({ queryKey: ["/api/customers"] });
  const { data: products = [] }     = useQuery<any[]>({ queryKey: ["/api/products"] });
  const { data: rInwards = [] }     = useQuery<any[]>({ queryKey: ["/api/returnable-inward"] });
  const { data: rOutwards = [] }    = useQuery<any[]>({ queryKey: ["/api/returnable-outward"] });
  const { data: settingsList = [] } = useQuery<any[]>({ queryKey: ["/api/settings"] });
  const settingsMap = (settingsList as any[]).reduce((m: any, s: any) => { m[s.key] = s.value; return m; }, {});

  const linkedIdsKey = isEdit
    ? `/api/gate-pass/linked-source-ids?exclude_gate_pass_id=${editData.id}`
    : "/api/gate-pass/linked-source-ids";
  const { data: linkedIds } = useQuery<{ returnable_inward_ids: string[]; returnable_outward_ids: string[] }>({
    queryKey: [linkedIdsKey],
  });
  const usedInwardIds  = new Set(linkedIds?.returnable_inward_ids || []);
  const usedOutwardIds = new Set(linkedIds?.returnable_outward_ids || []);

  // ── Form state ───────────────────────────────────────────────────────────────
  const [entryType,    setEntryType]    = useState(editData?.entry_type || "non_returnable_outward");
  const [typeDropOpen, setTypeDropOpen] = useState(false);
  const [voucherNo,    setVoucherNo]    = useState(editData?.voucher_no || "");
  const [outwardDate,  setOutwardDate]  = useState(editData?.outward_date?.split("T")[0] || today());
  const [dueDate,      setDueDate]      = useState(editData?.due_date?.split("T")[0] || "");
  const [remark,       setRemark]       = useState(editData?.remark || "");
  const [partyId,      setPartyId]      = useState(editData?.party_id || "");
  const [partySearch,  setPartySearch]  = useState(editData?.party_name_db || editData?.party_name_manual || "");
  const [partyDropOpen, setPartyDropOpen] = useState(false);
  const [panelSearch,  setPanelSearch]  = useState("");

  const rawVeh = (editData?.vehicle_no || "").toUpperCase();
  const [vehP1, setVehP1] = useState(rawVeh.slice(0, 2));
  const [vehP2, setVehP2] = useState(rawVeh.slice(2, 4));
  const [vehP3, setVehP3] = useState(rawVeh.slice(4, 6));
  const [vehP4, setVehP4] = useState(rawVeh.slice(6));
  const vehicleNo = `${vehP1}${vehP2}${vehP3}${vehP4}`;

  const [tab, setTab] = useState<"item" | "delivery">("item");
  const [sameAsCompany,   setSameAsCompany]   = useState(editData?.same_as_company !== false);
  const [contactPerson,   setContactPerson]   = useState(editData?.contact_person || "");
  const [mobileNo,        setMobileNo]        = useState(editData?.mobile_no || "");
  const [emailId,         setEmailId]         = useState(editData?.email_id || "");
  const [deliveryAddress, setDeliveryAddress] = useState(editData?.delivery_address || "");

  // Source record selected (for returnable types — single record)
  const [selectedSourceId, setSelectedSourceId] = useState<string>(
    editData?.source_inward_id || editData?.source_outward_id || ""
  );
  const [loadingSourceId, setLoadingSourceId] = useState<string | null>(null);

  // Item search per row (for non-returnable mode)
  const [itemSearch,   setItemSearch]   = useState<Record<string, string>>({});
  const [itemDropOpen, setItemDropOpen] = useState<string | null>(null);

  const [items, setItems] = useState<GpItem[]>(
    editData?.items?.length
      ? editData.items.map((it: any) => ({
          _key: crypto.randomUUID(),
          item_type: it.item_type || "",
          item_id: it.item_id || "",
          item_code: it.item_code || "",
          item_name: it.item_name || "",
          hsn: it.hsn || "",
          out_qty: String(it.out_qty || ""),
          unit: it.unit || "",
          rate: String(it.rate || ""),
          purpose: it.purpose || "",
          total_value: String(it.total_value || ""),
        }))
      : (entryType === "non_returnable_outward" ? [newGpRow()] : [])
  );

  const [error, setError] = useState("");

  // Auto-generate voucher number
  useEffect(() => {
    if (!isEdit && !voucherNo) {
      fetch("/api/voucher-series/next/gate_pass", { credentials: "include" })
        .then(r => r.json())
        .then(d => { if (d.voucher_no) setVoucherNo(d.voucher_no); })
        .catch(() => {});
    }
  }, []);

  // Same as Company → fill delivery
  useEffect(() => {
    if (sameAsCompany) {
      setDeliveryAddress([settingsMap["company_address"], settingsMap["company_city"], settingsMap["company_state"]].filter(Boolean).join(", "));
      setContactPerson("");
      setMobileNo(settingsMap["company_phone"] || "");
      setEmailId(settingsMap["company_email"] || "");
    }
  }, [sameAsCompany]);

  // When entry type changes, clear items and selected source
  function changeEntryType(et: string) {
    setEntryType(et);
    setItems(et === "non_returnable_outward" ? [newGpRow()] : []);
    setSelectedSourceId("");
    setPartyId(""); setPartySearch("");
    setTypeDropOpen(false);
  }

  // Panel records filtered by type + used + search
  const panelRecords = entryType === "returnable_inward"
    ? (rInwards as any[]).filter((r: any) => {
        if (usedInwardIds.has(r.id)) return false;
        if (partyId && r.party_id !== partyId) return false;
        if (panelSearch) {
          const s = panelSearch.toLowerCase();
          return (r.party_name_db || r.party_name_manual || "").toLowerCase().includes(s) ||
                 (r.voucher_no || "").toLowerCase().includes(s);
        }
        return true;
      })
    : entryType === "returnable_outward"
    ? (rOutwards as any[]).filter((r: any) => {
        if (usedOutwardIds.has(r.id)) return false;
        if (partyId && r.party_id !== partyId) return false;
        if (panelSearch) {
          const s = panelSearch.toLowerCase();
          return (r.party_name_db || r.party_name_manual || "").toLowerCase().includes(s) ||
                 (r.voucher_no || "").toLowerCase().includes(s);
        }
        return true;
      })
    : [];

  async function selectSource(record: any) {
    if (selectedSourceId === record.id) {
      // Deselect
      setSelectedSourceId("");
      setItems([]);
      return;
    }
    setLoadingSourceId(record.id);
    try {
      const endpoint = entryType === "returnable_inward"
        ? `/api/returnable-inward/${record.id}`
        : `/api/returnable-outward/${record.id}`;
      const res = await fetch(endpoint, { credentials: "include" });
      const data = await res.json();
      const newItems = (data.items || []).map((it: any) =>
        entryType === "returnable_inward" ? fromInwardItem(it) : fromOutwardItem(it)
      );
      setItems(newItems);
      setSelectedSourceId(record.id);
      if (!partyId && (record.party_id || record.party_name_db)) {
        setPartyId(record.party_id || "");
        setPartySearch(record.party_name_db || record.party_name_manual || "");
      }
    } finally { setLoadingSourceId(null); }
  }

  // Item update (non-returnable mode)
  function updateRow(key: string, field: keyof GpItem, val: string) {
    setItems(prev => prev.map(r => {
      if (r._key !== key) return r;
      const updated = { ...r, [field]: val };
      if (field === "out_qty" || field === "rate") {
        const q = parseFloat(field === "out_qty" ? val : r.out_qty) || 0;
        const rate = parseFloat(field === "rate" ? val : r.rate) || 0;
        updated.total_value = (q * rate).toFixed(2);
      }
      return updated;
    }));
  }

  function selectProduct(rowKey: string, prod: any) {
    setItems(prev => prev.map(r => {
      if (r._key !== rowKey) return r;
      const q = parseFloat(r.out_qty) || 0;
      const price = parseFloat(prod.selling_price || 0);
      return {
        ...r,
        item_id: prod.id,
        item_code: prod.code || "",
        item_name: prod.name,
        hsn: prod.hsn_code || "",
        unit: prod.uom || prod.unit || "",
        rate: price ? String(price) : r.rate,
        total_value: price && q ? (price * q).toFixed(2) : r.total_value,
      };
    }));
    setItemSearch(prev => ({ ...prev, [rowKey]: prod.name }));
    setItemDropOpen(null);
  }

  const totalQty   = items.reduce((s, r) => s + (parseFloat(r.out_qty) || 0), 0);
  const grandTotal = items.reduce((s, r) => s + (parseFloat(r.total_value) || 0), 0);

  const filteredParties = (customers as any[]).filter((c: any) =>
    !partySearch || c.name?.toLowerCase().includes(partySearch.toLowerCase())
  );

  // Item type options (for non-returnable)
  const itemTypeOptions = ["Store item", "Component", "Assemblies", "Finished Product", "Raw Material"];

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        entry_type: entryType,
        party_id: partyId || null,
        party_name_manual: partyId ? "" : partySearch,
        outward_date: outwardDate,
        due_date: dueDate || null,
        vehicle_no: vehicleNo,
        contact_person: contactPerson,
        mobile_no: mobileNo,
        email_id: emailId,
        delivery_address: deliveryAddress,
        same_as_company: sameAsCompany,
        source_inward_id:  entryType === "returnable_inward"  ? selectedSourceId || null : null,
        source_outward_id: entryType === "returnable_outward" ? selectedSourceId || null : null,
        remark,
        items: items.map(r => ({
          item_type: r.item_type, item_id: r.item_id || null, item_code: r.item_code,
          item_name: r.item_name, hsn: r.hsn,
          out_qty: parseFloat(r.out_qty) || 0, unit: r.unit,
          rate: parseFloat(r.rate) || 0, purpose: r.purpose,
          total_value: parseFloat(r.total_value) || 0,
        })),
      };
      const url    = isEdit ? `/api/gate-pass/${editData.id}` : "/api/gate-pass";
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
      qc.invalidateQueries({ queryKey: ["/api/gate-pass"] });
      qc.invalidateQueries({ queryKey: ["/api/gate-pass/linked-source-ids"] });
      onBack();
    },
    onError: (e: any) => setError(e.message),
  });

  const entryLabel = ENTRY_TYPES.find(t => t.value === entryType)?.label || "";
  const isReturnable = entryType !== "non_returnable_outward";

  const tabBtn = (id: "item" | "delivery", label: string) => (
    <button onClick={() => setTab(id)}
      className="px-5 py-2 text-sm font-semibold rounded-t-lg transition-colors"
      style={tab === id
        ? { background: SC.primary, color: "#fff" }
        : { background: "#f0f9ff", color: SC.primary, border: `1px solid ${SC.primary}` }}
      data-testid={`tab-${id}`}>
      {label}
    </button>
  );

  return (
    <div className="p-4 md:p-6" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-base">Gate Pass Entry</h2>
          <Info size={16} className="text-gray-400 cursor-pointer" />
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Row 1 — Entry type dropdown | Search | Inward/Outward Panel */}
          <div className="flex gap-4 items-start">

            {/* Entry Type Dropdown */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setTypeDropOpen(p => !p)}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded text-sm font-semibold bg-white min-w-[220px] justify-between"
                style={{ color: SC.primary }}
                data-testid="btn-entry-type">
                {entryLabel}
                <ChevronDown size={14} className={typeDropOpen ? "rotate-180" : ""} style={{ transition: "transform 0.2s" }} />
              </button>
              {typeDropOpen && (
                <div className="absolute top-full left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-30 min-w-[220px]">
                  {ENTRY_TYPES.map(et => (
                    <button key={et.value} onClick={() => changeEntryType(et.value)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-[#d2f1fa] transition-colors font-semibold"
                      style={{ color: entryType === et.value ? SC.primary : "#374151",
                               background: entryType === et.value ? "#f0f9ff" : "transparent" }}
                      data-testid={`opt-type-${et.value}`}>
                      {et.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search box (visible for returnable types) */}
            {isReturnable && (
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={panelSearch} onChange={e => setPanelSearch(e.target.value)}
                  placeholder="Search here..."
                  className="w-full border border-gray-300 rounded pl-8 pr-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                  data-testid="input-panel-search" />
              </div>
            )}

            {/* Right panel for Returnable types */}
            {isReturnable && (
              <div className="w-80 border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                <div className="grid text-xs font-semibold text-gray-600 bg-gray-50 border-b"
                  style={{ gridTemplateColumns: "1fr 1fr 44px" }}>
                  <div className="px-3 py-2">RDC INW Date</div>
                  <div className="px-3 py-2">RDC INW No</div>
                  <div className="px-3 py-2 text-center">Select</div>
                </div>
                <div className="max-h-24 overflow-y-auto">
                  {panelRecords.length === 0 && (
                    <div className="px-3 py-3 text-xs text-gray-400 text-center">
                      No pending records available
                    </div>
                  )}
                  {panelRecords.map((r: any) => (
                    <div key={r.id}
                      className="grid items-center border-b last:border-0 hover:bg-blue-50 transition-colors"
                      style={{ gridTemplateColumns: "1fr 1fr 44px" }}>
                      <div className="px-3 py-2 text-xs text-gray-700">
                        {fmtDate(r.inward_date || r.outward_date)}
                      </div>
                      <div className="px-3 py-2 text-xs font-semibold" style={{ color: SC.primary }}>
                        {r.voucher_no}
                      </div>
                      <div className="px-3 py-2 flex justify-center">
                        {loadingSourceId === r.id
                          ? <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: SC.primary, borderTopColor: "transparent" }} />
                          : (
                            <input type="checkbox"
                              checked={selectedSourceId === r.id}
                              onChange={e => selectSource(r)}
                              className="accent-[#027fa5] cursor-pointer"
                              data-testid={`chk-source-${r.id}`}
                            />
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Row 2 — Party Name */}
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Party Name</label>
            {isReturnable ? (
              <select value={partyId}
                onChange={e => { setPartyId(e.target.value); const c = (customers as any[]).find((c: any) => c.id === e.target.value); setPartySearch(c?.name || ""); setItems([]); setSelectedSourceId(""); }}
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5] bg-white"
                data-testid="select-party">
                <option value="">— Select Party —</option>
                {(customers as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : (
              <div className="relative">
                <input value={partySearch}
                  onChange={e => { setPartySearch(e.target.value); setPartyId(""); setPartyDropOpen(true); }}
                  onFocus={() => setPartyDropOpen(true)}
                  className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                  data-testid="input-party-search" />
                {partyDropOpen && partySearch && filteredParties.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto">
                    {filteredParties.slice(0, 8).map((c: any) => (
                      <button key={c.id} onClick={() => { setPartyId(c.id); setPartySearch(c.name); setPartyDropOpen(false); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[#d2f1fa]"
                        data-testid={`opt-party-${c.id}`}>{c.name}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Row 3 — Gate Pass No | Outward Date | Due Date | Vehicle No | Tabs */}
          <div className="flex gap-3 items-start flex-wrap">
            <div className="relative w-44">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Gate Pass No</label>
              <input value={voucherNo} readOnly
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm font-semibold bg-gray-50 outline-none"
                style={{ color: SC.primary }} data-testid="input-voucher-no" />
            </div>
            <div className="w-40">
              <DatePicker label="Outward Date" value={outwardDate} onChange={setOutwardDate} />
            </div>
            <div className="w-40">
              <DatePicker label="Due Date" value={dueDate} onChange={setDueDate} />
            </div>
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
                    data-testid={`input-veh-p${i+1}`} />
                ))}
              </div>
            </div>
            <div className="flex items-end gap-1 ml-auto">
              {tabBtn("item", "Item")}
              {tabBtn("delivery", "Delivery Details")}
            </div>
          </div>

          {/* ── Item Tab ─────────────────────────────────────────────────────── */}
          {tab === "item" && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Non-Returnable Outward columns */}
              {!isReturnable && (
                <>
                  <div className="grid text-xs font-semibold text-gray-600 bg-gray-50 border-b"
                    style={{ gridTemplateColumns: "40px 120px 1fr 80px 75px 60px 85px 1fr 100px 40px" }}>
                    {["S.No","Item Type","Item Name","HSN","Out Qty","Unit","Rate ₹","Purpose","Total Value ₹",""].map(h => (
                      <div key={h} className="px-2 py-2">{h}</div>
                    ))}
                  </div>
                  {items.map((row, idx) => {
                    const searchVal = itemSearch[row._key] ?? row.item_name;
                    const filteredProds = (products as any[]).filter((p: any) =>
                      !searchVal || p.name?.toLowerCase().includes(searchVal.toLowerCase()) || p.code?.toLowerCase().includes(searchVal.toLowerCase())
                    );
                    return (
                      <div key={row._key}
                        className="grid items-center border-b last:border-0 hover:bg-gray-50"
                        style={{ gridTemplateColumns: "40px 120px 1fr 80px 75px 60px 85px 1fr 100px 40px" }}>

                        <div className="px-2 py-1.5 text-xs text-gray-500 text-center">{String(idx+1).padStart(2,"0")}</div>

                        {/* Item Type */}
                        <div className="px-1 py-1">
                          <select value={row.item_type}
                            onChange={e => updateRow(row._key, "item_type", e.target.value)}
                            className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs outline-none focus:border-[#027fa5] bg-white"
                            data-testid={`sel-item-type-${idx}`}>
                            <option value="">Select</option>
                            {itemTypeOptions.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        </div>

                        {/* Item Name — searchable */}
                        <div className="px-1 py-1 relative">
                          <input value={searchVal}
                            onChange={e => { setItemSearch(prev => ({ ...prev, [row._key]: e.target.value })); updateRow(row._key, "item_name", e.target.value); setItemDropOpen(row._key); }}
                            onFocus={() => setItemDropOpen(row._key)}
                            className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs outline-none focus:border-[#027fa5]"
                            placeholder="Search item..."
                            data-testid={`input-item-name-${idx}`} />
                          {itemDropOpen === row._key && filteredProds.length > 0 && (
                            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-36 overflow-y-auto">
                              {filteredProds.slice(0, 10).map((p: any) => (
                                <button key={p.id} onClick={() => selectProduct(row._key, p)}
                                  className="w-full text-left px-2 py-1.5 text-xs hover:bg-[#d2f1fa] transition-colors">
                                  <span className="font-medium">{p.code}</span> — {p.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* HSN */}
                        <div className="px-1 py-1">
                          <input value={row.hsn} onChange={e => updateRow(row._key, "hsn", e.target.value)}
                            className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs outline-none focus:border-[#027fa5]"
                            data-testid={`input-hsn-${idx}`} />
                        </div>

                        {/* Out Qty */}
                        <div className="px-1 py-1">
                          <input type="number" value={row.out_qty} onChange={e => updateRow(row._key, "out_qty", e.target.value)}
                            className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs text-right outline-none focus:border-[#027fa5]"
                            data-testid={`input-qty-${idx}`} />
                        </div>

                        {/* Unit */}
                        <div className="px-1 py-1">
                          <input value={row.unit} onChange={e => updateRow(row._key, "unit", e.target.value)}
                            className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs outline-none focus:border-[#027fa5]"
                            data-testid={`input-unit-${idx}`} />
                        </div>

                        {/* Rate */}
                        <div className="px-1 py-1">
                          <input type="number" value={row.rate} onChange={e => updateRow(row._key, "rate", e.target.value)}
                            className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs text-right outline-none focus:border-[#027fa5]"
                            data-testid={`input-rate-${idx}`} />
                        </div>

                        {/* Purpose */}
                        <div className="px-1 py-1">
                          <input value={row.purpose} onChange={e => updateRow(row._key, "purpose", e.target.value)}
                            className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs outline-none focus:border-[#027fa5]"
                            placeholder="Purpose"
                            data-testid={`input-purpose-${idx}`} />
                        </div>

                        {/* Total Value */}
                        <div className="px-2 py-1.5 text-xs text-right font-semibold text-gray-700">
                          {parseFloat(row.total_value) > 0
                            ? parseFloat(row.total_value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : "—"}
                        </div>

                        {/* Delete / Add row */}
                        <div className="px-1 flex justify-center">
                          {idx === items.length - 1
                            ? <button onClick={() => setItems(p => [...p, newGpRow()])}
                                className="text-green-600 hover:text-green-800 p-1" data-testid={`btn-add-${idx}`}>
                                <Plus size={13} />
                              </button>
                            : <button onClick={() => setItems(p => p.filter(r => r._key !== row._key))}
                                className="text-red-400 hover:text-red-600 p-1" data-testid={`btn-rm-${idx}`}>
                                <Trash2 size={13} />
                              </button>
                          }
                        </div>
                      </div>
                    );
                  })}
                </>
              )}

              {/* Returnable types — read-only grid */}
              {isReturnable && (
                <>
                  <div className="grid text-xs font-semibold text-gray-600 bg-gray-50 border-b"
                    style={{ gridTemplateColumns: "40px 90px 1fr 80px 75px 60px 90px 100px" }}>
                    {["S.No","Item Code","Item Name","HSN","Out Qty","Unit","Rate ₹","Total Value ₹"].map(h => (
                      <div key={h} className="px-2 py-2">{h}</div>
                    ))}
                  </div>
                  {items.length === 0 && (
                    <div className="px-4 py-6 text-center text-sm text-gray-400">
                      {selectedSourceId ? "No items in selected record" : "Select a record from the panel above"}
                    </div>
                  )}
                  {items.map((row, idx) => (
                    <div key={row._key} className="grid items-center border-b last:border-0 hover:bg-gray-50"
                      style={{ gridTemplateColumns: "40px 90px 1fr 80px 75px 60px 90px 100px" }}>
                      <div className="px-2 py-1.5 text-xs text-gray-500 text-center">{String(idx+1).padStart(2,"0")}</div>
                      <div className="px-2 py-1.5 text-xs text-gray-600">{row.item_code}</div>
                      <div className="px-2 py-1.5 text-xs font-medium text-gray-800">{row.item_name}</div>
                      <div className="px-2 py-1.5 text-xs text-gray-600">{row.hsn}</div>
                      <div className="px-2 py-1.5 text-xs text-right">{row.out_qty}</div>
                      <div className="px-2 py-1.5 text-xs">{row.unit}</div>
                      <div className="px-2 py-1.5 text-xs text-right">{parseFloat(row.rate) > 0 ? parseFloat(row.rate).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "—"}</div>
                      <div className="px-2 py-1.5 text-xs text-right font-semibold text-gray-700">
                        {parseFloat(row.total_value) > 0 ? parseFloat(row.total_value).toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "—"}
                      </div>
                    </div>
                  ))}
                </>
              )}
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
                      <input type="radio" name="same_as_co" checked={sameAsCompany === opt.val}
                        onChange={() => setSameAsCompany(opt.val)}
                        className="accent-[#d74700]" data-testid={`radio-same-${opt.val}`} />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-5">
                <div className="w-64 space-y-4">
                  {[
                    { label: "Contact Person", val: contactPerson, set: setContactPerson, testid: "input-contact" },
                    { label: "Mobile No",       val: mobileNo,      set: setMobileNo,      testid: "input-mobile" },
                    { label: "Email Id",         val: emailId,       set: setEmailId,       testid: "input-email" },
                  ].map(f => (
                    <div key={f.testid} className="relative">
                      <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10">{f.label}</label>
                      <input value={f.val} onChange={e => f.set(e.target.value)} disabled={sameAsCompany}
                        className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5] disabled:bg-gray-50 disabled:text-gray-400"
                        data-testid={f.testid} />
                    </div>
                  ))}
                </div>
                <div className="flex-1 relative">
                  <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10">Delivery Address</label>
                  <textarea value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                    disabled={sameAsCompany} rows={5}
                    className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5] resize-none disabled:bg-gray-50 disabled:text-gray-400"
                    data-testid="input-address" />
                </div>
              </div>
            </div>
          )}

          {/* Totals */}
          {tab === "item" && (
            <div className="flex items-center justify-between px-2 py-1 text-sm">
              <span className="text-gray-600">
                Total Quantity : <span className="font-bold text-gray-800">
                  {totalQty > 0 ? totalQty.toLocaleString("en-IN", { maximumFractionDigits: 3 }) : "—"}
                </span>
              </span>
              <span className="font-bold text-gray-800">
                Grand Total : <span style={{ color: SC.primary }}>
                  ₹ {grandTotal > 0 ? grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
                </span>
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

        {/* Actions */}
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
function GpList({ onNew, onEdit }: { onNew: () => void; onEdit: (d: any) => void }) {
  const { data: list = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/gate-pass"] });
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/gate-pass/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/gate-pass"] });
      qc.invalidateQueries({ queryKey: ["/api/gate-pass/linked-source-ids"] });
    },
  });

  const filtered = (list as any[]).filter((r: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (r.voucher_no || "").toLowerCase().includes(s) ||
      (r.party_name_db || r.party_name_manual || "").toLowerCase().includes(s) ||
      (r.entry_type || "").toLowerCase().includes(s);
  });

  const typeLabel = (t: string) => ENTRY_TYPES.find(e => e.value === t)?.label || t;

  return (
    <div className="p-4 md:p-6" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-base">Gate Pass</h2>
          <button onClick={onNew}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white"
            style={{ background: SC.orange }} data-testid="btn-new">
            <Plus size={14} /> New
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by gate pass no, party, or type..."
            className="w-full max-w-sm border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-[#027fa5]"
            data-testid="input-search" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["Gate Pass No","Entry Type","Outward Date","Party Name","Due Date","Grand Total","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No gate passes found</td></tr>}
              {filtered.map((r: any) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-[#f0f9ff] transition-colors">
                  <td className="px-4 py-3 font-semibold" style={{ color: SC.primary }}>{r.voucher_no}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-semibold"
                      style={{ background: r.entry_type === "non_returnable_outward" ? "#fef3c7" : "#d2f1fa",
                               color: r.entry_type === "non_returnable_outward" ? "#92400e" : SC.primary }}>
                      {typeLabel(r.entry_type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{fmtDate(r.outward_date)}</td>
                  <td className="px-4 py-3 text-gray-700">{r.party_name_db || r.party_name_manual || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtDate(r.due_date)}</td>
                  <td className="px-4 py-3 text-gray-700">—</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
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
export default function GatePass() {
  const [view, setView] = useState<"list" | "form">("list");
  const [editData, setEditData] = useState<any>(null);

  async function handleEdit(row: any) {
    const res = await fetch(`/api/gate-pass/${row.id}`, { credentials: "include" });
    const data = await res.json();
    setEditData(data);
    setView("form");
  }

  function handleNew() { setEditData(null); setView("form"); }
  function handleBack() { setEditData(null); setView("list"); }

  if (view === "form") return <GpForm editData={editData} onBack={handleBack} />;
  return <GpList onNew={handleNew} onEdit={handleEdit} />;
}
