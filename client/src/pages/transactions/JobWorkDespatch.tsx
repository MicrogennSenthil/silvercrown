import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, ChevronDown, Loader2, Trash2, PencilLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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


function DespatchForm({ onBackToList, editId }: { onBackToList: () => void; editId?: string | null }) {
  const qc = useQueryClient();

  // ── Data queries ─────────────────────────────────────────────────────────────
  const { data: inwardList = [] } = useQuery<any[]>({ queryKey: ["/api/job-work-inward"] });
  const { data: customerList = [] } = useQuery<any[]>({ queryKey: ["/api/customers"] });

  // ── Form state ───────────────────────────────────────────────────────────────
  const [editingId,      setEditingId]      = useState<string | null>(null);
  const [voucherNo,      setVoucherNo]      = useState("");
  const [despatchDate,   setDespatchDate]   = useState(today());
  const [notes,          setNotes]          = useState("");
  // Vehicle No — 4-part: state | district | series | number
  const [vehP1, setVehP1] = useState(""); // e.g. TN
  const [vehP2, setVehP2] = useState(""); // e.g. 00
  const [vehP3, setVehP3] = useState(""); // e.g. AB
  const [vehP4, setVehP4] = useState(""); // e.g. 1234
  const vehicleNo = `${vehP1}${vehP2}${vehP3}${vehP4}`;
  const [isInterState,   setIsInterState]   = useState(false);
  const [gridSearch,     setGridSearch]     = useState("");

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
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  const { toast } = useToast();

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
      fetch("/api/voucher-series/next/job_work_despatch", { credentials: "include", cache: "no-store" })
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
            remark:          r.remark || "",
            cgst_rate:       r.cgst_rate || 0,
            sgst_rate:       r.sgst_rate || 0,
            igst_rate:       r.igst_rate || 0,
          }));
        setItems(prev => [...prev.filter(it => it.inward_id !== inward.id), ...newItems]);

        // Auto-fill vehicle no from inward if not already set
        const inwardVeh = (inward.vehicle_no || "").trim().toUpperCase();
        if (inwardVeh && !vehP1) {
          const vm = inwardVeh.match(/^([A-Z]{1,2})(\d{1,2})([A-Z]{1,3})(\d{1,4})$/);
          if (vm) { setVehP1(vm[1]); setVehP2(vm[2]); setVehP3(vm[3]); setVehP4(vm[4]); }
          else setVehP1(inwardVeh);
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

      // Parse vehicle_no into 4 parts
  const vRaw = (data.vehicle_no || "").toUpperCase();
  const vMatch = vRaw.match(/^([A-Z]{1,2})(\d{1,2})([A-Z]{1,3})(\d{1,4})$/);
  if (vMatch) { setVehP1(vMatch[1]); setVehP2(vMatch[2]); setVehP3(vMatch[3]); setVehP4(vMatch[4]); }
  else { setVehP1(vRaw); setVehP2(""); setVehP3(""); setVehP4(""); }

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
        remark:          it.remark || "",
        cgst_rate:       it.cgst_rate || 0,
        sgst_rate:       it.sgst_rate || 0,
        igst_rate:       it.igst_rate || 0,
      })));
      setIsInterState(data.is_inter_state || false);
    } catch {}
  }

  // Auto-load record when editId prop is provided
  useEffect(() => {
    if (editId) loadDespatch(editId);
  }, [editId]);

  // ── Reset form → go back to list ──────────────────────────────────────────────
  function resetForm() {
    onBackToList();
  }

  // ── Remove all items ──────────────────────────────────────────────────────────
  function removeAllItems() {
    setItems([]);
    setCheckedInwardIds(new Set());
    setSelectedRows(new Set());
  }

  // ── Remove selected rows ──────────────────────────────────────────────────────
  function removeSelectedItems() {
    const remaining = items.filter((_, i) => !selectedRows.has(i));
    // Uncheck any inward whose items are entirely removed
    const remainingInwardIds = new Set(remaining.map(it => it.inward_id).filter(Boolean));
    setCheckedInwardIds(prev => {
      const next = new Set<string>();
      prev.forEach(id => { if (remainingInwardIds.has(id)) next.add(id); });
      return next;
    });
    setItems(remaining);
    setSelectedRows(new Set());
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
      toast({ title: "Despatch saved", description: "Job work despatch saved successfully.", variant: "default" });
      if (!editingId) onBackToList();
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  function handleSave() {
    const activeItems = items.filter(it => parseFloat(it.qty || 0) > 0);
    if (!activeItems.length) { toast({ title: "No items", description: "Add at least one item to despatch.", variant: "destructive" }); return; }

    const isNew = !editingId;          // capture NOW — no closure issues
    const [primaryInward] = [...checkedInwardIds];

    saveMut.mutate({
      voucher_no:   voucherNo,
      despatch_date: despatchDate,
      inward_id:    primaryInward || null,
      party_id:     partyId || null,
      party_name_manual: partySearch,
      vehicle_no:   vehicleNo,
      notes,
      is_inter_state: isInterState,
      items: activeItems.map(it => {
        const tax = rowTax(it);
        return {
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
          remark:          it.remark || "",
          cgst_rate:       isInterState ? 0 : it.cgst_rate || 0,
          sgst_rate:       isInterState ? 0 : it.sgst_rate || 0,
          igst_rate:       isInterState ? it.igst_rate || 0 : 0,
          cgst_amt:        tax.cgst,
          sgst_amt:        tax.sgst,
          igst_amt:        tax.igst,
        };
      }),
    }, {
      onSuccess: () => { if (isNew) resetForm(); },
    });
  }

  // ── Computed totals ───────────────────────────────────────────────────────────
  const totalQty    = items.reduce((s, it) => s + parseFloat(it.qty || 0), 0);
  const totalAmount = items.reduce((s, it) => s + parseFloat(it.qty || 0) * parseFloat(it.rate || 0), 0);
  // Per-row tax calculations (based on Within/Inter-State toggle)
  function rowTax(row: any) {
    const base = parseFloat(row.qty || 0) * parseFloat(row.rate || 0);
    if (isInterState) {
      return { cgst: 0, sgst: 0, igst: base * parseFloat(row.igst_rate || 0) / 100 };
    }
    return {
      cgst: base * parseFloat(row.cgst_rate || 0) / 100,
      sgst: base * parseFloat(row.sgst_rate || 0) / 100,
      igst: 0,
    };
  }
  const totalCgst   = items.reduce((s, it) => s + rowTax(it).cgst, 0);
  const totalSgst   = items.reduce((s, it) => s + rowTax(it).sgst, 0);
  const totalIgst   = items.reduce((s, it) => s + rowTax(it).igst, 0);
  const totalWithTax = totalAmount + totalCgst + totalSgst + totalIgst;

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
          <div className="flex items-center gap-3">
            <button onClick={onBackToList} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors" data-testid="btn-back-to-list">
              ← Back
            </button>
            <span className="text-gray-300">|</span>
            <h2 className="text-base font-bold" style={{ color: SC.primary }}>
              {editingId ? "Edit Despatch" : "New Despatch"}
            </h2>
          </div>
        </div>

        <div className="p-5">

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
            {/* Vehicle No — 4-part input */}
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Vehicle No</label>
              <div className="flex border border-gray-300 rounded overflow-hidden" style={{ height: 42 }}>
                {[
                  { val: vehP1, set: setVehP1, w: 44, ph: "TN",   maxLen: 2, upper: true },
                  { val: vehP2, set: setVehP2, w: 36, ph: "00",   maxLen: 2, upper: false },
                  { val: vehP3, set: setVehP3, w: 44, ph: "AB",   maxLen: 3, upper: true },
                  { val: vehP4, set: setVehP4, w: 52, ph: "1234", maxLen: 4, upper: false },
                ].map((p, idx) => (
                  <input key={idx}
                    value={p.val}
                    maxLength={p.maxLen}
                    onChange={e => p.set(p.upper ? e.target.value.toUpperCase().replace(/[^A-Z]/g, "") : e.target.value.replace(/\D/g, ""))}
                    placeholder={p.ph}
                    className={`py-2.5 text-sm font-semibold text-center outline-none uppercase tracking-wider ${idx < 3 ? "border-r border-gray-300" : ""}`}
                    style={{ width: p.w }}
                    data-testid={`input-veh-p${idx+1}`}
                  />
                ))}
              </div>
            </div>
            {/* Within State / Inter-State toggle */}
            <div className="flex items-center gap-0 border border-gray-300 rounded overflow-hidden h-[42px] shrink-0">
              <button type="button"
                onClick={() => setIsInterState(false)}
                className="px-3 py-2 text-xs font-semibold transition-colors"
                style={{ background: !isInterState ? SC.primary : "#f9fafb", color: !isInterState ? "#fff" : "#374151" }}
                data-testid="btn-within-state">
                Within State
              </button>
              <button type="button"
                onClick={() => setIsInterState(true)}
                className="px-3 py-2 text-xs font-semibold transition-colors border-l border-gray-300"
                style={{ background: isInterState ? SC.orange : "#f9fafb", color: isInterState ? "#fff" : "#374151" }}
                data-testid="btn-inter-state">
                Inter-State
              </button>
            </div>
            {/* Grid search box */}
            <div className="relative flex-1">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Search Items</label>
              <div className="flex items-center border border-gray-300 rounded px-3 py-2.5 gap-2 bg-white">
                <Search size={14} className="text-gray-400 shrink-0" />
                <input
                  value={gridSearch}
                  onChange={e => setGridSearch(e.target.value)}
                  placeholder="Filter by item code, name or inward no…"
                  className="flex-1 text-sm outline-none bg-transparent"
                  data-testid="input-grid-search"
                />
              </div>
            </div>
          </div>

          {/* ── Items Grid ───────────────────────────────────────────────────── */}
          <div className="border border-gray-200 rounded overflow-hidden mb-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[900px]">
                <thead>
                  <tr className="font-semibold text-gray-600 uppercase tracking-wide border-b border-gray-200" style={{ background: "#f0f7fa" }}>
                    <th className="px-3 py-2.5 text-center w-9">
                      <input type="checkbox"
                        checked={items.length > 0 && selectedRows.size === items.length}
                        onChange={e => setSelectedRows(e.target.checked ? new Set(items.map((_, i) => i)) : new Set())}
                        className="accent-[#027fa5] cursor-pointer"
                        data-testid="checkbox-select-all" />
                    </th>
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
                    <th className="px-3 py-2.5 text-right w-24">Tot.Amt ₹</th>
                    <th className="px-3 py-2.5 text-right w-24" style={{ color: isInterState ? "#9ca3af" : SC.primary }}>CGST Amt</th>
                    <th className="px-3 py-2.5 text-right w-24" style={{ color: isInterState ? "#9ca3af" : SC.primary }}>SGST Amt</th>
                    <th className="px-3 py-2.5 text-right w-24" style={{ color: isInterState ? SC.orange : "#9ca3af" }}>IGST Amt</th>
                    <th className="px-3 py-2.5 text-left min-w-[160px]">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const q = gridSearch.trim().toLowerCase();
                    const filtered = q
                      ? items.filter(it =>
                          it.item_code?.toLowerCase().includes(q) ||
                          it.item_name?.toLowerCase().includes(q) ||
                          it.inward_voucher?.toLowerCase().includes(q)
                        )
                      : items;
                    if (filtered.length === 0) return (
                      <tr>
                        <td colSpan={17} className="px-4 py-10 text-center text-gray-300 text-sm italic">
                          {q ? "No items match your search" : partyId ? "Check an inward to load items" : "Select a party and check an inward"}
                        </td>
                      </tr>
                    );
                    return filtered.map((row, i) => {
                      const origIdx = items.indexOf(row);
                      const isChecked = selectedRows.has(origIdx);
                      return (
                    <tr key={`${row.inward_item_id}-${i}`}
                      className={`border-t border-gray-100 ${isChecked ? "bg-blue-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                      data-testid={`row-item-${i}`}>
                      <td className="px-3 py-1.5 text-center">
                        <input type="checkbox" checked={isChecked}
                          onChange={e => setSelectedRows(prev => {
                            const next = new Set(prev);
                            e.target.checked ? next.add(origIdx) : next.delete(origIdx);
                            return next;
                          })}
                          className="accent-[#027fa5] cursor-pointer"
                          data-testid={`checkbox-row-${i}`} />
                      </td>
                      <td className="px-3 py-1.5 text-gray-400">{i + 1}</td>
                      <td className="px-3 py-1.5 text-gray-600 font-mono">{row.item_code || "—"}</td>
                      <td className="px-3 py-1.5 font-medium text-gray-800">{row.item_name}</td>
                      <td className="px-3 py-1.5 text-gray-500">{row.hsn || "—"}</td>
                      {/* Qty — editable */}
                      <td className="px-1.5 py-1">
                        <input
                          type="number" min="0" step="0.001"
                          value={row.qty}
                          onChange={e => updateItem(origIdx, "qty", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-right text-xs outline-none focus:border-[#027fa5]"
                          data-testid={`input-qty-${i}`} />
                      </td>
                      <td className="px-3 py-1.5 text-center text-gray-500">{row.unit || "—"}</td>
                      {/* Rate — editable */}
                      <td className="px-1.5 py-1">
                        <input
                          type="number" min="0" step="0.01"
                          value={row.rate}
                          onChange={e => updateItem(origIdx, "rate", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-right text-xs outline-none focus:border-[#027fa5]"
                          placeholder="0.00"
                          data-testid={`input-rate-${i}`} />
                      </td>
                      <td className="px-3 py-1.5 text-gray-500">{row.party_dc || "—"}</td>
                      <td className="px-3 py-1.5 text-gray-500">{row.work_order_no || "—"}</td>
                      <td className="px-3 py-1.5 text-gray-500">{row.process || "—"}</td>
                      <td className="px-3 py-1.5 font-medium" style={{ color: SC.primary }}>{row.inward_voucher || "—"}</td>
                      {/* Tot.Amt ₹ */}
                      <td className="px-3 py-1.5 text-right font-semibold text-gray-700">
                        {(parseFloat(row.qty || 0) * parseFloat(row.rate || 0)) > 0
                          ? fmtAmount(parseFloat(row.qty) * parseFloat(row.rate))
                          : "—"}
                      </td>
                      {/* CGST Amt */}
                      <td className="px-3 py-1.5 text-right text-xs" style={{ color: isInterState ? "#d1d5db" : SC.primary }}>
                        {!isInterState && rowTax(row).cgst > 0 ? fmtAmount(rowTax(row).cgst) : "—"}
                      </td>
                      {/* SGST Amt */}
                      <td className="px-3 py-1.5 text-right text-xs" style={{ color: isInterState ? "#d1d5db" : SC.primary }}>
                        {!isInterState && rowTax(row).sgst > 0 ? fmtAmount(rowTax(row).sgst) : "—"}
                      </td>
                      {/* IGST Amt */}
                      <td className="px-3 py-1.5 text-right text-xs" style={{ color: isInterState ? SC.orange : "#d1d5db" }}>
                        {isInterState && rowTax(row).igst > 0 ? fmtAmount(rowTax(row).igst) : "—"}
                      </td>
                      {/* Remark + per-row delete */}
                      <td className="px-1.5 py-1">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={row.remark || ""}
                            onChange={e => updateItem(origIdx, "remark", e.target.value)}
                            placeholder="Remark…"
                            className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-[#027fa5] min-w-0"
                            data-testid={`input-remark-${i}`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const remaining = items.filter((_, ii) => ii !== origIdx);
                              const remainingInwardIds = new Set(remaining.map(it => it.inward_id).filter(Boolean));
                              setCheckedInwardIds(prev => {
                                const next = new Set<string>();
                                prev.forEach(id => { if (remainingInwardIds.has(id)) next.add(id); });
                                return next;
                              });
                              setItems(remaining);
                              setSelectedRows(new Set());
                            }}
                            className="shrink-0 p-1 rounded hover:bg-red-50 hover:text-red-500 text-gray-400 transition-colors"
                            data-testid={`btn-delete-row-${i}`}
                            title="Remove row">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ); }); })()}
                </tbody>
              </table>
            </div>

            {/* Footer row */}
            <div className="border-t border-gray-200 bg-gray-50">
              {/* Buttons row */}
              <div className="flex items-center gap-2 px-4 pt-2.5 pb-1">
                <button onClick={removeAllItems}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors"
                  data-testid="btn-remove-all">
                  <Trash2 size={12} /> Remove all
                </button>
                {selectedRows.size > 0 && (
                  <button onClick={removeSelectedItems}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-300 text-red-600 rounded bg-red-50 hover:bg-red-100 transition-colors"
                    data-testid="btn-remove-selected">
                    <Trash2 size={12} /> Remove selected ({selectedRows.size})
                  </button>
                )}
              </div>
              {/* Totals row */}
              <div className="flex items-center justify-end gap-6 px-4 pb-2.5 flex-wrap">
                <div className="flex items-center gap-2 text-gray-500 text-xs">
                  Total Qty :
                  <span className="font-bold text-gray-700 text-sm min-w-[40px] text-right">
                    {totalQty > 0 ? totalQty.toFixed(3) : "00"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 text-xs">
                  Taxable Amt :
                  <span className="font-bold text-gray-800 text-sm">{fmtAmount(totalAmount)}</span>
                </div>
                {!isInterState && (
                  <>
                    <div className="flex items-center gap-2 text-xs" style={{ color: SC.primary }}>
                      CGST :
                      <span className="font-bold text-sm">{fmtAmount(totalCgst)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs" style={{ color: SC.primary }}>
                      SGST :
                      <span className="font-bold text-sm">{fmtAmount(totalSgst)}</span>
                    </div>
                  </>
                )}
                {isInterState && (
                  <div className="flex items-center gap-2 text-xs" style={{ color: SC.orange }}>
                    IGST :
                    <span className="font-bold text-sm">{fmtAmount(totalIgst)}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 font-semibold text-gray-700">
                  Total (with Tax) :
                  <span className="font-bold text-base ml-1">{fmtAmount(totalWithTax)}</span>
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

// ── Job Work Despatch List (default export) ───────────────────────────────────
export default function JobWorkDespatch() {
  const [view, setView] = useState<"list" | "form">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: records = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/job-work-despatch"] });

  const filtered = records.filter((r: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.voucher_no?.toLowerCase().includes(q) ||
      r.party_name_db?.toLowerCase().includes(q) ||
      r.party_name_manual?.toLowerCase().includes(q) ||
      r.inward_voucher_no?.toLowerCase().includes(q) ||
      r.vehicle_no?.toLowerCase().includes(q)
    );
  });

  if (view === "form") {
    return <DespatchForm editId={editId} onBackToList={() => { setEditId(null); setView("list"); }} />;
  }

  return (
    <div className="p-6" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h1 className="font-semibold text-gray-800 text-base">Job Work Despatch</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by voucher / party / vehicle..."
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
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Inward Ref</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Vehicle</th>
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
                    <div className="text-sm font-medium">No despatch entries yet</div>
                    <div className="text-xs">Click "+ New" to create your first Job Work Despatch</div>
                  </div>
                </td>
              </tr>
            )}
            {filtered.map((r: any, i: number) => (
              <tr key={r.id} className={`border-t border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                data-testid={`row-despatch-${r.id}`}>
                <td className="px-5 py-2.5 text-gray-500">{i + 1}</td>
                <td className="px-5 py-2.5 font-semibold" style={{ color: SC.primary }}>{r.voucher_no}</td>
                <td className="px-5 py-2.5 text-gray-600 text-xs">{r.despatch_date ? new Date(r.despatch_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                <td className="px-5 py-2.5 font-medium text-gray-700">{r.party_name_db || r.party_name_manual || <span className="text-gray-300">—</span>}</td>
                <td className="px-5 py-2.5 text-gray-600 text-xs">{r.inward_voucher_no || <span className="text-gray-300">—</span>}</td>
                <td className="px-5 py-2.5 text-gray-600 text-xs font-mono tracking-wide">{r.vehicle_no ? String(r.vehicle_no).toUpperCase() : <span className="text-gray-300">—</span>}</td>
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
