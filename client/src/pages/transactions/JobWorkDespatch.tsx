import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Search, PencilLine, Loader2, CheckCircle2, AlertCircle, ChevronDown, TruckIcon } from "lucide-react";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

function today() { return new Date().toISOString().split("T")[0]; }

const DESPATCH_STATUS_STYLE: Record<string, string> = {
  Pending:   "bg-yellow-50 text-yellow-700 border border-yellow-200",
  Partial:   "bg-blue-50 text-blue-700 border border-blue-200",
  Completed: "bg-green-50 text-green-700 border border-green-200",
  Saved:     "bg-green-50 text-green-700 border border-green-200",
};

// ── Despatch Form ─────────────────────────────────────────────────────────────
function DespatchForm({ editData, onBack }: { editData?: any; onBack: () => void }) {
  const qc = useQueryClient();

  // Header state
  const [voucherNo, setVoucherNo]       = useState(editData?.voucher_no || "");
  const [despatchDate, setDespatchDate] = useState(editData?.despatch_date?.split("T")[0] || today());
  const [inwardId, setInwardId]         = useState(editData?.inward_id || "");
  const [inwardSearch, setInwardSearch] = useState(editData?.inward_voucher_no || "");
  const [inwardDropOpen, setInwardDropOpen] = useState(false);
  const [partyId, setPartyId]           = useState(editData?.party_id || "");
  const [partyName, setPartyName]       = useState(editData?.party_name_db || editData?.party_name_manual || "");
  const [vehicleNo, setVehicleNo]       = useState((editData?.vehicle_no || "").toUpperCase());
  const [driverName, setDriverName]     = useState(editData?.driver_name || "");
  const [lrNo, setLrNo]                 = useState(editData?.lr_no || "");
  const [notes, setNotes]               = useState(editData?.notes || "");

  // Item rows (loaded from inward balance)
  const [items, setItems] = useState<any[]>(editData?.items || []);
  const [inwardLoaded, setInwardLoaded] = useState<string | null>(editData?.inward_id || null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveOk, setSaveOk] = useState(false);

  // Load inward list (pending/partial only)
  const { data: inwardList = [] } = useQuery<any[]>({ queryKey: ["/api/job-work-inward"] });
  const pendingInwards = inwardList.filter(r => r.despatch_status !== "Completed");

  const filteredInwards = pendingInwards.filter(r =>
    !inwardSearch ||
    r.voucher_no?.toLowerCase().includes(inwardSearch.toLowerCase()) ||
    r.party_name_db?.toLowerCase().includes(inwardSearch.toLowerCase()) ||
    r.party_dc_no?.toLowerCase().includes(inwardSearch.toLowerCase())
  );

  // Auto-load voucher number on Add
  useEffect(() => {
    if (!editData && !voucherNo) {
      fetch("/api/voucher-series/next/job_work_despatch", { credentials: "include" })
        .then(r => r.json()).then(d => setVoucherNo(d.voucher_no || "")).catch(() => {});
    }
  }, []);

  // Load balance items when inward selected
  async function loadInwardItems(id: string) {
    if (inwardLoaded === id) return;
    try {
      const res = await fetch(`/api/job-work-inward/${id}/despatch-items`, { credentials: "include" });
      const rows = await res.json();
      setItems(rows.map((r: any) => ({ ...r, qty_despatched: "" })));
      setInwardLoaded(id);
    } catch {}
  }

  function selectInward(inward: any) {
    setInwardId(inward.id);
    setInwardSearch(inward.voucher_no);
    setPartyId(inward.party_id || "");
    setPartyName(inward.party_name_db || inward.party_name_manual || "");
    setInwardDropOpen(false);
    loadInwardItems(inward.id);
  }

  function despatchAll() {
    setItems(prev => prev.map(it => ({
      ...it,
      qty_despatched: parseFloat(it.qty_balance) > 0 ? String(it.qty_balance) : it.qty_despatched,
    })));
  }

  function updateQty(inwardItemId: string, val: string) {
    setItems(prev => prev.map(it =>
      it.inward_item_id === inwardItemId ? { ...it, qty_despatched: val } : it
    ));
  }

  const saveMut = useMutation({
    mutationFn: async (payload: any) => {
      const url = editData?.id ? `/api/job-work-despatch/${editData.id}` : "/api/job-work-despatch";
      const method = editData?.id ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Save failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/job-work-despatch"] });
      qc.invalidateQueries({ queryKey: ["/api/job-work-inward"] });
      setSaveOk(true);
      setTimeout(onBack, 900);
    },
    onError: (e: any) => setSaveError(e.message),
  });

  function handleSave() {
    if (!inwardId) { setSaveError("Please select an Inward reference."); return; }
    const despatching = items.filter(it => parseFloat(it.qty_despatched || 0) > 0);
    if (!despatching.length) { setSaveError("Enter despatch quantity for at least one item."); return; }
    setSaveError("");
    saveMut.mutate({
      voucher_no: voucherNo,
      despatch_date: despatchDate,
      inward_id: inwardId,
      party_id: partyId || null,
      party_name_manual: partyName,
      vehicle_no: vehicleNo,
      driver_name: driverName,
      lr_no: lrNo,
      notes,
      items: items.map(it => ({
        inward_item_id: it.inward_item_id,
        item_id:        it.item_id,
        item_code:      it.item_code,
        item_name:      it.item_name,
        unit:           it.unit,
        process:        it.process,
        hsn:            it.hsn,
        qty_inward:     it.qty_inward,
        qty_prev_despatched: it.qty_prev_despatched,
        qty_despatched: it.qty_despatched || 0,
        remark:         it.remark,
      })),
    });
  }

  const totalDespatching = items.reduce((s, it) => s + parseFloat(it.qty_despatched || 0), 0);

  return (
    <div className="min-h-screen p-4" style={{ background: SC.bg }}>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded border border-gray-300 bg-white hover:border-gray-400 transition-all"
            data-testid="btn-back">
            ← Back
          </button>
          <h2 className="text-lg font-bold" style={{ color: SC.primary }}>
            {editData ? "Edit Despatch" : "New Job Work Despatch"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {saveOk && (
            <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
              <CheckCircle2 size={16} /> Saved!
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saveMut.isPending}
            className="flex items-center gap-2 px-5 py-2 rounded text-white text-sm font-semibold shadow transition-all hover:opacity-90 disabled:opacity-60"
            style={{ background: SC.primary }}
            data-testid="btn-save">
            {saveMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <TruckIcon size={15} />}
            {editData ? "Update" : "Save Despatch"}
          </button>
        </div>
      </div>

      {saveError && (
        <div className="flex items-center gap-2 mb-3 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <AlertCircle size={15} />{saveError}
        </div>
      )}

      {/* Form card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-4">
        {/* Row 1 — Voucher + Date */}
        <div className="grid grid-cols-4 gap-4 mb-5">
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Despatch No</label>
            <input value={voucherNo} readOnly
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm font-bold outline-none"
              style={{ color: SC.primary }} data-testid="input-voucher-no" />
          </div>
          <DatePicker label="Despatch Date" value={despatchDate} onChange={setDespatchDate} data-testid="input-despatch-date" />
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Vehicle No</label>
            <input value={vehicleNo} onChange={e => setVehicleNo(e.target.value.toUpperCase())} placeholder="TN 00 AB 1234"
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
              data-testid="input-vehicle-no" />
          </div>
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Driver Name</label>
            <input value={driverName} onChange={e => setDriverName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
              data-testid="input-driver-name" />
          </div>
        </div>

        {/* Row 2 — Inward Ref + Party + LR */}
        <div className="grid grid-cols-3 gap-4 mb-5">
          {/* Inward Reference dropdown */}
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Inward Reference *</label>
            <div className="flex">
              <input
                value={inwardSearch}
                onChange={e => { setInwardSearch(e.target.value); setInwardDropOpen(true); }}
                onFocus={() => setInwardDropOpen(true)}
                placeholder="Search inward voucher / party..."
                className="flex-1 border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                data-testid="input-inward-ref" />
              <button type="button" onClick={() => setInwardDropOpen(o => !o)}
                className="px-2 border border-l-0 border-gray-300 rounded-r bg-gray-50 hover:bg-gray-100">
                <ChevronDown size={14} className="text-gray-400" />
              </button>
            </div>
            {inwardDropOpen && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-52 overflow-y-auto mt-0.5">
                {filteredInwards.length === 0 && (
                  <div className="px-3 py-4 text-xs text-gray-400 text-center">No pending inwards found</div>
                )}
                {filteredInwards.map(r => (
                  <button key={r.id} onClick={() => selectInward(r)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#d2f1fa] transition-colors border-b border-gray-50 last:border-0">
                    <div className="font-semibold text-xs" style={{ color: SC.primary }}>{r.voucher_no}</div>
                    <div className="text-gray-500 text-xs">{r.party_name_db || r.party_name_manual} {r.party_dc_no ? `· DC: ${r.party_dc_no}` : ""}</div>
                    <div className="mt-0.5">
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${DESPATCH_STATUS_STYLE[r.despatch_status || "Pending"]}`}>
                        {r.despatch_status || "Pending"}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Party / Customer</label>
            <input value={partyName} readOnly
              className="w-full border border-gray-200 rounded px-3 py-2.5 text-sm bg-gray-50 text-gray-600 outline-none"
              data-testid="input-party-name" />
          </div>
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">LR No</label>
            <input value={lrNo} onChange={e => setLrNo(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
              data-testid="input-lr-no" />
          </div>
        </div>

        {/* Notes */}
        <div className="relative mb-2">
          <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Notes</label>
          <input value={notes} onChange={e => setNotes(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
            data-testid="input-notes" />
        </div>
      </div>

      {/* Items table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <TruckIcon size={15} style={{ color: SC.primary }} /> Items to Despatch
            {inwardId && (
              <span className="text-xs font-normal text-gray-400 ml-1">
                ({items.filter(it => parseFloat(it.qty_balance) > 0).length} pending items)
              </span>
            )}
          </h3>
          {inwardId && items.some(it => parseFloat(it.qty_balance) > 0) && (
            <button onClick={despatchAll}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded border transition-all"
              style={{ borderColor: SC.primary, color: SC.primary }}
              data-testid="btn-despatch-all">
              Despatch All Pending
            </button>
          )}
        </div>

        {!inwardId ? (
          <div className="flex flex-col items-center justify-center py-14 text-gray-400">
            <TruckIcon size={32} className="mb-3 opacity-30" />
            <p className="text-sm">Select an Inward Reference above to load items</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wide" style={{ background: "#f8fafb" }}>
                  <th className="px-4 py-3 text-left w-8">#</th>
                  <th className="px-4 py-3 text-left">Item Name</th>
                  <th className="px-4 py-3 text-left">Process</th>
                  <th className="px-4 py-3 text-center">UOM</th>
                  <th className="px-4 py-3 text-right">Inward Qty</th>
                  <th className="px-4 py-3 text-right">Prev Despatched</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3 text-right w-32">Despatch Now *</th>
                  <th className="px-4 py-3 text-left">Remark</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, i) => {
                  const balance = parseFloat(row.qty_balance ?? (parseFloat(row.qty_inward) - parseFloat(row.qty_prev_despatched)));
                  const isFullyDone = balance <= 0;
                  const dVal = parseFloat(row.qty_despatched || 0);
                  const overLimit = dVal > balance;

                  return (
                    <tr key={row.inward_item_id}
                      className={`border-t border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"} ${isFullyDone ? "opacity-40" : ""}`}
                      data-testid={`row-despatch-item-${i}`}>
                      <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{row.item_name}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs">{row.process || "—"}</td>
                      <td className="px-4 py-2.5 text-center text-gray-500 text-xs">{row.unit || "—"}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{parseFloat(row.qty_inward).toFixed(3)}</td>
                      <td className="px-4 py-2.5 text-right text-orange-600">
                        {parseFloat(row.qty_prev_despatched) > 0 ? parseFloat(row.qty_prev_despatched).toFixed(3) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold" style={{ color: balance > 0 ? SC.primary : "#9ca3af" }}>
                        {balance > 0 ? balance.toFixed(3) : "Completed"}
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min="0"
                          max={balance}
                          step="0.001"
                          value={row.qty_despatched}
                          onChange={e => updateQty(row.inward_item_id, e.target.value)}
                          disabled={isFullyDone}
                          className={`w-full border rounded px-2 py-1.5 text-xs text-right outline-none transition-all ${overLimit ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-[#027fa5]"} disabled:bg-gray-100 disabled:cursor-not-allowed`}
                          placeholder="0.000"
                          data-testid={`input-qty-despatch-${i}`} />
                        {overLimit && <div className="text-red-500 text-xs mt-0.5 text-right">Exceeds balance</div>}
                      </td>
                      <td className="px-4 py-2.5">
                        <input value={row.remark || ""} onChange={e => setItems(prev => prev.map(it => it.inward_item_id === row.inward_item_id ? { ...it, remark: e.target.value } : it))}
                          className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs outline-none focus:border-[#027fa5]"
                          placeholder="Optional" data-testid={`input-remark-${i}`} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Footer totals */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
              <span className="text-xs text-gray-500">
                {items.filter(it => parseFloat(it.qty_despatched || 0) > 0).length} of {items.length} items despatching
              </span>
              <div className="flex items-center gap-6 text-sm">
                <span className="text-gray-500">Total Despatching:</span>
                <span className="font-bold text-lg" style={{ color: SC.primary }}>
                  {totalDespatching.toFixed(3)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Despatch List ─────────────────────────────────────────────────────────────
export default function JobWorkDespatch() {
  const qc = useQueryClient();
  const [view, setView] = useState<"list" | "add" | "edit">("list");
  const [editData, setEditData] = useState<any>(null);
  const [search, setSearch] = useState("");

  const { data: records = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/job-work-despatch"] });

  const filtered = records.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.voucher_no?.toLowerCase().includes(q) ||
      r.party_name_db?.toLowerCase().includes(q) ||
      r.inward_voucher_no?.toLowerCase().includes(q) ||
      r.vehicle_no?.toLowerCase().includes(q)
    );
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/job-work-despatch/${id}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/job-work-despatch"] });
      qc.invalidateQueries({ queryKey: ["/api/job-work-inward"] });
    },
  });

  async function openEdit(id: string) {
    const res = await fetch(`/api/job-work-despatch/${id}`, { credentials: "include" });
    const data = await res.json();
    setEditData(data);
    setView("edit");
  }

  if (view === "add") return <DespatchForm onBack={() => setView("list")} />;
  if (view === "edit") return <DespatchForm editData={editData} onBack={() => { setEditData(null); setView("list"); }} />;

  return (
    <div className="min-h-screen p-4" style={{ background: SC.bg }}>
      {/* Page header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold" style={{ color: SC.primary }}>Job Work Despatch</h1>
          <p className="text-xs text-gray-400 mt-0.5">Outward delivery against Job Work Inward</p>
        </div>
        <button
          onClick={() => setView("add")}
          className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-semibold shadow hover:opacity-90 transition-all"
          style={{ background: SC.primary }}
          data-testid="btn-add-despatch">
          <Plus size={16} /> New Despatch
        </button>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by despatch / inward / party / vehicle..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded w-72 outline-none focus:border-[#027fa5] bg-white"
            data-testid="input-search" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100" style={{ background: "#f8fafb" }}>
              <th className="px-5 py-3 text-left">Despatch No</th>
              <th className="px-5 py-3 text-left">Date</th>
              <th className="px-5 py-3 text-left">Inward Ref</th>
              <th className="px-5 py-3 text-left">Party</th>
              <th className="px-5 py-3 text-left">Vehicle</th>
              <th className="px-5 py-3 text-left">LR No</th>
              <th className="px-5 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={7} className="px-5 py-10 text-center text-gray-400 text-sm">Loading...</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-14 text-center">
                  <TruckIcon size={32} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-gray-400 text-sm">No despatch records found</p>
                  <button onClick={() => setView("add")}
                    className="mt-3 text-sm font-semibold px-4 py-1.5 rounded border"
                    style={{ borderColor: SC.primary, color: SC.primary }}
                    data-testid="btn-add-first">
                    Create First Despatch
                  </button>
                </td>
              </tr>
            )}
            {filtered.map((r, i) => (
              <tr key={r.id}
                className={`border-t border-gray-50 hover:bg-[#f0fafd] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                data-testid={`row-despatch-${r.id}`}>
                <td className="px-5 py-2.5 font-semibold" style={{ color: SC.primary }}>{r.voucher_no}</td>
                <td className="px-5 py-2.5 text-gray-600 text-xs">
                  {r.despatch_date ? new Date(r.despatch_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                </td>
                <td className="px-5 py-2.5 text-xs font-medium text-gray-500">{r.inward_voucher_no || "—"}</td>
                <td className="px-5 py-2.5 font-medium text-gray-700">{r.party_name_db || r.party_name_manual || "—"}</td>
                <td className="px-5 py-2.5 text-gray-600 text-xs font-mono">{r.vehicle_no || "—"}</td>
                <td className="px-5 py-2.5 text-gray-500 text-xs">{r.lr_no || "—"}</td>
                <td className="px-5 py-2.5">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(r.id)}
                      className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                      data-testid={`btn-edit-${r.id}`}>
                      <PencilLine size={14} />
                    </button>
                    <button onClick={() => { if (confirm("Delete this despatch?")) delMut.mutate(r.id); }}
                      className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      data-testid={`btn-delete-${r.id}`}>
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
  );
}
