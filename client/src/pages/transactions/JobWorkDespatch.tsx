import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ChevronDown, Loader2, AlertCircle, CheckCircle2, Info, Trash2 } from "lucide-react";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

function today() { return new Date().toISOString().split("T")[0]; }

function fmtDate(d: string) {
  if (!d) return "";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtAmount(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Vehicle No = 4 separate parts: state (2) | district (2) | series (2) | number (4)
function parseVehicleNo(vno: string): [string, string, string, string] {
  const parts = (vno || "").trim().toUpperCase().split(/[\s-]+/);
  return [parts[0] || "", parts[1] || "", parts[2] || "", parts[3] || ""];
}

function joinVehicleNo(a: string, b: string, c: string, d: string) {
  return [a, b, c, d].filter(Boolean).join(" ").toUpperCase();
}

export default function JobWorkDespatch() {
  const qc = useQueryClient();

  // ── Data queries ─────────────────────────────────────────────────────────────
  const { data: inwardList = [] } = useQuery<any[]>({ queryKey: ["/api/job-work-inward"] });
  const { data: despatchList = [] } = useQuery<any[]>({ queryKey: ["/api/job-work-despatch"] });
  const { data: customerList = [] } = useQuery<any[]>({ queryKey: ["/api/customers"] });

  // ── Search bar (finds existing despatches) ───────────────────────────────────
  const [searchText, setSearchText]       = useState("");
  const [showSearchDrop, setShowSearchDrop] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const searchResults = searchText.trim()
    ? despatchList.filter(d => {
        const q = searchText.toLowerCase();
        return (
          d.voucher_no?.toLowerCase().includes(q) ||
          d.party_name_db?.toLowerCase().includes(q) ||
          d.inward_voucher_no?.toLowerCase().includes(q) ||
          d.despatch_date?.includes(q)
        );
      }).slice(0, 8)
    : [];

  // Close search dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchDrop(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Form state ───────────────────────────────────────────────────────────────
  const [editingId,      setEditingId]      = useState<string | null>(null);
  const [voucherNo,      setVoucherNo]      = useState("");
  const [despatchDate,   setDespatchDate]   = useState(today());
  const [notes,          setNotes]          = useState("");
  const [vehState,       setVehState]       = useState("");
  const [vehDist,        setVehDist]        = useState("");
  const [vehSeries,      setVehSeries]      = useState("");
  const [vehNum,         setVehNum]         = useState("");

  // Party selection
  const [partyId,        setPartyId]        = useState("");
  const [partySearch,    setPartySearch]    = useState("");
  const [partyDropOpen,  setPartyDropOpen]  = useState(false);
  const partyRef = useRef<HTMLDivElement>(null);

  // Pending inwards for selected party
  const [checkedInwardIds, setCheckedInwardIds] = useState<Set<string>>(new Set());
  const [loadingInwardId,  setLoadingInwardId]  = useState<string | null>(null);

  // Items grid
  const [items, setItems] = useState<any[]>([]);

  // Save state
  const [saveError, setSaveError] = useState("");
  const [saveOk,    setSaveOk]    = useState(false);

  // Close party dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (partyRef.current && !partyRef.current.contains(e.target as Node)) {
        setPartyDropOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Auto-generate voucher number for new despatch
  useEffect(() => {
    if (!editingId && !voucherNo) {
      fetch("/api/voucher-series/next/job_work_despatch", { credentials: "include" })
        .then(r => r.json()).then(d => setVoucherNo(d.voucher_no || "")).catch(() => {});
    }
  }, [editingId]);

  // ── Computed: pending inwards for selected party ──────────────────────────────
  const partyInwards = inwardList.filter(
    r => r.party_id === partyId && r.despatch_status !== "Completed"
  );

  const filteredParties = customerList.filter((c: any) =>
    !partySearch || c.name?.toLowerCase().includes(partySearch.toLowerCase())
  );

  // ── Inward checkbox toggle ────────────────────────────────────────────────────
  async function toggleInward(inward: any, checked: boolean) {
    const newSet = new Set(checkedInwardIds);
    if (checked) {
      newSet.add(inward.id);
      setCheckedInwardIds(newSet);
      // Load balance items for this inward
      setLoadingInwardId(inward.id);
      try {
        const res = await fetch(`/api/job-work-inward/${inward.id}/despatch-items`, { credentials: "include" });
        const rows: any[] = await res.json();
        const newItems = rows
          .filter(r => parseFloat(r.qty_balance) > 0)
          .map(r => ({
            inward_item_id:  r.inward_item_id,
            inward_id:       inward.id,
            inward_voucher:  inward.voucher_no,
            party_dc:        inward.party_dc_no || "",
            work_order_no:   inward.work_order_no || "",
            item_id:         r.item_id,
            item_code:       r.item_code || "",
            item_name:       r.item_name,
            hsn:             r.hsn || "",
            qty:             r.qty_balance,
            unit:            r.unit || "",
            rate:            r.process_price != null ? String(r.process_price) : "",
            process:         r.process || "",
            qty_inward:      r.qty_inward,
            qty_prev_despatched: r.qty_prev_despatched,
          }));
        setItems(prev => [...prev.filter(it => it.inward_id !== inward.id), ...newItems]);

        // Auto-fill vehicle no from inward if not already set
        const inwardVeh = (inward.vehicle_no || "").trim();
        if (inwardVeh) {
          const [s, di, sr, n] = parseVehicleNo(inwardVeh);
          setVehState(prev => prev || s);
          setVehDist(prev => prev || di);
          setVehSeries(prev => prev || sr);
          setVehNum(prev => prev || n);
        }
      } catch {}
      setLoadingInwardId(null);
    } else {
      newSet.delete(inward.id);
      setCheckedInwardIds(newSet);
      setItems(prev => prev.filter(it => it.inward_id !== inward.id));
    }
  }

  // ── Load existing despatch into form ──────────────────────────────────────────
  async function loadDespatch(id: string) {
    try {
      const res = await fetch(`/api/job-work-despatch/${id}`, { credentials: "include" });
      const data = await res.json();

      setEditingId(data.id);
      setVoucherNo(data.voucher_no || "");
      setDespatchDate(data.despatch_date?.split("T")[0] || today());
      setNotes(data.notes || "");

      const [s, di, sr, n] = parseVehicleNo(data.vehicle_no || "");
      setVehState(s); setVehDist(di); setVehSeries(sr); setVehNum(n);

      // Set party
      const pId = data.party_id || "";
      setPartyId(pId);
      const cust = customerList.find((c: any) => c.id === pId);
      setPartySearch(cust?.name || data.party_name_db || data.party_name_manual || "");

      // Mark checked inwards
      const inwardIds = new Set<string>(data.items?.map((it: any) => it.inward_id).filter(Boolean));
      setCheckedInwardIds(inwardIds);

      // Set items from saved data
      const inwardMap: Record<string, any> = {};
      for (const iid of inwardIds) {
        const inw = inwardList.find(r => r.id === iid);
        if (inw) inwardMap[iid] = inw;
      }
      setItems((data.items || []).map((it: any, idx: number) => ({
        inward_item_id:  it.inward_item_id,
        inward_id:       it.inward_id,
        inward_voucher:  inwardMap[it.inward_id]?.voucher_no || "",
        party_dc:        inwardMap[it.inward_id]?.party_dc_no || "",
        work_order_no:   inwardMap[it.inward_id]?.work_order_no || "",
        item_id:         it.item_id,
        item_code:       it.item_code || "",
        item_name:       it.item_name,
        hsn:             it.hsn || "",
        qty:             it.qty_despatched,
        unit:            it.unit || "",
        rate:            it.rate || "",
        process:         it.process || "",
        qty_inward:      it.qty_inward,
        qty_prev_despatched: it.qty_prev_despatched,
      })));

      setSearchText("");
      setShowSearchDrop(false);
    } catch {}
  }

  // ── Reset form ────────────────────────────────────────────────────────────────
  function resetForm() {
    setEditingId(null);
    setVoucherNo("");
    setDespatchDate(today());
    setNotes("");
    setVehState(""); setVehDist(""); setVehSeries(""); setVehNum("");
    setPartyId(""); setPartySearch("");
    setCheckedInwardIds(new Set());
    setItems([]);
    setSaveError("");
    setSaveOk(false);
    // Re-fetch next voucher number
    fetch("/api/voucher-series/next/job_work_despatch", { credentials: "include" })
      .then(r => r.json()).then(d => setVoucherNo(d.voucher_no || "")).catch(() => {});
  }

  // ── Remove all items ──────────────────────────────────────────────────────────
  function removeAllItems() {
    setItems([]);
    setCheckedInwardIds(new Set());
  }

  // ── Update item field ─────────────────────────────────────────────────────────
  function updateItem(idx: number, field: string, val: string) {
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: val } : it));
  }

  // ── Save ──────────────────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async (payload: any) => {
      const url = editingId ? `/api/job-work-despatch/${editingId}` : "/api/job-work-despatch";
      const method = editingId ? "PATCH" : "POST";
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
      setTimeout(() => setSaveOk(false), 2000);
      if (!editingId) resetForm();
    },
    onError: (e: any) => setSaveError(e.message),
  });

  function handleSave() {
    setSaveError("");
    const activeItems = items.filter(it => parseFloat(it.qty || 0) > 0);
    if (!activeItems.length) { setSaveError("No items to despatch."); return; }

    const vehicleNo = joinVehicleNo(vehState, vehDist, vehSeries, vehNum);
    const [primaryInward] = [...checkedInwardIds];

    saveMut.mutate({
      voucher_no:   voucherNo,
      despatch_date: despatchDate,
      inward_id:    primaryInward || null,
      party_id:     partyId || null,
      party_name_manual: partySearch,
      vehicle_no:   vehicleNo,
      notes,
      items: activeItems.map(it => ({
        inward_id:       it.inward_id,
        inward_item_id:  it.inward_item_id,
        item_id:         it.item_id,
        item_code:       it.item_code,
        item_name:       it.item_name,
        unit:            it.unit,
        process:         it.process,
        hsn:             it.hsn,
        qty_inward:      it.qty_inward,
        qty_prev_despatched: it.qty_prev_despatched,
        qty_despatched:  it.qty,
        rate:            it.rate || 0,
        remark:          "",
      })),
    });
  }

  // ── Computed totals ───────────────────────────────────────────────────────────
  const totalQty    = items.reduce((s, it) => s + parseFloat(it.qty || 0), 0);
  const totalAmount = items.reduce((s, it) => s + parseFloat(it.qty || 0) * parseFloat(it.rate || 0), 0);

  // ── Delete existing despatch ──────────────────────────────────────────────────
  const delMut = useMutation({
    mutationFn: async () => {
      await fetch(`/api/job-work-despatch/${editingId}`, { method: "DELETE", credentials: "include" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/job-work-despatch"] });
      qc.invalidateQueries({ queryKey: ["/api/job-work-inward"] });
      resetForm();
    },
  });

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen p-4" style={{ background: SC.bg }}>
      {/* ── Main card ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-base font-bold" style={{ color: SC.primary }}>Job Work Despatch</h2>

          {/* Search existing despatches */}
          <div className="flex items-center gap-2">
            <div className="relative" ref={searchRef}>
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchText}
                onChange={e => { setSearchText(e.target.value); setShowSearchDrop(true); }}
                onFocus={() => setShowSearchDrop(true)}
                placeholder="Search Despatch No, Date and Party Name ..."
                className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-80 outline-none focus:border-[#027fa5] bg-gray-50"
                data-testid="input-search"
              />
              {showSearchDrop && searchResults.length > 0 && (
                <div className="absolute top-full right-0 mt-0.5 w-96 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-64 overflow-y-auto">
                  {searchResults.map(d => (
                    <button key={d.id} onClick={() => loadDespatch(d.id)}
                      className="w-full text-left px-3 py-2.5 hover:bg-[#d2f1fa] border-b border-gray-50 last:border-0 text-sm transition-colors"
                      data-testid={`search-result-${d.id}`}>
                      <div className="font-semibold" style={{ color: SC.primary }}>{d.voucher_no}</div>
                      <div className="text-xs text-gray-500 mt-0.5 flex gap-3">
                        <span>{fmtDate(d.despatch_date)}</span>
                        <span>{d.party_name_db || d.party_name_manual || "—"}</span>
                        <span className="text-gray-400">{d.inward_voucher_no}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400" title="Info">
              <Info size={16} />
            </button>
          </div>
        </div>

        <div className="p-5">
          {saveError && (
            <div className="flex items-center gap-2 mb-3 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
              <AlertCircle size={14} /> {saveError}
            </div>
          )}
          {saveOk && (
            <div className="flex items-center gap-2 mb-3 px-4 py-2 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs">
              <CheckCircle2 size={14} /> Despatch saved successfully!
            </div>
          )}

          {/* ── Row 1: Party + Inward table ─────────────────────────────────── */}
          <div className="flex gap-4 mb-4">
            {/* Party Name dropdown */}
            <div className="flex-[3] relative" ref={partyRef}>
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Party Name</label>
              <div className="flex">
                <input
                  value={partySearch}
                  onChange={e => { setPartySearch(e.target.value); setPartyDropOpen(true); if (!e.target.value) { setPartyId(""); setCheckedInwardIds(new Set()); setItems([]); } }}
                  onFocus={() => setPartyDropOpen(true)}
                  placeholder="Select party..."
                  className="flex-1 border border-gray-300 rounded-l px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                  data-testid="input-party"
                />
                <button type="button" onClick={() => setPartyDropOpen(o => !o)}
                  className="px-3 border border-l-0 border-gray-300 rounded-r bg-gray-50 hover:bg-gray-100">
                  <ChevronDown size={14} className="text-gray-400" />
                </button>
              </div>
              {partyDropOpen && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-44 overflow-y-auto mt-0.5">
                  {filteredParties.length === 0 && (
                    <div className="px-3 py-3 text-xs text-gray-400 text-center">No customers found</div>
                  )}
                  {filteredParties.map((c: any) => (
                    <button key={c.id} onClick={() => {
                      setPartyId(c.id); setPartySearch(c.name); setPartyDropOpen(false);
                      setCheckedInwardIds(new Set()); setItems([]);
                    }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#d2f1fa] border-b border-gray-50 last:border-0"
                      data-testid={`party-option-${c.id}`}>
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Pending Inwards table */}
            <div className="flex-[2] border border-gray-200 rounded overflow-hidden text-xs">
              <table className="w-full">
                <thead>
                  <tr className="text-gray-500 font-semibold uppercase tracking-wide" style={{ background: "#f0f7fa" }}>
                    <th className="px-3 py-2 text-left">INW Date</th>
                    <th className="px-3 py-2 text-left">Inw no</th>
                    <th className="px-3 py-2 text-center">Select</th>
                  </tr>
                </thead>
                <tbody>
                  {!partyId && (
                    <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-300 italic">Select a party first</td></tr>
                  )}
                  {partyId && partyInwards.length === 0 && (
                    <tr><td colSpan={3} className="px-3 py-4 text-center text-gray-300 italic">No pending inwards</td></tr>
                  )}
                  {partyInwards.map(inw => (
                    <tr key={inw.id} className="border-t border-gray-50 hover:bg-[#f7fdff]">
                      <td className="px-3 py-2 text-gray-600">{fmtDate(inw.inward_date)}</td>
                      <td className="px-3 py-2 font-semibold" style={{ color: SC.primary }}>{inw.voucher_no}</td>
                      <td className="px-3 py-2 text-center">
                        {loadingInwardId === inw.id ? (
                          <Loader2 size={13} className="animate-spin text-gray-400 mx-auto" />
                        ) : (
                          <input
                            type="checkbox"
                            checked={checkedInwardIds.has(inw.id)}
                            onChange={e => toggleInward(inw, e.target.checked)}
                            className="w-4 h-4 cursor-pointer accent-[#027fa5]"
                            data-testid={`chk-inward-${inw.id}`}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Row 2: Despatch No + Date + Vehicle No ───────────────────────── */}
          <div className="flex gap-3 mb-4">
            <div className="relative w-36">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Despatch no</label>
              <input value={voucherNo} readOnly
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm font-bold outline-none"
                style={{ color: SC.primary }} data-testid="input-voucher-no" />
            </div>
            <div className="relative w-44">
              <DatePicker label="Despatch Date" value={despatchDate} onChange={setDespatchDate} />
            </div>
            {/* Vehicle No — 4 separate boxes */}
            <div className="relative flex-1">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Vehicle No</label>
              <div className="flex items-center border border-gray-300 rounded overflow-hidden">
                <input value={vehState} onChange={e => setVehState(e.target.value.toUpperCase().slice(0,2))}
                  placeholder="TN" maxLength={2}
                  className="w-12 text-center px-2 py-2.5 text-sm font-semibold border-r border-gray-300 outline-none focus:bg-[#f0fafd] uppercase"
                  data-testid="input-veh-state" />
                <input value={vehDist} onChange={e => setVehDist(e.target.value.replace(/\D/g,'').slice(0,2))}
                  placeholder="00" maxLength={2}
                  className="w-12 text-center px-2 py-2.5 text-sm border-r border-gray-300 outline-none focus:bg-[#f0fafd]"
                  data-testid="input-veh-dist" />
                <input value={vehSeries} onChange={e => setVehSeries(e.target.value.toUpperCase().slice(0,2))}
                  placeholder="AB" maxLength={2}
                  className="w-12 text-center px-2 py-2.5 text-sm font-semibold border-r border-gray-300 outline-none focus:bg-[#f0fafd] uppercase"
                  data-testid="input-veh-series" />
                <input value={vehNum} onChange={e => setVehNum(e.target.value.replace(/\D/g,'').slice(0,4))}
                  placeholder="1234" maxLength={4}
                  className="w-16 text-center px-2 py-2.5 text-sm border-r border-gray-300 outline-none focus:bg-[#f0fafd]"
                  data-testid="input-veh-num" />
                <span className="flex-1 px-2 py-2.5 text-xs text-gray-400 bg-gray-50 font-mono">
                  {joinVehicleNo(vehState, vehDist, vehSeries, vehNum) || "Preview"}
                </span>
              </div>
            </div>
          </div>

          {/* ── Items Grid ───────────────────────────────────────────────────── */}
          <div className="border border-gray-200 rounded overflow-hidden mb-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[900px]">
                <thead>
                  <tr className="font-semibold text-gray-600 uppercase tracking-wide border-b border-gray-200" style={{ background: "#f0f7fa" }}>
                    <th className="px-3 py-2.5 text-left w-10">S.no</th>
                    <th className="px-3 py-2.5 text-left w-24">Item Code</th>
                    <th className="px-3 py-2.5 text-left min-w-[140px]">Item Name</th>
                    <th className="px-3 py-2.5 text-left w-20">HSN no</th>
                    <th className="px-3 py-2.5 text-right w-20">Qty</th>
                    <th className="px-3 py-2.5 text-center w-16">Unit</th>
                    <th className="px-3 py-2.5 text-right w-24">Rate ₹</th>
                    <th className="px-3 py-2.5 text-left w-24">Party Dc</th>
                    <th className="px-3 py-2.5 text-left w-28">Work Ord no</th>
                    <th className="px-3 py-2.5 text-left min-w-[120px]">Nature Of Process</th>
                    <th className="px-3 py-2.5 text-left w-24">Inward No</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-4 py-10 text-center text-gray-300 text-sm italic">
                        {partyId ? "Check an inward to load items" : "Select a party and check an inward"}
                      </td>
                    </tr>
                  )}
                  {items.map((row, i) => (
                    <tr key={`${row.inward_item_id}-${i}`}
                      className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                      data-testid={`row-item-${i}`}>
                      <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-1.5 text-gray-600 font-mono">{row.item_code || "—"}</td>
                      <td className="px-3 py-1.5 font-medium text-gray-800">{row.item_name}</td>
                      <td className="px-3 py-1.5 text-gray-500">{row.hsn || "—"}</td>
                      {/* Qty — editable */}
                      <td className="px-1.5 py-1">
                        <input
                          type="number" min="0" step="0.001"
                          value={row.qty}
                          onChange={e => updateItem(i, "qty", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-right text-xs outline-none focus:border-[#027fa5]"
                          data-testid={`input-qty-${i}`} />
                      </td>
                      <td className="px-3 py-1.5 text-center text-gray-500">{row.unit || "—"}</td>
                      {/* Rate — editable */}
                      <td className="px-1.5 py-1">
                        <input
                          type="number" min="0" step="0.01"
                          value={row.rate}
                          onChange={e => updateItem(i, "rate", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-right text-xs outline-none focus:border-[#027fa5]"
                          placeholder="0.00"
                          data-testid={`input-rate-${i}`} />
                      </td>
                      <td className="px-3 py-1.5 text-gray-500">{row.party_dc || "—"}</td>
                      <td className="px-3 py-1.5 text-gray-500">{row.work_order_no || "—"}</td>
                      <td className="px-3 py-1.5 text-gray-500">{row.process || "—"}</td>
                      <td className="px-3 py-1.5 font-medium" style={{ color: SC.primary }}>{row.inward_voucher || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer row */}
            <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-200 bg-gray-50">
              <button onClick={removeAllItems}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
                data-testid="btn-remove-all">
                <Trash2 size={12} /> Remove all
              </button>
              <div className="flex items-center gap-8 text-sm">
                <div className="flex items-center gap-2 text-gray-500 text-xs">
                  Total Quantity :
                  <span className="font-bold text-gray-700 text-sm min-w-[30px] text-right">
                    {totalQty > 0 ? totalQty.toFixed(3) : "00"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 font-semibold">
                  Total Amount :
                  <span className="font-bold text-base ml-1">
                    {fmtAmount(totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom: Notes + Cancel/Save ──────────────────────────────────── */}
        <div className="flex items-end justify-between px-5 py-4 border-t border-gray-100">
          <div className="relative w-72">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-[#027fa5] resize-none"
              data-testid="input-notes"
            />
          </div>

          <div className="flex items-center gap-3">
            {editingId && (
              <button
                onClick={() => { if (confirm("Delete this despatch?")) delMut.mutate(); }}
                disabled={delMut.isPending}
                className="flex items-center gap-1.5 px-4 py-2 rounded border border-red-300 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
                data-testid="btn-delete">
                <Trash2 size={14} /> Delete
              </button>
            )}
            <button
              onClick={resetForm}
              className="px-6 py-2 rounded border border-gray-300 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
              data-testid="btn-cancel">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saveMut.isPending}
              className="flex items-center gap-2 px-8 py-2 rounded text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-60"
              style={{ background: SC.orange }}
              data-testid="btn-save">
              {saveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
