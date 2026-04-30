import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, PencilLine, Printer, Info, ChevronDown, Search, FileEdit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };
const today = () => new Date().toISOString().split("T")[0];
const fmt = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const n2 = (v: number) => v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TAX_CODES: Record<string, { cgst: number; sgst: number; igst: number }> = {
  "GST0":  { cgst: 0,   sgst: 0,   igst: 0  },
  "GST3":  { cgst: 1.5, sgst: 1.5, igst: 3  },
  "GST5":  { cgst: 2.5, sgst: 2.5, igst: 5  },
  "GST12": { cgst: 6,   sgst: 6,   igst: 12 },
  "GST18": { cgst: 9,   sgst: 9,   igst: 18 },
  "GST28": { cgst: 14,  sgst: 14,  igst: 28 },
};

type PoaItem = {
  _key: string; item_id: string; item_code: string; item_name: string;
  qty: string; unit: string; rate: string; taxable_amt: string;
  tax_code: string; cgst_pct: string; sgst_pct: string; igst_pct: string;
  cgst_amt: string; sgst_amt: string; igst_amt: string; total: string;
};
type PoaTerm   = { _key: string; term_type: string; terms: string };
type PoaCharge = { _key: string; charge_type: string; amount: string };

function newItem(): PoaItem {
  return { _key: crypto.randomUUID(), item_id: "", item_code: "", item_name: "",
    qty: "", unit: "", rate: "", taxable_amt: "",
    tax_code: "", cgst_pct: "0", sgst_pct: "0", igst_pct: "0",
    cgst_amt: "0", sgst_amt: "0", igst_amt: "0", total: "0" };
}
function newTerm():   PoaTerm   { return { _key: crypto.randomUUID(), term_type: "", terms: "" }; }
function newCharge(): PoaCharge { return { _key: crypto.randomUUID(), charge_type: "", amount: "0" }; }

function recalcItem(row: PoaItem, isInterState = false): PoaItem {
  const qty = parseFloat(row.qty) || 0;
  const rate = parseFloat(row.rate) || 0;
  const taxable = qty * rate;
  const tc = TAX_CODES[row.tax_code];
  const cgstPct = tc ? tc.cgst : parseFloat(row.cgst_pct) || 0;
  const sgstPct = tc ? tc.sgst : parseFloat(row.sgst_pct) || 0;
  const igstPct = tc ? tc.igst : parseFloat(row.igst_pct) || 0;
  const cgstAmt = isInterState ? 0 : taxable * cgstPct / 100;
  const sgstAmt = isInterState ? 0 : taxable * sgstPct / 100;
  const igstAmt = isInterState ? taxable * igstPct / 100 : 0;
  return {
    ...row, taxable_amt: taxable.toFixed(2),
    cgst_pct: String(cgstPct), sgst_pct: String(sgstPct), igst_pct: String(igstPct),
    cgst_amt: cgstAmt.toFixed(2), sgst_amt: sgstAmt.toFixed(2), igst_amt: igstAmt.toFixed(2),
    total: (taxable + cgstAmt + sgstAmt + igstAmt).toFixed(2),
  };
}

function mapPoItems(raw: any[]): PoaItem[] {
  return raw.map(it => ({
    _key: crypto.randomUUID(), item_id: it.item_id||"", item_code: it.item_code||"",
    item_name: it.item_name||"", qty: String(it.qty||""), unit: it.unit||"",
    rate: String(it.rate||""), taxable_amt: String(it.taxable_amt||"0"),
    tax_code: it.tax_code||"", cgst_pct: String(it.cgst_pct||"0"),
    sgst_pct: String(it.sgst_pct||"0"), igst_pct: String(it.igst_pct||"0"),
    cgst_amt: String(it.cgst_amt||"0"), sgst_amt: String(it.sgst_amt||"0"),
    igst_amt: String(it.igst_amt||"0"), total: String(it.total||"0"),
  }));
}

