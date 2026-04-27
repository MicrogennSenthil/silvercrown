import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import {
  ReportShell, ReportFilterSelect, RTh, RTd, exportToCSV, printReport,
} from "@/components/ReportShell";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa" };

function today()    { return new Date().toISOString().slice(0, 10); }
function monthAgo() { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10); }
function fmtDate(s: string) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtQty(v: number | string) { return parseFloat(String(v) || "0").toFixed(2); }

type ReportRow = {
  order_id: string; jw_no: string; work_order_no: string;
  jw_date: string; delivery_date: string; despatch_status: string; party_name: string;
  item_id: string; seq_no: number; item_code: string; item_name: string;
  unit: string; ord_qty: string; des_qty: string; pending_qty: string;
};
type OrderGroup = {
  order_id: string; jw_no: string; work_order_no: string;
  jw_date: string; delivery_date: string; despatch_status: string;
  party_name: string; items: ReportRow[];
};

// ── Detail Modal ──────────────────────────────────────────────────────────────
function DetailModal({ order, onClose }: { order: OrderGroup; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
        style={{ fontFamily: "Source Sans Pro, sans-serif" }}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100" style={{ background: SC.tonal }}>
          <div>
            <h3 className="font-bold text-gray-800">JW Detail — {order.jw_no}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Date: <b>{fmtDate(order.jw_date)}</b>
              {order.delivery_date && <> · Delivery: <b>{fmtDate(order.delivery_date)}</b></>}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-500"><X size={16} /></button>
        </div>
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 grid grid-cols-3 gap-4 text-sm">
          <div><div className="text-xs text-gray-400 mb-0.5">Party Name</div><div className="font-semibold">{order.party_name || "—"}</div></div>
          <div><div className="text-xs text-gray-400 mb-0.5">Work Order No</div><div className="font-semibold">{order.work_order_no || "—"}</div></div>
          <div>
            <div className="text-xs text-gray-400 mb-0.5">Despatch Status</div>
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${order.despatch_status === "Partial" ? "bg-amber-50 text-amber-700 border border-amber-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
              {order.despatch_status || "Pending"}
            </span>
          </div>
        </div>
        <div className="overflow-auto flex-1 px-5 py-3">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <RTh>#</RTh><RTh>Item Code</RTh><RTh>Product / Item</RTh>
                <RTh>Unit</RTh><RTh right>Ord Qty</RTh><RTh right>Des Qty</RTh><RTh right>Pending</RTh>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it, idx) => (
                <tr key={it.item_id} className={`border-b border-gray-50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                  <RTd muted>{String(it.seq_no).padStart(2, "0")}</RTd>
                  <RTd muted>{it.item_code || "—"}</RTd>
                  <RTd bold>{it.item_name}</RTd>
                  <RTd>{it.unit}</RTd>
                  <RTd right>{fmtQty(it.ord_qty)}</RTd>
                  <RTd right muted>{fmtQty(it.des_qty)}</RTd>
                  <RTd right><span className="font-bold text-orange-600">{fmtQty(it.pending_qty)}</span></RTd>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: SC.tonal }} className="border-t-2 border-[#027fa5]/30">
                <RTd bold colSpan={4}>Total</RTd>
                <RTd right bold>{fmtQty(order.items.reduce((s, i) => s + parseFloat(i.ord_qty || "0"), 0))}</RTd>
                <RTd right muted>{fmtQty(order.items.reduce((s, i) => s + parseFloat(i.des_qty || "0"), 0))}</RTd>
                <RTd right bold><span className="text-orange-600">{fmtQty(order.items.reduce((s, i) => s + parseFloat(i.pending_qty || "0"), 0))}</span></RTd>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: SC.primary }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Report ───────────────────────────────────────────────────────────────
export default function DespatchPending() {
  const [search,      setSearch]      = useState("");
  const [fromDate,    setFromDate]    = useState(monthAgo());
  const [toDate,      setToDate]      = useState(today());
  const [partyFilter, setPartyFilter] = useState("");
  const [itemFilter,  setItemFilter]  = useState("");
  const [selected,    setSelected]    = useState<OrderGroup | null>(null);
  const [collapsed,   setCollapsed]   = useState<Set<string>>(new Set());

  const { data: rawRows = [], isLoading } = useQuery<ReportRow[]>({
    queryKey: ["/api/reports/despatch-pending", fromDate, toDate],
    queryFn: () =>
      fetch(`/api/reports/despatch-pending?from=${fromDate}&to=${toDate}`, { credentials: "include" })
        .then(r => r.json()),
  });

  // Filter options derived from full data
  const allParties = useMemo(() =>
    [...new Set(rawRows.map(r => r.party_name).filter(Boolean))].sort(), [rawRows]);
  const allItems = useMemo(() =>
    [...new Set(rawRows.map(r => r.item_name).filter(Boolean))].sort(), [rawRows]);

  // Group by order_id
  const groups: OrderGroup[] = useMemo(() => {
    const map = new Map<string, OrderGroup>();
    for (const row of rawRows) {
      if (!map.has(row.order_id)) {
        map.set(row.order_id, {
          order_id: row.order_id, jw_no: row.jw_no, work_order_no: row.work_order_no,
          jw_date: row.jw_date, delivery_date: row.delivery_date,
          despatch_status: row.despatch_status, party_name: row.party_name, items: [],
        });
      }
      map.get(row.order_id)!.items.push(row);
    }
    return Array.from(map.values());
  }, [rawRows]);

  // Apply filters
  const filtered = useMemo(() =>
    groups.filter(g => {
      if (partyFilter && g.party_name !== partyFilter) return false;
      if (itemFilter  && !g.items.some(i => i.item_name === itemFilter)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (![g.jw_no, g.work_order_no, g.party_name, ...g.items.map(i => `${i.item_name} ${i.item_code}`)].join(" ").toLowerCase().includes(q)) return false;
      }
      return true;
    }).map(g => ({
      ...g,
      items: itemFilter ? g.items.filter(i => i.item_name === itemFilter) : g.items,
    })),
  [groups, search, partyFilter, itemFilter]);

  function toggleCollapse(id: string) {
    setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const totalOrders  = filtered.length;
  const totalItems   = filtered.reduce((s, g) => s + g.items.length, 0);
  const totalOrdQty  = filtered.reduce((s, g) => s + g.items.reduce((ss, i) => ss + parseFloat(i.ord_qty || "0"), 0), 0);
  const totalDesQty  = filtered.reduce((s, g) => s + g.items.reduce((ss, i) => ss + parseFloat(i.des_qty || "0"), 0), 0);
  const totalPending = filtered.reduce((s, g) => s + g.items.reduce((ss, i) => ss + parseFloat(i.pending_qty || "0"), 0), 0);

  function handleExcel() {
    const headers = ["S.No","JW No","Work Order No","JW Date","Party Name","Item Code","Product/Item","Unit","Ord Qty","Des Qty","Pending","Status"];
    let sno = 0;
    const rows = filtered.flatMap(g =>
      g.items.map(i => [++sno, g.jw_no, g.work_order_no, g.jw_date, g.party_name,
        i.item_code, i.item_name, i.unit,
        fmtQty(i.ord_qty), fmtQty(i.des_qty), fmtQty(i.pending_qty), g.despatch_status])
    );
    exportToCSV(`DespatchPending_${fromDate}_${toDate}.csv`, headers, rows);
  }

  return (
    <>
      <ReportShell
        title="Despatch Pending"
        search={search} onSearch={setSearch}
        fromDate={fromDate} toDate={toDate}
        onFromDate={setFromDate} onToDate={setToDate}
        onPrint={() => printReport("Despatch Pending")}
        onExcelExport={handleExcel}
        onPdfExport={() => printReport("Despatch Pending")}
        recordCount={totalOrders}
        extraFilters={
          <>
            <ReportFilterSelect
              label="Party" value={partyFilter} onChange={setPartyFilter}
              options={allParties} allLabel="All Parties" />
            <ReportFilterSelect
              label="Item" value={itemFilter} onChange={setItemFilter}
              options={allItems} allLabel="All Items" />
          </>
        }
      >
        {/* Summary strip */}
        {!isLoading && filtered.length > 0 && (
          <div className="flex items-center gap-6 px-5 py-2 border-b border-gray-100 bg-gray-50/50 text-xs">
            <span className="text-gray-500">Orders: <b className="text-gray-800">{totalOrders}</b></span>
            <span className="text-gray-500">Items: <b className="text-gray-800">{totalItems}</b></span>
            <span className="text-gray-500">Order Qty: <b className="text-gray-800">{fmtQty(totalOrdQty)}</b></span>
            <span className="text-gray-500">Despatched: <b className="text-gray-800">{fmtQty(totalDesQty)}</b></span>
            <span className="text-gray-500">Pending: <b className="text-orange-600">{fmtQty(totalPending)}</b></span>
          </div>
        )}

        <table className="w-full text-sm">
          <thead className="sticky top-0">
            <tr>
              <RTh>S.no</RTh><RTh>JW No</RTh><RTh>JW Date</RTh>
              <RTh>Party Name</RTh><RTh>Product Details</RTh>
              <RTh>Unit</RTh><RTh right>Ord Qty</RTh><RTh right>Des Qty</RTh><RTh right>Pending</RTh>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={9} className="px-5 py-14 text-center text-gray-400">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-7 h-7 rounded-full animate-spin" style={{ border: "3px solid #d2f1fa", borderTopColor: "#027fa5" }} />
                  <span>Loading…</span>
                </div>
              </td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={9} className="px-5 py-14 text-center">
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <AlertCircle size={28} className="text-gray-300" />
                  <span className="text-sm">{search || partyFilter || itemFilter ? "No records match the filters." : "No despatch pending items in this date range."}</span>
                </div>
              </td></tr>
            )}
            {!isLoading && filtered.map((g, gi) => {
              const isCollapsed = collapsed.has(g.order_id);
              return [
                // Group header
                <tr key={`hdr-${g.order_id}`}
                  className="border-t border-gray-200 cursor-pointer hover:bg-[#f0f9ff] transition-colors"
                  style={{ background: "#f8fafc" }}
                  onClick={() => toggleCollapse(g.order_id)}
                  data-testid={`row-order-${g.order_id}`}>
                  <RTd bold muted>
                    <span className="flex items-center gap-1">
                      {isCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
                      {String(gi + 1).padStart(2, "0")}
                    </span>
                  </RTd>
                  <RTd bold>
                    <button type="button" onClick={e => { e.stopPropagation(); setSelected(g); }}
                      className="font-bold hover:underline" style={{ color: SC.primary }}
                      data-testid={`btn-view-${g.order_id}`}>{g.jw_no}</button>
                    {g.work_order_no && <div className="text-[10px] text-gray-400 font-normal">WO: {g.work_order_no}</div>}
                  </RTd>
                  <RTd>{fmtDate(g.jw_date)}</RTd>
                  <RTd bold>{g.party_name || "—"}</RTd>
                  <RTd muted><span className="text-xs italic">{g.items.length} item{g.items.length !== 1 ? "s" : ""}</span></RTd>
                  <RTd></RTd>
                  <RTd right bold>{fmtQty(g.items.reduce((s, i) => s + parseFloat(i.ord_qty || "0"), 0))}</RTd>
                  <RTd right muted>{fmtQty(g.items.reduce((s, i) => s + parseFloat(i.des_qty || "0"), 0))}</RTd>
                  <RTd right bold><span className="text-orange-600">{fmtQty(g.items.reduce((s, i) => s + parseFloat(i.pending_qty || "0"), 0))}</span></RTd>
                </tr>,

                // Item rows
                ...(!isCollapsed ? g.items.map((it, ii) => (
                  <tr key={it.item_id} className={`border-t border-gray-50 ${ii % 2 === 0 ? "bg-white" : "bg-gray-50/20"}`}
                    data-testid={`row-item-${it.item_id}`}>
                    <RTd muted><span className="pl-4 text-xs">{String(it.seq_no).padStart(2, "0")}</span></RTd>
                    <RTd muted></RTd><RTd muted></RTd><RTd muted></RTd>
                    <RTd>
                      <span className="font-medium">{it.item_name}</span>
                      {it.item_code && <span className="ml-1.5 text-[11px] text-gray-400">[{it.item_code}]</span>}
                    </RTd>
                    <RTd muted>{it.unit}</RTd>
                    <RTd right>{fmtQty(it.ord_qty)}</RTd>
                    <RTd right muted>{fmtQty(it.des_qty)}</RTd>
                    <RTd right><span className="font-semibold text-orange-600">{fmtQty(it.pending_qty)}</span></RTd>
                  </tr>
                )) : []),
              ];
            })}
          </tbody>
          {!isLoading && filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2" style={{ background: SC.tonal }}>
                <td colSpan={6} className="px-4 py-2.5 text-sm font-bold text-gray-700">
                  Total — {totalOrders} orders · {totalItems} items
                </td>
                <RTd right bold>{fmtQty(totalOrdQty)}</RTd>
                <RTd right muted>{fmtQty(totalDesQty)}</RTd>
                <RTd right bold><span className="text-orange-600">{fmtQty(totalPending)}</span></RTd>
              </tr>
            </tfoot>
          )}
        </table>
      </ReportShell>

      {selected && <DetailModal order={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
