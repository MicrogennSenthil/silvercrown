import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Loader2, AlertCircle, CheckCircle2, Info, Trash2, Plus } from "lucide-react";
import DatePicker from "@/components/DatePicker";
import { apiRequest } from "@/lib/queryClient";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

function today() { return new Date().toISOString().split("T")[0]; }

function fmtDate(d: string) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtAmt(n: any) {
  const v = parseFloat(n) || 0;
  return v === 0 ? "—" : v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseVehicle(s: string) {
  const clean = (s || "").replace(/\s/g, "").toUpperCase();
  const m = clean.match(/^([A-Z]{2})(\d{2})([A-Z]{1,3})(\d{1,4})$/);
  if (m) return { p1: m[1], p2: m[2], p3: m[3], p4: m[4] };
  return { p1: clean.slice(0,2), p2: clean.slice(2,4), p3: clean.slice(4,6), p4: clean.slice(6) };
}

export default function JobWorkInvoice() {
  const qc = useQueryClient();

  const { data: inwardList = [] } = useQuery<any[]>({ queryKey: ["/api/job-work-inward"] });
  const { data: invoiceList = [] } = useQuery<any[]>({ queryKey: ["/api/job-work-invoice"] });
  const { data: customerList = [] } = useQuery<any[]>({ queryKey: ["/api/customers"] });

  // ── Search bar ────────────────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState("");
  const [showSearchDrop, setShowSearchDrop] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchResults = searchText.trim()
    ? invoiceList.filter((d: any) => {
        const q = searchText.toLowerCase();
        return d.voucher_no?.toLowerCase().includes(q) ||
          d.party_name_db?.toLowerCase().includes(q) ||
          d.invoice_date?.includes(q);
      }).slice(0, 8)
    : [];
  useEffect(() => {
    function h(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearchDrop(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Tab ───────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"invoice" | "charges">("invoice");

  // ── Form state ────────────────────────────────────────────────────────────────
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [voucherNo,    setVoucherNo]    = useState("");
  const [invoiceDate,  setInvoiceDate]  = useState(today());
  const [vehP1,        setVehP1]        = useState("");
  const [vehP2,        setVehP2]        = useState("");
  const [vehP3,        setVehP3]        = useState("");
  const [vehP4,        setVehP4]        = useState("");
  const [invoiceType,  setInvoiceType]  = useState<"despatch_notes" | "direct_invoice">("despatch_notes");
  const [isInterState, setIsInterState] = useState(false);
  const [remark,       setRemark]       = useState("");

  // Party
  const [partyId,       setPartyId]       = useState("");
  const [partySearch,   setPartySearch]   = useState("");
  const [partyDropOpen, setPartyDropOpen] = useState(false);
  const partyRef = useRef<HTMLDivElement>(null);

  // Inward panel
  const [checkedInwardIds, setCheckedInwardIds] = useState<Set<string>>(new Set());
  const [loadingInwardId,  setLoadingInwardId]  = useState<string | null>(null);

  // Items grid (Invoice tab)
  const [items,        setItems]        = useState<any[]>([]);
  const [gridSearch,   setGridSearch]   = useState("");

  // Charges tab
  const [charges,      setCharges]      = useState<any[]>([{ charge_name: "", amount: "" }]);
  const [termOfDel,    setTermOfDel]    = useState("");
  const [transport,    setTransport]    = useState("");
  const [freight,      setFreight]      = useState<"to_pay" | "paid">("to_pay");
  const [deliveryAddr, setDeliveryAddr] = useState("");
  const [sameAsCompany,setSameAsCompany]= useState(false);

  // Save state
  const [saveError, setSaveError] = useState("");
  const [saveOk,    setSaveOk]    = useState(false);

  // Party dropdown close on outside click
  useEffect(() => {
    function h(e: MouseEvent) {
      if (partyRef.current && !partyRef.current.contains(e.target as Node)) setPartyDropOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Auto-generate voucher number
  useEffect(() => {
    if (!editingId && !voucherNo) {
      fetch("/api/voucher-series/next/job_work_invoice", { credentials: "include", cache: "no-store" })
        .then(r => r.json()).then(d => setVoucherNo(d.voucher_no || "")).catch(() => {});
    }
  }, [editingId]);

  // Filtered parties
  const filteredParties = customerList.filter((c: any) =>
    !partySearch || c.name?.toLowerCase().includes(partySearch.toLowerCase())
  );

  // Inwards for selected party
  const partyInwards = inwardList.filter((r: any) => r.party_id === partyId);

  // Filtered items in grid
  const filteredItems = gridSearch.trim()
    ? items.filter(it => {
        const q = gridSearch.toLowerCase();
        return it.item_code?.toLowerCase().includes(q) ||
          it.item_name?.toLowerCase().includes(q) ||
          it.despatch_voucher_no?.toLowerCase().includes(q);
      })
    : items;

  // Recompute tax amounts when inter-state toggle changes
  useEffect(() => {
    setItems(prev => prev.map(it => {
      const taxable = parseFloat(it.amount || 0);
      return {
        ...it,
        cgst_amt: isInterState ? 0 : taxable * parseFloat(it.cgst_rate || 0) / 100,
        sgst_amt: isInterState ? 0 : taxable * parseFloat(it.sgst_rate || 0) / 100,
        igst_amt: isInterState ? taxable * parseFloat(it.igst_rate || 0) / 100 : 0,
      };
    }));
  }, [isInterState]);

  // Total quantity
  const totalQty     = items.reduce((s, it) => s + parseFloat(it.qty_despatched || 0), 0);
  const totalTaxable = items.reduce((s, it) => s + parseFloat(it.amount || 0), 0);
  const totalCgst    = items.reduce((s, it) => s + parseFloat(it.cgst_amt || 0), 0);
  const totalSgst    = items.reduce((s, it) => s + parseFloat(it.sgst_amt || 0), 0);
  const totalIgst    = items.reduce((s, it) => s + parseFloat(it.igst_amt || 0), 0);
  const grandTotal   = totalTaxable + (isInterState ? totalIgst : totalCgst + totalSgst);

  // ── Toggle inward ─────────────────────────────────────────────────────────────
  async function toggleInward(inward: any, checked: boolean) {
    const newSet = new Set(checkedInwardIds);
    if (checked) {
      newSet.add(inward.id);
      setCheckedInwardIds(newSet);
      setLoadingInwardId(inward.id);
      try {
        const endpoint = invoiceType === "despatch_notes"
          ? `/api/job-work-inward/${inward.id}/despatch-items-for-invoice`
          : `/api/job-work-inward/${inward.id}/direct-items-for-invoice`;
        const res = await fetch(endpoint, { credentials: "include" });
        const rows: any[] = await res.json();
        const newItems = rows.map(r => {
          const qty    = parseFloat(r.qty_despatched || 0);
          const rate   = parseFloat(r.rate || 0);
          const taxable = qty * rate;
          const cgstR  = parseFloat(r.cgst_rate || 0);
          const sgstR  = parseFloat(r.sgst_rate || 0);
          const igstR  = parseFloat(r.igst_rate || 0);
          return {
            despatch_id:        r.despatch_id || null,
            inward_id:          inward.id,
            inward_item_id:     r.inward_item_id || r.id || null,
            item_id:            r.item_id || null,
            item_code:          r.item_code || "",
            item_name:          r.item_name || "",
            unit:               r.unit || "",
            process:            r.process || "",
            hsn:                r.hsn || "",
            qty_despatched:     qty,
            rate:               rate,
            amount:             taxable,
            po_no:              r.party_po_no || "",
            party_dc:           r.party_dc_no || "",
            work_order_no:      r.work_order_no || "",
            despatch_voucher_no:r.despatch_voucher_no || "",
            inward_voucher_no:  r.inward_voucher_no || "",
            no_of_cover:        0,
            packages:           0,
            cgst_rate:          cgstR,
            sgst_rate:          sgstR,
            igst_rate:          igstR,
            cgst_amt:           taxable * cgstR / 100,
            sgst_amt:           taxable * sgstR / 100,
            igst_amt:           taxable * igstR / 100,
          };
        });
        setItems(prev => [...prev.filter(it => it.inward_id !== inward.id), ...newItems]);
        const veh = (inward.vehicle_no || "").trim();
        if (veh) {
          const parts = parseVehicle(veh);
          setVehP1(p => p || parts.p1);
          setVehP2(p => p || parts.p2);
          setVehP3(p => p || parts.p3);
          setVehP4(p => p || parts.p4);
        }
      } catch {}
      setLoadingInwardId(null);
    } else {
      newSet.delete(inward.id);
      setCheckedInwardIds(newSet);
      setItems(prev => prev.filter(it => it.inward_id !== inward.id));
    }
  }

  // ── Load existing invoice ─────────────────────────────────────────────────────
  async function loadInvoice(id: string) {
    try {
      const res = await fetch(`/api/job-work-invoice/${id}`, { credentials: "include" });
      const data = await res.json();
      setEditingId(data.id);
      setVoucherNo(data.voucher_no || "");
      setInvoiceDate(data.invoice_date?.split("T")[0] || today());
      const vParts = parseVehicle(data.vehicle_no || "");
      setVehP1(vParts.p1); setVehP2(vParts.p2); setVehP3(vParts.p3); setVehP4(vParts.p4);
      setInvoiceType(data.invoice_type || "despatch_notes");
      setIsInterState(data.is_inter_state || false);
      setRemark(data.remark || "");
      setTermOfDel(data.term_of_delivery || "");
      setTransport(data.transport || "");
      setFreight(data.freight || "to_pay");
      setDeliveryAddr(data.delivery_address || "");
      setSameAsCompany(data.same_as_company || false);
      const pId = data.party_id || "";
      setPartyId(pId);
      const cust = customerList.find((c: any) => c.id === pId);
      setPartySearch(cust?.name || data.party_name_db || data.party_name_manual || "");
      const inwardIds = new Set<string>((data.items || []).map((it: any) => it.inward_id).filter(Boolean));
      setCheckedInwardIds(inwardIds);
      setItems((data.items || []).map((it: any) => ({ ...it })));
      const loadedCharges = (data.charges || []);
      setCharges(loadedCharges.length > 0 ? loadedCharges : [{ charge_name: "", amount: "" }]);
      setShowSearchDrop(false);
      setSaveError("");
      setSaveOk(false);
    } catch (e: any) {
      setSaveError("Failed to load invoice");
    }
  }

  // ── Reset form ────────────────────────────────────────────────────────────────
  function resetForm() {
    setEditingId(null);
    setVoucherNo("");
    setInvoiceDate(today());
    setVehP1(""); setVehP2(""); setVehP3(""); setVehP4("");
    setInvoiceType("despatch_notes");
    setIsInterState(false);
    setRemark("");
    setPartyId("");
    setPartySearch("");
    setCheckedInwardIds(new Set());
    setItems([]);
    setCharges([{ charge_name: "", amount: "" }]);
    setTermOfDel("");
    setTransport("");
    setFreight("to_pay");
    setDeliveryAddr("");
    setSameAsCompany(false);
    setSaveError("");
    setSaveOk(false);
    setActiveTab("invoice");
    fetch("/api/voucher-series/next/job_work_invoice", { credentials: "include", cache: "no-store" })
      .then(r => r.json()).then(d => setVoucherNo(d.voucher_no || "")).catch(() => {});
  }

  // ── Remove all items ──────────────────────────────────────────────────────────
  function removeAllItems() {
    setItems([]);
    setCheckedInwardIds(new Set());
  }

  // ── Update item editable fields ───────────────────────────────────────────────
  function updateItem(idx: number, field: string, value: any) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  }

  // ── Charges helpers ───────────────────────────────────────────────────────────
  function addCharge() {
    setCharges(prev => [...prev, { charge_name: "", amount: "" }]);
  }
  function updateCharge(idx: number, field: string, value: string) {
    setCharges(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  }
  function removeCharge(idx: number) {
    setCharges(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/job-work-invoice", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/job-work-invoice"] }); },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: any) => apiRequest("PATCH", `/api/job-work-invoice/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/job-work-invoice"] }); },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/job-work-invoice/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/job-work-invoice"] }); resetForm(); },
  });

  // ── Save ──────────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaveError("");
    setSaveOk(false);
    const validCharges = charges.filter(c => c.charge_name?.trim());
    const vehicleNo = [vehP1, vehP2, vehP3, vehP4].join("").toUpperCase();
    const body = {
      voucher_no:       voucherNo,
      invoice_date:     invoiceDate,
      party_id:         partyId || null,
      party_name_manual:partySearch,
      vehicle_no:       vehicleNo,
      invoice_type:     invoiceType,
      is_inter_state:   isInterState,
      term_of_delivery: termOfDel,
      transport,
      freight,
      delivery_address: deliveryAddr,
      same_as_company:  sameAsCompany,
      remark,
      items,
      charges:          validCharges,
    };
    const isNew = !editingId;
    try {
      if (editingId) {
        await updateMut.mutateAsync({ id: editingId, body },
          { onSuccess: () => { setSaveOk(true); } });
      } else {
        await createMut.mutateAsync(body,
          { onSuccess: () => { setSaveOk(true); if (isNew) resetForm(); } });
      }
    } catch (e: any) {
      setSaveError(e?.message || "Save failed");
    }
  }

  const isSaving = createMut.isPending || updateMut.isPending;

  // ── Shared header + panel layout ──────────────────────────────────────────────
  return (
    <div style={{ background: SC.bg, minHeight: "100vh", padding: "24px" }}>
      {/* Page title + search */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold" style={{ color: SC.primary }}>Job Work Invoice</h1>
        <div className="relative" ref={searchRef}>
          <div className="flex items-center border rounded-lg px-3 py-2 bg-white shadow-sm gap-2" style={{ width: 340 }}>
            <Search size={15} className="text-gray-400" />
            <input
              data-testid="input-invoice-search"
              className="outline-none text-sm flex-1"
              placeholder="Search Invoice No, Date and Party Name ..."
              value={searchText}
              onChange={e => { setSearchText(e.target.value); setShowSearchDrop(true); }}
              onFocus={() => setShowSearchDrop(true)}
            />
            <Info size={15} className="text-gray-400 cursor-pointer" />
          </div>
          {showSearchDrop && searchResults.length > 0 && (
            <div className="absolute right-0 top-10 bg-white border rounded-lg shadow-xl z-50 w-full overflow-hidden">
              {searchResults.map((inv: any) => (
                <div key={inv.id}
                  className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-0 text-sm"
                  onClick={() => loadInvoice(inv.id)}>
                  <span className="font-semibold" style={{ color: SC.primary }}>{inv.voucher_no}</span>
                  <span className="mx-2 text-gray-400">|</span>
                  <span>{inv.party_name_db}</span>
                  <span className="mx-2 text-gray-400">|</span>
                  <span className="text-gray-500">{fmtDate(inv.invoice_date)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Alerts */}
      {saveError && (
        <div className="flex items-center gap-2 mb-3 px-4 py-2 rounded-lg text-sm text-white" style={{ background: SC.orange }}>
          <AlertCircle size={16} /> {saveError}
        </div>
      )}
      {saveOk && (
        <div className="flex items-center gap-2 mb-3 px-4 py-2 rounded-lg text-sm text-white" style={{ background: "#16a34a" }}>
          <CheckCircle2 size={16} /> Invoice saved successfully.
        </div>
      )}

      <div className="bg-white rounded-xl shadow p-5">
        {/* Tabs */}
        <div className="flex gap-1 mb-5 border-b">
          {(["invoice", "charges"] as const).map(tab => (
            <button key={tab}
              data-testid={`tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className="px-5 py-2 text-sm font-medium rounded-t-lg transition-colors"
              style={activeTab === tab
                ? { background: SC.primary, color: "#fff", borderBottom: "none" }
                : { color: "#555" }}>
              {tab === "invoice" ? "Job Work Invoice" : "Charges"}
            </button>
          ))}
        </div>

        {/* ── Shared top row: party + inward panel ── */}
        <div className="flex gap-4 mb-4">
          {/* Left: Party dropdown */}
          <div className="flex-1 relative" ref={partyRef}>
            <label className="text-xs text-gray-500 mb-1 block">Party Name</label>
            <div className="border rounded-lg px-3 py-2 flex items-center justify-between cursor-pointer bg-white"
              onClick={() => setPartyDropOpen(p => !p)}>
              <input
                data-testid="input-party-name"
                className="outline-none flex-1 text-sm"
                placeholder="Select Party..."
                value={partySearch}
                onChange={e => { setPartySearch(e.target.value); setPartyDropOpen(true); setPartyId(""); }}
              />
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {partyDropOpen && (
              <div className="absolute left-0 top-full mt-1 bg-white border rounded-lg shadow-xl z-50 w-full max-h-48 overflow-y-auto">
                {filteredParties.map((c: any) => (
                  <div key={c.id} className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                    onClick={() => { setPartyId(c.id); setPartySearch(c.name); setPartyDropOpen(false); setItems([]); setCheckedInwardIds(new Set()); }}>
                    {c.name}
                  </div>
                ))}
                {filteredParties.length === 0 && <div className="px-3 py-2 text-gray-400 text-sm">No parties found</div>}
              </div>
            )}
          </div>

          {/* Right: Inward selection panel */}
          <div className="border rounded-lg overflow-hidden" style={{ minWidth: 420 }}>
            {/* Invoice type radio */}
            <div className="flex items-center gap-4 px-3 py-2 border-b bg-gray-50">
              {(["despatch_notes", "direct_invoice"] as const).map(t => (
                <label key={t} className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input type="radio" name="invoiceType" value={t}
                    checked={invoiceType === t}
                    onChange={() => { setInvoiceType(t); setItems([]); setCheckedInwardIds(new Set()); }}
                  />
                  <span style={invoiceType === t ? { color: SC.orange, fontWeight: 600 } : {}}>
                    {t === "despatch_notes" ? "Despatch Notes" : "Direct Invoice"}
                  </span>
                </label>
              ))}
            </div>
            {/* Inward table header */}
            <div className="grid text-xs font-semibold text-gray-500 bg-gray-50 border-b"
              style={{ gridTemplateColumns: "1fr 110px 110px 52px" }}>
              <div className="px-2 py-1.5">Inw no</div>
              <div className="px-2 py-1.5">Party Dc Date</div>
              <div className="px-2 py-1.5">Party Dc no</div>
              <div className="px-2 py-1.5 text-center">Select</div>
            </div>
            {/* Inward rows */}
            <div className="max-h-24 overflow-y-auto">
              {partyInwards.length === 0 && (
                <div className="px-3 py-3 text-xs text-gray-400 text-center">
                  {partyId ? "No inwards found" : "Select a party"}
                </div>
              )}
              {partyInwards.map((inw: any) => (
                <div key={inw.id}
                  className="grid items-center border-b last:border-0 hover:bg-blue-50 transition-colors"
                  style={{ gridTemplateColumns: "1fr 110px 110px 52px" }}>
                  <div className="px-2 py-1.5 text-xs font-semibold" style={{ color: SC.primary }}>{inw.voucher_no}</div>
                  <div className="px-2 py-1.5 text-xs text-gray-600">{fmtDate(inw.party_dc_date)}</div>
                  <div className="px-2 py-1.5 text-xs text-gray-600">{inw.party_dc_no}</div>
                  <div className="px-2 py-1.5 flex justify-center">
                    {loadingInwardId === inw.id
                      ? <Loader2 size={14} className="animate-spin" style={{ color: SC.primary }} />
                      : <input type="checkbox"
                          data-testid={`chk-inward-${inw.id}`}
                          className="accent-orange-600 cursor-pointer w-4 h-4"
                          checked={checkedInwardIds.has(inw.id)}
                          onChange={e => toggleInward(inw, e.target.checked)}
                        />
                    }
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Shared form fields: Invoice no, Date, Vehicle No ── */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Invoice no</label>
            <input data-testid="input-voucher-no"
              className="border rounded px-3 py-1.5 text-sm font-semibold bg-gray-50 w-28"
              style={{ color: SC.primary }}
              value={voucherNo} onChange={e => setVoucherNo(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Invoice Date</label>
            <DatePicker value={invoiceDate} onChange={setInvoiceDate} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Vehicle No</label>
            <div className="flex items-center gap-1">
              {[
                { val: vehP1, set: setVehP1, w: "w-12", ph: "TN",   max: 2 },
                { val: vehP2, set: setVehP2, w: "w-10", ph: "00",   max: 2 },
                { val: vehP3, set: setVehP3, w: "w-12", ph: "AB",   max: 3 },
                { val: vehP4, set: setVehP4, w: "w-16", ph: "1234", max: 4 },
              ].map((seg, i) => (
                <input key={i}
                  data-testid={`input-vehicle-p${i+1}`}
                  className={`border rounded px-2 py-1.5 text-sm text-center ${seg.w} font-semibold`}
                  placeholder={seg.ph}
                  maxLength={seg.max}
                  value={seg.val}
                  onChange={e => seg.set(e.target.value.toUpperCase())} />
              ))}
            </div>
          </div>
          {activeTab === "invoice" && (
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Search Items</label>
              <div className="flex items-center border rounded px-3 py-1.5 gap-2 bg-white">
                <Search size={13} className="text-gray-400" />
                <input className="outline-none text-sm flex-1"
                  placeholder="Filter by Item code, name or despatch no..."
                  value={gridSearch} onChange={e => setGridSearch(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* ── Within / Inter-State toggle ── */}
        {activeTab === "invoice" && (
          <div className="flex items-center gap-4 mb-3">
            {[false, true].map(val => (
              <label key={String(val)} className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                <input type="radio" name="stateType" className="accent-orange-600"
                  checked={isInterState === val}
                  onChange={() => setIsInterState(val)} />
                <span style={isInterState === val ? { color: SC.orange, fontWeight: 700 } : { color: "#555" }}>
                  {val ? "Inter-State" : "Within State"}
                </span>
              </label>
            ))}
          </div>
        )}

        {/* ── TAB: Job Work Invoice ── */}
        {activeTab === "invoice" && (
          <>
            {/* Items grid */}
            <div className="border rounded-lg overflow-hidden mb-3">
              <div className="overflow-x-auto">
                <table className="w-full text-xs" style={{ minWidth: 1440 }}>
                  <thead>
                    <tr style={{ background: SC.primary, color: "#fff" }}>
                      <th className="px-2 py-2 text-left w-8">S.No</th>
                      <th className="px-2 py-2 text-left">PO No</th>
                      <th className="px-2 py-2 text-left">Item Code</th>
                      <th className="px-2 py-2 text-left">Item Name</th>
                      <th className="px-2 py-2 text-left">Desp No</th>
                      <th className="px-2 py-2 text-left">Party DC</th>
                      <th className="px-2 py-2 text-left">Work Ord no</th>
                      <th className="px-2 py-2 text-left">Process</th>
                      <th className="px-2 py-2 text-left">Inw DN</th>
                      <th className="px-2 py-2 text-center w-20">No.of Cover</th>
                      <th className="px-2 py-2 text-center w-20">Packages</th>
                      <th className="px-2 py-2 text-right w-20">Qty</th>
                      <th className="px-2 py-2 text-left w-16">Unit</th>
                      <th className="px-2 py-2 text-right w-24">Rate ₹</th>
                      <th className="px-2 py-2 text-right w-28">Taxable Amt ₹</th>
                      {isInterState
                        ? <th className="px-2 py-2 text-right w-24">IGST ₹</th>
                        : <>
                            <th className="px-2 py-2 text-right w-24">CGST ₹</th>
                            <th className="px-2 py-2 text-right w-24">SGST ₹</th>
                          </>
                      }
                      <th className="px-2 py-2 text-right w-28">Tot.Amt ₹</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={isInterState ? 17 : 18} className="text-center py-8 text-gray-400 text-sm">
                          Select an inward from the panel to load items
                        </td>
                      </tr>
                    )}
                    {filteredItems.map((it, idx) => {
                      const realIdx = items.indexOf(it);
                      const qty      = parseFloat(it.qty_despatched || 0);
                      const rate     = parseFloat(it.rate || 0);
                      const taxable  = qty * rate;
                      const cgstAmt  = parseFloat(it.cgst_amt || 0);
                      const sgstAmt  = parseFloat(it.sgst_amt || 0);
                      const igstAmt  = parseFloat(it.igst_amt || 0);
                      const rowTotal = isInterState ? taxable + igstAmt : taxable + cgstAmt + sgstAmt;
                      return (
                        <tr key={idx} className="border-b hover:bg-blue-50 transition-colors">
                          <td className="px-2 py-1 text-gray-500">{idx + 1}</td>
                          <td className="px-2 py-1 text-gray-600">{it.po_no || "—"}</td>
                          <td className="px-2 py-1 font-mono">{it.item_code}</td>
                          <td className="px-2 py-1 font-medium text-gray-800">{it.item_name}</td>
                          <td className="px-2 py-1" style={{ color: SC.primary }}>{it.despatch_voucher_no || "—"}</td>
                          <td className="px-2 py-1 text-gray-600">{it.party_dc || "—"}</td>
                          <td className="px-2 py-1 text-gray-700">{it.work_order_no || "—"}</td>
                          <td className="px-2 py-1 text-gray-700">{it.process || "—"}</td>
                          <td className="px-2 py-1" style={{ color: SC.primary }}>{it.inward_voucher_no || "—"}</td>
                          <td className="px-2 py-1">
                            <input type="number" min={0}
                              data-testid={`input-cover-${idx}`}
                              className="border rounded px-1 py-0.5 text-xs text-center w-16"
                              value={it.no_of_cover || ""}
                              onChange={e => updateItem(realIdx, "no_of_cover", parseInt(e.target.value || "0"))} />
                          </td>
                          <td className="px-2 py-1">
                            <input type="number" min={0}
                              data-testid={`input-packages-${idx}`}
                              className="border rounded px-1 py-0.5 text-xs text-center w-16"
                              value={it.packages || ""}
                              onChange={e => updateItem(realIdx, "packages", parseInt(e.target.value || "0"))} />
                          </td>
                          <td className="px-2 py-1 text-right font-semibold">{qty.toLocaleString("en-IN")}</td>
                          <td className="px-2 py-1 text-gray-600">{it.unit}</td>
                          <td className="px-2 py-1 text-right">
                            <input type="number" min={0} step="0.01"
                              data-testid={`input-rate-${idx}`}
                              className="border rounded px-1 py-0.5 text-xs text-right w-20"
                              value={rate || ""}
                              onChange={e => {
                                const r2 = parseFloat(e.target.value || "0");
                                const t2 = qty * r2;
                                const cgR = parseFloat(it.cgst_rate || 0);
                                const sgR = parseFloat(it.sgst_rate || 0);
                                const igR = parseFloat(it.igst_rate || 0);
                                setItems(prev => prev.map((row, i) => i === realIdx ? {
                                  ...row, rate: r2, amount: t2,
                                  cgst_amt: isInterState ? 0 : t2 * cgR / 100,
                                  sgst_amt: isInterState ? 0 : t2 * sgR / 100,
                                  igst_amt: isInterState ? t2 * igR / 100 : 0,
                                } : row));
                              }} />
                          </td>
                          <td className="px-2 py-1 text-right text-gray-800">{fmtAmt(taxable)}</td>
                          {isInterState
                            ? <td className="px-2 py-1 text-right" style={{ color: SC.primary }}>{fmtAmt(igstAmt)}</td>
                            : <>
                                <td className="px-2 py-1 text-right" style={{ color: SC.primary }}>{fmtAmt(cgstAmt)}</td>
                                <td className="px-2 py-1 text-right" style={{ color: SC.primary }}>{fmtAmt(sgstAmt)}</td>
                              </>
                          }
                          <td className="px-2 py-1 text-right font-bold" style={{ color: SC.orange }}>{fmtAmt(rowTotal)}</td>
                          <td className="px-2 py-1 text-center">
                            <button data-testid={`btn-del-row-${idx}`}
                              onClick={() => setItems(prev => prev.filter((_, i) => i !== realIdx))}
                              className="text-red-400 hover:text-red-600 p-0.5">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer: Remove all + Totals */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <button
                data-testid="btn-remove-all"
                onClick={removeAllItems}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors">
                <Trash2 size={13} /> Remove all
              </button>
              <div className="flex items-center gap-5 text-sm flex-wrap">
                <span className="text-gray-600">Total Qty: <strong style={{ color: SC.primary }}>{totalQty.toLocaleString("en-IN", { maximumFractionDigits: 3 })}</strong></span>
                <span className="text-gray-600">Taxable: <strong style={{ color: SC.primary }}>₹{totalTaxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></span>
                {isInterState
                  ? <span className="text-gray-600">IGST: <strong style={{ color: SC.primary }}>₹{totalIgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></span>
                  : <>
                      <span className="text-gray-600">CGST: <strong style={{ color: SC.primary }}>₹{totalCgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></span>
                      <span className="text-gray-600">SGST: <strong style={{ color: SC.primary }}>₹{totalSgst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</strong></span>
                    </>
                }
                <span className="font-bold text-base">Total (with Tax): <span style={{ color: SC.orange }}>₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></span>
              </div>
            </div>
          </>
        )}

        {/* ── TAB: Charges ── */}
        {activeTab === "charges" && (
          <div className="flex gap-5 mb-4">
            {/* Left: Other charges grid */}
            <div className="flex-none" style={{ width: 320 }}>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: SC.primary, color: "#fff" }}>
                      <th className="px-2 py-2 text-left w-10">S.No</th>
                      <th className="px-2 py-2 text-left">Other Charges</th>
                      <th className="px-2 py-2 text-right w-28">Amount ₹</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map((ch, idx) => (
                      <tr key={idx} className="border-b hover:bg-blue-50">
                        <td className="px-2 py-1.5 text-gray-500">{idx + 1}</td>
                        <td className="px-1 py-1">
                          <input
                            data-testid={`input-charge-name-${idx}`}
                            className="border rounded px-2 py-1 text-sm w-full"
                            placeholder="Charge name"
                            value={ch.charge_name}
                            onChange={e => updateCharge(idx, "charge_name", e.target.value)} />
                        </td>
                        <td className="px-1 py-1">
                          <input type="number"
                            data-testid={`input-charge-amount-${idx}`}
                            className="border rounded px-2 py-1 text-sm w-full text-right"
                            placeholder="0.00"
                            value={ch.amount}
                            onChange={e => updateCharge(idx, "amount", e.target.value)} />
                        </td>
                        <td className="px-1 py-1">
                          <button onClick={() => removeCharge(idx)}
                            className="text-red-400 hover:text-red-600 p-0.5">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  data-testid="btn-add-charge"
                  onClick={addCharge}
                  className="flex items-center gap-1 w-full px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50 border-t">
                  <Plus size={13} /> Add row
                </button>
              </div>
            </div>

            {/* Right: Delivery section */}
            <div className="flex-1 border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-3" style={{ color: SC.primary }}>Delivery</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Term of Delivery</label>
                  <input data-testid="input-term-of-delivery"
                    className="border rounded px-3 py-1.5 text-sm w-full"
                    value={termOfDel} onChange={e => setTermOfDel(e.target.value)} />
                </div>
                <div className="row-span-2">
                  <label className="text-xs text-gray-500 mb-1 block">Delivery Address</label>
                  <textarea data-testid="input-delivery-address"
                    className="border rounded px-3 py-1.5 text-sm w-full resize-none"
                    rows={4}
                    value={deliveryAddr} onChange={e => setDeliveryAddr(e.target.value)} />
                  <label className="flex items-center gap-2 mt-1 cursor-pointer text-sm">
                    <input type="checkbox" data-testid="chk-same-as-company"
                      className="accent-blue-600"
                      checked={sameAsCompany} onChange={e => setSameAsCompany(e.target.checked)} />
                    Same as Company
                  </label>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Transport</label>
                  <input data-testid="input-transport"
                    className="border rounded px-3 py-1.5 text-sm w-full"
                    value={transport} onChange={e => setTransport(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Freight:</label>
                  <div className="flex gap-4">
                    {(["to_pay", "paid"] as const).map(f => (
                      <label key={f} className="flex items-center gap-1.5 cursor-pointer text-sm">
                        <input type="radio" name="freight" value={f}
                          checked={freight === f}
                          onChange={() => setFreight(f)}
                        />
                        <span style={freight === f ? { color: SC.orange, fontWeight: 600 } : {}}>
                          {f === "to_pay" ? "To Pay" : "Paid"}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Shared remark ── */}
        <div className="mb-4">
          <label className="text-xs text-gray-500 mb-1 block">Remark</label>
          <textarea data-testid="input-remark"
            className="border rounded px-3 py-2 text-sm w-full resize-none"
            rows={3}
            value={remark} onChange={e => setRemark(e.target.value)} />
        </div>

        {/* ── Action buttons ── */}
        <div className="flex justify-end gap-3">
          {editingId && (
            <button
              data-testid="btn-delete"
              onClick={() => deleteMut.mutate(editingId)}
              className="px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
              Delete
            </button>
          )}
          <button data-testid="btn-cancel" onClick={resetForm}
            className="px-5 py-2 text-sm border rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button data-testid="btn-save" onClick={handleSave} disabled={isSaving}
            className="px-6 py-2 text-sm text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
            style={{ background: isSaving ? "#aaa" : SC.orange }}>
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
