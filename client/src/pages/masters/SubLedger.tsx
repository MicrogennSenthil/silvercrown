import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PencilLine, Plus, Trash2, Info, ChevronDown, ArrowLeft } from "lucide-react";
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
    <div className="flex border border-gray-300 rounded overflow-hidden text-xs font-semibold">
      <button type="button" onClick={() => onChange("Credit")}
        className="px-3 py-1.5 transition-colors"
        style={value === "Credit" ? { background: SC.primary, color: "#fff" } : { background: "#fff", color: "#6b7280" }}>
        Credit
      </button>
      <button type="button" onClick={() => onChange("Debit")}
        className="px-3 py-1.5 transition-colors"
        style={value === "Debit" ? { background: SC.primary, color: "#fff" } : { background: "#fff", color: "#6b7280" }}>
        Debit
      </button>
    </div>
  );
}

// ── Bill row ────────────────────────────────────────────────────────────────
type BillRow = {
  _key: string;
  refNo: string;
  refDate: string;
  voucherNo: string;
  voucherDate: string;
  amount: string;
  crDr: string;
};

function newBill(): BillRow {
  return { _key: crypto.randomUUID(), refNo: "", refDate: "", voucherNo: "", voucherDate: "", amount: "", crDr: "Cr" };
}

// ── Ledger Form ────────────────────────────────────────────────────────────
function LedgerForm({
  item, onBack, initialGlId, initialCatId,
}: { item?: any; onBack: () => void; initialGlId?: string; initialCatId?: string }) {
  const qc = useQueryClient();
  const isEdit = !!item?.id;

  const { data: generalLedgersList = [] } = useQuery<any[]>({ queryKey: ["/api/general-ledgers"] });
  const { data: categoriesList = [] } = useQuery<any[]>({ queryKey: ["/api/ledger-categories"] });

  const [name, setName] = useState(item?.name || "");
  const [glId, setGlId] = useState(item?.generalLedgerId || initialGlId || "");
  const [catId, setCatId] = useState(item?.categoryId || initialCatId || "");
  const [levelType, setLevelType] = useState(item?.levelType || "Same");
  const [paymentType, setPaymentType] = useState(item?.paymentType || "OnAccount");
  const [obEntry, setObEntry] = useState<boolean>(item?.openingBalanceEntry ?? false);
  const [obAmount, setObAmount] = useState(item?.openingBalance || "0");
  const [obType, setObType] = useState(item?.openingBalanceType || "Credit");
  const [cbAmount, setCbAmount] = useState(item?.closingBalance || "0");
  const [cbType, setCbType] = useState(item?.closingBalanceType || "Credit");
  const [notes, setNotes] = useState(item?.notes || "");
  const [bills, setBills] = useState<BillRow[]>(
    item?.bills?.length
      ? item.bills.map((b: any) => ({
          _key: crypto.randomUUID(),
          refNo: b.refNo || "",
          refDate: b.refDate || "",
          voucherNo: b.voucherNo || "",
          voucherDate: b.voucherDate || "",
          amount: b.amount || "",
          crDr: b.crDr || "Cr",
        }))
      : []
  );
  const [error, setError] = useState("");

  // When GL changes, auto-populate categoryId from GL's category
  useEffect(() => {
    const gl = generalLedgersList.find((g: any) => g.id === glId);
    if (gl?.categoryId) setCatId(gl.categoryId);
  }, [glId, generalLedgersList]);

  // When bills change and obEntry is on, sum amounts → opening/closing balance
  useEffect(() => {
    if (!obEntry) return;
    const total = bills.reduce((acc, b) => acc + (parseFloat(b.amount) || 0), 0);
    setObAmount(total.toFixed(2));
    setCbAmount(total.toFixed(2));
  }, [bills, obEntry]);

  const catName = categoriesList.find((c: any) => c.id === catId)?.name || "";

  function updateBill(key: string, field: keyof BillRow, val: string) {
    setBills(prev => prev.map(b => b._key === key ? { ...b, [field]: val } : b));
  }
  function addBill() { setBills(prev => [...prev, newBill()]); }
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
        bills: obEntry
          ? bills.map(b => ({
              refNo: b.refNo, refDate: b.refDate || null,
              voucherNo: b.voucherNo, voucherDate: b.voucherDate || null,
              amount: b.amount || "0", crDr: b.crDr,
            }))
          : [],
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
    onError: (e: any) => setError(e.message),
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
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                data-testid="input-ledger-name"
              />
            </div>

            {/* General Ledger (Parent) */}
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Ledger</label>
              <select
                value={glId} onChange={e => setGlId(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm bg-white outline-none focus:border-[#027fa5] appearance-none"
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
              <div className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm text-gray-700 bg-gray-50 flex items-center justify-between">
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
                className="border border-gray-300 rounded px-3 py-2 text-sm bg-white outline-none focus:border-[#027fa5] appearance-none pr-8 font-medium text-gray-700"
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
                className="border border-gray-300 rounded px-3 py-2 text-sm bg-white outline-none focus:border-[#027fa5] appearance-none pr-8 font-medium text-gray-700"
                data-testid="select-payment-type"
              >
                <option value="OnAccount">On Account</option>
                <option value="BillToBill">Bill to Bill</option>
              </select>
              <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* Opening Balance Entry toggle */}
            <div className="flex items-center gap-2 border border-gray-300 rounded px-3 py-2">
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
                  onChange={e => { if (!obEntry) setObAmount(e.target.value); }}
                  readOnly={obEntry}
                  className="w-28 border border-gray-300 rounded-l px-2 py-2 text-sm outline-none focus:border-[#027fa5] text-right"
                  placeholder="0000.00"
                  data-testid="input-opening-balance"
                />
              </div>
              <CrDrToggle value={obType} onChange={setObType} />
            </div>

            {/* Closing Bal */}
            <div className="flex items-center gap-1">
              <div className="relative">
                <label className="absolute -top-2 left-2 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Closing Bal</label>
                <input
                  type="number" value={cbAmount}
                  onChange={e => { if (!obEntry) setCbAmount(e.target.value); }}
                  readOnly={obEntry}
                  className="w-28 border border-gray-300 rounded-l px-2 py-2 text-sm outline-none focus:border-[#027fa5] text-right"
                  placeholder="0000.00"
                  data-testid="input-closing-balance"
                />
              </div>
              <CrDrToggle value={cbType} onChange={setCbType} />
            </div>
          </div>

          {/* Bill Detail Grid (shown only when obEntry is ON) */}
          {obEntry && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: SC.tonal }}>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700 w-10">S.no</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Ref no</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Ref Date</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Voucher no</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-700">Voucher Date</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-700">Amount ₹</th>
                    <th className="px-3 py-2 text-center font-semibold text-gray-700">Cr/Dr</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {bills.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-6 text-center text-gray-400 text-sm">
                        No bill entries. Click "+ Add Bill" to add opening bill details.
                      </td>
                    </tr>
                  )}
                  {bills.map((b, i) => (
                    <tr key={b._key} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                      data-testid={`row-bill-${i}`}>
                      <td className="px-3 py-1.5 text-gray-500 text-center">{String(i + 1).padStart(2, "0")}</td>
                      <td className="px-2 py-1.5">
                        <input value={b.refNo} onChange={e => updateBill(b._key, "refNo", e.target.value)}
                          placeholder="REF no" className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-[#027fa5]"
                          data-testid={`input-ref-no-${i}`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <DatePicker
                          value={b.refDate}
                          onChange={v => updateBill(b._key, "refDate", v)}
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

              {/* Bill grid footer — total + add row */}
              <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50/50">
                <button type="button" onClick={addBill}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded"
                  style={{ color: SC.primary, border: `1px solid ${SC.primary}` }}
                  data-testid="btn-add-bill">
                  <Plus size={12} /> Add Bill
                </button>
                <div className="flex items-center gap-2 text-xs text-gray-600 font-semibold">
                  <span>Total:</span>
                  <span className="font-mono text-gray-800">
                    ₹{fmt(bills.reduce((a, b) => a + (parseFloat(b.amount) || 0), 0))}
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

          {error && <p className="text-red-500 text-xs">{error}</p>}
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
export default function SubLedgerMaster() {
  const [location, setLocation] = useLocation();

  // Parse URL query params for pre-fill from GL tree
  const params = new URLSearchParams(
    typeof window !== "undefined" ? window.location.search : ""
  );
  const urlMode   = params.get("mode");        // "new"
  const urlGlId   = params.get("glId") || "";
  const urlCatId  = params.get("catId") || "";
  const urlFrom   = params.get("from") || "";  // "gl-tree"

  const [view, setView] = useState<"list" | "add" | "edit">(
    urlMode === "new" ? "add" : "list"
  );
  const [editItem, setEditItem] = useState<any>(null);
  const [search, setSearch] = useState("");

  // Back handler: if came from GL tree, navigate back there
  function handleBack() {
    if (urlFrom === "gl-tree") {
      setLocation("/accounts/general-ledger");
    } else {
      setEditItem(null);
      setView("list");
    }
  }

  const { data: ledgers = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/sub-ledgers"] });
  const { data: glList = [] } = useQuery<any[]>({ queryKey: ["/api/general-ledgers"] });
  const { data: catList = [] } = useQuery<any[]>({ queryKey: ["/api/ledger-categories"] });

  const qc = useQueryClient();

  const glMap: Record<string, string> = {};
  glList.forEach((g: any) => { glMap[g.id] = g.name; });
  const catMap: Record<string, string> = {};
  catList.forEach((c: any) => { catMap[c.id] = c.name; });

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/sub-ledgers/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/sub-ledgers"] }),
  });

  async function handleEdit(r: any) {
    const res = await fetch(`/api/sub-ledgers/${r.id}`, { credentials: "include" });
    const data = await res.json();
    setEditItem(data);
    setView("edit");
  }

  const filtered = ledgers.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  if (view === "add") return (
    <LedgerForm
      onBack={handleBack}
      initialGlId={urlGlId}
      initialCatId={urlCatId}
    />
  );
  if (view === "edit") return (
    <LedgerForm
      item={editItem}
      onBack={handleBack}
    />
  );

  return (
    <div className="p-6" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
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
          </div>
        </div>

        {/* Table */}
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: SC.tonal }}>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700 w-12">S.no</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Ledger Name</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Parent Ledger</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Category</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Level</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Payment</th>
              <th className="px-5 py-2.5 text-right font-semibold text-gray-700">Opening Bal</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Status</th>
              <th className="px-3 py-2.5 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-400 text-sm">Loading...</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={9} className="px-5 py-8 text-center text-gray-400 text-sm">No ledgers found</td></tr>
            )}
            {filtered.map((r, i) => (
              <tr key={r.id} className={`border-t border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                data-testid={`row-subledger-${r.id}`}>
                <td className="px-5 py-2.5 text-gray-500">{i + 1}</td>
                <td className="px-5 py-2.5 font-medium text-gray-800">{r.name}</td>
                <td className="px-5 py-2.5 text-gray-600">{glMap[r.generalLedgerId] || <span className="text-gray-300">—</span>}</td>
                <td className="px-5 py-2.5 text-gray-600">{catMap[r.categoryId] || <span className="text-gray-300">—</span>}</td>
                <td className="px-5 py-2.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${r.levelType === "Next" ? "bg-orange-50 text-orange-700" : "bg-blue-50 text-blue-700"}`}>
                    {r.levelType === "Next" ? "Next Level" : "Same Level"}
                  </span>
                </td>
                <td className="px-5 py-2.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${r.paymentType === "BillToBill" ? "bg-purple-50 text-purple-700" : "bg-teal-50 text-teal-700"}`}>
                    {r.paymentType === "BillToBill" ? "Bill to Bill" : "On Account"}
                  </span>
                </td>
                <td className="px-5 py-2.5 text-right font-mono text-xs text-gray-700">
                  {fmt(r.openingBalance)} <span className="text-gray-400">{r.openingBalanceType === "Credit" ? "Cr" : "Dr"}</span>
                </td>
                <td className="px-5 py-2.5">
                  <span className={`text-xs font-semibold ${r.isActive ? "text-green-600" : "text-red-400"}`}>
                    {r.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <button onClick={() => handleEdit(r)}
                    className="p-1.5 rounded hover:bg-blue-50" style={{ color: SC.primary }}
                    data-testid={`btn-edit-${r.id}`}>
                    <PencilLine size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-3 border-t border-gray-100">
          <button
            className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }} data-testid="btn-cancel">Cancel</button>
          <button onClick={() => setView("add")}
            className="px-8 py-2 rounded text-sm font-semibold text-white"
            style={{ background: SC.orange }} data-testid="btn-add">Add</button>
        </div>
      </div>
    </div>
  );
}
