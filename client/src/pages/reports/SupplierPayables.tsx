import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Phone, User } from "lucide-react";
import { ReportShell, RTh, RTd, exportToCSV } from "@/components/ReportShell";

const SC = { primary: "#027fa5", tonal: "#d2f1fa" };

function fmtAmt(v: any) {
  const n = parseFloat(String(v || "0"));
  if (n === 0) return <span className="text-gray-300">0.00</span>;
  return <span>{n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
}
function fmtAmtPlain(v: any) {
  return parseFloat(String(v || "0")).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type Row = {
  supplier_id: string;
  supplier_name: string;
  contact_no: string;
  contact_person: string;
  bucket1: string;
  bucket2: string;
  bucket3: string;
  bucket4: string;
  bucket_above: string;
  others: string;
  total: string;
};

export default function SupplierPayables() {
  const [search,    setSearch]    = useState("");
  const [days,      setDays]      = useState("15");
  const [daysInput, setDaysInput] = useState("15");
  const inputRef = useRef<HTMLInputElement>(null);

  const appliedDays = Math.max(1, parseInt(days, 10) || 15);

  const { data: apiData, isLoading } = useQuery<{ days: number; rows: Row[] }>({
    queryKey: ["/api/reports/supplier-payables", days],
    queryFn: () =>
      fetch(`/api/reports/supplier-payables?days=${appliedDays}`, { credentials: "include" })
        .then(r => r.json()),
  });

  const rawRows: Row[] = apiData?.rows ?? [];

  const filtered = useMemo(() =>
    rawRows.filter(r => {
      if (!search.trim()) return true;
      return [r.supplier_name, r.contact_no, r.contact_person]
        .join(" ").toLowerCase().includes(search.toLowerCase());
    }),
  [rawRows, search]);

  const d = appliedDays;
  const colHeaders = [
    `0–${d} Days`,
    `${d}–${d*2} Days`,
    `${d*2}–${d*3} Days`,
    `${d*3}–${d*4} Days`,
    `Above ${d*4} Days`,
    "Others",
    "Total",
  ];

  const totals = useMemo(() => ({
    bucket1:      filtered.reduce((s, r) => s + parseFloat(r.bucket1      || "0"), 0),
    bucket2:      filtered.reduce((s, r) => s + parseFloat(r.bucket2      || "0"), 0),
    bucket3:      filtered.reduce((s, r) => s + parseFloat(r.bucket3      || "0"), 0),
    bucket4:      filtered.reduce((s, r) => s + parseFloat(r.bucket4      || "0"), 0),
    bucket_above: filtered.reduce((s, r) => s + parseFloat(r.bucket_above || "0"), 0),
    others:       filtered.reduce((s, r) => s + parseFloat(r.others       || "0"), 0),
    total:        filtered.reduce((s, r) => s + parseFloat(r.total        || "0"), 0),
  }), [filtered]);

  function handleExcel() {
    const headers = ["S.No", "Supplier Name", ...colHeaders, "Contact No", "Contact Person"];
    const rows = filtered.map((r, i) => [
      i + 1, r.supplier_name,
      fmtAmtPlain(r.bucket1), fmtAmtPlain(r.bucket2), fmtAmtPlain(r.bucket3),
      fmtAmtPlain(r.bucket4), fmtAmtPlain(r.bucket_above),
      fmtAmtPlain(r.others),  fmtAmtPlain(r.total),
      r.contact_no || "", r.contact_person || "",
    ]);
    exportToCSV(`SupplierPayables_${d}days.csv`, headers, rows);
  }

  function applyDays() {
    const n = Math.max(1, parseInt(daysInput, 10) || 15);
    setDaysInput(String(n));
    setDays(String(n));
  }

  const daysFilter = (
    <div className="flex items-center gap-2">
      <div className="relative">
        <span className="text-[10px] font-semibold text-gray-400 absolute -top-2 left-2 bg-white px-1 leading-none z-10">
          Bucket Interval (Days)
        </span>
        <div className="flex items-center border border-gray-200 rounded-lg bg-white h-[36px] hover:border-[#027fa5] focus-within:border-[#027fa5] focus-within:ring-1 focus-within:ring-[#027fa5]/20 overflow-hidden">
          <input
            ref={inputRef}
            type="number" min="1" max="365"
            value={daysInput}
            onChange={e => setDaysInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") applyDays(); }}
            className="w-20 pl-3 py-2 text-sm text-gray-700 outline-none bg-transparent tabular-nums"
            data-testid="input-days" />
          <button
            onClick={applyDays}
            className="h-full px-3 text-xs font-semibold text-white transition-colors"
            style={{ background: SC.primary }}
            data-testid="btn-apply-days">
            Apply
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <ReportShell
      title="Supplier Payables"
      search={search} onSearch={setSearch}
      onExcelExport={handleExcel}
      recordCount={filtered.length}
      extraFilters={daysFilter}
    >
      {/* Summary strip */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-1 px-5 py-2 border-b border-gray-100 bg-gray-50/50 text-xs">
          <span className="text-gray-500">Suppliers: <b className="text-gray-800">{filtered.length}</b></span>
          <span className="text-gray-500">Grand Total: <b className="font-bold" style={{ color: SC.primary }}>
            ₹ {totals.total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </b></span>
          {totals.bucket_above > 0 && (
            <span className="text-red-600 font-semibold">
              Overdue ({`>${d*4}d`}): ₹ {totals.bucket_above.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 1000 }}>
          <thead className="sticky top-0">
            <tr>
              <RTh>S.no</RTh>
              <RTh>Supplier Name</RTh>
              {colHeaders.slice(0, 4).map(h => (
                <RTh key={h} right>{h}</RTh>
              ))}
              <RTh right className="text-red-600">{colHeaders[4]}</RTh>
              <RTh right className="text-gray-500">{colHeaders[5]}</RTh>
              <RTh right className="font-bold">Total</RTh>
              <RTh>Contact No</RTh>
              <RTh>Contact Person</RTh>
            </tr>
          </thead>

          <tbody>
            {isLoading && (
              <tr><td colSpan={11} className="px-5 py-14 text-center text-gray-400">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-7 h-7 rounded-full animate-spin"
                    style={{ border: "3px solid #d2f1fa", borderTopColor: "#027fa5" }} />
                  <span>Loading…</span>
                </div>
              </td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={11} className="px-5 py-14 text-center">
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <AlertCircle size={28} className="text-gray-300" />
                  <span className="text-sm">
                    {search ? "No suppliers match the search." : "No outstanding payables found."}
                  </span>
                </div>
              </td></tr>
            )}
            {!isLoading && filtered.map((row, idx) => {
              const above = parseFloat(row.bucket_above || "0");
              const total = parseFloat(row.total || "0");
              return (
                <tr key={row.supplier_id}
                  className={`border-t border-gray-50 hover:bg-[#f0f9ff] transition-colors
                    ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/20"}`}
                  data-testid={`row-supp-${idx}`}>
                  <RTd muted>{String(idx + 1).padStart(2, "0")}</RTd>
                  <td className="px-4 py-2.5 font-semibold text-gray-800">{row.supplier_name}</td>
                  <RTd right>{fmtAmt(row.bucket1)}</RTd>
                  <RTd right>{fmtAmt(row.bucket2)}</RTd>
                  <RTd right>
                    <span className={parseFloat(row.bucket3||"0") > 0 ? "text-amber-600 font-semibold" : ""}>
                      {fmtAmt(row.bucket3)}
                    </span>
                  </RTd>
                  <RTd right>
                    <span className={parseFloat(row.bucket4||"0") > 0 ? "text-orange-600 font-semibold" : ""}>
                      {fmtAmt(row.bucket4)}
                    </span>
                  </RTd>
                  <RTd right>
                    <span className={above > 0 ? "text-red-600 font-bold" : ""}>
                      {fmtAmt(row.bucket_above)}
                    </span>
                  </RTd>
                  <RTd right muted>{fmtAmt(row.others)}</RTd>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`font-bold tabular-nums ${total > 0 ? "text-gray-800" : "text-gray-400"}`}>
                      {fmtAmtPlain(row.total)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                    {row.contact_no
                      ? <span className="flex items-center gap-1"><Phone size={11} className="text-gray-400"/>{row.contact_no}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">
                    {row.contact_person
                      ? <span className="flex items-center gap-1"><User size={11} className="text-gray-400"/>{row.contact_person}</span>
                      : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {!isLoading && filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2" style={{ background: SC.tonal }}>
                <td colSpan={2} className="px-4 py-2.5 text-sm font-bold text-gray-700">
                  Grand Total — {filtered.length} supplier{filtered.length !== 1 ? "s" : ""}
                </td>
                <RTd right bold>{fmtAmt(totals.bucket1)}</RTd>
                <RTd right bold>{fmtAmt(totals.bucket2)}</RTd>
                <RTd right bold>
                  <span className={totals.bucket3 > 0 ? "text-amber-600" : ""}>{fmtAmt(totals.bucket3)}</span>
                </RTd>
                <RTd right bold>
                  <span className={totals.bucket4 > 0 ? "text-orange-600" : ""}>{fmtAmt(totals.bucket4)}</span>
                </RTd>
                <RTd right bold>
                  <span className={totals.bucket_above > 0 ? "text-red-600" : ""}>{fmtAmt(totals.bucket_above)}</span>
                </RTd>
                <RTd right bold muted>{fmtAmt(totals.others)}</RTd>
                <td className="px-4 py-2.5 text-right text-sm font-bold text-gray-800 tabular-nums">
                  ₹ {totals.total.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td colSpan={2}/>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </ReportShell>
  );
}
