import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Info, PencilLine, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

function today() { return new Date().toISOString().split("T")[0]; }

function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

type OutwardItem = {
  _key: string;
  inward_id: string;
  item_id: string;
  item_code: string;
  item_name: string;
  hsn: string;
  qty_inward: string;
  qty_outward: string;
  unit: string;
  weight: string;
  unit_value: string;
  total_value: string;
};

function makeOutwardRow(inward_id: string, inwardItem: any): OutwardItem {
  return {
    _key: crypto.randomUUID(),
    inward_id,
    item_id: inwardItem.item_id || "",
    item_code: inwardItem.item_code || "",
    item_name: inwardItem.item_name || "",
    hsn: inwardItem.hsn || "",
    qty_inward: String(inwardItem.qty || 0),
    qty_outward: String(inwardItem.qty || 0),
    unit: inwardItem.unit || "",
    weight: "",
    unit_value: String(inwardItem.unit_value || 0),
    total_value: String(
      (parseFloat(inwardItem.qty || 0) * parseFloat(inwardItem.unit_value || 0)).toFixed(2)
    ),
  };
}

// ── Outward Form ─────────────────────────────────────────────────────────────
function ROutwardForm({ editData, onBack }: { editData?: any; onBack: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!editData?.id;

  const { data: allInwards = [] }   = useQuery<any[]>({ queryKey: ["/api/returnable-inward"] });
  const { data: customers = [] }    = useQuery<any[]>({ queryKey: ["/api/customers"] });
  const { data: settingsList = [] } = useQuery<any[]>({ queryKey: ["/api/settings"] });

  const settingsMap = (settingsList as any[]).reduce((m: any, s: any) => { m[s.key] = s.value; return m; }, {});

  // Already-outward-ed inward IDs
  const outwardIdsKey = isEdit
    ? `/api/returnable-outward/outward-inward-ids?exclude_outward_id=${editData.id}`
    : "/api/returnable-outward/outward-inward-ids";
  const { data: outwardedData } = useQuery<{ inward_ids: string[] }>({ queryKey: [outwardIdsKey] });
  const outwardedInwardIds = new Set(outwardedData?.inward_ids || []);

  // ── Header state ────────────────────────────────────────────────────────────
  const [voucherNo,   setVoucherNo]   = useState(editData?.voucher_no || "");
  const [outwardDate, setOutwardDate] = useState(editData?.outward_date?.split("T")[0] || today());
  const [remark,      setRemark]      = useState(editData?.remark || "");

  // Party
  const [partyId,     setPartyId]     = useState(editData?.party_id || "");
  const [partySearch, setPartySearch] = useState(editData?.party_name_db || editData?.party_name_manual || "");

  // Panel search (search company name or inward no)
  const [panelSearch, setPanelSearch] = useState("");

  // Vehicle No
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

  // Which inward records are checked in the panel
  const [checkedInwardIds, setCheckedInwardIds] = useState<Set<string>>(
    new Set(editData?.items?.map((it: any) => it.inward_id).filter(Boolean) || [])
  );
  const [loadingInwardId, setLoadingInwardId] = useState<string | null>(null);

  // Items grid
  const [items, setItems] = useState<OutwardItem[]>(
    editData?.items?.length
      ? editData.items.map((it: any) => ({
          _key: crypto.randomUUID(),
          inward_id: it.inward_id || "",
          item_id: it.item_id || "",
          item_code: it.item_code || "",
          item_name: it.item_name || "",
          hsn: it.hsn || "",
          qty_inward: String(it.qty_inward || 0),
          qty_outward: String(it.qty_outward || 0),
          unit: it.unit || "",
          weight: String(it.weight || ""),
          unit_value: String(it.unit_value || 0),
          total_value: String(it.total_value || 0),
        }))
      : []
  );

  const { toast } = useToast();

  // Auto-generate voucher number
  useEffect(() => {
    if (!isEdit && !voucherNo) {
      fetch("/api/voucher-series/next/returnable_outward", { credentials: "include" })
        .then(r => r.json())
        .then(d => { if (d.voucher_no) setVoucherNo(d.voucher_no); })
        .catch(() => {});
    }
  }, []);

  // Same as Company → fill delivery fields
  useEffect(() => {
    if (sameAsCompany) {
      setDeliveryAddress([settingsMap["company_address"], settingsMap["company_city"], settingsMap["company_state"]].filter(Boolean).join(", "));
      setContactPerson("");
      setMobileNo(settingsMap["company_phone"] || "");
      setEmailId(settingsMap["company_email"] || "");
    }
  }, [sameAsCompany]);

  // Available inward records for right panel
  // Filter by party (if selected) + panel search + not already outward-ed
  const panelInwards = (allInwards as any[]).filter((ri: any) => {
    const partyMatch = partyId
      ? ri.party_id === partyId
      : !panelSearch || (ri.party_name_db || ri.party_name_manual || "").toLowerCase().includes(panelSearch.toLowerCase()) || (ri.voucher_no || "").toLowerCase().includes(panelSearch.toLowerCase());
    if (!partyMatch) return false;
    return !outwardedInwardIds.has(ri.id);
  });

  // When panel search changes and no party selected, filter across all
  const displayPanelInwards = panelSearch && !partyId
    ? (allInwards as any[]).filter((ri: any) =>
        !outwardedInwardIds.has(ri.id) && (
          (ri.party_name_db || ri.party_name_manual || "").toLowerCase().includes(panelSearch.toLowerCase()) ||
          (ri.voucher_no || "").toLowerCase().includes(panelSearch.toLowerCase())
        )
      )
    : panelInwards;

  async function toggleInward(ri: any, checked: boolean) {
    if (checked) {
      // Load inward detail to get items
      setLoadingInwardId(ri.id);
      try {
        const res = await fetch(`/api/returnable-inward/${ri.id}`, { credentials: "include" });
        const data = await res.json();
        const newRows = (data.items || []).map((it: any) => makeOutwardRow(ri.id, it));
        setItems(prev => [...prev, ...newRows]);
        setCheckedInwardIds(prev => new Set([...prev, ri.id]));
        // Auto-set party from this inward
        if (!partyId && ri.party_id) {
          setPartyId(ri.party_id);
          setPartySearch(ri.party_name_db || ri.party_name_manual || "");
        }
      } finally { setLoadingInwardId(null); }
    } else {
      // Remove items for this inward
      setItems(prev => prev.filter(it => it.inward_id !== ri.id));
      setCheckedInwardIds(prev => { const s = new Set(prev); s.delete(ri.id); return s; });
    }
  }

  function updateRow(key: string, field: keyof OutwardItem, val: string) {
    setItems(prev => prev.map(r => {
      if (r._key !== key) return r;
      const updated = { ...r, [field]: val };
      if (field === "qty_outward" || field === "unit_value") {
        const q = parseFloat(field === "qty_outward" ? val : r.qty_outward) || 0;
        const v = parseFloat(field === "unit_value" ? val : r.unit_value) || 0;
        updated.total_value = (q * v).toFixed(2);
      }
      return updated;
    }));
  }

  const totalOutQty = items.reduce((s, r) => s + (parseFloat(r.qty_outward) || 0), 0);
  const grandTotal  = items.reduce((s, r) => s + (parseFloat(r.total_value) || 0), 0);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        party_id: partyId || null,
        party_name_manual: partyId ? "" : partySearch,
        outward_date: outwardDate,
        vehicle_no: vehicleNo,
        contact_person: contactPerson,
        mobile_no: mobileNo,
        email_id: emailId,
        delivery_address: deliveryAddress,
        same_as_company: sameAsCompany,
        remark,
        items: items.map(r => ({
          inward_id: r.inward_id || null,
          item_id: r.item_id || null,
          item_code: r.item_code, item_name: r.item_name, hsn: r.hsn,
          qty_inward: parseFloat(r.qty_inward) || 0,
          qty_outward: parseFloat(r.qty_outward) || 0,
          unit: r.unit,
          weight: parseFloat(r.weight) || 0,
          unit_value: parseFloat(r.unit_value) || 0,
          total_value: parseFloat(r.total_value) || 0,
        })),
      };
      const url    = isEdit ? `/api/returnable-outward/${editData.id}` : "/api/returnable-outward";
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
      qc.invalidateQueries({ queryKey: ["/api/returnable-outward"] });
      qc.invalidateQueries({ queryKey: ["/api/returnable-outward/outward-inward-ids"] });
      qc.invalidateQueries({ queryKey: ["/api/returnable-inward"] });
      onBack();
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

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

        {/* Card Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-base">Party Outward DC</h2>
          <Info size={16} className="text-gray-400 cursor-pointer" />
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Row 1 — Search & Inward Panel */}
          <div className="flex gap-4">
            {/* Left: search label + panel search */}
            <div className="flex-1">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  value={panelSearch}
                  onChange={e => setPanelSearch(e.target.value)}
                  placeholder="Search Company Name, inward no..."
                  className="w-full border border-gray-300 rounded pl-8 pr-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                  data-testid="input-panel-search"
                />
              </div>
            </div>
            <Info size={16} className="text-gray-400 mt-3 flex-shrink-0" />

            {/* Right: RDC Inward panel */}
            <div className="w-80 border border-gray-200 rounded-lg overflow-hidden flex-shrink-0">
              <div className="grid text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-200"
                style={{ gridTemplateColumns: "1fr 1fr 44px" }}>
                <div className="px-3 py-2">RDC INW Date</div>
                <div className="px-3 py-2">RDC INW No</div>
                <div className="px-3 py-2 text-center">Select</div>
              </div>
              <div className="max-h-24 overflow-y-auto">
                {displayPanelInwards.length === 0 && (
                  <div className="px-3 py-3 text-xs text-gray-400 text-center">
                    {partyId || panelSearch ? "No pending inwards" : "Search or select a party"}
                  </div>
                )}
                {displayPanelInwards.map((ri: any) => (
                  <div key={ri.id}
                    className="grid items-center border-b last:border-0 hover:bg-blue-50 transition-colors"
                    style={{ gridTemplateColumns: "1fr 1fr 44px" }}>
                    <div className="px-3 py-2 text-xs text-gray-700">{fmtDate(ri.inward_date)}</div>
                    <div className="px-3 py-2 text-xs font-semibold" style={{ color: SC.primary }}>{ri.voucher_no}</div>
                    <div className="px-3 py-2 flex justify-center">
                      {loadingInwardId === ri.id
                        ? <div className="w-3 h-3 border-2 rounded-full animate-spin" style={{ borderColor: SC.primary, borderTopColor: "transparent" }} />
                        : (
                          <input type="checkbox"
                            checked={checkedInwardIds.has(ri.id)}
                            onChange={e => toggleInward(ri, e.target.checked)}
                            className="accent-[#027fa5] cursor-pointer"
                            data-testid={`chk-inward-${ri.id}`}
                          />
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2 — Party Name */}
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Party Name</label>
            <select
              value={partyId}
              onChange={e => {
                setPartyId(e.target.value);
                const c = (customers as any[]).find((c: any) => c.id === e.target.value);
                setPartySearch(c?.name || "");
                setItems([]); setCheckedInwardIds(new Set());
              }}
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5] bg-white"
              data-testid="select-party">
              <option value="">— Select Party —</option>
              {(customers as any[]).map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Row 3 — RDC Outward No | RDC Outward Date | Vehicle No | Tabs */}
          <div className="flex gap-4 items-start">
            <div className="relative w-48">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">RDC Outward No</label>
              <input value={voucherNo} readOnly
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm font-semibold outline-none bg-gray-50"
                style={{ color: SC.primary }} data-testid="input-voucher-no" />
            </div>

            <div className="w-44">
              <DatePicker label="RDC Outward Date" value={outwardDate} onChange={setOutwardDate} />
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
            <div className="flex items-end gap-1 ml-auto">
              {tabBtn("item", "Item")}
              {tabBtn("delivery", "Delivery Details")}
            </div>
          </div>

          {/* ── Item Tab ─────────────────────────────────────────────────────── */}
          {tab === "item" && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Column Headers */}
              <div className="grid text-xs font-semibold text-gray-600 bg-gray-50 border-b border-gray-200"
                style={{ gridTemplateColumns: "40px 90px 1fr 80px 75px 75px 60px 70px 95px 105px" }}>
                {["S.No","Item Code","Item Description","HSN/SAC","In Qty","Out Qty","Unit","Weight","Unit Value ₹","Total Value ₹"].map(h => (
                  <div key={h} className="px-2 py-2 text-right first:text-center [&:nth-child(-n+4)]:text-left">{h}</div>
                ))}
              </div>

              {/* Empty state */}
              {items.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-gray-400">
                  Select inward record(s) from the panel above to load items
                </div>
              )}

              {/* Item Rows */}
              {items.map((row, idx) => (
                <div key={row._key}
                  className="grid items-center border-b last:border-0 hover:bg-gray-50"
                  style={{ gridTemplateColumns: "40px 90px 1fr 80px 75px 75px 60px 70px 95px 105px" }}>

                  <div className="px-2 py-1.5 text-xs text-gray-500 text-center">{String(idx + 1).padStart(2, "0")}</div>

                  <div className="px-1 py-1">
                    <input value={row.item_code} readOnly
                      className="w-full border border-gray-100 rounded px-1.5 py-1 text-xs bg-gray-50 outline-none"
                      data-testid={`input-code-${idx}`} />
                  </div>

                  <div className="px-1 py-1">
                    <input value={row.item_name} readOnly
                      className="w-full border border-gray-100 rounded px-1.5 py-1 text-xs bg-gray-50 outline-none"
                      data-testid={`input-name-${idx}`} />
                  </div>

                  <div className="px-1 py-1">
                    <input value={row.hsn} readOnly
                      className="w-full border border-gray-100 rounded px-1.5 py-1 text-xs bg-gray-50 outline-none"
                      data-testid={`input-hsn-${idx}`} />
                  </div>

                  {/* In Qty — read-only */}
                  <div className="px-1 py-1">
                    <input value={row.qty_inward} readOnly
                      className="w-full border border-gray-100 rounded px-1.5 py-1 text-xs text-right bg-gray-50 outline-none"
                      data-testid={`input-qty-in-${idx}`} />
                  </div>

                  {/* Out Qty — editable */}
                  <div className="px-1 py-1">
                    <input type="number" value={row.qty_outward}
                      onChange={e => updateRow(row._key, "qty_outward", e.target.value)}
                      className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs text-right outline-none focus:border-[#027fa5]"
                      data-testid={`input-qty-out-${idx}`} />
                  </div>

                  <div className="px-1 py-1">
                    <input value={row.unit} readOnly
                      className="w-full border border-gray-100 rounded px-1.5 py-1 text-xs bg-gray-50 outline-none"
                      data-testid={`input-unit-${idx}`} />
                  </div>

                  {/* Weight — editable */}
                  <div className="px-1 py-1">
                    <input type="number" value={row.weight}
                      onChange={e => updateRow(row._key, "weight", e.target.value)}
                      className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs text-right outline-none focus:border-[#027fa5]"
                      data-testid={`input-weight-${idx}`} />
                  </div>

                  {/* Unit Value — editable */}
                  <div className="px-1 py-1">
                    <input type="number" value={row.unit_value}
                      onChange={e => updateRow(row._key, "unit_value", e.target.value)}
                      className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs text-right outline-none focus:border-[#027fa5]"
                      data-testid={`input-unit-value-${idx}`} />
                  </div>

                  {/* Total Value — calculated */}
                  <div className="px-2 py-1.5 text-xs text-right font-semibold text-gray-700">
                    {parseFloat(row.total_value) > 0
                      ? parseFloat(row.total_value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : "—"}
                  </div>
                </div>
              ))}
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
                    { label: "Mobile No", val: mobileNo, set: setMobileNo, testid: "input-mobile" },
                    { label: "Email Id", val: emailId, set: setEmailId, testid: "input-email" },
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

          {/* Totals footer */}
          {tab === "item" && (
            <div className="flex items-center justify-between px-2 py-1 text-sm">
              <span className="text-gray-600">
                Total Quantity : <span className="font-bold text-gray-800">
                  {totalOutQty > 0 ? totalOutQty.toLocaleString("en-IN", { maximumFractionDigits: 3 }) : "—"}
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

        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onBack}
            className="px-8 py-2 border border-gray-300 rounded text-sm font-semibold text-gray-700 hover:bg-gray-50"
            data-testid="btn-cancel">Cancel</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || items.length === 0}
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
function ROutwardList({ onNew, onEdit }: { onNew: () => void; onEdit: (d: any) => void }) {
  const { data: list = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/returnable-outward"] });
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/returnable-outward/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/returnable-outward"] });
      qc.invalidateQueries({ queryKey: ["/api/returnable-outward/outward-inward-ids"] });
      qc.invalidateQueries({ queryKey: ["/api/returnable-inward"] });
    },
  });

  const filtered = (list as any[]).filter((r: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (r.voucher_no || "").toLowerCase().includes(s) ||
      (r.party_name_db || r.party_name_manual || "").toLowerCase().includes(s);
  });

  return (
    <div className="p-4 md:p-6" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-base">Returnable Party Outward DC</h2>
          <button onClick={onNew}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white"
            style={{ background: SC.orange }} data-testid="btn-new">
            <Plus size={14} /> New
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by outward no or party..."
            className="w-full max-w-sm border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-[#027fa5]"
            data-testid="input-search" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["Outward No","Outward Date","Party Name","Vehicle No","Grand Total","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No records found</td></tr>}
              {filtered.map((r: any) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-[#f0f9ff] transition-colors">
                  <td className="px-4 py-3 font-semibold" style={{ color: SC.primary }}>{r.voucher_no}</td>
                  <td className="px-4 py-3 text-gray-700">{fmtDate(r.outward_date)}</td>
                  <td className="px-4 py-3 text-gray-700">{r.party_name_db || r.party_name_manual || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{r.vehicle_no || "—"}</td>
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
export default function ReturnableOutward() {
  const [view, setView] = useState<"list" | "form">("list");
  const [editData, setEditData] = useState<any>(null);

  async function handleEdit(row: any) {
    const res = await fetch(`/api/returnable-outward/${row.id}`, { credentials: "include" });
    const data = await res.json();
    setEditData(data);
    setView("form");
  }

  function handleNew() { setEditData(null); setView("form"); }
  function handleBack() { setEditData(null); setView("list"); }

  if (view === "form") return <ROutwardForm editData={editData} onBack={handleBack} />;
  return <ROutwardList onNew={handleNew} onEdit={handleEdit} />;
}
