import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { ReportShell, RTh, RTd, exportToCSV, printReport } from "@/components/ReportShell";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

function today() { return new Date().toISOString().slice(0, 10); }
function monthAgo() {
  const d = new Date(); d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}
function fmtDate(s: string) {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtQty(v: number | string) {
  return parseFloat(String(v) || "0").toFixed(2);
}

type ReportRow = {
  order_id: string;
  order_no: string;
  work_order_no: string;
  order_date: string;
  party_dc_no: string;
  delivery_date: string;
  despatch_status: string;
  party_name: string;
  item_id: string;
  seq_no: number;
  item_code: string;
  item_name: string;
  unit: string;
  order_qty: string;
  despatched_qty: string;
  pending_qty: string;
  process: string;
};

type OrderGroup = {
  order_id: string;
  order_no: string;
  work_order_no: string;
  order_date: string;
  party_name: string;
  delivery_date: string;
  despatch_status: string;
  items: ReportRow[];
};

// ── Detail modal ───────────────────────────────────────────────────────────────
function DetailModal({ order, onClose }: { order: OrderGroup; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col"
        style={{ fontFamily: "Source Sans Pro, sans-serif" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100" style={{ background: SC.tonal }}>
          <div>
            <h3 className="font-bold text-gray-800">Order Detail — {order.order_no}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {order.work_order_no && <span>Work Order: <b>{order.work_order_no}</b> · </span>}
              Date: <b>{fmtDate(order.order_date)}</b>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><X size={17} /></button>
        </div>

        {/* Party info */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-gray-400 font-medium mb-0.5">Party Name</div>
              <div className="font-semibold text-gray-800">{order.party_name || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 font-medium mb-0.5">Delivery Date</div>
              <div className="font-semibold text-gray-700">{fmtDate(order.delivery_date)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 font-medium mb-0.5">Status</div>
              <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded ${
                order.despatch_status === "Partial"
                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}>{order.despatch_status}</span>
            </div>
          </div>
        </div>

        {/* Items table */}
        <div className="overflow-auto flex-1 px-5 py-3">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: SC.tonal }}>
                <RTh>#</RTh>
                <RTh>Item Code</RTh>
                <RTh>Product / Item Name</RTh>
                <RTh>Process</RTh>
                <RTh>Unit</RTh>
                <RTh right>Order Qty</RTh>
                <RTh right>Despatched</RTh>
                <RTh right>Pending</RTh>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it, idx) => (
                <tr key={it.item_id}
                  className={`border-b border-gray-50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                  <RTd muted>{String(it.seq_no).padStart(2, "0")}</RTd>
                  <RTd muted>{it.item_code || "—"}</RTd>
                  <RTd bold>{it.item_name}</RTd>
                  <RTd>{it.process || "—"}</RTd>
                  <RTd>{it.unit}</RTd>
                  <RTd right>{fmtQty(it.order_qty)}</RTd>
                  <RTd right muted>{fmtQty(it.despatched_qty)}</RTd>
                  <RTd right>
                    <span className="font-bold text-orange-600">{fmtQty(it.pending_qty)}</span>
                  </RTd>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: SC.tonal }} className="border-t-2 border-[#027fa5]/30">
                <RTd bold colSpan={5 as any}>Total</RTd>
                <RTd right bold>
                  {fmtQty(order.items.reduce((s, i) => s + parseFloat(i.order_qty || "0"), 0))}
                </RTd>
                <RTd right muted>
                  {fmtQty(order.items.reduce((s, i) => s + parseFloat(i.despatched_qty || "0"), 0))}
                </RTd>
                <RTd right bold>
                  <span className="text-orange-600">
                    {fmtQty(order.items.reduce((s, i) => s + parseFloat(i.pending_qty || "0"), 0))}
                  </span>
                </RTd>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={onClose}
            className="px-6 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: SC.primary }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function JobWorkPending() {
  const [search,   setSearch]   = useState("");
  const [fromDate, setFromDate] = useState(monthAgo());
  const [toDate,   setToDate]   = useState(today());
  const [selected, setSelected] = useState<OrderGroup | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { data: rawRows = [], isLoading } = useQuery<ReportRow[]>({
    queryKey: ["/api/reports/job-work-pending", fromDate, toDate],
    queryFn: () =>
      fetch(`/api/reports/job-work-pending?from=${fromDate}&to=${toDate}`, { credentials: "include" })
        .then(r => r.json()),
  });

  // Group rows by order_id
  const groups: OrderGroup[] = useMemo(() => {
    const map = new Map<string, OrderGroup>();
    for (const row of rawRows) {
      if (!map.has(row.order_id)) {
        map.set(row.order_id, {
          order_id: row.order_id,
          order_no: row.order_no,
          work_order_no: row.work_order_no,
          order_date: row.order_date,
          party_name: row.party_name,
          delivery_date: row.delivery_date,
          despatch_status: row.despatch_status,
          items: [],
        });
      }
      map.get(row.order_id)!.items.push(row);
    }
    return Array.from(map.values());
  }, [rawRows]);

  // Text search
  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter(g =>
      [g.order_no, g.work_order_no, g.party_name, g.despatch_status,
        ...g.items.map(i => i.item_name + " " + i.item_code + " " + i.process)
      ].join(" ").toLowerCase().includes(q)
    );
  }, [groups, search]);

  function toggleCollapse(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Excel export ────────────────────────────────────────────────────────────
  function handleExcel() {
    const headers = ["S.No","Order No","Work Order No","Order Date","Party Name","Item Code","Product/Item","Process","Unit","Order Qty","Despatched","Pending","Status"];
    let sno = 0;
    const rows = filtered.flatMap(g =>
      g.items.map(i => [
        ++sno, g.order_no, g.work_order_no, g.order_date, g.party_name,
        i.item_code, i.item_name, i.process, i.unit,
        fmtQty(i.order_qty), fmtQty(i.despatched_qty), fmtQty(i.pending_qty), g.despatch_status,
      ])
    );
    exportToCSV(`JobWorkPending_${fromDate}_${toDate}.csv`, headers, rows);
  }

  // ── PDF export ──────────────────────────────────────────────────────────────
  function handlePdf() {
    printReport("Job Work Pending Report");
  }

  const totalOrders  = filtered.length;
  const totalItems   = filtered.reduce((s, g) => s + g.items.length, 0);
  const totalPending = filtered.reduce((s, g) =>
    s + g.items.reduce((ss, i) => ss + parseFloat(i.pending_qty || "0"), 0), 0);

  return (
    <>
      <ReportShell
        title="Job Work Pending"
        search={search} onSearch={setSearch}
        fromDate={fromDate} toDate={toDate}
        onFromDate={setFromDate} onToDate={setToDate}
        onPrint={() => printReport("Job Work Pending Report")}
        onExcelExport={handleExcel}
        onPdfExport={handlePdf}
        recordCount={totalOrders}
      >
        {/* Summary strip */}
        {!isLoading && filtered.length > 0 && (
          <div className="flex items-center gap-6 px-5 py-2.5 border-b border-gray-100 bg-gray-50/50 text-xs">
            <span className="text-gray-500">Orders: <b className="text-gray-800">{totalOrders}</b></span>
            <span className="text-gray-500">Items: <b className="text-gray-800">{totalItems}</b></span>
            <span className="text-gray-500">Total Pending Qty: <b className="text-orange-600">{fmtQty(totalPending)}</b></span>
          </div>
        )}

        {/* Table */}
        <table className="w-full text-sm">
          <thead className="sticky top-0">
            <tr>
              <RTh>S.no</RTh>
              <RTh>Order No</RTh>
              <RTh>Order Date</RTh>
              <RTh>Party Name</RTh>
              <RTh>Product Details</RTh>
              <RTh>Process</RTh>
              <RTh>Unit</RTh>
              <RTh right>Order Qty</RTh>
              <RTh right>Pending</RTh>
              <RTh>Status</RTh>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={10} className="px-5 py-14 text-center text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-7 h-7 border-3 rounded-full animate-spin" style={{ border: "3px solid #d2f1fa", borderTopColor: "#027fa5" }} />
                    <span>Loading report…</span>
                  </div>
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={10} className="px-5 py-14 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <AlertCircle size={28} className="text-gray-300" />
                    <span className="text-sm">
                      {search ? "No records match the search." : "No pending job work found for the selected date range."}
                    </span>
                  </div>
                </td>
              </tr>
            )}
            {!isLoading && filtered.map((g, gi) => {
              const isCollapsed = collapsed.has(g.order_id);
              const rowSpan     = g.items.length + 1;
              return [
                /* Group header row */
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
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setSelected(g); }}
                      className="font-bold hover:underline"
                      style={{ color: SC.primary }}
                      data-testid={`btn-view-order-${g.order_id}`}>
                      {g.order_no}
                    </button>
                    {g.work_order_no && <div className="text-[10px] text-gray-400 font-normal">WO: {g.work_order_no}</div>}
                  </RTd>
                  <RTd>{fmtDate(g.order_date)}</RTd>
                  <RTd bold>{g.party_name || "—"}</RTd>
                  <RTd muted><span className="text-xs italic">{g.items.length} item{g.items.length !== 1 ? "s" : ""}</span></RTd>
                  <RTd></RTd>
                  <RTd></RTd>
                  <RTd right bold>
                    {fmtQty(g.items.reduce((s, i) => s + parseFloat(i.order_qty || "0"), 0))}
                  </RTd>
                  <RTd right bold>
                    <span className="text-orange-600">
                      {fmtQty(g.items.reduce((s, i) => s + parseFloat(i.pending_qty || "0"), 0))}
                    </span>
                  </RTd>
                  <RTd>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      g.despatch_status === "Partial"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-red-50 text-red-700"
                    }`}>{g.despatch_status}</span>
                  </RTd>
                </tr>,

                /* Item detail rows (collapsible) */
                ...(!isCollapsed ? g.items.map((it, ii) => (
                  <tr key={it.item_id}
                    className={`border-t border-gray-50 ${ii % 2 === 0 ? "bg-white" : "bg-gray-50/20"}`}
                    data-testid={`row-item-${it.item_id}`}>
                    <RTd muted><span className="pl-4 text-xs">{String(it.seq_no).padStart(2, "0")}</span></RTd>
                    <RTd muted></RTd>
                    <RTd muted></RTd>
                    <RTd muted></RTd>
                    <RTd>
                      <span className="font-medium text-gray-800">{it.item_name}</span>
                      {it.item_code && <span className="ml-1.5 text-[11px] text-gray-400">[{it.item_code}]</span>}
                    </RTd>
                    <RTd muted>{it.process || "—"}</RTd>
                    <RTd muted>{it.unit}</RTd>
                    <RTd right>{fmtQty(it.order_qty)}</RTd>
                    <RTd right>
                      <span className="font-semibold text-orange-600">{fmtQty(it.pending_qty)}</span>
                    </RTd>
                    <RTd></RTd>
                  </tr>
                )) : []),
              ];
            })}
          </tbody>
          {!isLoading && filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2" style={{ background: SC.tonal }}>
                <td colSpan={7} className="px-4 py-2.5 text-sm font-bold text-gray-700">
                  Total — {totalOrders} order{totalOrders !== 1 ? "s" : ""}, {totalItems} item{totalItems !== 1 ? "s" : ""}
                </td>
                <RTd right bold>{fmtQty(filtered.reduce((s, g) => s + g.items.reduce((ss, i) => ss + parseFloat(i.order_qty || "0"), 0), 0))}</RTd>
                <RTd right bold><span className="text-orange-600">{fmtQty(totalPending)}</span></RTd>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </ReportShell>

      {/* Detail modal */}
      {selected && <DetailModal order={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