// ── Amendment Form ───────────────────────────────────────────────────────────
function PoaForm({ editData, onBack }: { editData?: any; onBack: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!editData?.id;

  const { data: purchaseOrders = [] } = useQuery<any[]>({ queryKey: ["/api/purchase-orders"] });
  const { data: suppliers = [] }      = useQuery<any[]>({ queryKey: ["/api/suppliers"] });
  const { data: products = [] }       = useQuery<any[]>({ queryKey: ["/api/products"] });
  const { data: termTypes = [] }      = useQuery<any[]>({ queryKey: ["/api/term-types"] });
  const { data: allTerms = [] }       = useQuery<any[]>({ queryKey: ["/api/terms"] });
  const { data: expenseSleds = [] }   = useQuery<any[]>({ queryKey: ["/api/sub-ledgers/expense"] });

  const [voucherNo,    setVoucherNo]    = useState(editData?.voucher_no || "");
  const [amendDate,    setAmendDate]    = useState(editData?.amendment_date?.split("T")[0] || today());
  const [sourcePo,     setSourcePo]     = useState<any>(null);
  const [sourcePoSearch, setSourcePoSearch] = useState(editData?.original_po_no || "");
  const [sourcePoOpen, setSourcePoOpen] = useState(false);
  const [suppId,       setSuppId]       = useState(editData?.supplier_id || "");
  const [suppSearch,   setSuppSearch]   = useState(editData?.supplier_name_db || editData?.supplier_name_manual || "");
  const [suppOpen,     setSuppOpen]     = useState(false);

  // Validate suppId: clear if not a real supplier UUID (e.g. stale sub-ledger ID)
  const validSuppId = suppId && (suppliers as any[]).some((s: any) => s.id === suppId) ? suppId : "";
  const [poType,       setPoType]       = useState(editData?.po_type || "Purchase Order");
  const [schedDate,    setSchedDate]    = useState(editData?.schedule_date?.split("T")[0] || "");
  const [priority,     setPriority]     = useState(editData?.priority || "Medium");
  const [payMode,      setPayMode]      = useState(editData?.payment_mode || "Cash");
  const [purchaseType, setPurchaseType] = useState(editData?.purchase_type || "within_state");
  const [ourRef,       setOurRef]       = useState(editData?.our_ref_no || "");
  const [yourRef,      setYourRef]      = useState(editData?.your_ref_no || "");
  const [delivLoc,     setDelivLoc]     = useState(editData?.delivery_location || "");
  const [remark,       setRemark]       = useState(editData?.remark || "");
  const [tab,          setTab]          = useState<"items"|"terms">("items");
  const { toast } = useToast();
  const [loading,      setLoading]      = useState(false);

  const [items,   setItems]   = useState<PoaItem[]>(editData?.items?.length ? mapPoItems(editData.items) : [newItem()]);
  const [terms,   setTerms]   = useState<PoaTerm[]>(editData?.terms?.length ? editData.terms.map((t: any) => ({ _key: crypto.randomUUID(), term_type: t.term_type||"", terms: t.terms||"" })) : [newTerm()]);
  const [charges, setCharges] = useState<PoaCharge[]>(editData?.charges?.length ? editData.charges.map((c: any) => ({ _key: crypto.randomUUID(), charge_type: c.charge_type||"", amount: String(c.amount||"0") })) : [newCharge()]);

  const [itemSearch, setItemSearch] = useState<Record<string, string>>({});
  const [itemDropOpen, setItemDropOpen] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEdit) {
      fetch("/api/voucher-series/next/purchase_order_amendment", { credentials: "include" })
        .then(r => r.json()).then(d => { if (d.voucher_no) setVoucherNo(d.voucher_no); });
    }
  }, []);

  useEffect(() => {
    function h(e: MouseEvent) { if (!containerRef.current?.contains(e.target as Node)) { setSourcePoOpen(false); setItemDropOpen(null); setSuppOpen(false); } }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    const inter = purchaseType === "inter_state";
    setItems(prev => prev.map(r => recalcItem(r, inter)));
  }, [purchaseType]);

  // Load PO data when a source PO is selected
  async function loadSourcePo(po: any) {
    setSourcePo(po);
    setSourcePoSearch(po.voucher_no);
    setSourcePoOpen(false);
    setLoading(true);
    try {
      const res = await fetch(`/api/purchase-orders/${po.id}`, { credentials: "include" });
      const data = await res.json();
      setSuppId(data.supplier_id || "");
      setSuppSearch(data.supplier_name_db || data.supplier_name_manual || "");
      setPoType(data.po_type || "Purchase Order");
      setSchedDate(data.schedule_date?.split("T")[0] || "");
      setPriority(data.priority || "Medium");
      setPayMode(data.payment_mode || "Cash");
      setOurRef(data.our_ref_no || "");
      setYourRef(data.your_ref_no || "");
      setDelivLoc(data.delivery_location || "");
      setRemark(data.remark || "");
      setItems(data.items?.length ? mapPoItems(data.items) : [newItem()]);
      setTerms(data.terms?.length ? data.terms.map((t: any) => ({ _key: crypto.randomUUID(), term_type: t.term_type||"", terms: t.terms||"" })) : [newTerm()]);
      setCharges(data.charges?.length ? data.charges.map((c: any) => ({ _key: crypto.randomUUID(), charge_type: c.charge_type||"", amount: String(c.amount||"0") })) : [newCharge()]);
    } finally { setLoading(false); }
  }

  function pickProduct(key: string, prod: any) {
    const inter = purchaseType === "inter_state";
    setItems(prev => prev.map(r => {
      if (r._key !== key) return r;
      const taxCode = prod.cgst_rate && prod.sgst_rate
        ? Object.entries(TAX_CODES).find(([, v]) => Math.abs(v.cgst - parseFloat(prod.cgst_rate)) < 0.1)?.[0] || ""
        : "";
      const rate = parseFloat(prod.purchase_price) || parseFloat(prod.cost_price) || 0;
      const updated: PoaItem = {
        ...r, item_id: prod.id, item_code: prod.code||"", item_name: prod.name,
        unit: prod.uom||prod.unit||"", rate: String(rate),
        tax_code: taxCode, cgst_pct: String(prod.cgst_rate||"0"),
        sgst_pct: String(prod.sgst_rate||"0"), igst_pct: String(prod.igst_rate||"0"),
      };
      return recalcItem(updated, inter);
    }));
    setItemSearch(prev => ({ ...prev, [key]: prod.name }));
    setItemDropOpen(null);
  }

  function updateItemField(key: string, field: keyof PoaItem, val: string) {
    const inter = purchaseType === "inter_state";
    setItems(prev => prev.map(r => {
      if (r._key !== key) return r;
      let updated = { ...r, [field]: val };
      if (field === "tax_code") {
        const tc = TAX_CODES[val];
        if (tc) { updated.cgst_pct = String(tc.cgst); updated.sgst_pct = String(tc.sgst); updated.igst_pct = String(tc.igst); }
      }
      return recalcItem(updated, inter);
    }));
  }

  // Totals
  const totalQty     = items.reduce((s, r) => s + (parseFloat(r.qty)||0), 0);
  const totalTaxable = items.reduce((s, r) => s + (parseFloat(r.taxable_amt)||0), 0);
  const totalCgst    = items.reduce((s, r) => s + (parseFloat(r.cgst_amt)||0), 0);
  const totalSgst    = items.reduce((s, r) => s + (parseFloat(r.sgst_amt)||0), 0);
  const totalIgst    = items.reduce((s, r) => s + (parseFloat(r.igst_amt)||0), 0);
  const totalTax     = totalCgst + totalSgst + totalIgst;
  const grandTotal   = totalTaxable + totalTax + charges.reduce((s, c) => s + (parseFloat(c.amount)||0), 0);

  type TaxRow = { label: string; pct: number; amt: number };
  const taxBreakdown: TaxRow[] = [];
  if (totalCgst > 0) {
    [...new Set(items.map(r => parseFloat(r.cgst_pct)||0))].forEach(pct => {
      const amt = items.filter(r => parseFloat(r.cgst_pct)===pct).reduce((s,r) => s+(parseFloat(r.cgst_amt)||0),0);
      if (amt > 0) taxBreakdown.push({ label:"CGST", pct, amt });
    });
  }
  if (totalSgst > 0) {
    [...new Set(items.map(r => parseFloat(r.sgst_pct)||0))].forEach(pct => {
      const amt = items.filter(r => parseFloat(r.sgst_pct)===pct).reduce((s,r) => s+(parseFloat(r.sgst_amt)||0),0);
      if (amt > 0) taxBreakdown.push({ label:"SGST", pct, amt });
    });
  }
  if (totalIgst > 0) {
    [...new Set(items.map(r => parseFloat(r.igst_pct)||0))].forEach(pct => {
      const amt = items.filter(r => parseFloat(r.igst_pct)===pct).reduce((s,r) => s+(parseFloat(r.igst_amt)||0),0);
      if (amt > 0) taxBreakdown.push({ label:"IGST", pct, amt });
    });
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        amendment_date: amendDate,
        original_po_id: sourcePo?.id || editData?.original_po_id || null,
        original_po_no: sourcePo?.voucher_no || editData?.original_po_no || "",
        supplier_id: validSuppId||null, supplier_name_manual: validSuppId ? "" : suppSearch,
        po_type: poType, schedule_date: schedDate||null, priority, payment_mode: payMode,
        purchase_type: purchaseType,
        our_ref_no: ourRef, your_ref_no: yourRef, delivery_location: delivLoc,
        remark, status: "Draft",
        items: items.map(r => ({
          item_id: r.item_id||null, item_code: r.item_code, item_name: r.item_name,
          qty: parseFloat(r.qty)||0, unit: r.unit, rate: parseFloat(r.rate)||0,
          taxable_amt: parseFloat(r.taxable_amt)||0, tax_code: r.tax_code,
          cgst_pct: parseFloat(r.cgst_pct)||0, sgst_pct: parseFloat(r.sgst_pct)||0,
          igst_pct: parseFloat(r.igst_pct)||0, cgst_amt: parseFloat(r.cgst_amt)||0,
          sgst_amt: parseFloat(r.sgst_amt)||0, igst_amt: parseFloat(r.igst_amt)||0,
          total: parseFloat(r.total)||0,
        })),
        terms:   terms.map(t => ({ term_type: t.term_type, terms: t.terms })),
        charges: charges.map(c => ({ charge_type: c.charge_type, amount: parseFloat(c.amount)||0 })),
      };
      const url = isEdit ? `/api/purchase-order-amendments/${editData.id}` : "/api/purchase-order-amendments";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: (data) => {
      if (!isEdit && data.voucher_no) setVoucherNo(data.voucher_no);
      qc.invalidateQueries({ queryKey: ["/api/purchase-order-amendments"] });
      onBack();
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const filteredPOs = (purchaseOrders as any[]).filter((po: any) =>
    !sourcePoSearch || po.voucher_no?.toLowerCase().includes(sourcePoSearch.toLowerCase()) ||
    (po.supplier_name_db||"").toLowerCase().includes(sourcePoSearch.toLowerCase())
  );
  const filteredSuppliers = (suppliers as any[]).filter((s: any) =>
    !suppSearch || s.name?.toLowerCase().includes(suppSearch.toLowerCase())
  );

  const tabBtn = (id: "items"|"terms", label: string) => (
    <button onClick={() => setTab(id)}
      className="px-5 py-2 text-sm font-semibold rounded-t-lg transition-colors flex-shrink-0"
      style={tab === id ? { background: SC.primary, color: "#fff" } : { background: "#f0f9ff", color: SC.primary, border: `1px solid ${SC.primary}` }}
      data-testid={`tab-${id}`}>{label}</button>
  );

  return (
    <div ref={containerRef} className="p-4 md:p-6" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-sm">

        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <FileEdit size={16} style={{ color: SC.primary }} />
            Purchase Order Amendment
          </h2>
          <div className="flex items-center gap-2">
            <button className="p-1.5 text-gray-400 hover:text-gray-600"><Printer size={15}/></button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600"><Info size={15}/></button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">

          {/* Row 1 — POA No | POA Date | Source PO | PO Type */}
          <div className="grid grid-cols-4 gap-3">
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">POA No</label>
              <input value={voucherNo} readOnly
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm font-semibold bg-gray-50 outline-none"
                style={{ color: SC.primary }} data-testid="input-poa-no"/>
            </div>
            <DatePicker label="POA Date" value={amendDate} onChange={setAmendDate}/>

            {/* Source PO dropdown */}
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Source PO</label>
              <div className="relative">
                <input value={sourcePoSearch}
                  onChange={e => { setSourcePoSearch(e.target.value); setSourcePoOpen(true); }}
                  onFocus={() => setSourcePoOpen(true)}
                  placeholder="Search PO No..."
                  className="w-full border border-gray-300 rounded px-3 py-2.5 pr-8 text-sm outline-none focus:border-[#027fa5]"
                  data-testid="input-source-po"/>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
              </div>
              {sourcePoOpen && filteredPOs.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-52 overflow-y-auto mt-0.5">
                  {filteredPOs.slice(0, 10).map((po: any) => (
                    <button key={po.id} onClick={() => loadSourcePo(po)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#d2f1fa] border-b last:border-0"
                      data-testid={`opt-po-${po.id}`}>
                      <div className="font-semibold text-[#027fa5]">{po.voucher_no}</div>
                      <div className="text-xs text-gray-500">{po.supplier_name_db || po.supplier_name_manual} · {fmt(po.po_date)}</div>
                    </button>
                  ))}
                </div>
              )}
              {sourcePoOpen && filteredPOs.length === 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-30 p-3 text-sm text-gray-400 mt-0.5">
                  No purchase orders found
                </div>
              )}
            </div>

            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">PO Type</label>
              <input value={poType} onChange={e => setPoType(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                data-testid="input-po-type"/>
            </div>
          </div>

          {/* Row 2 — Supplier | Exp Date | Priority | Cash/Credit | Tabs */}
          <div className="flex gap-3 items-center flex-wrap">
            {/* Supplier */}
            <div className="relative w-56">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Supplier Name</label>
              <div className="relative">
                <input value={suppSearch}
                  onChange={e => { setSuppSearch(e.target.value); setSuppId(""); setSuppOpen(true); }}
                  onFocus={() => setSuppOpen(true)}
                  className="w-full border border-gray-300 rounded px-3 py-2.5 pr-8 text-sm outline-none focus:border-[#027fa5]"
                  data-testid="input-supplier"/>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
              </div>
              {suppOpen && filteredSuppliers.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto mt-0.5">
                  {filteredSuppliers.slice(0, 20).map((s: any) => (
                    <button key={s.id} onClick={() => { setSuppId(s.id); setSuppSearch(s.name); setSuppOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#d2f1fa]">
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="w-44">
              <DatePicker label="Exp Date" value={schedDate} onChange={setSchedDate}/>
            </div>
            <div className="relative w-36">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5] bg-white appearance-none pr-7"
                data-testid="select-priority">
                {["High","Medium","Low"].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
            </div>
            <div className="flex items-center gap-4 px-2">
              {["Cash","Credit"].map(m => (
                <label key={m} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="pay_mode" checked={payMode===m} onChange={() => setPayMode(m)}
                    className="accent-[#d74700]" data-testid={`radio-${m.toLowerCase()}`}/>
                  <span className="text-sm font-medium text-gray-700">{m}</span>
                </label>
              ))}
            </div>
            {/* Within State / Inter State */}
            <div className="flex items-center gap-1 px-1">
              <span className="text-xs text-gray-500 font-medium mr-1">Purchase:</span>
              {[{val:"within_state",label:"Within State"},{val:"inter_state",label:"Inter State"}].map(opt => (
                <label key={opt.val} className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" name="purchase_type_amend" checked={purchaseType===opt.val}
                    onChange={() => setPurchaseType(opt.val)}
                    className="accent-[#027fa5]" data-testid={`radio-amend-${opt.val}`}/>
                  <span className="text-sm font-medium text-gray-700 mr-2">{opt.label}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-1 ml-auto">
              {tabBtn("items","Items Details")}
              {tabBtn("terms","Terms")}
            </div>
          </div>

          {/* Source PO info banner */}
          {(sourcePo || editData?.original_po_no) && (
            <div className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm"
              style={{ background: SC.tonal, borderLeft: `3px solid ${SC.primary}` }}>
              <FileEdit size={14} style={{ color: SC.primary }}/>
              <span className="font-semibold" style={{ color: SC.primary }}>
                Amending PO: {sourcePo?.voucher_no || editData?.original_po_no}
              </span>
              {loading && <span className="text-xs text-gray-500">Loading PO data…</span>}
              <span className="text-gray-500 text-xs">Edit any fields below and save to record the amendment</span>
            </div>
          )}

          {/* ── Items Details Tab ─────────────────────────────────────────── */}
          {tab === "items" && (
            <>
              <div className="border border-gray-200 rounded-lg overflow-visible">
                <div className="grid text-xs font-semibold text-gray-600 bg-gray-50 border-b"
                  style={{ gridTemplateColumns: "36px 90px 1fr 60px 55px 70px 90px 90px 90px 80px 90px 36px" }}>
                  {["S.No","Item Code","Item Name","Qty","Unit","Rate ₹","Taxable ₹","CGST ₹","SGST ₹","IGST ₹","Total ₹",""].map(h => (
                    <div key={h} className="px-1.5 py-2">{h}</div>
                  ))}
                </div>

                {items.map((row, idx) => {
                  const search = itemSearch[row._key] ?? row.item_name;
                  const filtered = (products as any[]).filter((p: any) =>
                    !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.code?.toLowerCase().includes(search.toLowerCase())
                  );
                  return (
                    <div key={row._key} className="grid items-center border-b last:border-0 hover:bg-gray-50"
                      style={{ gridTemplateColumns: "36px 90px 1fr 60px 55px 70px 90px 90px 90px 80px 90px 36px" }}>
                      <div className="px-1.5 py-1.5 text-xs text-gray-500 text-center">{String(idx+1).padStart(2,"0")}</div>
                      <div className="px-1 py-1">
                        <input value={row.item_code} readOnly
                          className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs bg-gray-50 outline-none"
                          data-testid={`input-code-${idx}`}/>
                      </div>
                      <div className="px-1 py-1 relative">
                        <input value={search}
                          onChange={e => { setItemSearch(p => ({...p,[row._key]:e.target.value})); updateItemField(row._key,"item_name",e.target.value); setItemDropOpen(row._key); }}
                          onFocus={() => setItemDropOpen(row._key)}
                          placeholder="Search item..."
                          className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs outline-none focus:border-[#027fa5]"
                          data-testid={`input-name-${idx}`}/>
                        {itemDropOpen===row._key && filtered.length > 0 && (
                          <div className="absolute top-full left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto min-w-[260px]">
                            {filtered.slice(0,12).map((p: any) => (
                              <button key={p.id} onClick={() => pickProduct(row._key, p)}
                                className="w-full text-left px-2 py-1.5 text-xs hover:bg-[#d2f1fa]">
                                <span className="font-semibold text-[#027fa5]">{p.code}</span>
                                <span className="mx-1 text-gray-400">—</span>{p.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="px-1 py-1">
                        <input type="number" value={row.qty}
                          onChange={e => updateItemField(row._key,"qty",e.target.value)}
                          className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs text-right outline-none focus:border-[#027fa5]"
                          data-testid={`input-qty-${idx}`}/>
                      </div>
                      <div className="px-1 py-1">
                        <input value={row.unit} onChange={e => updateItemField(row._key,"unit",e.target.value)}
                          className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs outline-none focus:border-[#027fa5]"
                          data-testid={`input-unit-${idx}`}/>
                      </div>
                      <div className="px-1 py-1">
                        <input type="number" value={row.rate}
                          onChange={e => updateItemField(row._key,"rate",e.target.value)}
                          className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs text-right outline-none focus:border-[#027fa5]"
                          data-testid={`input-rate-${idx}`}/>
                      </div>
                      <div className="px-1.5 py-1.5 text-xs text-right text-gray-700">
                        {parseFloat(row.taxable_amt) > 0 ? n2(parseFloat(row.taxable_amt)) : "—"}
                      </div>
                      <div className="px-1.5 py-1.5 text-xs text-right text-gray-600">
                        {parseFloat(row.cgst_amt) > 0 ? `${n2(parseFloat(row.cgst_amt))}(${row.cgst_pct}%)` : "—"}
                      </div>
                      <div className="px-1.5 py-1.5 text-xs text-right text-gray-600">
                        {parseFloat(row.sgst_amt) > 0 ? `${n2(parseFloat(row.sgst_amt))}(${row.sgst_pct}%)` : "—"}
                      </div>
                      <div className="px-1.5 py-1.5 text-xs text-right text-gray-600">
                        {parseFloat(row.igst_amt) > 0 ? `${n2(parseFloat(row.igst_amt))}(${row.igst_pct}%)` : "—"}
                      </div>
                      <div className="px-1.5 py-1.5 text-xs text-right font-semibold text-gray-800">
                        {parseFloat(row.total) > 0 ? n2(parseFloat(row.total)) : "—"}
                      </div>
                      <div className="px-1 flex justify-center">
                        {idx === items.length-1
                          ? <button onClick={() => setItems(p => [...p, newItem()])} className="text-green-600 hover:text-green-800 p-1" data-testid={`btn-add-${idx}`}><Plus size={13}/></button>
                          : <button onClick={() => setItems(p => p.filter(r => r._key!==row._key))} className="text-red-400 hover:text-red-600 p-1" data-testid={`btn-rm-${idx}`}><Trash2 size={13}/></button>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between px-2 py-1 text-sm border-t border-gray-100">
                <div className="flex items-center gap-4">
                  <button onClick={() => setItems([newItem()])} className="text-xs text-red-500 hover:text-red-700 font-semibold" data-testid="btn-remove-all">Remove all</button>
                  <span className="text-gray-600 text-xs">Total Quantity : <span className="font-bold text-gray-800">{totalQty > 0 ? totalQty.toLocaleString("en-IN",{maximumFractionDigits:3}) : "—"}</span></span>
                  <span className="text-gray-600 text-xs">Tax Amount : <span className="font-bold text-gray-800">{totalTax > 0 ? `₹ ${n2(totalTax)}` : "—"}</span></span>
                </div>
                <span className="font-bold text-gray-800 text-sm">Grand Total : <span style={{ color: SC.primary }}>₹ {n2(grandTotal)}</span></span>
              </div>
            </>
          )}

          {/* ── Terms Tab ────────────────────────────────────────────────── */}
          {tab === "terms" && (
            <>
              <div className="flex gap-4">
                <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden">
                  <div className="grid text-xs font-semibold text-gray-600 bg-gray-50 border-b"
                    style={{ gridTemplateColumns: "36px 1fr 1fr 30px" }}>
                    {["S.No","Term Types","Terms",""].map(h => <div key={h} className="px-2 py-2">{h}</div>)}
                  </div>
                  {terms.map((t, idx) => {
                    const selectedTT = (termTypes as any[]).find((tt: any) => tt.name === t.term_type || tt.id === t.term_type);
                    const filteredTerms = (allTerms as any[]).filter((tr: any) => !selectedTT || tr.term_type_id === selectedTT.id);
                    return (
                      <div key={t._key} className="grid items-center border-b last:border-0"
                        style={{ gridTemplateColumns: "36px 1fr 1fr 30px" }}>
                        <div className="px-2 py-1.5 text-xs text-gray-500">{String(idx+1).padStart(2,"0")}</div>
                        <div className="px-1 py-1">
                          <select value={t.term_type}
                            onChange={e => setTerms(prev => prev.map(r => r._key===t._key ? {...r,term_type:e.target.value,terms:""} : r))}
                            className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs outline-none bg-white">
                            <option value="">Select Type</option>
                            {(termTypes as any[]).filter((tt: any) => tt.is_active !== false).map((tt: any) => (
                              <option key={tt.id} value={tt.name}>{tt.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="px-1 py-1">
                          <select value={t.terms}
                            onChange={e => setTerms(prev => prev.map(r => r._key===t._key ? {...r,terms:e.target.value} : r))}
                            className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs outline-none bg-white">
                            <option value="">Select Terms</option>
                            {filteredTerms.map((tr: any) => <option key={tr.id} value={tr.name}>{tr.name}</option>)}
                          </select>
                        </div>
                        <div className="flex justify-center">
                          {idx===terms.length-1
                            ? <button onClick={() => setTerms(p=>[...p,newTerm()])} className="text-green-600 p-1"><Plus size={12}/></button>
                            : <button onClick={() => setTerms(p=>p.filter(r=>r._key!==t._key))} className="text-red-400 p-1"><Trash2 size={12}/></button>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="w-72 border border-gray-200 rounded-lg overflow-hidden">
                  <div className="grid text-xs font-semibold text-gray-600 bg-gray-50 border-b"
                    style={{ gridTemplateColumns: "36px 1fr 80px 30px" }}>
                    {["S.No","Other Charges","Amount ₹",""].map(h => <div key={h} className="px-2 py-2">{h}</div>)}
                  </div>
                  {charges.map((c, idx) => (
                    <div key={c._key} className="grid items-center border-b last:border-0"
                      style={{ gridTemplateColumns: "36px 1fr 80px 30px" }}>
                      <div className="px-2 py-1.5 text-xs text-gray-500">{String(idx+1).padStart(2,"0")}</div>
                      <div className="px-1 py-1">
                        <select value={c.charge_type}
                          onChange={e => setCharges(prev => prev.map(r => r._key===c._key ? {...r,charge_type:e.target.value} : r))}
                          className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs outline-none bg-white">
                          <option value="">Select Charges</option>
                          {(expenseSleds as any[]).map((sl: any) => (
                            <option key={sl.id} value={sl.name}>{sl.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="px-1 py-1">
                        <input type="number" value={c.amount}
                          onChange={e => setCharges(prev => prev.map(r => r._key===c._key ? {...r,amount:e.target.value} : r))}
                          className="w-full border border-gray-200 rounded px-1.5 py-1 text-xs text-right outline-none focus:border-[#027fa5]"/>
                      </div>
                      <div className="flex justify-center">
                        {idx===charges.length-1
                          ? <button onClick={() => setCharges(p=>[...p,newCharge()])} className="text-green-600 p-1"><Plus size={12}/></button>
                          : <button onClick={() => setCharges(p=>p.filter(r=>r._key!==c._key))} className="text-red-400 p-1"><Trash2 size={12}/></button>}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="w-56 space-y-3">
                  {[{ label:"Our Ref No", val:ourRef, set:setOurRef, id:"input-our-ref" },
                    { label:"Your Ref No", val:yourRef, set:setYourRef, id:"input-your-ref" }].map(f => (
                    <div key={f.id} className="relative">
                      <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10">{f.label}</label>
                      <input value={f.val} onChange={e => f.set(e.target.value)}
                        className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                        data-testid={f.id}/>
                    </div>
                  ))}
                  <div className="relative">
                    <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10">Delivery Location</label>
                    <textarea value={delivLoc} onChange={e => setDelivLoc(e.target.value)} rows={3}
                      className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5] resize-none"
                      data-testid="input-deliv-loc"/>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-2 py-1 text-sm border-t border-gray-100">
                <span className="text-xs text-gray-600">Total Amount : <span className="font-bold text-gray-800">{totalTaxable > 0 ? `₹ ${n2(totalTaxable)}` : "—"}</span></span>
                <span className="text-xs text-gray-600">Tax Amount : <span className="font-bold text-gray-800">{totalTax > 0 ? `₹ ${n2(totalTax)}` : "—"}</span></span>
                <span className="font-bold text-sm text-gray-800">Grand Total : <span style={{ color: SC.primary }}>₹ {n2(grandTotal)}</span></span>
              </div>
            </>
          )}

          {/* Tax breakdown */}
          {taxBreakdown.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden w-80">
              <div className="grid text-xs font-semibold text-gray-600 bg-gray-50 border-b"
                style={{ gridTemplateColumns: "36px 1fr 70px 90px" }}>
                {["S.No","Tax Setup","%","Amount ₹"].map(h => <div key={h} className="px-2 py-2">{h}</div>)}
              </div>
              {taxBreakdown.map((tb, idx) => (
                <div key={idx} className="grid border-b last:border-0"
                  style={{ gridTemplateColumns: "36px 1fr 70px 90px" }}>
                  <div className="px-2 py-1.5 text-xs text-gray-500">{String(idx+1).padStart(2,"0")}</div>
                  <div className="px-2 py-1.5 text-xs font-medium text-gray-700">{tb.label}</div>
                  <div className="px-2 py-1.5 text-xs text-right text-gray-600">{tb.pct.toFixed(2)}</div>
                  <div className="px-2 py-1.5 text-xs text-right font-semibold text-gray-800">{n2(tb.amt)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

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
function PoaList({ onNew, onEdit }: { onNew: () => void; onEdit: (d: any) => void }) {
  const { data: list = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/purchase-order-amendments"] });
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const delMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/purchase-order-amendments/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/purchase-order-amendments"] }),
  });

  const filtered = (list as any[]).filter((r: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (r.voucher_no||"").toLowerCase().includes(s) ||
      (r.original_po_no||"").toLowerCase().includes(s) ||
      (r.supplier_name_db||r.supplier_name_manual||"").toLowerCase().includes(s);
  });

  const badge = (status: string) => {
    const cls: Record<string,string> = { Draft:"bg-yellow-100 text-yellow-800", Approved:"bg-green-100 text-green-700", Rejected:"bg-red-100 text-red-700" };
    return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls[status]||"bg-gray-100 text-gray-600"}`}>{status||"Draft"}</span>;
  };

  return (
    <div className="p-4 md:p-6" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <FileEdit size={16} style={{ color: SC.primary }}/> Purchase Order Amendment
          </h2>
          <button onClick={onNew}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold text-white"
            style={{ background: SC.orange }} data-testid="btn-new">
            <Plus size={14}/> New
          </button>
        </div>
        <div className="px-6 py-3 border-b border-gray-100">
          <div className="relative max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search POA no or supplier..."
              className="w-full border border-gray-300 rounded pl-8 pr-3 py-2 text-sm outline-none focus:border-[#027fa5]"
              data-testid="input-search"/>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["POA No","Amendment Date","Source PO","Supplier","Exp Date","Priority","Payment","Status","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>}
              {!isLoading && filtered.length===0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">No amendments found</td></tr>}
              {filtered.map((r: any) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-[#f0f9ff] transition-colors">
                  <td className="px-4 py-3 font-semibold" style={{ color: SC.primary }}>{r.voucher_no}</td>
                  <td className="px-4 py-3 text-gray-700">{fmt(r.amendment_date)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-semibold">{r.original_po_no||"—"}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.supplier_name_db||r.supplier_name_manual||"—"}</td>
                  <td className="px-4 py-3 text-gray-600">{fmt(r.schedule_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${r.priority==="High"?"bg-red-100 text-red-700":r.priority==="Medium"?"bg-yellow-100 text-yellow-700":"bg-blue-100 text-blue-700"}`}>{r.priority}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.payment_mode}</td>
                  <td className="px-4 py-3">{badge(r.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => onEdit(r)} className="text-[#027fa5] hover:text-[#015f7a] p-1" data-testid={`btn-edit-${r.id}`}><PencilLine size={14}/></button>
                      <button onClick={() => delMut.mutate(r.id)} className="text-red-400 hover:text-red-600 p-1" data-testid={`btn-del-${r.id}`}><Trash2 size={14}/></button>
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

// ── Main ─────────────────────────────────────────────────────────────────────
export default function PurchaseAmendment() {
  const [view, setView] = useState<"list"|"form">("list");
  const [editData, setEditData] = useState<any>(null);

  async function handleEdit(row: any) {
    const res = await fetch(`/api/purchase-order-amendments/${row.id}`, { credentials: "include" });
    setEditData(await res.json());
    setView("form");
  }

  if (view==="form") return <PoaForm editData={editData} onBack={() => { setEditData(null); setView("list"); }}/>;
  return <PoaList onNew={() => { setEditData(null); setView("form"); }} onEdit={handleEdit}/>;
}
