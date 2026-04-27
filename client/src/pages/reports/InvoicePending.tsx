import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
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
  despatch_id: string;
  despatch_no: string;
  despatch_date: string;
  inward_id: string;
  jw_no: string;
  jw_date: string;
  work_order_no: string;
  party_name: string;
  item_id: string;
  seq_no: number;
  item_code: string;
  item_name: string;
  unit: string;
  process: string;
  order_qty: string;
  des_qty: string;
  inv_qty: string;
  pending_qty: string;
};

// ── Main Report ───────────────────────────────────────────────────────────────
export default function InvoicePending() {
  const [search,      setSearch]      = useState("");
  const [fromDate,    setFromDate]    = useState(monthAgo());
  const [toDate,      setToDate]      = useState(today());
  const [partyFilter, setPartyFilter] = useState("");
  const [itemFilter,  setItemFilter]  = useState("");

  const { data: rawRows = [], isLoading } = useQuery<ReportRow[]>({
    queryKey: ["/api/reports/invoice-pending", fromDate, toDate],
    queryFn: () =>
      fetch(`/api/reports/invoice-pending?from=${fromDate}&to=${toDate}`, { credentials: "include" })
        .then(r => r.json()),
  });

  // Filter options (from full dataset)
  const allParties = useMemo(() =>
    [...new Set(rawRows.map(r => r.party_name).filter(Boolean))].sort(), [rawRows]);
  const allItems = useMemo(() =>
    [...new Set(rawRows.map(r => r.item_name).filter(Boolean))].sort(), [rawRows]);

  // Apply filters
  const filtered: ReportRow[] = useMemo(() => {
    return rawRows.filter(r => {
      if (partyFilter && r.party_name !== partyFilter) return false;
      if (itemFilter  && r.item_name  !== itemFilter)  return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (![r.jw_no, r.despatch_no, r.party_name, r.item_name, r.item_code, r.work_order_no]
          .join(" ").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rawRows, search, partyFilter, itemFilter]);

  // Build display rows: group by despatch_id, first item of each group shows header cols
  const displayRows = useMemo(() => {
    type DisplayRow = ReportRow & { isFirst: boolean; groupSno: number; groupSize: number };
    const result: DisplayRow[] = [];
    const seen = new Map<string, number>(); // despatch_id → sno
    let sno = 0;
    for (const row of filtered) {
      if (!seen.has(row.despatch_id)) {
        seen.set(row.despatch_id, ++sno);
      }
      const groupSno = seen.get(row.despatch_id)!;
      const isFirst  = result.findIndex(r => r.despatch_id === row.despatch_id) === -1;
      const groupSize = filtered.filter(r => r.despatch_id === row.despatch_id).length;
      result.push({ ...row, isFirst, groupSno, groupSize });
    }
    return result;
  }, [filtered]);

  const totalRows    = displayRows.length;
  const totalOrdQty  = displayRows.reduce((s, r) => s + parseFloat(r.order_qty || "0"), 0);
  const totalDesQty  = displayRows.reduce((s, r) => s + parseFloat(r.des_qty   || "0"), 0);
  const totalInvQty  = displayRows.reduce((s, r) => s + parseFloat(r.inv_qty   || "0"), 0);
  const totalPending = displayRows.reduce((s, r) => s + parseFloat(r.pending_qty || "0"), 0);
  const uniqueDespatches = new Set(displayRows.map(r => r.despatch_id)).size;

  function handleExcel() {
    const headers = ["S.No","JW No","JW Date","Des No","Des Date","Party Name","Product Details","Unit","Order Qty","Des Qty","Inv Qty","Pending"];
    let sno = 0;
    const rows = displayRows.map(r => [
      ++sno, r.jw_no, fmtDate(r.jw_date), r.despatch_no, fmtDate(r.despatch_date),
      r.party_name, r.item_name, r.unit,
      fmtQty(r.order_qty), fmtQty(r.des_qty), fmtQty(r.inv_qty), fmtQty(r.pending_qty),
    ]);
    exportToCSV(`InvoicePending_${fromDate}_${toDate}.csv`, headers, rows);
  }

  return (
    <ReportShell
      title="Invoice Pending"
      search={search} onSearch={setSearch}
      fromDate={fromDate} toDate={toDate}
      onFromDate={setFromDate} onToDate={setToDate}
      onPrint={() => printReport("Invoice Pending")}
      onExcelExport={handleExcel}
      onPdfExport={() => printReport("Invoice Pending")}
      recordCount={uniqueDespatches}
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
      {!isLoading && displayRows.length > 0 && (
        <div className="flex items-center gap-6 px-5 py-2 border-b border-gray-100 bg-gray-50/50 text-xs">
          <span className="text-gray-500">Despatches: <b className="text-gray-800">{uniqueDespatches}</b></span>
          <span className="text-gray-500">Items: <b className="text-gray-800">{totalRows}</b></span>
          <span className="text-gray-500">Order Qty: <b className="text-gray-800">{fmtQty(totalOrdQty)}</b></span>
          <span className="text-gray-500">Despatch Qty: <b className="text-gray-800">{fmtQty(totalDesQty)}</b></span>
          <span className="text-gray-500">Invoiced: <b className="text-gray-800">{fmtQty(totalInvQty)}</b></span>
          <span className="text-gray-500">Pending: <b className="text-orange-600">{fmtQty(totalPending)}</b></span>
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="sticky top-0">
          <tr>
            <RTh>S.no</RTh>
            <RTh>JW No</RTh>
            <RTh>JW Date</RTh>
            <RTh>Des No</RTh>
            <RTh>Des Date</RTh>
            <RTh>Party Name</RTh>
            <RTh>Product Details</RTh>
            <RTh>Unit</RTh>
            <RTh right>Order</RTh>
            <RTh right>Despatch</RTh>
            <RTh right>Bill</RTh>
            <RTh right>Pending</RTh>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr><td colSpan={12} className="px-5 py-14 text-center text-gray-400">
              <div className="flex flex-col items-center gap-2">
                <div className="w-7 h-7 rounded-full animate-spin"
                  style={{ border: "3px solid #d2f1fa", borderTopColor: "#027fa5" }} />
                <span>Loading…</span>
              </div>
            </td></tr>
          )}
          {!isLoading && displayRows.length === 0 && (
            <tr><td colSpan={12} className="px-5 py-14 text-center">
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <AlertCircle size={28} className="text-gray-300" />
                <span className="text-sm">
                  {search || partyFilter || itemFilter
                    ? "No records match the filters."
                    : "No invoice-pending items in this date range."}
                </span>
              </div>
            </td></tr>
          )}

          {!isLoading && displayRows.map((row, idx) => {
            const isGroupStart = row.isFirst;
            const prevDespatch = idx > 0 ? displayRows[idx - 1].despatch_id : null;
            const isNewGroup = row.despatch_id !== prevDespatch;

            return (
              <tr key={`${row.despatch_id}-${row.item_id}`}
                className={`${isNewGroup && idx > 0 ? "border-t-2 border-gray-200" : "border-t border-gray-50"}
                  ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/20"} hover:bg-[#f0f9ff] transition-colors`}
                data-testid={`row-item-${row.item_id}`}>

                {/* S.no — only on first item of group */}
                <RTd muted>
                  {isGroupStart
                    ? <span className="font-semibold text-gray-600">{String(row.groupSno).padStart(2, "0")}</span>
                    : ""}
                </RTd>

                {/* JW No — only on first item of group */}
                <RTd>
                  {isGroupStart
                    ? <span className="font-semibold" style={{ color: SC.primary }}>{row.jw_no || "—"}</span>
                    : ""}
                </RTd>

                {/* JW Date — only on first item of group */}
                <RTd muted>
                  {isGroupStart ? fmtDate(row.jw_date) : ""}
                </RTd>

                {/* Des No — only on first item of group */}
                <RTd>
                  {isGroupStart
                    ? <span className="font-semibold text-gray-700">{row.despatch_no}</span>
                    : ""}
                </RTd>

                {/* Des Date — only on first item of group */}
                <RTd muted>
                  {isGroupStart ? fmtDate(row.despatch_date) : ""}
                </RTd>

                {/* Party Name — only on first item of group */}
                <RTd bold>
                  {isGroupStart ? (row.party_name || "—") : ""}
                </RTd>

                {/* Product Details — always shown */}
                <RTd>
                  <span className="font-medium">{row.item_name}</span>
                  {row.item_code && (
                    <span className="ml-1.5 text-[11px] text-gray-400">[{row.item_code}]</span>
                  )}
                </RTd>

                {/* Unit */}
                <RTd muted>{row.unit}</RTd>

                {/* Order Qty */}
                <RTd right>{fmtQty(row.order_qty)}</RTd>

                {/* Despatch Qty */}
                <RTd right muted>{fmtQty(row.des_qty)}</RTd>

                {/* Invoice (Bill) Qty */}
                <RTd right muted>{fmtQty(row.inv_qty)}</RTd>

                {/* Pending */}
                <RTd right>
                  <span className="font-bold text-orange-600">{fmtQty(row.pending_qty)}</span>
                </RTd>
              </tr>
            );
          })}
        </tbody>

        {!isLoading && displayRows.length > 0 && (
          <tfoot>
            <tr className="border-t-2" style={{ background: SC.tonal }}>
              <td colSpan={8} className="px-4 py-2.5 text-sm font-bold text-gray-700">
                Total — {uniqueDespatches} despatch{uniqueDespatches !== 1 ? "es" : ""} · {totalRows} items
              </td>
              <RTd right bold>{fmtQty(totalOrdQty)}</RTd>
              <RTd right muted>{fmtQty(totalDesQty)}</RTd>
              <RTd right muted>{fmtQty(totalInvQty)}</RTd>
              <RTd right bold><span className="text-orange-600">{fmtQty(totalPending)}</span></RTd>
            </tr>
          </tfoot>
        )}
      </table>
    </ReportShell>
  );
}
