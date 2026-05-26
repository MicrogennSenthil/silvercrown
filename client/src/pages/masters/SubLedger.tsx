import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PencilLine, Plus, Trash2, Info, ChevronDown, ArrowLeft, TrendingUp, CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

function fmt(v: string | number) {
  return parseFloat(String(v) || "0").toFixed(2);
}

// ── Inline toggle (Credit/Debit selector) ────────────────────────────────────
function CrDrToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex border border-gray-300 rounded overflow-hidden text-sm font-medium h-[34px]">
      <button type="button" onClick={() => onChange("Credit")}
        className="px-4 transition-colors"
        style={value === "Credit" ? { background: SC.primary, color: "#fff" } : { background: "#fff", color: "#6b7280" }}>
        Credit
      </button>
      <button type="button" onClick={() => onChange("Debit")}
        className="px-4 transition-colors"
        style={value === "Debit" ? { background: SC.primary, color: "#fff" } : { background: "#fff", color: "#6b7280" }}>
        Debit
      </button>
    </div>
  );
}

// ── Bill row ────────────────────────────────────────────────────────────────
type BillRow = {
  _key: string;
  id?: string;           // DB primary-key (present for saved rows)
  billType: "Opening" | "Bills";
  refNo: string;
  refDate: string;
  voucherNo: string;
  voucherDate: string;
  amount: string;
  crDr: string;
};

function newBill(): BillRow {
  return { _key: crypto.randomUUID(), billType: "Opening", refNo: "", refDate: "", voucherNo: "", voucherDate: "", amount: "", crDr: "Cr" };
}

