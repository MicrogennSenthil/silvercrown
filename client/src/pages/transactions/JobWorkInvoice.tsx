import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Loader2, AlertCircle, CheckCircle2, Trash2, Plus, PencilLine, Printer, X } from "lucide-react";
import DatePicker from "@/components/DatePicker";
import { apiRequest } from "@/lib/queryClient";
import { buildTaxInvoiceHTML } from "@/lib/printTaxInvoice";

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


/* ── Invoice Print Dialog ──────────────────────────────────────────── */
function InvoicePrintDialog({ invoiceId, isNew, onDone }: { invoiceId: string; isNew: boolean; onDone: () => void }) {
  const [mode,    setMode]    = useState<"pick" | "einvoice">("pick");
  const [irn,     setIrn]     = useState("");
  const [ackNo,   setAckNo]   = useState("");
  const [ackDate, setAckDate] = useState("");
  const [loading, setLoading] = useState(false);

  async function doPrint(isEInvoice: boolean) {
    setLoading(true);
    try {
      const res = await fetch(`/api/reprint/invoice/${invoiceId}`, { credentials: "include" });
      const doc = await res.json();
      const html = buildTaxInvoiceHTML(doc, isEInvoice, isEInvoice ? { irn, ack_no: ackNo, ack_date: ackDate } : undefined);
      const win = window.open("", "_blank", "width=900,height=760");
      if (win) { win.document.write(html); win.document.close(); setTimeout(() => win.print(), 600); }
      if (isEInvoice && (irn || ackNo || ackDate)) {
        await fetch(`/api/job-work-invoice/${invoiceId}/e-invoice`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ irn, ack_no: ackNo, ack_date: ackDate }),
        });
      }
    } finally {
      setLoading(false);
      onDone();
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onDone}/>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 z-10 p-6">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="text-base font-bold text-gray-800">Invoice Saved!</h3>
            <p className="text-xs text-gray-400 mt-0.5">Would you like to print?</p>
          </div>
          <button onClick={onDone} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={15}/></button>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {mode === "pick" ? (
            <>
              <button onClick={() => doPrint(false)} disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: SC.orange }}
                data-testid="btn-print-normal-invoice">
                <Printer size={14}/> Normal Invoice (3 copies)
              </button>
              <button onClick={() => setMode("einvoice")} disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-bold border-2 flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ borderColor: SC.primary, color: SC.primary }}
                data-testid="btn-print-einvoice-open">
                <Printer size={14}/> e-Invoice (with IRN / Ack)
              </button>
              <button onClick={onDone}
                className="text-xs text-gray-400 hover:text-gray-600 text-center py-1">
                Skip — don&apos;t print
              </button>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">IRN</label>
                <textarea value={irn} onChange={e => setIrn(e.target.value)} rows={2}
                  placeholder="Paste IRN hash here..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:border-[#027fa5]"
                  data-testid="input-einv-irn"/>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Ack No.</label>
                  <input value={ackNo} onChange={e => setAckNo(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#027fa5]"
                    data-testid="input-einv-ack-no"/>
                </div>
                <div className="flex-1">
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Ack Date</label>
                  <input type="date" value={ackDate} onChange={e => setAckDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#027fa5]"
                    data-testid="input-einv-ack-date"/>
                </div>
              </div>
              <button onClick={() => doPrint(true)} disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: SC.primary }}
                data-testid="btn-print-einvoice-confirm">
                {loading ? <div className="w-4 h-4 rounded-full animate-spin border-2 border-white/30 border-t-white"/> : <Printer size={14}/>}
                Print e-Invoice
              </button>
              <button onClick={() => setMode("pick")}
                className="text-xs text-gray-400 hover:text-gray-600 text-center">
                ← Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function InvoiceForm({ onBackToList, editId }: { onBackToList: () => void; editId?: string | null }) {
  const qc = useQueryClient();

  // Read URL params (set by "Make Invoice" button on inward screen)
  const _urlParams = new URLSearchParams(window.location.search);
  const urlPartyId  = _urlParams.get("party_id")  || "";
  const urlInwardId = _urlParams.get("inward_id") || "";
  const urlFlow     = _urlParams.get("flow")      || "";

  // Lightweight queries — always fetch on mount
  const { data: customerList = [] } = useQuery<any[]>({ queryKey: ["/api/customers"] });
  const { data: subledgerList = [] } = useQuery<any[]>({ queryKey: ["/api/sub-ledgers/expense"] });
  const { data: settingsList = [] } = useQuery<any[]>({ queryKey: ["/api/settings"] });
  const { data: allProductsRaw = [] } = useQuery<any[]>({ queryKey: ["/api/products"] });
  const { data: allCategories = [] }  = useQuery<any[]>({ queryKey: ["/api/categories"] });
  const { data: processList = [] }    = useQuery<any[]>({ queryKey: ["/api/processes"] });
  const _rawMatCatIds = new Set((allCategories as any[]).filter((c: any) => c.isRawMaterial || c.is_raw_material).map((c: any) => c.id));
  const allProducts = _rawMatCatIds.size > 0 ? (allProductsRaw as any[]).filter((p: any) => !_rawMatCatIds.has(p.categoryId)) : allProductsRaw as any[];

  // Heavy queries — only fire once a party is chosen (or when editing an existing invoice)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [partyId, setPartyId] = useState(() => urlPartyId);

  const { data: inwardList = [], isFetching: inwardFetching } = useQuery<any[]>({
    queryKey: ["/api/job-work-inward", partyId],
    queryFn: () => fetch(`/api/job-work-inward?party_id=${partyId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!partyId,
    staleTime: 30_000,
  });
  const { data: despatchList = [], isFetching: despatchFetching } = useQuery<any[]>({
    queryKey: ["/api/job-work-despatch", partyId],
    queryFn: () => fetch(`/api/job-work-despatch?party_id=${partyId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!partyId,
    staleTime: 30_000,
  });
  const panelLoading = !!partyId && (inwardFetching || despatchFetching);

  // invoiced-ids — only needed once party is known, lazy too
  const invoicedIdsKey = editId
    ? `/api/job-work-invoice/invoiced-ids?exclude_invoice_id=${editId}`
    : "/api/job-work-invoice/invoiced-ids";
  const { data: invoicedIds } = useQuery<{ despatch_ids: string[]; direct_inward_ids: string[] }>({
    queryKey: [invoicedIdsKey, partyId],
    enabled: !!partyId,
    staleTime: 30_000,
  });
  const invoicedDespatchIds  = new Set(invoicedIds?.despatch_ids || []);
  const invoicedDirectInwIds = new Set(invoicedIds?.direct_inward_ids || []);
  const settingsMap = (settingsList as any[]).reduce((m: any, s: any) => { m[s.key] = s.value; return m; }, {});
  type FlowMode = "inward_despatch_invoice" | "inward_direct" | "direct_only";
  const rawFlowSetting: string = settingsMap.jobwork_invoice_flow || "inward_despatch_invoice";
  const enabledFlows: FlowMode[] = rawFlowSetting.split(",").filter(Boolean) as FlowMode[];

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
  const [activeFlow,   setActiveFlow]   = useState<FlowMode>("inward_despatch_invoice");
  const [invoiceType,  setInvoiceType]  = useState<"despatch_notes" | "direct_invoice">("despatch_notes");
  const [isInterState, setIsInterState] = useState(false);
  const [isEwayBill,   setIsEwayBill]   = useState(false);
  const [remark,       setRemark]       = useState("");

  // Party
  const [partySearch,   setPartySearch]   = useState("");
  const [partyDropOpen, setPartyDropOpen] = useState(false);
  const partyRef = useRef<HTMLDivElement>(null);

  // Credit check
  type CreditWarn = { warning: "limit"|"days"|"both"|null; credit_limit: number; credit_days: number; outstanding: number; oldest_dr_days: number; can_override: boolean } | null;
  const [creditWarn, setCreditWarn] = useState<CreditWarn>(null);

  // Panel selection — despatch IDs (despatch_notes mode) or inward IDs (direct_invoice mode)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [loadingId,  setLoadingId]  = useState<string | null>(null);

  // Items grid (Invoice tab)
  const [items,        setItems]        = useState<any[]>([]);
  const [gridSearch,   setGridSearch]   = useState("");
  const [directSearch, setDirectSearch] = useState<Record<number, string>>({});
  const [directDrop,   setDirectDrop]   = useState<number | null>(null);
  const [dropPos,      setDropPos]      = useState<{ top: number; left: number; width: number } | null>(null);

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
  const [printDialogState, setPrintDialogState] = useState<{ id: string; isNew: boolean } | null>(null);

  // Party dropdown close on outside click
  useEffect(() => {
    function h(e: MouseEvent) {
      if (partyRef.current && !partyRef.current.contains(e.target as Node)) setPartyDropOpen(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // When settings load/change, reset activeFlow — prefer URL flow param if valid
  useEffect(() => {
    if (urlFlow && enabledFlows.includes(urlFlow as FlowMode)) {
      setActiveFlow(urlFlow as FlowMode);
    } else {
      const first = enabledFlows[0] || "inward_despatch_invoice";
      setActiveFlow(first);
    }
  }, [rawFlowSetting]);

  // Auto-fill party name in search input when coming from URL (needs customerList to load)
  useEffect(() => {
    if (!urlPartyId || partySearch) return;
    const c = (customerList as any[]).find((c: any) => c.id === urlPartyId);
    if (c) setPartySearch(c.name);
  }, [urlPartyId, customerList]);

  // Sync invoiceType and reset grid whenever activeFlow changes (new invoices only)
  useEffect(() => {
    setInvoiceType(activeFlow === "inward_despatch_invoice" ? "despatch_notes" : "direct_invoice");
    if (!editingId) {
      setItems([]);
      setCheckedIds(new Set());
    }
  }, [activeFlow]);

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

  // Despatch Notes mode: despatches for party that are finalised and not yet fully invoiced.
  // During edit mode, also include despatches already used in THIS invoice (checkedIds) — they
  // may have status "Invoiced" but must still appear pre-checked in the panel.
  const partyDespatches = (despatchList as any[]).filter((d: any) => {
    if (d.party_id !== partyId) return false;
    if (invoicedDespatchIds.has(d.id)) return false; // invoiced by a DIFFERENT invoice
    if (d.status === "Cancelled") return false;
    if (d.status === "Draft" || d.status == null) return false;
    // Always show if it belongs to the invoice being edited (even if status = "Invoiced")
    if (checkedIds.has(d.id)) return true;
    // For new/pending despatches, exclude already-invoiced ones
    return d.status !== "Invoiced";
  });
  // Direct Invoice mode: inwards for party with NO despatch and NOT yet directly invoiced.
  // Same logic: include already-checked inwards when editing.
  const partyDirectInwards = (inwardList as any[]).filter((r: any) => {
    if (r.party_id !== partyId) return false;
    if (invoicedDirectInwIds.has(r.id)) return false;
    if (checkedIds.has(r.id)) return true;
    return !r.despatch_status || r.despatch_status === "Pending";
  });
  // Combined panel (inward_despatch_invoice): despatches + inwards-without-despatch, each tagged with _type
  const partyDespatchPanel = [
    ...partyDespatches.map((d: any) => ({ ...d, _type: "despatch" as const })),
    ...partyDirectInwards.map((r: any) => ({ ...r, _type: "inward" as const })),
  ];

  // Auto-select inward from URL once panel has loaded (runs once) — must be AFTER partyDespatchPanel
  const _autoInwardDone = useRef(false);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!urlInwardId || _autoInwardDone.current || !partyDespatchPanel.length) return;
    const rec = partyDespatchPanel.find((r: any) => r.id === urlInwardId);
    if (rec) {
      _autoInwardDone.current = true;
      toggleRecord(rec, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlInwardId, partyDespatchPanel]);

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
      const cgstR = parseFloat(it.cgst_rate || 0);
      const sgstR = parseFloat(it.sgst_rate || 0);
      // derive igst from cgst+sgst if igst_rate is 0
      const igstR = parseFloat(it.igst_rate || 0) || (cgstR + sgstR);
      return {
        ...it,
        igst_rate: igstR,
        cgst_amt: isInterState ? 0 : taxable * cgstR / 100,
        sgst_amt: isInterState ? 0 : taxable * sgstR / 100,
        igst_amt: isInterState ? taxable * igstR / 100 : 0,
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

  // ── Credit check — auto-runs when party or total changes ─────────────────────
  useEffect(() => {
    if (!partyId) { setCreditWarn(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/credit-check?party_id=${partyId}&amount=${grandTotal}&module=job_work_invoice`,
          { credentials: "include" }
        );
        if (!cancelled) setCreditWarn(await r.json());
      } catch { /* silent */ }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [partyId, grandTotal]);

  // ── Toggle despatch or inward — loads items directly into grid ───────────────
  async function toggleRecord(record: any, checked: boolean) {
    const newSet = new Set(checkedIds);
    // Use _type tag if present; fall back to invoiceType for legacy paths
    const isDespatch = record._type === "despatch" || (record._type === undefined && invoiceType === "despatch_notes");

    if (checked) {
      newSet.add(record.id);
      setCheckedIds(newSet);
      setLoadingId(record.id);
      try {
        const endpoint = isDespatch
          ? `/api/job-work-despatch/${record.id}/items-for-invoice`
          : `/api/job-work-inward/${record.id}/direct-items-for-invoice`;
        const res = await fetch(endpoint, { credentials: "include" });
        const data = await res.json();
        const rows: any[] = Array.isArray(data) ? data : [];
        // Build invoice rows directly — no modal
        const built = rows.map(r => {
          const qty    = parseFloat(r.qty_despatched || r.qty || 0);
          const rate   = parseFloat(r.rate || 0);
          const taxable = qty * rate;
          const cgstR  = parseFloat(r.cgst_rate || 0);
          const sgstR  = parseFloat(r.sgst_rate || 0);
          const igstR  = parseFloat(r.igst_rate || 0) || (cgstR + sgstR);
          return {
            despatch_id:         isDespatch ? record.id : null,
            inward_id:           isDespatch ? (r.inward_id || null) : (record.id || null),
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
            despatch_voucher_no: r.despatch_voucher_no || (isDespatch ? record.voucher_no : "") || "",
            inward_voucher_no:   r.inward_voucher_no || (!isDespatch ? record.voucher_no : "") || "",
            packing_details:     "",
            cgst_rate: cgstR, sgst_rate: sgstR, igst_rate: igstR,
            cgst_amt:  isInterState ? 0 : taxable * cgstR / 100,
            sgst_amt:  isInterState ? 0 : taxable * sgstR / 100,
            igst_amt:  isInterState ? taxable * igstR / 100 : 0,
          };
        });
        // Auto-fill vehicle no from despatch record
        if (isDespatch) {
          const veh = (record.vehicle_no || "").trim();
          if (veh) {
            const parts = parseVehicle(veh);
            setVehP1(p => p || parts.p1);
            setVehP2(p => p || parts.p2);
            setVehP3(p => p || parts.p3);
            setVehP4(p => p || parts.p4);
          }
          setItems(prev => [...prev.filter(it => it.despatch_id !== record.id), ...built]);
        } else {
          setItems(prev => [...prev.filter(it => it.inward_id !== record.id), ...built]);
        }
      } catch {}
      setLoadingId(null);
    } else {
      newSet.delete(record.id);
      setCheckedIds(newSet);
      setItems(prev => prev.filter(it => isDespatch
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
      setIsEwayBill(data.is_eway_bill || false);
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
      setPartyDropOpen(false);
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
    setCheckedIds(new Set());
  }

  // ── Update item editable fields ───────────────────────────────────────────────
  function updateItem(idx: number, field: string, value: any) {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: value };
      if (field === "qty_despatched" || field === "rate") {
        const qty = parseFloat(field === "qty_despatched" ? value : updated.qty_despatched) || 0;
        const rate = parseFloat(field === "rate" ? value : updated.rate) || 0;
        const t = qty * rate;
        const cgR = parseFloat(updated.cgst_rate) || 0;
        const sgR = parseFloat(updated.sgst_rate) || 0;
        const igR = parseFloat(updated.igst_rate) || 0;
        updated.amount   = t;
        updated.cgst_amt = isInterState ? 0 : t * cgR / 100;
        updated.sgst_amt = isInterState ? 0 : t * sgR / 100;
        updated.igst_amt = isInterState ? t * igR / 100 : 0;
      }
      return updated;
    }));
  }

  function newDirectRow() {
    return {
      _manual: true,
      despatch_id: null, inward_id: null, inward_item_id: null, item_id: null,
      item_code: "", item_name: "", unit: "", process: "", hsn: "",
      qty_despatched: 0, rate: 0, amount: 0,
      po_no: "", party_dc: "", work_order_no: "", despatch_voucher_no: "", inward_voucher_no: "",
      packing_details: "",
      cgst_rate: 0, sgst_rate: 0, igst_rate: 0, cgst_amt: 0, sgst_amt: 0, igst_amt: 0,
    };
  }
  function addDirectRow() { setItems(prev => [...prev, newDirectRow()]); }


  function switchFlow(f: FlowMode) {
    setActiveFlow(f);
    setCheckedIds(new Set());
    setItems([]);
  }

  function selectDirectItem(realIdx: number, product: any) {
    // Products schema (Drizzle camelCase):
    //   selling_price col → product.rate
    //   cgst_rate col     → product.cgstRate
    //   sgst_rate col     → product.sgstRate
    //   igst_rate col     → product.igstRate
    //   hsn_code col      → product.hsnCode
    //   unit / uom        → product.unit / product.uom
    const rate  = parseFloat(product.rate || 0) || parseFloat(product.sellingPrice ?? product.selling_price ?? 0);
    const cgstR = parseFloat(product.cgstRate ?? product.cgst_rate ?? 0);
    const sgstR = parseFloat(product.sgstRate ?? product.sgst_rate ?? 0);
    const igstR = parseFloat(product.igstRate ?? product.igst_rate ?? 0) || (cgstR + sgstR);
    const qty     = parseFloat(items[realIdx]?.qty_despatched || 0);
    const taxable = qty * rate;
    setItems(prev => prev.map((it, i) => i !== realIdx ? it : {
      ...it,
      item_id:   product.id || null,
      item_code: product.code || "",
      item_name: product.name || "",
      unit:      (product.unit || product.uom || "").toUpperCase(),
      hsn: isEwayBill
        ? (product.hsnCodeEway ?? product.hsn_code_eway ?? product.hsnCode ?? product.hsn_code ?? "")
        : (product.hsnCode ?? product.hsn_code ?? ""),
      rate,
      amount:    taxable,
      cgst_rate: cgstR,
      sgst_rate: sgstR,
      igst_rate: igstR,
      cgst_amt:  isInterState ? 0 : taxable * cgstR / 100,
      sgst_amt:  isInterState ? 0 : taxable * sgstR / 100,
      igst_amt:  isInterState ? taxable * igstR / 100 : 0,
    }));
    setDirectSearch(prev => ({ ...prev, [realIdx]: product.name || "" }));
    setDirectDrop(null);
    setDropPos(null);
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
    mutationFn: (id: string) => apiRequest("PATCH", `/api/job-work-invoice/${id}/cancel`),
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

    // ── Validation ─────────────────────────────────────────────────────────────
    if (!partySearch.trim()) {
      setSaveError("Party name is required. Please select or enter a party.");
      return;
    }
    const namedItems = items.filter(it => it.item_name?.trim());
    if (!namedItems.length) {
      setSaveError("Please add at least one item before saving the invoice.");
      return;
    }
    for (const it of namedItems) {
      const qty  = parseFloat(it.qty_despatched ?? 0);
      const rate = parseFloat(it.rate ?? 0);
      const cgst = parseFloat(it.cgst_rate ?? 0);
      const sgst = parseFloat(it.sgst_rate ?? 0);
      const igst = parseFloat(it.igst_rate ?? 0);
      if (!(qty > 0)) {
        setSaveError(`Item "${it.item_name}" has zero quantity. Please enter a valid quantity.`);
        return;
      }
      if (!(rate > 0)) {
        setSaveError(`Item "${it.item_name}" has no rate. Please enter the rate.`);
        return;
      }
      const gstMissing = isInterState ? !(igst > 0) : !(cgst > 0 && sgst > 0);
      if (gstMissing) {
        setSaveError(`Item "${it.item_name}" is missing ${isInterState ? "IGST" : "GST"} rate. Please set the tax percentage.`);
        return;
      }
    }
    // ── Credit limit / days block ───────────────────────────────────────────────
    if (creditWarn?.warning && !creditWarn.can_override) {
      setSaveError(
        creditWarn.warning === "limit"
          ? "Cannot save: this party's credit limit has been exceeded. Contact your supervisor for approval."
          : creditWarn.warning === "days"
          ? "Cannot save: this party's credit days have been exceeded. Contact your supervisor for approval."
          : "Cannot save: this party's credit limit and credit days have both been exceeded. Contact your supervisor for approval."
      );
      return;
    }
    // ── End Validation ─────────────────────────────────────────────────────────

    const validCharges = charges.filter(c => c.charge_name?.trim());
    const vehicleNo = [vehP1, vehP2, vehP3, vehP4].join("").toUpperCase();
    // Derive invoice_type from the actual items so mixed-panel invoices are tracked correctly
    const hasDespatchItems = namedItems.some((it: any) => it.despatch_id);
    const derivedInvoiceType = hasDespatchItems ? "despatch_notes" : "direct_invoice";
    const body = {
      voucher_no:       voucherNo,
      invoice_date:     invoiceDate,
      party_id:         partyId || null,
      party_name_manual:partySearch,
      vehicle_no:       vehicleNo,
      invoice_type:     activeFlow === "direct_only" ? "direct_invoice" : derivedInvoiceType,
      is_inter_state:   isInterState,
      is_eway_bill:     isEwayBill,
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
      let saved: any;
      if (editingId) {
        saved = await updateMut.mutateAsync({ id: editingId, body },
          { onSuccess: () => { setSaveOk(true); } });
      } else {
        saved = await createMut.mutateAsync(body,
          { onSuccess: () => { setSaveOk(true); } });
      }
      const savedId = saved?.id || editingId;
      if (savedId) {
        setPrintDialogState({ id: savedId, isNew });
      } else if (isNew) {
        resetForm();
      }
    } catch (e: any) {
      setSaveError(e?.message || "Save failed");
    }
  }

  const isSaving = createMut.isPending || updateMut.isPending;

  // ── Shared header + panel layout ──────────────────────────────────────────────
  return (
    <div style={{ background: SC.bg, minHeight: "100vh", padding: "24px" }}>

      {/* Print dialog (shown after save) */}
      {printDialogState && (
        <InvoicePrintDialog
          invoiceId={printDialogState.id}
          isNew={printDialogState.isNew}
          onDone={() => {
            const wasNew = printDialogState.isNew;
            setPrintDialogState(null);
            if (wasNew) resetForm();
          }}
        />
      )}

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
            <div className="border rounded-lg px-3 py-2 flex items-center justify-between bg-white">
              <input
                data-testid="input-party-name"
                className="outline-none flex-1 text-sm"
                placeholder="Type to search party..."
                value={partySearch}
                onChange={e => { setPartySearch(e.target.value); setPartyDropOpen(true); setPartyId(""); }}
                onFocus={() => setPartyDropOpen(true)}
                onBlur={() => setTimeout(() => setPartyDropOpen(false), 150)}
              />
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {partyDropOpen && (
              <div className="absolute left-0 top-full mt-1 bg-white border rounded-lg shadow-xl z-50 w-full max-h-48 overflow-y-auto">
                {filteredParties.map((c: any) => (
                  <div key={c.id} className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm"
                    onMouseDown={() => { setPartyId(c.id); setPartySearch(c.name); setPartyDropOpen(false); setItems([]); setCheckedIds(new Set()); }}>
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

            {/* Credit warning banner */}
            {creditWarn?.warning && (
              <div className={`mt-2 px-3 py-2.5 rounded-lg border flex gap-2 items-start text-sm ${
                !creditWarn.can_override
                  ? "border-red-300 bg-red-50 text-red-700"
                  : "border-amber-300 bg-amber-50 text-amber-700"
              }`}>
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <div>
                  {(creditWarn.warning === "limit" || creditWarn.warning === "both") && (
                    <div><strong>Credit Limit Exceeded:</strong> Outstanding ₹{creditWarn.outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })} + this invoice exceeds the limit of ₹{creditWarn.credit_limit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}.</div>
                  )}
                  {(creditWarn.warning === "days" || creditWarn.warning === "both") && (
                    <div><strong>Credit Days Exceeded:</strong> Oldest outstanding bill is {creditWarn.oldest_dr_days} days old (credit limit: {creditWarn.credit_days} days).</div>
                  )}
                  <div className="mt-0.5 text-xs opacity-75">
                    {creditWarn.can_override
                      ? "You have approval rights — you may still save this document."
                      : "You do not have approval rights to override the credit limit. Please contact your supervisor."}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: flow switcher + selection panel */}
          {(enabledFlows.length > 0) && (
            <div style={{ minWidth: 440 }}>

              {/* Flow switcher — shown when multiple flows are enabled (new invoices only) */}
              {enabledFlows.length > 1 && !editingId && (
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs text-gray-500 font-medium">Invoice via:</span>
                  {([ "inward_despatch_invoice", "inward_direct", "direct_only" ] as FlowMode[]).filter(f => enabledFlows.includes(f)).map(f => {
                    const labels: Record<FlowMode, string> = {
                      inward_despatch_invoice: "Despatch → Invoice",
                      inward_direct:           "Inward → Invoice",
                      direct_only:             "Direct (Manual)",
                    };
                    return (
                      <button key={f} onClick={() => switchFlow(f)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                        style={activeFlow === f
                          ? { background: SC.primary, color: "#fff", borderColor: "transparent" }
                          : { background: "#fff", color: "#374151", borderColor: "#d1d5db" }}>
                        {labels[f]}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Panel box — only when not in direct_only mode */}
              {activeFlow !== "direct_only" && (
                partyId && !panelLoading && (
                  (activeFlow === "inward_despatch_invoice" && partyDespatchPanel.length === 0) ||
                  (activeFlow === "inward_direct" && partyDirectInwards.length === 0)
                ) ? (
                  /* No pending items alert */
                  <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 border rounded-lg bg-amber-50 border-amber-200 text-center">
                    <AlertCircle size={26} className="text-amber-500" />
                    <div>
                      <div className="text-sm font-semibold text-amber-800 mb-0.5">No Pending Invoices</div>
                      <div className="text-xs text-amber-700">
                        There are no pending {activeFlow === "inward_despatch_invoice" ? "despatch notes or inwards" : "inwards"} against this party.
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Normal panel */
                  <div className="border rounded-lg overflow-hidden">
                    {/* Panel header */}
                    <div className="px-3 py-2 border-b bg-gray-50 flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wide" style={{ color: SC.primary }}>
                        {activeFlow === "inward_despatch_invoice" ? "Job Work Despatch Notes" : "Job Work Inward"}
                      </span>
                      <span className="text-xs text-gray-400">
                        {activeFlow === "inward_despatch_invoice" ? "(select despatch to load items)" : "(select inward to load items)"}
                      </span>
                    </div>

                    {/* ── Despatch Notes panel ── */}
                    {activeFlow === "inward_despatch_invoice" && (
                      <>
                        <div className="grid text-xs font-semibold text-gray-500 bg-gray-50 border-b"
                          style={{ gridTemplateColumns: "110px 80px 100px 1fr 80px 110px 44px" }}>
                          <div className="px-2 py-1.5">Desp No</div>
                          <div className="px-2 py-1.5">Date</div>
                          <div className="px-2 py-1.5">Inward No</div>
                          <div className="px-2 py-1.5">Inward Ref</div>
                          <div className="px-2 py-1.5">Vehicle</div>
                          <div className="px-2 py-1.5">Invoice No</div>
                          <div className="px-2 py-1.5 text-center">✓</div>
                        </div>
                        <div className="max-h-28 overflow-y-auto">
                          {!partyId && (
                            <div className="px-3 py-3 text-xs text-gray-400 text-center">Select a party first</div>
                          )}
                          {panelLoading && (
                            <div className="px-3 py-3 text-xs text-gray-400 text-center flex items-center justify-center gap-1.5">
                              <Loader2 size={12} className="animate-spin" /> Loading…
                            </div>
                          )}
                          {partyDespatchPanel.map((row: any) => {
                            const isDesp = row._type === "despatch";
                            const rowId  = row.id;
                            return (
                              <div key={rowId}
                                className={`grid items-center border-b last:border-0 transition-colors ${isDesp ? "hover:bg-blue-50" : "hover:bg-amber-50 bg-amber-50/30"}`}
                                style={{ gridTemplateColumns: "110px 80px 100px 1fr 80px 110px 44px" }}>
                                <div className="px-2 py-1.5 text-xs font-semibold" style={{ color: SC.primary }}>
                                  {isDesp ? row.voucher_no : <span className="text-gray-300 italic text-xs">No Despatch</span>}
                                </div>
                                <div className="px-2 py-1.5 text-xs text-gray-600">
                                  {isDesp ? fmtDate(row.despatch_date) : fmtDate(row.inward_date)}
                                </div>
                                <div className="px-2 py-1.5 text-xs font-semibold" style={{ color: isDesp ? "#555" : SC.primary }}>
                                  {isDesp ? (row.inward_voucher_no || "—") : row.voucher_no}
                                </div>
                                <div className="px-2 py-1.5 text-xs text-gray-500">
                                  {isDesp ? (row.party_dc_no || "—") : (row.party_dc_no || row.party_po_no || "—")}
                                </div>
                                <div className="px-2 py-1.5 text-xs font-mono text-gray-600">
                                  {isDesp ? (row.vehicle_no || "—") : "—"}
                                </div>
                                <div className="px-2 py-1.5 text-xs font-semibold" style={{ color: row.invoice_voucher_no ? SC.orange : undefined }}>
                                  {row.invoice_voucher_no || <span className="text-gray-300">—</span>}
                                </div>
                                <div className="px-2 py-1.5 flex justify-center">
                                  {loadingId === rowId
                                    ? <Loader2 size={13} className="animate-spin" style={{ color: SC.primary }} />
                                    : <input type="checkbox"
                                        data-testid={`chk-${isDesp ? "despatch" : "inward"}-${rowId}`}
                                        className="accent-orange-600 cursor-pointer w-4 h-4"
                                        checked={checkedIds.has(rowId)}
                                        onChange={e => toggleRecord(row, e.target.checked)}
                                      />
                                  }
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* ── Inward Direct panel ── */}
                    {activeFlow === "inward_direct" && (
                      <>
                        <div className="grid text-xs font-semibold text-gray-500 bg-gray-50 border-b"
                          style={{ gridTemplateColumns: "100px 80px 1fr 1fr 44px" }}>
                          <div className="px-2 py-1.5">Inward No</div>
                          <div className="px-2 py-1.5">Date</div>
                          <div className="px-2 py-1.5">DC No</div>
                          <div className="px-2 py-1.5">PO No</div>
                          <div className="px-2 py-1.5 text-center">✓</div>
                        </div>
                        <div className="max-h-28 overflow-y-auto">
                          {!partyId && (
                            <div className="px-3 py-3 text-xs text-gray-400 text-center">Select a party first</div>
                          )}
                          {panelLoading && (
                            <div className="px-3 py-3 text-xs text-gray-400 text-center flex items-center justify-center gap-1.5">
                              <Loader2 size={12} className="animate-spin" /> Loading…
                            </div>
                          )}
                          {partyDirectInwards.map((inw: any) => (
                            <div key={inw.id}
                              className="grid items-center border-b last:border-0 hover:bg-blue-50 transition-colors"
                              style={{ gridTemplateColumns: "100px 80px 1fr 1fr 44px" }}>
                              <div className="px-2 py-1.5 text-xs font-semibold" style={{ color: SC.primary }}>{inw.voucher_no}</div>
                              <div className="px-2 py-1.5 text-xs text-gray-600">{fmtDate(inw.inward_date)}</div>
                              <div className="px-2 py-1.5 text-xs text-gray-500">{inw.party_dc_no || "—"}</div>
                              <div className="px-2 py-1.5 text-xs text-gray-700 font-medium">{inw.party_po_no || "—"}</div>
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
                )
              )}
            </div>
          )}
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
                <label className="flex items-center gap-1.5 cursor-pointer text-sm font-medium ml-4 pl-4 border-l border-gray-200">
                  <input type="checkbox" data-testid="chk-eway-bill" className="accent-orange-600 w-4 h-4"
                    checked={isEwayBill}
                    onChange={e => {
                      const checked = e.target.checked;
                      setIsEwayBill(checked);
                      setItems(prev => prev.map(it => {
                        if (!it.item_id) return it;
                        const prod = (allProducts as any[]).find((p: any) => p.id === it.item_id);
                        if (!prod) return it;
                        const hsn = checked
                          ? (prod.hsnCodeEway ?? prod.hsn_code_eway ?? prod.hsnCode ?? prod.hsn_code ?? "")
                          : (prod.hsnCode ?? prod.hsn_code ?? "");
                        return hsn ? { ...it, hsn } : it;
                      }));
                    }} />
                  <span style={isEwayBill ? { color: SC.orange, fontWeight: 700 } : { color: "#555" }}>E-Way Bill HSN</span>
                </label>
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
                      <th className="px-2 py-2 text-left w-20">HSN</th>
                      <th className="px-2 py-2 text-left">Desp No</th>
                      <th className="px-2 py-2 text-left">Party DC</th>
                      <th className="px-2 py-2 text-left">Reference No</th>
                      <th className="px-2 py-2 text-left">Process</th>
                      <th className="px-2 py-2 text-left">Inw DN</th>
                      <th className="px-2 py-2 text-right w-20">Qty</th>
                      <th className="px-2 py-2 text-left w-16">Unit</th>
                      <th className="px-2 py-2 text-right w-24">Rate ₹</th>
                      <th className="px-2 py-2 text-right w-28">Taxable Amt ₹</th>
                      <th className="px-2 py-2 text-center w-20">{isInterState ? "IGST %" : "GST %"}</th>
                      {isInterState
                        ? <th className="px-2 py-2 text-right w-24">IGST ₹</th>
                        : <>
                            <th className="px-2 py-2 text-right w-24">CGST ₹</th>
                            <th className="px-2 py-2 text-right w-24">SGST ₹</th>
                          </>
                      }
                      <th className="px-2 py-2 text-right w-28">Tot.Amt ₹</th>
                      <th className="px-2 py-2 text-left w-28">Packing</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.length === 0 && (
                      <tr>
                        <td colSpan={isInterState ? 19 : 20} className="text-center py-8 text-gray-400 text-sm">
                          {activeFlow === "direct_only"
                            ? "Click \"+ Add Row\" below to add items manually"
                            : activeFlow === "inward_direct"
                            ? "Check an inward from the panel above to load items, or click \"+ Add Row\""
                            : "Select a despatch from the panel above to load items"}
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
                      const isManual = it._manual || !it.inward_item_id || activeFlow === "direct_only";
                      return (
                        <tr key={idx} className="border-b hover:bg-blue-50 transition-colors">
                          <td className="px-2 py-1 text-gray-500">{idx + 1}</td>
                          <td className="px-2 py-1 text-gray-600">{it.po_no || "—"}</td>
                          <td className="px-2 py-1 font-mono">
                            {isManual
                              ? <input value={it.item_code}
                                  data-testid={`input-item-code-${idx}`}
                                  className="border rounded px-1 py-0.5 text-xs font-mono w-24"
                                  placeholder="Code"
                                  onChange={e => {
                                    updateItem(realIdx, "item_code", e.target.value);
                                    const match = (allProducts as any[]).find((p: any) =>
                                      p.code?.toLowerCase() === e.target.value.toLowerCase()
                                    );
                                    if (match) {
                                      selectDirectItem(realIdx, match);
                                    }
                                  }} />
                              : it.item_code}
                          </td>
                          <td className="px-2 py-1 font-medium text-gray-800">
                            {isManual
                              ? <input
                                  data-testid={`input-item-name-${idx}`}
                                  className="border rounded px-1 py-0.5 text-xs w-40"
                                  placeholder="Search item..."
                                  value={directSearch[realIdx] !== undefined ? directSearch[realIdx] : it.item_name}
                                  onChange={e => {
                                    const r = (e.target as HTMLInputElement).getBoundingClientRect();
                                    setDropPos({ top: r.bottom, left: r.left, width: 260 });
                                    setDirectSearch(prev => ({ ...prev, [realIdx]: e.target.value }));
                                    updateItem(realIdx, "item_name", e.target.value);
                                    setDirectDrop(realIdx);
                                  }}
                                  onFocus={e => {
                                    const r = (e.target as HTMLInputElement).getBoundingClientRect();
                                    setDropPos({ top: r.bottom, left: r.left, width: 260 });
                                    setDirectDrop(realIdx);
                                  }}
                                  onBlur={() => setTimeout(() => { setDirectDrop(null); setDropPos(null); }, 200)}
                                />
                              : it.item_name}
                          </td>
                          <td className="px-2 py-1">
                            <input type="text"
                              data-testid={`input-hsn-${idx}`}
                              className="border rounded px-1 py-0.5 text-xs w-20 font-mono"
                              placeholder="HSN"
                              value={it.hsn || ""}
                              onChange={e => updateItem(realIdx, "hsn", e.target.value)} />
                          </td>
                          <td className="px-2 py-1" style={{ color: SC.primary }}>{it.despatch_voucher_no || "—"}</td>
                          <td className="px-2 py-1 text-gray-600">{it.party_dc || "—"}</td>
                          <td className="px-2 py-1 text-gray-700">{it.work_order_no || "—"}</td>
                          <td className="px-2 py-1 text-gray-700">
                            {isManual
                              ? <select
                                  data-testid={`input-process-${idx}`}
                                  className="border rounded px-1 py-0.5 text-xs w-28 bg-white"
                                  value={it.process || ""}
                                  onChange={e => updateItem(realIdx, "process", e.target.value)}>
                                  <option value="">— Process —</option>
                                  {(processList as any[]).filter((p: any) => p.is_active !== false).map((p: any) => (
                                    <option key={p.id} value={p.name}>{p.name}</option>
                                  ))}
                                </select>
                              : (it.process || "—")}
                          </td>
                          <td className="px-2 py-1" style={{ color: SC.primary }}>{it.inward_voucher_no || "—"}</td>
                          <td className="px-2 py-1 text-right font-semibold">
                            <input type="number" min={0} step="0.001"
                                data-testid={`input-qty-${idx}`}
                                className="border rounded px-1 py-0.5 text-xs text-right w-20"
                                value={it.qty_despatched || ""}
                                placeholder="0"
                                onChange={e => updateItem(realIdx, "qty_despatched", parseFloat(e.target.value || "0"))} />
                          </td>
                          <td className="px-2 py-1 text-gray-600">
                            {isManual
                              ? <select
                                  data-testid={`select-unit-${idx}`}
                                  className="border rounded px-1 py-0.5 text-xs bg-white w-16"
                                  value={it.unit}
                                  onChange={e => updateItem(realIdx, "unit", e.target.value)}>
                                  <option value="">—</option>
                                  {(uomList as any[]).filter((u: any) => u.isActive !== false).map((u: any) => (
                                    <option key={u.id} value={(u.shortForm || u.code || "").toUpperCase()}>{u.shortForm || u.code}</option>
                                  ))}
                                </select>
                              : it.unit}
                          </td>
                          <td className="px-2 py-1 text-right">
                            <input type="number" min={0} step="0.01"
                              data-testid={`input-rate-${idx}`}
                              className="border rounded px-1 py-0.5 text-xs text-right w-20"
                              value={rate || ""}
                              onChange={e => {
                                const r2 = parseFloat(e.target.value || "0");
                                const t2 = qty * r2;
                                // If tax rates are still 0 but item_id is known, look up from product master
                                let cgR = parseFloat(it.cgst_rate || 0);
                                let sgR = parseFloat(it.sgst_rate || 0);
                                let igR = parseFloat(it.igst_rate || 0);
                                if (cgR === 0 && it.item_id) {
                                  const prod = (allProducts as any[]).find((p: any) => p.id === it.item_id);
                                  if (prod) {
                                    cgR = parseFloat(prod.cgstRate ?? prod.cgst_rate ?? 0);
                                    sgR = parseFloat(prod.sgstRate ?? prod.sgst_rate ?? 0);
                                    igR = parseFloat(prod.igstRate ?? prod.igst_rate ?? 0) || (cgR + sgR);
                                  }
                                }
                                setItems(prev => prev.map((row, i) => i === realIdx ? {
                                  ...row, rate: r2, amount: t2,
                                  cgst_rate: cgR, sgst_rate: sgR, igst_rate: igR,
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
                                ? parseFloat(it.igst_rate ?? 0)
                                : parseFloat(it.cgst_rate ?? 0) * 2}
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
                          <td className="px-2 py-1">
                            <input type="text"
                              data-testid={`input-packing-${idx}`}
                              className="border rounded px-1 py-0.5 text-xs w-24"
                              placeholder="e.g. 2 Boxes"
                              value={it.packing_details || ""}
                              onChange={e => updateItem(realIdx, "packing_details", e.target.value)} />
                          </td>
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

            {/* Footer: Remove all + Add Row (direct) + Totals */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  data-testid="btn-remove-all"
                  onClick={removeAllItems}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50 transition-colors">
                  <Trash2 size={13} /> Remove all
                </button>
                {(invoiceType === "direct_invoice" || activeFlow === "direct_only") && (
                  <button
                    data-testid="btn-add-direct-row"
                    onClick={addDirectRow}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded hover:bg-blue-50 transition-colors"
                    style={{ color: SC.primary, borderColor: SC.primary }}>
                    <Plus size={13} /> Add Row
                  </button>
                )}
              </div>
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
              onClick={() => {
                if (window.confirm("Cancel this invoice? This will reverse the ledger entries and mark the invoice as Cancelled.")) {
                  deleteMut.mutate(editingId);
                }
              }}
              className="px-4 py-2 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors">
              Cancel Invoice
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

      {/* Item autocomplete dropdown — portalled to document.body to escape all overflow/z-index */}
      {directDrop !== null && dropPos && (() => {
        const q = (directSearch[directDrop] || "").toLowerCase().trim();
        if (!q) return null;
        const hits = (allProducts as any[]).filter((p: any) =>
          p.isActive !== false &&
          (p.name?.toLowerCase().includes(q) || p.code?.toLowerCase().includes(q))
        ).slice(0, 12);
        if (!hits.length) return null;
        const rowIdx = directDrop;
        return createPortal(
          <div
            style={{
              position: "fixed",
              top: dropPos.top + 2,
              left: dropPos.left,
              width: dropPos.width,
              zIndex: 99999,
            }}
            className="bg-white border border-gray-200 rounded-lg shadow-2xl max-h-52 overflow-y-auto">
            {hits.map((p: any) => (
              <div key={p.id}
                className="px-3 py-2 text-xs cursor-pointer hover:bg-blue-50 border-b last:border-0 flex justify-between items-center"
                onMouseDown={e => {
                  e.preventDefault();
                  selectDirectItem(rowIdx, p);
                }}>
                <div>
                  <span className="font-mono text-gray-500 mr-1.5">{p.code}</span>
                  <span className="font-medium text-gray-800">{p.name}</span>
                </div>
                {parseFloat(p.selling_price) > 0 && (
                  <span className="text-gray-400 ml-2 shrink-0">₹{parseFloat(p.selling_price).toLocaleString("en-IN")}</span>
                )}
              </div>
            ))}
          </div>,
          document.body
        );
      })()}
    </div>
  );
}

// ── Job Work Invoice List (default export) ────────────────────────────────────
export default function JobWorkInvoice() {
  const PAGE_SIZE = 15;
  const [view, setView] = useState<"list" | "form">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data: records = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/job-work-invoice"] });

  const filtered = records.filter((r: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.voucher_no?.toLowerCase().includes(q) ||
      r.party_name_db?.toLowerCase().includes(q) ||
      r.party_name_manual?.toLowerCase().includes(q) ||
      r.invoice_date?.includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages);
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
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
            {pageRows.map((r: any, i: number) => (
              <tr key={r.id} className={`border-t border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                data-testid={`row-invoice-${r.id}`}>
                <td className="px-5 py-2.5 text-gray-500">{(safePage - 1) * PAGE_SIZE + i + 1}</td>
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
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                    r.status === "Saved"      ? "bg-green-50 text-green-700"  :
                    r.status === "Cancelled"  ? "bg-red-50 text-red-600"      :
                                               "bg-yellow-50 text-yellow-700"
                  }`}>
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

        {/* Pagination */}
        {!isLoading && filtered.length > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/50">
            <span className="text-xs text-gray-500">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length} records
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(1)} disabled={safePage === 1}
                className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100">«</button>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100">‹</button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  p === "..." ? (
                    <span key={`e${idx}`} className="px-2 py-1 text-xs text-gray-400">…</span>
                  ) : (
                    <button key={p} onClick={() => setPage(p as number)}
                      className={`px-2.5 py-1 text-xs rounded border ${safePage === p ? "text-white border-transparent" : "border-gray-200 hover:bg-gray-100"}`}
                      style={safePage === p ? { background: "#027fa5" } : {}}>
                      {p}
                    </button>
                  )
                )}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100">›</button>
              <button onClick={() => setPage(totalPages)} disabled={safePage === totalPages}
                className="px-2 py-1 text-xs rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-100">»</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
