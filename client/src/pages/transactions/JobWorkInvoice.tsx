import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Loader2, AlertCircle, CheckCircle2, Trash2, Plus, PencilLine } from "lucide-react";
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

function InvoiceForm({ onBackToList, editId }: { onBackToList: () => void; editId?: string | null }) {
  const qc = useQueryClient();

  const { data: inwardList = [] }   = useQuery<any[]>({ queryKey: ["/api/job-work-inward"] });
  const { data: despatchList = [] } = useQuery<any[]>({ queryKey: ["/api/job-work-despatch"] });
  const { data: customerList = [] } = useQuery<any[]>({ queryKey: ["/api/customers"] });
  const { data: subledgerList = [] } = useQuery<any[]>({ queryKey: ["/api/sub-ledgers"] });
  const { data: settingsList = [] } = useQuery<any[]>({ queryKey: ["/api/settings"] });

  // IDs already covered by existing invoices (excluded when editing own invoice)
  const invoicedIdsKey = editId
    ? `/api/job-work-invoice/invoiced-ids?exclude_invoice_id=${editId}`
    : "/api/job-work-invoice/invoiced-ids";
  const { data: invoicedIds } = useQuery<{ despatch_ids: string[]; direct_inward_ids: string[] }>({
    queryKey: [invoicedIdsKey],
  });
  const invoicedDespatchIds  = new Set(invoicedIds?.despatch_ids || []);
  const invoicedDirectInwIds = new Set(invoicedIds?.direct_inward_ids || []);
  const settingsMap = (settingsList as any[]).reduce((m: any, s: any) => { m[s.key] = s.value; return m; }, {});

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

  // Panel selection — despatch IDs (despatch_notes mode) or inward IDs (direct_invoice mode)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [loadingId,  setLoadingId]  = useState<string | null>(null);

  // Items grid (Invoice tab)
  const [items,        setItems]        = useState<any[]>([]);
  const [gridSearch,   setGridSearch]   = useState("");

  // Charges tab
  const [charges,      setCharges]      = useState<any[]>([{ subledger_id: "", charge_name: "", amount: "" }]);
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

  // Despatch Notes mode: despatches for party that are finalised (not Draft/Cancelled) and not yet invoiced
  const partyDespatches = (despatchList as any[]).filter((d: any) =>
    d.party_id === partyId &&
    !invoicedDespatchIds.has(d.id) &&
    d.status !== "Draft" && d.status !== "Cancelled" && d.status != null
  );
  // Direct Invoice mode: inwards for party with NO despatch and NOT yet directly invoiced
  const partyDirectInwards = (inwardList as any[]).filter((r: any) =>
    r.party_id === partyId &&
    (!r.despatch_status || r.despatch_status === "Pending") &&
    !invoicedDirectInwIds.has(r.id)
  );

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

  // ── Toggle despatch (Despatch Notes mode) or inward (Direct Invoice mode) ────
  async function toggleRecord(record: any, checked: boolean) {
    const newSet = new Set(checkedIds);
    const isDespatchMode = invoiceType === "despatch_notes";

    if (checked) {
      newSet.add(record.id);
      setCheckedIds(newSet);
      setLoadingId(record.id);
      try {
        const endpoint = isDespatchMode
          ? `/api/job-work-despatch/${record.id}/items-for-invoice`
          : `/api/job-work-inward/${record.id}/direct-items-for-invoice`;
        const res = await fetch(endpoint, { credentials: "include" });
        const rows: any[] = await res.json();
        const newItems = rows.map(r => {
          const qty     = parseFloat(r.qty_despatched || 0);
          const rate    = parseFloat(r.rate || 0);
          const taxable = qty * rate;
          const cgstR   = parseFloat(r.cgst_rate || 0);
          const sgstR   = parseFloat(r.sgst_rate || 0);
          const igstR   = parseFloat(r.igst_rate || 0);
          return {
            despatch_id:         isDespatchMode ? record.id : null,
            inward_id:           r.inward_id || null,
            inward_item_id:      r.inward_item_id || r.id || null,
            item_id:             r.item_id || null,
            item_code:           r.item_code || "",
            item_name:           r.item_name || "",
            unit:                r.unit || "",
            process:             r.process || "",
            hsn:                 r.hsn || "",
            qty_despatched:      qty,
            rate,
            amount:              taxable,
            po_no:               r.party_po_no || "",
            party_dc:            r.party_dc_no || "",
            work_order_no:       r.work_order_no || "",
            despatch_voucher_no: r.despatch_voucher_no || "",
            inward_voucher_no:   r.inward_voucher_no || "",
            no_of_cover:         0,
            packages:            0,
            cgst_rate:           cgstR,
            sgst_rate:           sgstR,
            igst_rate:           igstR,
            cgst_amt:            isInterState ? 0 : taxable * cgstR / 100,
            sgst_amt:            isInterState ? 0 : taxable * sgstR / 100,
            igst_amt:            isInterState ? taxable * igstR / 100 : 0,
          };
        });
        // Remove previous items for this record then add new ones
        setItems(prev => [
          ...prev.filter(it => isDespatchMode
            ? it.despatch_id !== record.id
            : it.inward_id !== record.id),
          ...newItems,
        ]);
        // Auto-fill vehicle from despatch record
        const veh = (record.vehicle_no || "").trim();
        if (veh) {
          const parts = parseVehicle(veh);
          setVehP1(p => p || parts.p1);
          setVehP2(p => p || parts.p2);
          setVehP3(p => p || parts.p3);
          setVehP4(p => p || parts.p4);
        }
      } catch {}
      setLoadingId(null);
    } else {
      newSet.delete(record.id);
      setCheckedIds(newSet);
      setItems(prev => prev.filter(it => isDespatchMode
        ? it.despatch_id !== record.id
        : it.inward_id !== record.id));
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
      const invType = data.invoice_type || "despatch_notes";
      const restoredIds = new Set<string>(
        invType === "despatch_notes"
          ? (data.items || []).map((it: any) => it.despatch_id).filter(Boolean)
          : (data.items || []).map((it: any) => it.inward_id).filter(Boolean)
      );
      setCheckedIds(restoredIds);
      setItems((data.items || []).map((it: any) => ({ ...it })));
      const loadedCharges = (data.charges || []);
      setCharges(loadedCharges.length > 0
        ? loadedCharges.map((c: any) => ({ subledger_id: c.subledger_id || "", charge_name: c.charge_name || "", amount: c.amount || "" }))
        : [{ subledger_id: "", charge_name: "", amount: "" }]);
      setShowSearchDrop(false);
      setSaveError("");
      setSaveOk(false);
    } catch (e: any) {
      setSaveError("Failed to load invoice");
    }
  }

  // ── Reset form ────────────────────────────────────────────────────────────────
  // Auto-load record when editId prop is provided
  useEffect(() => {
    if (editId) loadInvoice(editId);
  }, [editId]);

  function resetForm() {
    onBackToList();
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
    setCharges(prev => [...prev, { subledger_id: "", charge_name: "", amount: "" }]);
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/job-work-invoice"] });
      qc.invalidateQueries({ queryKey: ["/api/job-work-invoice/invoiced-ids"] });
    },
  });
  const updateMut = useMutation({
    mutationFn: ({ id, body }: any) => apiRequest("PATCH", `/api/job-work-invoice/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/job-work-invoice"] });
      qc.invalidateQueries({ queryKey: ["/api/job-work-invoice/invoiced-ids"] });
    },
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/job-work-invoice/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/job-work-invoice"] });
      qc.invalidateQueries({ queryKey: ["/api/job-work-invoice/invoiced-ids"] });
      resetForm();
    },
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
      {/* Page title + back */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBackToList} className="text-sm text-gray-500 hover:text-gray-800 transition-colors" data-testid="btn-back-to-list">
          ← Back
        </button>
        <span className="text-gray-300">|</span>
        <h1 className="text-xl font-bold" style={{ color: SC.primary }}>
          {editingId ? "Edit Invoice" : "New Invoice"}
        </h1>
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
        {/* Company info header */}
        {settingsMap.company_name && (
          <div className="flex items-start justify-between mb-4 pb-3 border-b border-gray-100">
            <div>
              <div className="font-bold text-base" style={{ color: SC.primary }}>{settingsMap.company_name}</div>
              {(settingsMap.company_address || settingsMap.company_city || settingsMap.company_state) && (
                <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                  {[settingsMap.company_address, settingsMap.company_city, settingsMap.company_state].filter(Boolean).join(", ")}
                </div>
              )}
              <div className="flex flex-wrap gap-x-4 mt-0.5 text-xs text-gray-500">
                {settingsMap.company_gstin  && <span>GSTIN: <span className="font-mono font-semibold text-gray-700">{settingsMap.company_gstin}</span></span>}
                {settingsMap.company_phone  && <span>Ph: {settingsMap.company_phone}</span>}
                {settingsMap.company_email  && <span>{settingsMap.company_email}</span>}
              </div>
            </div>
          </div>
        )}

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
                    onClick={() => { setPartyId(c.id); setPartySearch(c.name); setPartyDropOpen(false); setItems([]); setCheckedIds(new Set()); }}>
                    {c.name}
                  </div>
                ))}
                {filteredParties.length === 0 && <div className="px-3 py-2 text-gray-400 text-sm">No parties found</div>}
              </div>
            )}

            {/* Party details card — fills empty space below dropdown */}
            {partyId && (() => {
              const party = customerList.find((c: any) => c.id === partyId);
              if (!party) return null;
              const addrParts = [party.address, party.address1, party.address2, party.city, party.state].filter(Boolean);
              return (
                <div className="mt-2 px-3 py-2.5 rounded-lg border border-blue-100 bg-blue-50/50 text-xs">
                  <div className="font-semibold text-sm mb-0.5" style={{ color: SC.primary }}>{party.name}</div>
                  {addrParts.length > 0 && (
                    <div className="text-gray-600 leading-relaxed mb-0.5">{addrParts.join(", ")}</div>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                    {party.phone    && <span className="text-gray-500">Ph: {party.phone}</span>}
                    {party.gstin    && <span className="text-gray-500">GSTIN: <span className="font-mono font-semibold text-gray-700">{party.gstin}</span></span>}
                    {party.email    && <span className="text-gray-500">{party.email}</span>}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Right: selection panel — Despatch Notes or Direct Invoice */}
          <div className="border rounded-lg overflow-hidden" style={{ minWidth: 440 }}>
            {/* Mode radio */}
            <div className="flex items-center gap-4 px-3 py-2 border-b bg-gray-50">
              {(["despatch_notes", "direct_invoice"] as const).map(t => (
                <label key={t} className="flex items-center gap-1.5 cursor-pointer text-sm">
                  <input type="radio" name="invoiceType" value={t}
                    checked={invoiceType === t}
                    onChange={() => { setInvoiceType(t); setItems([]); setCheckedIds(new Set()); }}
                  />
                  <span style={invoiceType === t ? { color: SC.orange, fontWeight: 600 } : {}}>
                    {t === "despatch_notes" ? "Despatch Notes" : "Direct Invoice"}
                  </span>
                </label>
              ))}
            </div>

            {/* ── Despatch Notes panel ── */}
            {invoiceType === "despatch_notes" && (
              <>
                <div className="grid text-xs font-semibold text-gray-500 bg-gray-50 border-b"
                  style={{ gridTemplateColumns: "100px 90px 1fr 90px 44px" }}>
                  <div className="px-2 py-1.5">Desp No</div>
                  <div className="px-2 py-1.5">Date</div>
                  <div className="px-2 py-1.5">Inward Ref</div>
                  <div className="px-2 py-1.5">Vehicle</div>
                  <div className="px-2 py-1.5 text-center">✓</div>
                </div>
                <div className="max-h-28 overflow-y-auto">
                  {!partyId && (
                    <div className="px-3 py-3 text-xs text-gray-400 text-center">Select a party</div>
                  )}
                  {partyId && partyDespatches.length === 0 && (
                    <div className="px-3 py-4 text-center">
                      <div className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-block">
                        ⚠ No pending despatch notes — all despatches for this party have already been invoiced.
                      </div>
                    </div>
                  )}
                  {partyDespatches.map((d: any) => (
                    <div key={d.id}
                      className="grid items-center border-b last:border-0 hover:bg-blue-50 transition-colors"
                      style={{ gridTemplateColumns: "100px 90px 1fr 90px 44px" }}>
                      <div className="px-2 py-1.5 text-xs font-semibold" style={{ color: SC.primary }}>{d.voucher_no}</div>
                      <div className="px-2 py-1.5 text-xs text-gray-600">{fmtDate(d.despatch_date)}</div>
                      <div className="px-2 py-1.5 text-xs text-gray-500">{d.inward_voucher_no || "—"}</div>
                      <div className="px-2 py-1.5 text-xs font-mono text-gray-600">{d.vehicle_no || "—"}</div>
                      <div className="px-2 py-1.5 flex justify-center">
                        {loadingId === d.id
                          ? <Loader2 size={13} className="animate-spin" style={{ color: SC.primary }} />
                          : <input type="checkbox"
                              data-testid={`chk-despatch-${d.id}`}
                              className="accent-orange-600 cursor-pointer w-4 h-4"
                              checked={checkedIds.has(d.id)}
                              onChange={e => toggleRecord(d, e.target.checked)}
                            />
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ── Direct Invoice panel ── */}
            {invoiceType === "direct_invoice" && (
              <>
                <div className="grid text-xs font-semibold text-gray-500 bg-gray-50 border-b"
                  style={{ gridTemplateColumns: "100px 90px 1fr 44px" }}>
                  <div className="px-2 py-1.5">Inward No</div>
                  <div className="px-2 py-1.5">Date</div>
                  <div className="px-2 py-1.5">DC No</div>
                  <div className="px-2 py-1.5 text-center">✓</div>
                </div>
                <div className="max-h-28 overflow-y-auto">
                  {!partyId && (
                    <div className="px-3 py-3 text-xs text-gray-400 text-center">Select a party</div>
                  )}
                  {partyId && partyDirectInwards.length === 0 && (
                    <div className="px-3 py-4 text-center">
                      <div className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 inline-block">
                        ⚠ No pending inwards — all eligible inwards for this party have already been invoiced or despatched.
                      </div>
                    </div>
                  )}
                  {partyDirectInwards.map((inw: any) => (
                    <div key={inw.id}
                      className="grid items-center border-b last:border-0 hover:bg-blue-50 transition-colors"
                      style={{ gridTemplateColumns: "100px 90px 1fr 44px" }}>
                      <div className="px-2 py-1.5 text-xs font-semibold" style={{ color: SC.primary }}>{inw.voucher_no}</div>
                      <div className="px-2 py-1.5 text-xs text-gray-600">{fmtDate(inw.inward_date)}</div>
                      <div className="px-2 py-1.5 text-xs text-gray-500">{inw.party_dc_no || "—"}</div>
                      <div className="px-2 py-1.5 flex justify-center">
                        {loadingId === inw.id
                          ? <Loader2 size={13} className="animate-spin" style={{ color: SC.primary }} />
                          : <input type="checkbox"
                              data-testid={`chk-inward-${inw.id}`}
                              className="accent-orange-600 cursor-pointer w-4 h-4"
                              checked={checkedIds.has(inw.id)}
                              onChange={e => toggleRecord(inw, e.target.checked)}
                            />
                        }
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
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
          {activeTab === "invoice" && (
            <div className="flex items-end pb-1">
              <div className="flex items-center gap-4">
                {[false, true].map(val => (
                  <label key={String(val)} className="flex items-center gap-1.5 cursor-pointer text-sm font-medium">
                    <input type="radio" name="stateType" className="accent-orange-600"
                      checked={isInterState === val}
                      onChange={() => setIsInterState(val)} />
                    <span style={isInterState === val ? { color: SC.orange, fontWeight: 700 } : { color: "#555" }}>
                      {val ? "Inter-State" : "Within State"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

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
                      <th className="px-2 py-2 text-center w-20">GST %</th>
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
                        <td colSpan={isInterState ? 18 : 19} className="text-center py-8 text-gray-400 text-sm">
                          Select a despatch or inward from the panel to load items
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
                          <td className="px-2 py-1 text-center">
                            <input type="number" min={0} max={28} step="0.5"
                              data-testid={`input-gst-pct-${idx}`}
                              className="border rounded px-1 py-0.5 text-xs text-center w-16"
                              value={isInterState
                                ? (parseFloat(it.igst_rate || 0) || "")
                                : (parseFloat(it.cgst_rate || 0) * 2 || "")}
                              onChange={e => {
                                const pct = parseFloat(e.target.value || "0");
                                const half = pct / 2;
                                setItems(prev => prev.map((row, i) => i === realIdx ? {
                                  ...row,
                                  cgst_rate: isInterState ? 0 : half,
                                  sgst_rate: isInterState ? 0 : half,
                                  igst_rate: isInterState ? pct : 0,
                                  cgst_amt:  isInterState ? 0 : taxable * half / 100,
                                  sgst_amt:  isInterState ? 0 : taxable * half / 100,
                                  igst_amt:  isInterState ? taxable * pct / 100 : 0,
                                } : row));
                              }} />
                          </td>
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
          <div className="flex gap-5 mb-4" style={{ alignItems: "flex-start" }}>

            {/* Left: Other charges grid */}
            <div style={{ width: 380, flexShrink: 0 }}>
              <div className="border rounded-lg overflow-hidden shadow-sm">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ background: SC.primary, color: "#fff" }}>
                      <th className="px-3 py-2.5 text-left font-medium" style={{ width: 48 }}>S.no</th>
                      <th className="px-3 py-2.5 text-left font-medium">Other Charges</th>
                      <th className="px-3 py-2.5 text-right font-medium" style={{ width: 110 }}>Amount ₹</th>
                      <th style={{ width: 32 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map((ch, idx) => (
                      <tr key={idx} className="border-b border-gray-200 hover:bg-blue-50 transition-colors">
                        <td className="px-3 py-2 text-gray-500 text-center text-sm">{idx + 1}</td>
                        <td className="px-2 py-1.5">
                          <select
                            data-testid={`select-charge-subledger-${idx}`}
                            className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 focus:outline-none focus:border-blue-400 bg-white cursor-pointer"
                            value={ch.subledger_id}
                            onChange={e => {
                              const sl = (subledgerList as any[]).find((s: any) => s.id === e.target.value);
                              setCharges(prev => prev.map((c, i) => i === idx ? {
                                ...c,
                                subledger_id: e.target.value,
                                charge_name: sl ? sl.name : "",
                              } : c));
                            }}>
                            <option value="">— Select subledger —</option>
                            {(subledgerList as any[]).map((sl: any) => (
                              <option key={sl.id} value={sl.id}>{sl.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number"
                            data-testid={`input-charge-amount-${idx}`}
                            className="w-full px-2 py-1 text-sm rounded border border-gray-200 focus:outline-none focus:border-blue-400 text-right bg-transparent"
                            placeholder="0.00"
                            value={ch.amount}
                            onChange={e => updateCharge(idx, "amount", e.target.value)} />
                        </td>
                        <td className="px-1 py-1 text-center">
                          <button onClick={() => removeCharge(idx)}
                            className="text-red-300 hover:text-red-600 transition-colors p-1">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {/* Empty placeholder rows for visual grid feel */}
                    {Array.from({ length: Math.max(0, 5 - charges.length) }).map((_, i) => (
                      <tr key={`empty-${i}`} className="border-b border-gray-100">
                        <td className="px-3 py-3 text-gray-300 text-center text-xs">{charges.length + i + 1}</td>
                        <td className="px-3 py-3"></td>
                        <td className="px-3 py-3"></td>
                        <td></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* Total row */}
                {charges.some(c => parseFloat(c.amount) > 0) && (
                  <div className="flex justify-between items-center px-3 py-2 bg-gray-50 border-t border-gray-200">
                    <span className="text-xs font-semibold text-gray-600">Total Other Charges</span>
                    <span className="text-sm font-bold" style={{ color: SC.primary }}>
                      ₹{charges.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0)
                          .toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <button
                  data-testid="btn-add-charge"
                  onClick={addCharge}
                  className="flex items-center gap-1.5 w-full px-3 py-2 text-xs hover:bg-gray-50 border-t border-gray-200 transition-colors"
                  style={{ color: SC.primary }}>
                  <Plus size={13} /> Add row
                </button>
              </div>
            </div>

            {/* Right: Delivery section */}
            <div className="flex-1 border rounded-lg overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 border-b" style={{ background: SC.primary }}>
                <h3 className="text-sm font-semibold text-white">Delivery</h3>
              </div>
              <div className="p-4">
                <div className="flex gap-4">
                  {/* Left column: Term of Delivery + Transport + Freight */}
                  <div className="flex-1 flex flex-col gap-4">
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block font-medium">Term of Delivery</label>
                      <input data-testid="input-term-of-delivery"
                        className="border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-1"
                        style={{ focusRingColor: SC.primary } as any}
                        placeholder="e.g. Ex Works"
                        value={termOfDel} onChange={e => setTermOfDel(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block font-medium">Transport</label>
                      <input data-testid="input-transport"
                        className="border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-1"
                        placeholder="Transporter name"
                        value={transport} onChange={e => setTransport(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-2 block font-medium">Freight</label>
                      <div className="flex gap-5">
                        {(["to_pay", "paid"] as const).map(f => (
                          <label key={f} className="flex items-center gap-2 cursor-pointer text-sm">
                            <input type="radio" name="freight" value={f}
                              className="accent-orange-600"
                              checked={freight === f}
                              onChange={() => setFreight(f)} />
                            <span style={freight === f ? { color: SC.orange, fontWeight: 700 } : { color: "#555" }}>
                              {f === "to_pay" ? "To Pay" : "Paid"}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right column: Delivery Address */}
                  <div className="flex-1 flex flex-col">
                    <label className="text-xs text-gray-500 mb-1 block font-medium">Delivery Address</label>
                    <textarea data-testid="input-delivery-address"
                      className="border rounded-lg px-3 py-2 text-sm w-full resize-none flex-1 focus:outline-none focus:ring-1"
                      rows={6}
                      placeholder="Enter delivery address..."
                      value={deliveryAddr} onChange={e => setDeliveryAddr(e.target.value)} />
                    <label className="flex items-center gap-2 mt-2 cursor-pointer text-sm text-gray-600">
                      <input type="checkbox" data-testid="chk-same-as-company"
                        className="accent-blue-600 w-4 h-4"
                        checked={sameAsCompany} onChange={e => setSameAsCompany(e.target.checked)} />
                      Same as Company
                    </label>
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

// ── Job Work Invoice List (default export) ────────────────────────────────────
export default function JobWorkInvoice() {
  const [view, setView] = useState<"list" | "form">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: records = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/job-work-invoice"] });

  const filtered = records.filter((r: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.voucher_no?.toLowerCase().includes(q) ||
      r.party_name_db?.toLowerCase().includes(q) ||
      r.invoice_date?.includes(q)
    );
  });

  if (view === "form") {
    return <InvoiceForm editId={editId} onBackToList={() => { setEditId(null); setView("list"); }} />;
  }

  return (
    <div className="p-6" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h1 className="font-semibold text-gray-800 text-base">Job Work Invoice</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by voucher / party / date..."
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded w-64 outline-none focus:border-[#027fa5]"
                data-testid="input-search" />
            </div>
            <button onClick={() => { setEditId(null); setView("form"); }}
              className="px-6 py-2 rounded text-sm font-semibold text-white"
              style={{ background: SC.orange }} data-testid="btn-add">
              + New
            </button>
          </div>
        </div>

        {/* Table */}
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: SC.tonal }}>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700 w-12">S.No</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Voucher No</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Date</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Party</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Type</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Tax</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Status</th>
              <th className="px-3 py-2.5 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400 text-sm">Loading...</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <div className="text-sm font-medium">No invoices yet</div>
                    <div className="text-xs">Click "+ New" to create your first Job Work Invoice</div>
                  </div>
                </td>
              </tr>
            )}
            {filtered.map((r: any, i: number) => (
              <tr key={r.id} className={`border-t border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                data-testid={`row-invoice-${r.id}`}>
                <td className="px-5 py-2.5 text-gray-500">{i + 1}</td>
                <td className="px-5 py-2.5 font-semibold" style={{ color: SC.primary }}>{r.voucher_no}</td>
                <td className="px-5 py-2.5 text-gray-600 text-xs">{r.invoice_date ? new Date(r.invoice_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                <td className="px-5 py-2.5 font-medium text-gray-700">{r.party_name_db || r.party_name_manual || <span className="text-gray-300">—</span>}</td>
                <td className="px-5 py-2.5 text-xs text-gray-600">
                  {r.invoice_type === "direct_invoice" ? "Direct" : "Despatch"}
                </td>
                <td className="px-5 py-2.5 text-xs">
                  <span className={`px-2 py-0.5 rounded font-semibold ${r.is_inter_state ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>
                    {r.is_inter_state ? "Inter-State" : "Within State"}
                  </span>
                </td>
                <td className="px-5 py-2.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${r.status === "Saved" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                    {r.status || "Draft"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <button onClick={() => { setEditId(r.id); setView("form"); }}
                    className="p-1.5 rounded hover:bg-blue-50 transition-colors" style={{ color: SC.primary }}
                    data-testid={`btn-edit-${r.id}`}>
                    <PencilLine size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

      </div>
    </div>
  );
}