// ── Ledger Form ────────────────────────────────────────────────────────────
function LedgerForm({
  item, onBack, initialGlId, initialCatId,
}: { item?: any; onBack: () => void; initialGlId?: string; initialCatId?: string }) {
  const qc = useQueryClient();
  const isEdit = !!item?.id;

  const { data: generalLedgersList = [] } = useQuery<any[]>({ queryKey: ["/api/general-ledgers"] });
  const { data: categoriesList = [] } = useQuery<any[]>({ queryKey: ["/api/ledger-categories"] });

  // Live account statement (edit mode only)
  const { data: stmtData, isLoading: stmtLoading } = useQuery<any>({
    queryKey: ["/api/sub-ledgers", item?.id, "statement"],
    queryFn: () => fetch(`/api/sub-ledgers/${item.id}/statement`, { credentials: "include" }).then(r => r.json()),
    enabled: isEdit && !!item?.id,
  });

  // Financial year max date for "Opening" bills: last day of previous FY
  // India FY: April 1 – March 31. If today >= April 1, current FY started this year.
  const prevFYEndDate = (() => {
    const now = new Date();
    const fyStartYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    return `${fyStartYear}-03-31`;
  })();

  const billGridRef = useRef<HTMLDivElement>(null);
  function scrollToBillGrid() {
    billGridRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    billGridRef.current?.classList.add("ring-2", "ring-[#027fa5]", "ring-offset-1");
    setTimeout(() => billGridRef.current?.classList.remove("ring-2", "ring-[#027fa5]", "ring-offset-1"), 2000);
  }

  const [name, setName] = useState(item?.name || "");
  const [glId, setGlId] = useState(item?.generalLedgerId || initialGlId || "");
  const [catId, setCatId] = useState(item?.categoryId || initialCatId || "");
  const [levelType, setLevelType] = useState(item?.levelType || "Same");
  const hasSavedBills = isEdit && (item?.bills?.length ?? 0) > 0;
  const [paymentType, setPaymentType] = useState(hasSavedBills ? "BillToBill" : (item?.paymentType || "BillToBill"));
  const [obEntry, setObEntry] = useState<boolean>(hasSavedBills || (item?.openingBalanceEntry ?? false));
  const [obAmount, setObAmount] = useState(item?.openingBalance || "0");
  const [obType, setObType] = useState(item?.openingBalanceType || "Credit");
  const [cbAmount, setCbAmount] = useState(item?.closingBalance || "0");
  const [cbType, setCbType] = useState(item?.closingBalanceType || "Credit");
  const [notes, setNotes] = useState(item?.notes || "");
  const [bills, setBills] = useState<BillRow[]>(
    item?.bills?.length
      ? item.bills.map((b: any) => ({
          _key: crypto.randomUUID(),
          id: b.id || undefined,          // preserve DB id for inline-edit sync
          billType: (b.billType || "Opening") as "Opening" | "Bills",
          refNo: b.refNo || "",
          refDate: b.refDate || "",
          voucherNo: b.voucherNo || "",
          voucherDate: b.voucherDate || "",
          amount: b.amount || "",
          crDr: b.crDr || "Cr",
        }))
      : []
  );
  const { toast } = useToast();

  // Inline bill editing state (for Account Statement rows)
  type EditingBill = { id: string; billType: string; refNo: string; refDate: string; voucherNo: string; voucherDate: string; amount: string; crDr: string; };
  const [editingBill, setEditingBill] = useState<EditingBill | null>(null);

  const updateBillMutation = useMutation({
    mutationFn: (data: { id: string } & Omit<EditingBill, "id">) =>
      apiRequest("PUT", `/api/sub-ledger-bills/${data.id}`, {
        billType: data.billType,
        refNo: data.refNo,
        refDate: data.refDate || null,
        voucherNo: data.voucherNo,
        voucherDate: data.voucherDate || null,
        amount: data.amount,
        crDr: data.crDr,
      }),
    onSuccess: (_res, variables) => {
      // Sync the edited bill back into local bills state so opening balance recalculates
      setBills(prev => prev.map(b =>
        b.id === variables.id
          ? {
              ...b,
              billType: variables.billType as "Opening" | "Bills",
              refNo: variables.refNo,
              refDate: variables.refDate,
              voucherNo: variables.voucherNo,
              voucherDate: variables.voucherDate,
              amount: variables.amount,
              crDr: variables.crDr,
            }
          : b
      ));
      qc.invalidateQueries({ queryKey: ["/api/sub-ledgers", item?.id, "statement"] });
      qc.invalidateQueries({ queryKey: ["/api/sub-ledgers"] });
      setEditingBill(null);
      toast({ title: "Bill updated" });
    },
    onError: (e: any) => toast({ title: "Failed to update bill", description: e.message, variant: "destructive" }),
  });

  // When GL changes, auto-populate categoryId from GL's category
  useEffect(() => {
    const gl = generalLedgersList.find((g: any) => g.id === glId);
    if (gl?.categoryId) setCatId(gl.categoryId);
  }, [glId, generalLedgersList]);

  // When bills change and obEntry is on + BillToBill, sum only "Opening" type amounts → opening/closing balance
  useEffect(() => {
    if (!obEntry || paymentType !== "BillToBill") return;
    const total = bills
      .filter(b => b.billType === "Opening")
      .reduce((acc, b) => acc + (parseFloat(b.amount) || 0), 0);
    setObAmount(total.toFixed(2));
    setCbAmount(total.toFixed(2));
  }, [bills, obEntry, paymentType]);

  // Clear bills when switching to OnAccount (only if no saved bills from DB)
  useEffect(() => {
    if (paymentType === "OnAccount" && !hasSavedBills) setBills([]);
  }, [paymentType]);

  const catName = categoriesList.find((c: any) => c.id === catId)?.name || "";

  // Current FY start: April 1 of FY start year
  const fyStartDate = prevFYEndDate.slice(0, 4) + "-04-01";

  function updateBill(key: string, field: keyof BillRow, val: string) {
    setBills(prev => prev.map(b => {
      if (b._key !== key) return b;
      const updated = { ...b, [field]: val };
      // Auto-classify: if refDate or voucherDate is before current FY start → Opening
      if ((field === "refDate" || field === "voucherDate") && val && val < fyStartDate) {
        updated.billType = "Opening";
      }
      // When switching type to "Opening", clear dates that exceed the prev FY end
      if (field === "billType" && val === "Opening") {
        if (updated.refDate && updated.refDate > prevFYEndDate) updated.refDate = "";
        if (updated.voucherDate && updated.voucherDate > prevFYEndDate) updated.voucherDate = "";
      }
      return updated;
    }));
  }
  function addBill() {
    setBills(prev => [...prev, newBill()]);
  }
  function removeBill(key: string) { setBills(prev => prev.filter(b => b._key !== key)); }

  const saveMut = useMutation({
    mutationFn: async () => {
      const code = item?.code || `SL-${Date.now()}`;
      const payload = {
        code, name: name.trim(), generalLedgerId: glId || null,
        categoryId: catId || null,
        levelType, paymentType,
        openingBalanceEntry: obEntry,
        openingBalance: obAmount, openingBalanceType: obType,
        closingBalance: cbAmount, closingBalanceType: cbType,
        notes, isActive: true,
        bills: bills.map(b => ({
          billType: b.billType || "Opening",
          refNo: b.refNo, refDate: b.refDate || null,
          voucherNo: b.voucherNo, voucherDate: b.voucherDate || null,
          amount: b.amount || "0", crDr: b.crDr,
        })),
      };
      const url = isEdit ? `/api/sub-ledgers/${item.id}` : "/api/sub-ledgers";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Save failed"); }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sub-ledgers"] });
      onBack();
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const parentGL = generalLedgersList.find((g: any) => g.id === glId);
  const parentCat = categoriesList.find((c: any) => c.id === (parentGL?.categoryId || catId));

  return (
    <div className="p-6" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm">
        {/* Card Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <button type="button" onClick={onBack}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
              <ArrowLeft size={16}/>
            </button>
            <div>
              <h2 className="font-semibold text-gray-800 text-base">Ledger</h2>
              {initialGlId && parentGL && (
                <div className="text-xs text-gray-400 mt-0.5">
                  {parentCat?.name && <span>{parentCat.name} › </span>}
                  <span className="text-[#027fa5] font-medium">{parentGL.name}</span>
                  <span> › New Ledger</span>
                </div>
              )}
            </div>
          </div>
          <Info size={16} className="text-gray-400 cursor-pointer" />
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Row 1 — Ledger Name | Ledger (GL) | Category */}
          <div className="grid grid-cols-3 gap-4">
            {/* Ledger Name */}
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Ledger</label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder="Enter Ledger Name..."
                className="w-full border border-gray-300 rounded px-3 h-[34px] text-sm outline-none focus:border-[#027fa5]"
                data-testid="input-ledger-name"
              />
            </div>

            {/* General Ledger (Parent) */}
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Ledger</label>
              <select
                value={glId} onChange={e => setGlId(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 h-[34px] text-sm bg-white outline-none focus:border-[#027fa5] appearance-none"
                data-testid="select-general-ledger"
              >
                <option value="">-- Select Parent Ledger --</option>
                {generalLedgersList.map((g: any) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Category (read-only, from GL) */}
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Category</label>
              <div className="w-full border border-gray-200 rounded px-3 h-[34px] text-sm text-gray-700 bg-gray-50 flex items-center justify-between">
                <span>{catName || <span className="text-gray-400 text-xs">Auto from Ledger</span>}</span>
                <ChevronDown size={14} className="text-gray-400" />
              </div>
            </div>
          </div>

          {/* Row 2 — Level | Payment | OB Entry toggle | Opening Bal | Closing Bal */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Level Type */}
            <div className="relative">
              <select
                value={levelType} onChange={e => setLevelType(e.target.value)}
                className="border border-gray-300 rounded px-3 h-[34px] text-sm bg-white outline-none focus:border-[#027fa5] appearance-none pr-8 font-medium text-gray-700"
                data-testid="select-level-type"
              >
                <option value="Same">Same Level</option>
                <option value="Next">Next Level</option>
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Payment Type */}
            <div className="relative">
              <select
                value={paymentType} onChange={e => setPaymentType(e.target.value)}
                className="border border-gray-300 rounded px-3 h-[34px] text-sm bg-white outline-none focus:border-[#027fa5] appearance-none pr-8 font-medium text-gray-700"
                data-testid="select-payment-type"
              >
                <option value="OnAccount">On Account</option>
                <option value="BillToBill">Bill to Bill</option>
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Opening Balance Entry toggle */}
            <div className="flex items-center gap-2 border border-gray-300 rounded px-3 h-[34px]">
              <span className="text-sm text-gray-700 font-medium whitespace-nowrap">Opening Balance Entry</span>
              <button
                type="button"
                onClick={() => { setObEntry(!obEntry); if (obEntry) setBills([]); }}
                className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                style={{ background: obEntry ? SC.primary : "#d1d5db" }}
                data-testid="toggle-ob-entry"
              >
                <span
                  className="inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm"
                  style={{ transform: obEntry ? "translateX(18px)" : "translateX(2px)" }}
                />
              </button>
            </div>

            {/* Opening Bal */}
            <div className="flex items-center gap-1">
              <div className="relative">
                <label className="absolute -top-2 left-2 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Opening Bal</label>
                <input
                  type="number" value={obAmount}
                  onChange={e => { setObAmount(e.target.value); setCbAmount(e.target.value); }}
                  disabled={!obEntry}
                  readOnly={obEntry && paymentType === "BillToBill"}
                  className={`w-28 border rounded-l px-2 h-[34px] text-sm outline-none text-right transition-colors
                    ${!obEntry ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed" : "border-gray-300 focus:border-[#027fa5]"}`}
                  placeholder="0000.00"
                  data-testid="input-opening-balance"
                />
              </div>
              <div className={!obEntry ? "opacity-40 pointer-events-none" : ""}>
                <CrDrToggle value={obType} onChange={setObType} />
              </div>
            </div>

            {/* Closing Bal */}
            <div className="flex items-center gap-1">
              <div className="relative">
                <label className="absolute -top-2 left-2 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Closing Bal</label>
                <input
                  type="number" value={cbAmount}
                  onChange={e => setCbAmount(e.target.value)}
                  disabled={!obEntry}
                  readOnly={obEntry && paymentType === "BillToBill"}
                  className={`w-28 border rounded-l px-2 h-[34px] text-sm outline-none text-right transition-colors
                    ${!obEntry ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed" : "border-gray-300 focus:border-[#027fa5]"}`}
                  placeholder="0000.00"
                  data-testid="input-closing-balance"
                />
              </div>
              <div className={!obEntry ? "opacity-40 pointer-events-none" : ""}>
                <CrDrToggle value={cbType} onChange={setCbType} />
              </div>
            </div>
          </div>

          {/* Bill Detail Grid (shown only when obEntry is ON AND Bill-to-Bill) */}
          {obEntry && paymentType === "BillToBill" && (
            <div ref={billGridRef} className="border border-gray-200 rounded-lg overflow-hidden transition-all duration-300">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: SC.tonal }}>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 w-10">S.no</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 w-28">Type</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Ref no</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 w-36">Ref Date</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Voucher no</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 w-36">Voucher Date</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Amount ₹</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700">Cr/Dr</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {bills.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-6 text-center text-gray-400 text-sm">
                        No bill entries. Click "+ Add Bill" to add bill details.
                      </td>
                    </tr>
                  )}
                  {bills.map((b, i) => (
                    <tr key={b._key} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                      data-testid={`row-bill-${i}`}>
                      <td className="px-3 py-1.5 text-gray-500 text-center">{String(i + 1).padStart(2, "0")}</td>
                      <td className="px-2 py-1.5">
                        <select value={b.billType} onChange={e => updateBill(b._key, "billType", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-white outline-none focus:border-[#027fa5] font-medium"
                          data-testid={`select-bill-type-${i}`}
                          style={b.billType === "Opening"
                            ? { color: SC.primary, borderColor: SC.tonal }
                            : { color: "#d74700", borderColor: "#fde8dc" }}>
                          <option value="Opening">Opening</option>
                          <option value="Bills">Bills</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={b.refNo} onChange={e => updateBill(b._key, "refNo", e.target.value)}
                          placeholder="REF no" className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-[#027fa5]"
                          data-testid={`input-ref-no-${i}`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <DatePicker
                          value={b.refDate}
                          onChange={v => updateBill(b._key, "refDate", v)}
                          max={b.billType === "Opening" ? prevFYEndDate : undefined}
                          openUp
                          data-testid={`input-ref-date-${i}`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={b.voucherNo} onChange={e => updateBill(b._key, "voucherNo", e.target.value)}
                          placeholder="Voucher no" className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-[#027fa5]"
                          data-testid={`input-voucher-no-${i}`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <DatePicker
                          value={b.voucherDate}
                          onChange={v => updateBill(b._key, "voucherDate", v)}
                          max={b.billType === "Opening" ? prevFYEndDate : undefined}
                          openUp
                          data-testid={`input-voucher-date-${i}`}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" value={b.amount} onChange={e => updateBill(b._key, "amount", e.target.value)}
                          placeholder="0.00" className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-[#027fa5] text-right"
                          data-testid={`input-amount-${i}`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={b.crDr} onChange={e => updateBill(b._key, "crDr", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs bg-white outline-none focus:border-[#027fa5]"
                          data-testid={`select-crdr-${i}`}>
                          <option value="Cr">Cr</option>
                          <option value="Dr">Dr</option>
                        </select>
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <button type="button" onClick={() => removeBill(b._key)}
                          className="p-1 text-red-400 hover:text-red-600 rounded"
                          data-testid={`btn-remove-bill-${i}`}>
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Bill grid footer — totals + add row */}
              <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50/50">
                <button type="button" onClick={addBill}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded"
                  style={{ color: SC.primary, border: `1px solid ${SC.primary}` }}
                  data-testid="btn-add-bill">
                  <Plus size={12} /> Add Bill
                </button>
                <div className="flex items-center gap-4 text-xs text-gray-600 font-semibold">
                  <span>
                    Opening Total: <span className="font-mono text-gray-800">
                      ₹{fmt(bills.filter(b => b.billType === "Opening").reduce((a, b) => a + (parseFloat(b.amount) || 0), 0))}
                    </span>
                  </span>
                  <span>
                    Bills Total: <span className="font-mono" style={{ color: SC.orange }}>
                      ₹{fmt(bills.filter(b => b.billType === "Bills").reduce((a, b) => a + (parseFloat(b.amount) || 0), 0))}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Notes</label>
            <textarea
              value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} placeholder=""
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5] resize-none"
              data-testid="input-notes"
            />
          </div>


          {/* ── Live Account Statement (edit only) ── */}
          {isEdit && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2.5" style={{ background: SC.tonal }}>
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} style={{ color: SC.primary }} />
                  <span className="text-sm font-semibold text-gray-800">Account Statement</span>
                  <span className="text-xs text-gray-500 ml-1">— Purchases, Sales, Payments &amp; Receipts</span>
                </div>
                {stmtData && (
                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>OB: <strong>₹{fmt(stmtData.openingBalance)}</strong> <span className="text-gray-400">{stmtData.openingBalanceType?.slice(0,2)}</span></span>
                    {stmtData.statement?.length > 0 && (
                      <span>Closing: <strong className="font-mono" style={{ color: SC.primary }}>
                        ₹{fmt(stmtData.statement[stmtData.statement.length - 1]?.balance)}
                      </strong> <span className="text-gray-400">{stmtData.statement[stmtData.statement.length - 1]?.balanceType}</span></span>
                    )}
                  </div>
                )}
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-3 py-2 text-left text-gray-500 font-semibold w-8">#</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-semibold">Date</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-semibold">Voucher / Ref No</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-semibold">Voucher Date</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-semibold">Type</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-semibold">Narration / Source</th>
                      <th className="px-3 py-2 text-right text-gray-500 font-semibold">Debit ₹</th>
                      <th className="px-3 py-2 text-right text-gray-500 font-semibold">Credit ₹</th>
                      <th className="px-3 py-2 text-right text-gray-500 font-semibold">Balance ₹</th>
                    </tr>
                  </thead>
                  {/* Static rows: opening balance, loading, empty */}
                  <tbody>
                    {stmtData && (
                      <tr className="border-b border-gray-50 bg-blue-50/30">
                        <td className="px-3 py-1.5 text-gray-400">—</td>
                        <td className="px-3 py-1.5 text-gray-500 italic">Opening</td>
                        <td className="px-3 py-1.5 text-gray-500 italic" colSpan={2}>Opening Balance</td>
                        <td className="px-3 py-1.5 text-xs text-gray-400 font-medium">—</td>
                        <td className="px-3 py-1.5 text-gray-500 italic">—</td>
                        <td className="px-3 py-1.5 text-right font-mono text-gray-600">
                          {stmtData.openingBalanceType !== "Credit" ? fmt(stmtData.openingBalance) : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-gray-600">
                          {stmtData.openingBalanceType === "Credit" ? fmt(stmtData.openingBalance) : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-semibold" style={{ color: SC.primary }}>
                          {fmt(stmtData.openingBalance)} <span className="text-gray-400 text-[10px]">{stmtData.openingBalanceType?.slice(0,2)}</span>
                        </td>
                      </tr>
                    )}
                    {stmtLoading && (
                      <tr><td colSpan={9} className="px-3 py-6 text-center text-gray-400">Loading statement…</td></tr>
                    )}
                    {!stmtLoading && stmtData?.statement?.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-3 py-5 text-center text-gray-400">
                          No transactions posted yet. Purchases, sales, payments and receipts will appear here.
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {/* Transaction rows — each row (+ optional inline edit) is its own tbody */}
                  {stmtData?.statement?.map((r: any, i: number) => {
                      const isBillRow = !!(r.billId);
                      const isEditing = editingBill?.id === r.billId;
                      const rowBg = i % 2 === 0 ? "bg-white" : "bg-gray-50/30";
                      return (
                        <tbody key={i}>
                          <tr className={`border-b border-gray-50 ${rowBg}`} data-testid={`stmt-row-${i}`}>
                            <td className="px-3 py-1.5 text-gray-400 text-center">{i + 1}</td>
                            <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">
                              {r.txnDate ? new Date(r.txnDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                            </td>
                            <td className="px-3 py-1.5">
                              <div className="font-semibold text-gray-700">{r.voucherNo || r.refNo || "—"}</div>
                              {r.refNo && r.refNo !== r.voucherNo && <div className="text-gray-400 text-[10px]">Ref: {r.refNo}</div>}
                            </td>
                            {/* Voucher Date */}
                            <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">
                              {r.voucherDate ? new Date(r.voucherDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                            </td>
                            {/* Voucher Type */}
                            <td className="px-3 py-1.5">
                              {r.billType ? (
                                <span className="inline-block text-[10px] px-1.5 py-0.5 rounded font-medium"
                                  style={r.billType === "Bills"
                                    ? { background: "#fde8dc", color: "#d74700" }
                                    : { background: SC.tonal, color: SC.primary }}>
                                  {r.billType}
                                </span>
                              ) : r.sourceType ? (
                                <span className="inline-block text-[10px] px-1.5 py-0.5 rounded font-medium bg-gray-100 text-gray-500">
                                  {r.sourceType === "grn" ? "Purchase" : r.sourceType}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="px-3 py-1.5">
                              <div className="text-gray-600 truncate max-w-[140px]">{r.narration || "—"}</div>
                              {isBillRow && isEdit && (
                                <button type="button"
                                  onClick={() => {
                                    if (isEditing) { setEditingBill(null); return; }
                                    setEditingBill({
                                      id: r.billId,
                                      billType: r.billType || "Opening",
                                      refNo: r.refNo || "",
                                      refDate: r.txnDate || "",
                                      voucherNo: r.voucherNo || "",
                                      voucherDate: r.voucherDate || "",
                                      amount: String(r.debit > 0 ? r.debit : r.credit),
                                      crDr: r.debit > 0 ? "Dr" : "Cr",
                                    });
                                  }}
                                  className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded font-medium border transition-colors hover:bg-[#027fa5] hover:text-white mt-0.5"
                                  style={isEditing
                                    ? { background: SC.primary, color: "#fff", borderColor: SC.primary }
                                    : { borderColor: SC.primary, color: SC.primary }}
                                  data-testid={`btn-edit-bill-${i}`}>
                                  <PencilLine size={9} /> {isEditing ? "Cancel" : "Edit"}
                                </button>
                              )}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-red-600">
                              {r.debit > 0 ? fmt(r.debit) : "—"}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono text-green-700">
                              {r.credit > 0 ? fmt(r.credit) : "—"}
                            </td>
                            <td className="px-3 py-1.5 text-right font-mono font-semibold" style={{ color: SC.primary }}>
                              {fmt(r.balance)} <span className="text-gray-400 text-[10px]">{r.balanceType}</span>
                            </td>
                          </tr>
                          {/* Inline edit row — expands below the bill row */}
                          {isEditing && editingBill && (
                            <tr className="border-b border-[#027fa5]/30 bg-[#d2f1fa]/40">
                              <td colSpan={9} className="px-3 py-3">
                                <div className="flex flex-wrap items-end gap-2 text-xs">
                                  {/* Type */}
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-gray-500 font-medium">Type</span>
                                    <select value={editingBill.billType}
                                      onChange={e => setEditingBill(prev => prev ? { ...prev, billType: e.target.value } : prev)}
                                      className="border border-gray-300 rounded px-2 py-1 bg-white text-xs outline-none focus:border-[#027fa5] w-24"
                                      style={editingBill.billType === "Opening" ? { color: SC.primary } : { color: "#d74700" }}>
                                      <option value="Opening">Opening</option>
                                      <option value="Bills">Bills</option>
                                    </select>
                                  </div>
                                  {/* Ref No */}
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-gray-500 font-medium">Ref No</span>
                                    <input value={editingBill.refNo}
                                      onChange={e => setEditingBill(prev => prev ? { ...prev, refNo: e.target.value } : prev)}
                                      placeholder="Ref no" className="border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-[#027fa5] w-28" />
                                  </div>
                                  {/* Ref Date */}
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-gray-500 font-medium">Ref Date</span>
                                    <DatePicker value={editingBill.refDate}
                                      onChange={v => setEditingBill(prev => prev ? { ...prev, refDate: v } : prev)}
                                      max={editingBill.billType === "Opening" ? prevFYEndDate : undefined}
                                      openUp data-testid="edit-ref-date"/>
                                  </div>
                                  {/* Voucher No */}
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-gray-500 font-medium">Voucher No</span>
                                    <input value={editingBill.voucherNo}
                                      onChange={e => setEditingBill(prev => prev ? { ...prev, voucherNo: e.target.value } : prev)}
                                      placeholder="Voucher no" className="border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-[#027fa5] w-28" />
                                  </div>
                                  {/* Voucher Date */}
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-gray-500 font-medium">Voucher Date</span>
                                    <DatePicker value={editingBill.voucherDate}
                                      onChange={v => setEditingBill(prev => prev ? { ...prev, voucherDate: v } : prev)}
                                      max={editingBill.billType === "Opening" ? prevFYEndDate : undefined}
                                      openUp data-testid="edit-voucher-date"/>
                                  </div>
                                  {/* Amount */}
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-gray-500 font-medium">Amount ₹</span>
                                    <input type="number" value={editingBill.amount}
                                      onChange={e => setEditingBill(prev => prev ? { ...prev, amount: e.target.value } : prev)}
                                      placeholder="0.00" className="border border-gray-300 rounded px-2 py-1 text-xs outline-none focus:border-[#027fa5] w-24 text-right" />
                                  </div>
                                  {/* Cr/Dr */}
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-gray-500 font-medium">Cr/Dr</span>
                                    <select value={editingBill.crDr}
                                      onChange={e => setEditingBill(prev => prev ? { ...prev, crDr: e.target.value } : prev)}
                                      className="border border-gray-300 rounded px-2 py-1 bg-white text-xs outline-none focus:border-[#027fa5] w-16">
                                      <option value="Cr">Cr</option>
                                      <option value="Dr">Dr</option>
                                    </select>
                                  </div>
                                  {/* Save */}
                                  <button type="button"
                                    disabled={updateBillMutation.isPending}
                                    onClick={() => updateBillMutation.mutate({ ...editingBill })}
                                    className="px-3 py-1 rounded text-xs font-semibold text-white transition-opacity disabled:opacity-60"
                                    style={{ background: SC.primary }}>
                                    {updateBillMutation.isPending ? "Saving…" : "Save"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      );
                    })}
                  {stmtData?.statement?.length > 0 && (
                    <tfoot>
                      <tr className="border-t-2 border-gray-200 bg-gray-50">
                        <td colSpan={6} className="px-3 py-2 text-xs font-semibold text-gray-600">Closing Balance</td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-red-600">
                          {fmt(stmtData.statement.reduce((s: number, r: any) => s + r.debit, 0))}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-semibold text-green-700">
                          {fmt(stmtData.statement.reduce((s: number, r: any) => s + r.credit, 0))}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-sm font-bold" style={{ color: SC.primary }}>
                          {fmt(stmtData.statement[stmtData.statement.length - 1]?.balance)}{" "}
                          <span className="text-xs font-semibold text-gray-500">
                            {stmtData.statement[stmtData.statement.length - 1]?.balanceType}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* ── Closing Balance Verification ── */}
              {stmtData && (() => {
                const stmtRows: any[] = stmtData.statement || [];
                const calcBal  = stmtRows.length > 0 ? stmtRows[stmtRows.length - 1].balance : parseFloat(stmtData.openingBalance || "0");
                const calcType = stmtRows.length > 0 ? stmtRows[stmtRows.length - 1].balanceType : (stmtData.openingBalanceType === "Credit" ? "Cr" : "Dr");
                const storedBal  = parseFloat(cbAmount || "0");
                const storedType = cbType === "Credit" ? "Cr" : "Dr";
                const diff = Math.abs(calcBal - storedBal);
                const matched = diff < 0.01 && calcType === storedType;
                return (
                  <div className={`flex items-center justify-between px-4 py-3 border-t-2 ${matched ? "border-green-200 bg-green-50/60" : "border-amber-200 bg-amber-50/60"}`}>
                    <div className="flex items-center gap-2">
                      {matched
                        ? <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                        : <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />}
                      <span className={`text-sm font-semibold ${matched ? "text-green-800" : "text-amber-800"}`}>
                        {matched ? "Closing Balance Verified" : "Closing Balance Mismatch"}
                      </span>
                      {!matched && (
                        <span className="text-xs text-amber-700 ml-1">
                          — Difference: ₹{fmt(diff)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-6 text-xs">
                      <div className="text-center">
                        <div className="text-gray-500 mb-0.5">Stored Closing Bal</div>
                        <div className={`font-mono font-bold text-sm ${matched ? "text-green-700" : "text-amber-700"}`}>
                          ₹{fmt(storedBal)} <span className="text-xs font-semibold">{storedType}</span>
                        </div>
                      </div>
                      <div className="text-gray-300 text-lg font-light">/</div>
                      <div className="text-center">
                        <div className="text-gray-500 mb-0.5">Calculated Closing Bal</div>
                        <div className={`font-mono font-bold text-sm ${matched ? "text-green-700" : "text-amber-700"}`}>
                          ₹{fmt(calcBal)} <span className="text-xs font-semibold">{calcType}</span>
                        </div>
                      </div>
                      {!matched && (
                        <button
                          type="button"
                          onClick={() => { setCbAmount(fmt(calcBal)); setCbType(calcType === "Cr" ? "Credit" : "Debit"); }}
                          className="text-xs px-3 py-1 rounded font-semibold text-white"
                          style={{ background: SC.primary }}
                          data-testid="btn-sync-closing-bal">
                          Sync to Calculated
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Card Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button type="button" onClick={onBack}
            className="px-8 py-2 rounded border text-sm font-semibold text-gray-700 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }} data-testid="btn-back">Back</button>
          <button type="button"
            onClick={() => saveMut.mutate()}
            disabled={!name.trim() || saveMut.isPending}
            className="px-8 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }} data-testid="btn-accept">
            {saveMut.isPending ? "Saving..." : "Accept"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sub Ledger List ──────────────────────────────────────────────────────────
type RowEdit = {
  name: string; glId: string; levelType: string;
  paymentType: string; obAmount: string; obType: string;
};

export default function SubLedgerMaster() {
  const [location, setLocation] = useLocation();

  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const urlMode  = params.get("mode");
  const urlGlId  = params.get("glId") || "";
  const urlCatId = params.get("catId") || "";
  const urlFrom  = params.get("from") || "";

  const [view, setView]           = useState<"list" | "add" | "edit">(urlMode === "new" ? "add" : "list");
  const [editItem, setEditItem]   = useState<any>(null);
  const [search, setSearch]       = useState("");
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [rowDraft, setRowDraft]   = useState<RowEdit | null>(null);
  const { toast } = useToast();

  function handleBack() {
    if (urlFrom === "gl-tree") setLocation("/accounts/general-ledger");
    else { setEditItem(null); setView("list"); }
  }

  const { data: ledgers = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/sub-ledgers"] });
  const { data: glList  = [] }            = useQuery<any[]>({ queryKey: ["/api/general-ledgers"] });
  const { data: catList = [] }            = useQuery<any[]>({ queryKey: ["/api/ledger-categories"] });
  const qc = useQueryClient();

  const glMap:  Record<string, string> = {};
  glList.forEach((g: any) => { glMap[g.id] = g.name; });
  const catMap: Record<string, string> = {};
  catList.forEach((c: any) => { catMap[c.id] = c.name; });
  const glCatMap: Record<string, string> = {};
  glList.forEach((g: any) => { if (g.categoryId) glCatMap[g.id] = g.categoryId; });

  function startEditRow(r: any) {
    setEditingRowId(r.id);
    setRowDraft({
      name: r.name || "",
      glId: r.generalLedgerId || "",
      levelType: r.levelType || "Same",
      paymentType: r.paymentType || "BillToBill",
      obAmount: r.openingBalance || "0",
      obType: r.openingBalanceType || "Credit",
    });
  }

  function cancelEdit() { setEditingRowId(null); setRowDraft(null); }

  const saveRowMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/sub-ledgers/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message); }
      return res.json();
    },
    onSuccess: () => {
      setEditingRowId(null); setRowDraft(null);
      qc.invalidateQueries({ queryKey: ["/api/sub-ledgers"] });
      toast({ title: "Saved" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/sub-ledgers/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/sub-ledgers"] }),
  });

  async function openBillsForm(r: any) {
    const res  = await fetch(`/api/sub-ledgers/${r.id}`, { credentials: "include" });
    const data = await res.json();
    setEditItem(data); setView("edit");
  }

  const filtered = (ledgers as any[]).filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  if (view === "add") return <LedgerForm onBack={handleBack} initialGlId={urlGlId} initialCatId={urlCatId} />;
  if (view === "edit") return <LedgerForm key={editItem?.id} item={editItem} onBack={handleBack} />;

  const iCell = "w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-[#027fa5] bg-white";

  return (
    <div className="p-4" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-full mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h1 className="font-semibold text-gray-800 text-base">Ledger</h1>
          <div className="flex items-center gap-3">
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search Ledger name..."
              className="px-3 py-1.5 text-sm border border-gray-200 rounded w-56 outline-none focus:border-[#027fa5]"
              data-testid="input-search"
            />
            <button onClick={() => setView("add")}
              className="px-5 py-1.5 rounded text-sm font-semibold text-white flex items-center gap-1.5"
              style={{ background: SC.orange }} data-testid="btn-add">
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        {/* Read-only table — one row editable at a time */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ background: SC.tonal }}>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-10 text-xs">S.no</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 text-xs min-w-[160px]">Ledger Name</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 text-xs min-w-[160px]">Parent Ledger</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 text-xs min-w-[110px]">Category</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 text-xs min-w-[110px]">Level</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 text-xs min-w-[120px]">Payment</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-700 text-xs min-w-[140px]">Opening Bal</th>
                <th className="px-3 py-2.5 text-center font-semibold text-gray-700 text-xs w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-400 text-sm">Loading...</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-400 text-sm">No ledgers found. Click Add to create one.</td></tr>
              )}
              {filtered.map((r, i) => {
                const isEditing = editingRowId === r.id;
                const d = isEditing ? rowDraft! : null;
                const catId = isEditing
                  ? (glCatMap[d!.glId] || r.categoryId || "")
                  : (r.categoryId || glCatMap[r.generalLedgerId] || "");
                const isPending = saveRowMut.isPending && (saveRowMut.variables as any)?.id === r.id;
                const rowBg = isEditing ? "bg-[#d2f1fa]/40" : i % 2 === 0 ? "bg-white" : "bg-gray-50/30";

                return (
                  <tr key={r.id} className={`border-t border-gray-100 ${rowBg}`}
                    data-testid={`row-subledger-${r.id}`}>

                    {/* S.No */}
                    <td className="px-3 py-2 text-gray-400 text-xs text-center">{i + 1}</td>

                    {/* Ledger Name */}
                    <td className="px-3 py-2">
                      {isEditing
                        ? <input value={d!.name} onChange={ev => setRowDraft(p => p ? { ...p, name: ev.target.value } : p)}
                            className={iCell} data-testid={`input-name-${r.id}`} />
                        : <span className="text-xs text-gray-800 font-medium">{r.name}</span>
                      }
                    </td>

                    {/* Parent GL */}
                    <td className="px-3 py-2">
                      {isEditing
                        ? <select value={d!.glId} onChange={ev => setRowDraft(p => p ? { ...p, glId: ev.target.value } : p)}
                            className={iCell} data-testid={`select-gl-${r.id}`}>
                            <option value="">-- Select --</option>
                            {glList.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </select>
                        : <span className="text-xs text-gray-600">{glMap[r.generalLedgerId] || "—"}</span>
                      }
                    </td>

                    {/* Category (always read-only, auto from GL) */}
                    <td className="px-3 py-2">
                      <span className="text-xs text-gray-500">{catMap[catId] || "—"}</span>
                    </td>

                    {/* Level */}
                    <td className="px-3 py-2">
                      {isEditing
                        ? <select value={d!.levelType} onChange={ev => setRowDraft(p => p ? { ...p, levelType: ev.target.value } : p)}
                            className={iCell} data-testid={`select-level-${r.id}`}>
                            <option value="Same">Same Level</option>
                            <option value="Next">Next Level</option>
                          </select>
                        : <span className="text-xs text-gray-600">{r.levelType === "Next" ? "Next Level" : "Same Level"}</span>
                      }
                    </td>

                    {/* Payment */}
                    <td className="px-3 py-2">
                      {isEditing
                        ? <select value={d!.paymentType} onChange={ev => setRowDraft(p => p ? { ...p, paymentType: ev.target.value } : p)}
                            className={iCell} data-testid={`select-payment-${r.id}`}>
                            <option value="OnAccount">On Account</option>
                            <option value="BillToBill">Bill to Bill</option>
                          </select>
                        : <span className="text-xs text-gray-600">{r.paymentType === "BillToBill" ? "Bill to Bill" : "On Account"}</span>
                      }
                    </td>

                    {/* Opening Bal */}
                    <td className="px-3 py-2">
                      {isEditing
                        ? <div className="flex items-center gap-1">
                            <input type="number" value={d!.obAmount}
                              onChange={ev => setRowDraft(p => p ? { ...p, obAmount: ev.target.value } : p)}
                              className={`${iCell} text-right w-24`} placeholder="0.00"
                              data-testid={`input-ob-${r.id}`} />
                            <div className="flex border border-gray-200 rounded overflow-hidden text-[10px] font-semibold h-[26px] flex-shrink-0">
                              <button type="button" onClick={() => setRowDraft(p => p ? { ...p, obType: "Credit" } : p)}
                                className="px-2 transition-colors"
                                style={d!.obType === "Credit" ? { background: SC.primary, color: "#fff" } : { background: "#fff", color: "#9ca3af" }}>
                                Cr
                              </button>
                              <button type="button" onClick={() => setRowDraft(p => p ? { ...p, obType: "Debit" } : p)}
                                className="px-2 transition-colors"
                                style={d!.obType === "Debit" ? { background: SC.primary, color: "#fff" } : { background: "#fff", color: "#9ca3af" }}>
                                Dr
                              </button>
                            </div>
                          </div>
                        : <span className="text-xs text-gray-700 font-mono">
                            {parseFloat(r.openingBalance || "0").toFixed(2)}
                            <span className="ml-1 text-[10px] text-gray-400">{r.openingBalanceType === "Debit" ? "Dr" : "Cr"}</span>
                          </span>
                      }
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-1">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveRowMut.mutate({
                                id: r.id,
                                data: {
                                  name: d!.name, generalLedgerId: d!.glId || null,
                                  categoryId: catId || null,
                                  levelType: d!.levelType, paymentType: d!.paymentType,
                                  openingBalance: d!.obAmount, openingBalanceType: d!.obType,
                                  bills: r.bills || [],
                                },
                              })}
                              disabled={isPending}
                              className="px-2.5 py-1 rounded text-[10px] font-semibold text-white disabled:opacity-50 transition-opacity"
                              style={{ background: SC.primary }}
                              data-testid={`btn-save-${r.id}`}>
                              {isPending ? "…" : "Save"}
                            </button>
                            <button onClick={cancelEdit}
                              className="px-2.5 py-1 rounded text-[10px] font-semibold border border-gray-300 text-gray-600 hover:bg-gray-50"
                              data-testid={`btn-cancel-${r.id}`}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => startEditRow(r)}
                              className="p-1.5 rounded hover:bg-blue-50 transition-colors"
                              style={{ color: SC.primary }}
                              title="Edit this ledger"
                              data-testid={`btn-edit-${r.id}`}>
                              <PencilLine size={13} />
                            </button>
                            <button onClick={() => openBillsForm(r)}
                              className="px-2 py-1 rounded text-[10px] font-semibold border transition-colors hover:bg-[#027fa5] hover:text-white"
                              style={{ borderColor: SC.primary, color: SC.primary }}
                              title="Open full ledger form with bills & statement"
                              data-testid={`btn-bills-${r.id}`}>
                              Bills
                            </button>
                            <button onClick={() => { if (confirm(`Delete "${r.name}"?`)) deleteMut.mutate(r.id); }}
                              className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                              title="Delete" data-testid={`btn-delete-${r.id}`}>
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
