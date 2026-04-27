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
function fmtNum(v: number | string, decimals = 2) {
  return parseFloat(String(v) || "0").toFixed(decimals);
}
function fmtAmt(v: number | string) {
  return parseFloat(String(v) || "0").toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type ReportRow = {
  despatch_id: string;
  des_no: string;
  des_date: string;
  jw_no: string;
  work_order_no: string;
  party_name: string;
  vehicle_no: string;
  lr_no: string;
  item_id: string;
  seq_no: number;
  item_code: string;
  item_name: string;
  unit: string;
  process: string;
  qty: string;
  rate: string;
  amount: string;
  cgst_rate: string; sgst_rate: string; igst_rate: string;
  cgst_amt: string;  sgst_amt: string;  igst_amt: string;
  total_amt: string;
};

export default function DespatchRegister() {
  const [search,      setSearch]      = useState("");
  const [fromDate,    setFromDate]    = useState(monthAgo());
  const [toDate,      setToDate]      = useState(today());
  const [partyFilter, setPartyFilter] = useState("");
  const [itemFilter,  setItemFilter]  = useState("");

  const { data: rawRows = [], isLoading } = useQuery<ReportRow[]>({
    queryKey: ["/api/reports/despatch-register", fromDate, toDate],
    queryFn: () =>
      fetch(`/api/reports/despatch-register?from=${fromDate}&to=${toDate}`, { credentials: "include" })
        .then(r => r.json()),
  });

  const allParties = useMemo(() =>
    [...new Set(rawRows.map(r => r.party_name).filter(Boolean))].sort(), [rawRows]);
  const allItems = useMemo(() =>
    [...new Set(rawRows.map(r => r.item_name).filter(Boolean))].sort(), [rawRows]);

  const filtered: ReportRow[] = useMemo(() =>
    rawRows.filter(r => {
      if (partyFilter && r.party_name !== partyFilter) return false;
      if (itemFilter  && r.item_name  !== itemFilter)  return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (![r.des_no, r.jw_no, r.party_name, r.item_name, r.item_code, r.vehicle_no, r.lr_no]
          .join(" ").toLowerCase().includes(q)) return false;
      }
      return true;
    }),
  [rawRows, search, partyFilter, itemFilter]);

  // Build display rows: first item of each despatch group shows header columns
  type DisplayRow = ReportRow & { isFirst: boolean; groupSno: number };
  const displayRows = useMemo((): DisplayRow[] => {
    const seen = new Map<string, number>();
    let sno = 0;
    return filtered.map(row => {
      if (!seen.has(row.despatch_id)) seen.set(row.despatch_id, ++sno);
      const groupSno = seen.get(row.despatch_id)!;
      const isFirst  = filtered.findIndex(r => r.despatch_id === row.despatch_id) ===
                       filtered.indexOf(row);
      return { ...row, isFirst, groupSno };
    });
  }, [filtered]);

  const uniqueDespatches = new Set(displayRows.map(r => r.despatch_id)).size;
  const totalQty    = displayRows.reduce((s, r) => s + parseFloat(r.qty       || "0"), 0);
  const totalAmt    = displayRows.reduce((s, r) => s + parseFloat(r.amount    || "0"), 0);
  const totalTax    = displayRows.reduce((s, r) =>
    s + parseFloat(r.cgst_amt || "0") + parseFloat(r.sgst_amt || "0") + parseFloat(r.igst_amt || "0"), 0);
  const totalFinal  = displayRows.reduce((s, r) => s + parseFloat(r.total_amt || "0"), 0);

  function handleExcel() {
    const headers = ["S.No","Des No","Des Date","JW No","Party Name","Product Name","Unit","Process","Qty","Rate","Amount","CGST","SGST","IGST","Total"];
    let sno = 0;
    const rows = displayRows.map(r => [
      ++sno, r.des_no, fmtDate(r.des_date), r.jw_no, r.party_name,
      r.item_name, r.unit, r.process, fmtNum(r.qty), fmtNum(r.rate),
      fmtNum(r.amount), fmtNum(r.cgst_amt), fmtNum(r.sgst_amt), fmtNum(r.igst_amt), fmtNum(r.total_amt),
    ]);
    exportToCSV(`DespatchRegister_${fromDate}_${toDate}.csv`, headers, rows);
  }

  return (
    <ReportShell
      title="Despatch Register"
      search={search} onSearch={setSearch}
      fromDate={fromDate} toDate={toDate}
      onFromDate={setFromDate} onToDate={setToDate}
      onPrint={() => printReport("Despatch Register")}
      onExcelExport={handleExcel}
      onPdfExport={() => printReport("Despatch Register")}
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
          <span className="text-gray-500">Items: <b className="text-gray-800">{displayRows.length}</b></span>
          <span className="text-gray-500">Total Qty: <b className="text-gray-800">{fmtNum(totalQty)}</b></span>
          <span className="text-gray-500">Taxable Amt: <b className="text-gray-800">₹{fmtAmt(totalAmt)}</b></span>
          <span className="text-gray-500">Tax: <b className="text-gray-800">₹{fmtAmt(totalTax)}</b></span>
          <span className="text-gray-500">Total: <b style={{ color: SC.primary }}>₹{fmtAmt(totalFinal)}</b></span>
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="sticky top-0">
          <tr>
            <RTh>S.no</RTh>
            <RTh>Des No</RTh>
            <RTh>Des Date</RTh>
            <RTh>Party Name</RTh>
            <RTh>Product Name</RTh>
            <RTh>Unit</RTh>
            <RTh right>Qty</RTh>
            <RTh right>Rate ₹</RTh>
            <RTh right>Amount ₹</RTh>
            <RTh right>CGST</RTh>
            <RTh right>SGST</RTh>
            <RTh right>IGST</RTh>
            <RTh right>Total ₹</RTh>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr><td colSpan={13} className="px-5 py-14 text-center text-gray-400">
              <div className="flex flex-col items-center gap-2">
                <div className="w-7 h-7 rounded-full animate-spin"
                  style={{ border: "3px solid #d2f1fa", borderTopColor: "#027fa5" }} />
                <span>Loading…</span>
              </div>
            </td></tr>
          )}
          {!isLoading && displayRows.length === 0 && (
            <tr><td colSpan={13} className="px-5 py-14 text-center">
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <AlertCircle size={28} className="text-gray-300" />
                <span className="text-sm">
                  {search || partyFilter || itemFilter
                    ? "No records match the filters."
                    : "No despatch records in this date range."}
                </span>
              </div>
            </td></tr>
          )}

          {!isLoading && displayRows.map((row, idx) => {
            const prevDespatch = idx > 0 ? displayRows[idx - 1].despatch_id : null;
            const isNewGroup = row.despatch_id !== prevDespatch;

            return (
              <tr key={`${row.despatch_id}-${row.item_id}`}
                className={`${isNewGroup && idx > 0 ? "border-t-2 border-gray-200" : "border-t border-gray-50"}
                  ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/20"} hover:bg-[#f0f9ff] transition-colors`}
                data-testid={`row-item-${row.item_id}`}>

                {/* S.no */}
                <RTd muted>
                  {row.isFirst
                    ? <span className="font-semibold text-gray-600">{String(row.groupSno).padStart(2, "0")}</span>
                    : ""}
                </RTd>

                {/* Des No */}
                <RTd>
                  {row.isFirst
                    ? <div>
                        <span className="font-semibold" style={{ color: SC.primary }}>{row.des_no}</span>
                        {row.jw_no && <div className="text-[10px] text-gray-400">JW: {row.jw_no}</div>}
                      </div>
                    : ""}
                </RTd>

                {/* Des Date */}
                <RTd muted>{row.isFirst ? fmtDate(row.des_date) : ""}</RTd>

                {/* Party Name */}
                <RTd bold>{row.isFirst ? (row.party_name || "—") : ""}</RTd>

                {/* Product Name */}
                <RTd>
                  <span className="font-medium">{row.item_name}</span>
                  {row.item_code && (
                    <span className="ml-1.5 text-[11px] text-gray-400">[{row.item_code}]</span>
                  )}
                  {row.process && (
                    <div className="text-[10px] text-gray-400">{row.process}</div>
                  )}
                </RTd>

                <RTd muted>{row.unit}</RTd>
                <RTd right>{fmtNum(row.qty)}</RTd>
                <RTd right>{fmtNum(row.rate)}</RTd>
                <RTd right>{fmtAmt(row.amount)}</RTd>

                {/* Tax columns — show 0.00 if zero */}
                <RTd right muted>
                  {parseFloat(row.cgst_amt || "0") > 0
                    ? <>{fmtNum(row.cgst_rate)}%<br /><span className="text-gray-600">{fmtAmt(row.cgst_amt)}</span></>
                    : <span className="text-gray-300">—</span>}
                </RTd>
                <RTd right muted>
                  {parseFloat(row.sgst_amt || "0") > 0
                    ? <>{fmtNum(row.sgst_rate)}%<br /><span className="text-gray-600">{fmtAmt(row.sgst_amt)}</span></>
                    : <span className="text-gray-300">—</span>}
                </RTd>
                <RTd right muted>
                  {parseFloat(row.igst_amt || "0") > 0
                    ? <>{fmtNum(row.igst_rate)}%<br /><span className="text-gray-600">{fmtAmt(row.igst_amt)}</span></>
                    : <span className="text-gray-300">—</span>}
                </RTd>

                <RTd right bold>
                  <span style={{ color: parseFloat(row.total_amt || "0") > 0 ? SC.primary : undefined }}>
                    {fmtAmt(row.total_amt)}
                  </span>
                </RTd>
              </tr>
            );
          })}
        </tbody>

        {!isLoading && displayRows.length > 0 && (
          <tfoot>
            <tr className="border-t-2" style={{ background: SC.tonal }}>
              <td colSpan={6} className="px-4 py-2.5 text-sm font-bold text-gray-700">
                Total — {uniqueDespatches} despatch{uniqueDespatches !== 1 ? "es" : ""} · {displayRows.length} items
              </td>
              <RTd right bold>{fmtNum(totalQty)}</RTd>
              <RTd right></RTd>
              <RTd right bold>{fmtAmt(totalAmt)}</RTd>
              <RTd right muted colSpan={3}></RTd>
              <RTd right bold>
                <span style={{ color: SC.primary }}>₹{fmtAmt(totalFinal)}</span>
              </RTd>
            </tr>
          </tfoot>
        )}
      </table>
    </ReportShell>
  );
}
