import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Check, X, ChevronDown, ChevronRight, CheckSquare, Eye, MessageSquare } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };
const fmt = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const n2 = (v: number) => v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function StatusBadge({ status, decisions, totalLevels }: { status: string; decisions: any[]; totalLevels: number }) {
  const approvedCount = decisions.filter((d: any) => d.status === "Approved").length;
  if (status === "Approved")    return <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700">Approved</span>;
  if (status === "Rejected")    return <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">Rejected</span>;
  if (status === "Pending Approval" && approvedCount > 0)
    return <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">
      Level {approvedCount}/{totalLevels}
    </span>;
  return <span className="px-2 py-0.5 rounded text-xs font-bold bg-yellow-100 text-yellow-800">Unapproved</span>;
}

function ApprovalLevelPips({ decisions, totalLevels }: { decisions: any[]; totalLevels: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: totalLevels }, (_, i) => {
        const dec = decisions.find((d: any) => d.level === i+1 || d.approval_level === i+1);
        const approved = dec?.status === "Approved";
        const rejected = dec?.status === "Rejected";
        return (
          <div key={i} title={dec ? `${dec.level_name}: ${dec.status}${dec.approver_name ? ` by ${dec.approver_name}` : ""}` : `Level ${i+1}: Pending`}
            className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold cursor-pointer
              ${approved ? "bg-green-500 text-white" : rejected ? "bg-red-400 text-white" : "bg-gray-200 text-gray-500"}`}>
            {approved ? <Check size={10}/> : rejected ? <X size={10}/> : i+1}
          </div>
        );
      })}
    </div>
  );
}

function CommentsModal({ onConfirm, onCancel, mode }: { onConfirm: (c: string) => void; onCancel: () => void; mode: "approve"|"reject" }) {
  const [comment, setComment] = useState("");
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h3 className="font-semibold text-gray-800 mb-1">{mode === "approve" ? "Confirm Approval" : "Confirm Rejection"}</h3>
        <p className="text-sm text-gray-500 mb-4">{mode === "approve" ? "Add an optional comment before approving." : "Please provide a reason for rejection."}</p>
        <textarea value={comment} onChange={e => setComment(e.target.value)}
          placeholder={mode === "approve" ? "Optional comment…" : "Reason for rejection (required)"}
          className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-[#027fa5] resize-none h-24 mb-4"/>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-6 py-2 border border-gray-300 rounded text-sm font-semibold text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={() => onConfirm(comment)}
            className="px-8 py-2 rounded text-sm font-semibold text-white"
            style={{ background: mode === "approve" ? SC.primary : "#dc2626" }}>
            {mode === "approve" ? "Approve" : "Reject"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PoDetailDrawer({ po, levels, onClose }: { po: any; levels: any[]; onClose: () => void }) {
  const { data: detail } = useQuery<any>({
    queryKey: [`/api/purchase-orders/${po.id}`],
    queryFn: () => fetch(`/api/purchase-orders/${po.id}`, { credentials: "include" }).then(r => r.json()),
  });

  return (
    <div className="fixed inset-0 bg-black/30 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-xl h-full bg-white shadow-xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ background: SC.primary }}>
          <div>
            <h3 className="font-bold text-white text-sm">{po.voucher_no}</h3>
            <p className="text-xs text-blue-100">{po.supplier_name} · {fmt(po.po_date)}</p>
          </div>
          <button onClick={onClose} className="text-white hover:text-blue-200"><X size={18}/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Bill Value", value: `₹ ${n2(po.bill_value)}` },
              { label: "Payment", value: po.payment_mode },
              { label: "Priority", value: po.priority },
            ].map(f => (
              <div key={f.label} className="p-3 rounded-lg" style={{ background: SC.tonal }}>
                <div className="text-xs text-gray-500">{f.label}</div>
                <div className="font-semibold text-gray-800 text-sm">{f.value}</div>
              </div>
            ))}
          </div>

          {/* Approval Progress */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Approval Progress</h4>
            <div className="space-y-2">
              {levels.map((lvl: any) => {
                const dec = po.decisions.find((d: any) => d.level === lvl.approval_level || d.approval_level === lvl.approval_level);
                return (
                  <div key={lvl.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
                      ${dec?.status==="Approved" ? "bg-green-500 text-white" : dec?.status==="Rejected" ? "bg-red-400 text-white" : "bg-gray-200 text-gray-500"}`}>
                      {dec?.status==="Approved" ? <Check size={12}/> : dec?.status==="Rejected" ? <X size={12}/> : lvl.approval_level}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800">{lvl.name}</div>
                      {dec?.status === "Approved" && (
                        <div className="text-xs text-green-600">Approved by {dec.approver_name} · {dec.decided_at ? new Date(dec.decided_at).toLocaleString("en-IN") : ""}</div>
                      )}
                      {dec?.status === "Rejected" && (
                        <div className="text-xs text-red-500">Rejected by {dec.approver_name} — {dec.comments}</div>
                      )}
                      {!dec && <div className="text-xs text-gray-400">Awaiting approval</div>}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold
                      ${dec?.status==="Approved" ? "bg-green-100 text-green-700" : dec?.status==="Rejected" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"}`}>
                      {dec?.status || "Pending"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Items */}
          {detail?.items?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items</h4>
              <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
                <div className="grid bg-gray-50 border-b font-semibold text-gray-600" style={{ gridTemplateColumns: "1fr 60px 60px 70px 80px" }}>
                  {["Item Name","Qty","Unit","Rate","Total"].map(h => <div key={h} className="px-2 py-2">{h}</div>)}
                </div>
                {detail.items.map((it: any, i: number) => (
                  <div key={i} className="grid border-b last:border-0 hover:bg-gray-50" style={{ gridTemplateColumns: "1fr 60px 60px 70px 80px" }}>
                    <div className="px-2 py-2 font-medium text-gray-700">{it.item_name}</div>
                    <div className="px-2 py-2 text-right text-gray-600">{it.qty}</div>
                    <div className="px-2 py-2 text-gray-500">{it.unit}</div>
                    <div className="px-2 py-2 text-right text-gray-600">{n2(parseFloat(it.rate)||0)}</div>
                    <div className="px-2 py-2 text-right font-semibold text-gray-800">{n2(parseFloat(it.total)||0)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function PurchaseOrderApproval() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState<"approve"|"reject"|null>(null);
  const [detailPo, setDetailPo] = useState<any>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(searchRef.current);
  }, [search]);

  const { data: levels = [] } = useQuery<any[]>({
    queryKey: ["/api/purchase-order-approval/levels"],
  });

  const { data: pos = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/purchase-order-approval", debouncedSearch],
    queryFn: async () => {
      const url = debouncedSearch
        ? `/api/purchase-order-approval?search=${encodeURIComponent(debouncedSearch)}`
        : "/api/purchase-order-approval";
      const r = await fetch(url, { credentials: "include" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Failed to load");
      return Array.isArray(j) ? j : [];
    },
  });

  const totalLevels = (levels as any[]).length || 1;

  const approveMut = useMutation({
    mutationFn: ({ ids, comments }: { ids: string[]; comments: string }) =>
      fetch("/api/purchase-order-approval/approve", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ po_ids: ids, comments }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/purchase-order-approval"] });
      qc.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setSelected(new Set());
      setShowModal(null);
    },
  });

  const rejectMut = useMutation({
    mutationFn: ({ ids, comments }: { ids: string[]; comments: string }) =>
      fetch("/api/purchase-order-approval/reject", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ po_ids: ids, comments }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/purchase-order-approval"] });
      qc.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setSelected(new Set());
      setShowModal(null);
    },
  });

  const resetMut = useMutation({
    mutationFn: (ids: string[]) =>
      fetch("/api/purchase-order-approval/reset", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ po_ids: ids }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/purchase-order-approval"] });
      qc.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
      setSelected(new Set());
    },
  });

  function toggleSelect(id: string) {
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  }
  function toggleAll() {
    if (selected.size === (pos as any[]).length) setSelected(new Set());
    else setSelected(new Set((pos as any[]).map((p: any) => p.id)));
  }

  const selectedIds = Array.from(selected);
  const hasSelected = selectedIds.length > 0;

  // Summary counts
  const counts = {
    unapproved: (pos as any[]).filter((p: any) => !["Approved","Rejected"].includes(p.status)).length,
    approved: (pos as any[]).filter((p: any) => p.status === "Approved").length,
    rejected: (pos as any[]).filter((p: any) => p.status === "Rejected").length,
  };

  return (
    <div className="p-4 md:p-6" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-sm">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Purchase Order Approval</h2>

            {/* Approval levels display */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Approval Levels:</span>
              {(levels as any[]).map((lvl: any, i: number) => (
                <div key={lvl.id} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight size={10} className="text-gray-400"/>}
                  <span className="px-2 py-0.5 rounded font-semibold" style={{ background: SC.tonal, color: SC.primary }}>
                    L{lvl.approval_level}: {lvl.name.replace(/Level \d+ - /,"").substring(0,20)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary cards */}
          <div className="flex items-center gap-4 mb-4">
            {[
              { label: "Pending Approval", count: counts.unapproved, color: "#d97706", bg: "#fef3c7" },
              { label: "Approved", count: counts.approved, color: "#059669", bg: "#d1fae5" },
              { label: "Rejected", count: counts.rejected, color: "#dc2626", bg: "#fee2e2" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ background: s.bg }}>
                <span className="font-bold text-lg" style={{ color: s.color }}>{s.count}</span>
                <span className="text-xs font-medium" style={{ color: s.color }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* Search bar */}
          <div className="relative max-w-lg">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by PO no, supplier name, item name, qty, rate, status…"
              className="w-full border border-gray-300 rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none focus:border-[#027fa5] transition-colors"
              data-testid="input-search"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={13}/>
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200" style={{ background: "#e8f6fb" }}>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox"
                    checked={hasSelected && selected.size === (pos as any[]).length}
                    onChange={toggleAll}
                    className="accent-[#027fa5]"
                    data-testid="chk-all"/>
                </th>
                {["PO No","PO Date","Supplier Name","Bill Value ₹","Payment","Priority","Approval Progress","Status","Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-700">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
              )}
              {!isLoading && (pos as any[]).length === 0 && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-sm text-gray-400">
                  {search ? "No purchase orders match your search" : "No purchase orders found"}
                </td></tr>
              )}
              {(pos as any[]).map((po: any) => (
                <tr key={po.id}
                  className={`border-b last:border-0 transition-colors ${selected.has(po.id) ? "bg-[#d2f1fa]" : "hover:bg-[#f0f9ff]"}`}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(po.id)} onChange={() => toggleSelect(po.id)}
                      className="accent-[#027fa5]" data-testid={`chk-${po.id}`}/>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-sm" style={{ color: SC.primary }}>{po.voucher_no}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-sm">{fmt(po.po_date)}</td>
                  <td className="px-4 py-3 text-gray-800 text-sm font-medium">{po.supplier_name || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-gray-800">₹ {n2(po.bill_value)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${po.payment_mode==="Credit"?"bg-orange-50 text-orange-700":"bg-blue-50 text-blue-600"}`}>
                      {po.payment_mode}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${po.priority==="High"?"bg-red-100 text-red-700":po.priority==="Medium"?"bg-yellow-100 text-yellow-700":"bg-blue-100 text-blue-700"}`}>
                      {po.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ApprovalLevelPips decisions={po.decisions||[]} totalLevels={totalLevels}/>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={po.status} decisions={po.decisions||[]} totalLevels={totalLevels}/>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button title="View details" onClick={() => setDetailPo(po)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-[#027fa5]"
                        data-testid={`btn-view-${po.id}`}>
                        <Eye size={13}/>
                      </button>
                      {!["Approved","Rejected"].includes(po.status) && (
                        <button title="Quick approve" onClick={() => {
                          setSelected(new Set([po.id]));
                          setShowModal("approve");
                        }}
                          className="p-1.5 rounded hover:bg-green-50 text-green-500 hover:text-green-700"
                          data-testid={`btn-approve-${po.id}`}>
                          <Check size={13}/>
                        </button>
                      )}
                      {!["Approved","Rejected"].includes(po.status) && (
                        <button title="Reject" onClick={() => {
                          setSelected(new Set([po.id]));
                          setShowModal("reject");
                        }}
                          className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600"
                          data-testid={`btn-reject-${po.id}`}>
                          <X size={13}/>
                        </button>
                      )}
                      {["Approved","Rejected"].includes(po.status) && (
                        <button title="Reset to Draft" onClick={() => resetMut.mutate([po.id])}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 text-xs font-semibold"
                          data-testid={`btn-reset-${po.id}`}>
                          ↺
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <div className="text-sm text-gray-500">
            {hasSelected
              ? <span className="font-semibold" style={{ color: SC.primary }}>{selectedIds.length} PO{selectedIds.length>1?"s":""} selected</span>
              : <span>{(pos as any[]).length} purchase order{(pos as any[]).length!==1?"s":""}</span>}
          </div>
          <div className="flex items-center gap-3">
            {hasSelected && (
              <button onClick={() => setSelected(new Set())}
                className="px-4 py-2 border border-gray-300 rounded text-sm font-semibold text-gray-600 hover:bg-gray-50"
                data-testid="btn-clear-sel">
                Clear
              </button>
            )}
            <button
              onClick={() => hasSelected ? setShowModal("reject") : undefined}
              disabled={!hasSelected || rejectMut.isPending}
              className="px-8 py-2 border border-gray-300 rounded text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              data-testid="btn-reject">
              Reject
            </button>
            <button
              onClick={() => hasSelected ? setShowModal("approve") : undefined}
              disabled={!hasSelected || approveMut.isPending}
              className="px-10 py-2 rounded text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: hasSelected ? SC.orange : "#ccc" }}
              data-testid="btn-approve">
              {approveMut.isPending ? "Approving…" : `Approve${selectedIds.length > 1 ? ` (${selectedIds.length})` : ""}`}
            </button>
          </div>
        </div>
      </div>

      {/* Comments / Confirm Modal */}
      {showModal && (
        <CommentsModal
          mode={showModal}
          onCancel={() => setShowModal(null)}
          onConfirm={comment => {
            if (showModal === "approve") approveMut.mutate({ ids: selectedIds, comments: comment });
            else rejectMut.mutate({ ids: selectedIds, comments: comment });
          }}
        />
      )}

      {/* Detail Drawer */}
      {detailPo && (
        <PoDetailDrawer po={detailPo} levels={levels as any[]} onClose={() => setDetailPo(null)}/>
      )}
    </div>
  );
}
