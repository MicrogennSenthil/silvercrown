import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Scale } from "lucide-react";
import { exportToCSV } from "@/components/ReportShell";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

const GL_TYPE_LABELS: Record<string, string> = {
  bank: "Bank Accounts", cash: "Cash Accounts",
  sundry_debtor: "Sundry Debtors", sundry_creditor: "Sundry Creditors",
  purchase: "Purchase Accounts", expense: "Expense Accounts",
  tax: "Tax Accounts", roundoff: "Round Off",
  liability: "Liability Accounts", income: "Income Accounts",
  other: "Other Accounts",
};

function fmtN(v: number) {
  if (v === 0) return <span className="text-gray-300">—</span>;
  return <>{v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</>;
}
function plain(v: number) {
  return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type TBRow = {
  id: string; name: string; code: string; gl_type: string;
  ob_amt: number; ob_type: string;
  period_dr: number; period_cr: number;
  closing_dr: number; closing_cr: number;
};
type TBData = {
  rows: TBRow[];
  totals: { opening_dr: number; opening_cr: number; period_dr: number; period_cr: number; closing_dr: number; closing_cr: number };
};

export default function TrialBalance() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), 3, 1); // Apr 1 = FY start
  const f2 = (d: Date) => d.toISOString().split("T")[0];

  const [fromDate, setFromDate] = useState(f2(firstDay));
  const [toDate,   setToDate]   = useState(f2(today));
  const [search,   setSearch]   = useState("");
  const [applied,  setApplied]  = useState(false);
  const [showZero, setShowZero] = useState(false);

  const qkFrom = applied ? fromDate : "";
  const qkTo   = applied ? toDate   : "";

  const { data, isLoading } = useQuery<TBData>({
    queryKey: ["/api/reports/trial-balance", qkFrom, qkTo],
    queryFn: () =>
      fetch(`/api/reports/trial-balance${applied ? `?from=${fromDate}&to=${toDate}` : ""}`,
        { credentials: "include" }).then(r => r.json()),
  });

  const allRows: TBRow[] = data?.rows ?? [];
  const totals = data?.totals;

  const filtered = useMemo(() => {
    let rows = allRows;
    if (!showZero) rows = rows.filter(r =>
      r.closing_dr > 0 || r.closing_cr > 0 || r.ob_amt > 0 || r.period_dr > 0 || r.period_cr > 0
    );
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(r => r.name.toLowerCase().includes(q) || (r.code || "").toLowerCase().includes(q));
    }
    return rows;
  }, [allRows, search, showZero]);

  const groups = useMemo(() => {
    const map = new Map<string, TBRow[]>();
    for (const r of filtered) {
      const label = GL_TYPE_LABELS[r.gl_type] || "Other Accounts";
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(r);
    }
    return map;
  }, [filtered]);

  function handleExport() {
    const headers = ["Account", "Code", "Type", "Opening Dr ₹", "Opening Cr ₹", "Period Dr ₹", "Period Cr ₹", "Closing Dr ₹", "Closing Cr ₹"];
    const rows = filtered.map(r => [
      r.name, r.code || "", GL_TYPE_LABELS[r.gl_type] || r.gl_type,
      r.ob_type === "Dr" ? plain(r.ob_amt) : "",
      r.ob_type !== "Dr" ? plain(r.ob_amt) : "",
      r.period_dr > 0 ? plain(r.period_dr) : "",
      r.period_cr > 0 ? plain(r.period_cr) : "",
      r.closing_dr > 0 ? plain(r.closing_dr) : "",
      r.closing_cr > 0 ? plain(r.closing_cr) : "",
    ]);
    exportToCSV("TrialBalance.csv", headers, rows);
  }

  const isBalanced = totals ? Math.abs(totals.closing_dr - totals.closing_cr) < 1 : true;

  return (
    <div className="p-4" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ background: SC.tonal }}>
          <div className="flex items-center gap-2">
            <Scale size={16} style={{ color: SC.primary }} />
            <h1 className="font-bold text-gray-800 text-base">Trial Balance</h1>
            <span className="text-xs text-gray-500 ml-1">· All active GL accounts with closing balances</span>
          </div>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-semibold text-white"
            style={{ background: SC.primary }}>
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 px-5 py-3 border-b bg-gray-50">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">From Date</label>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="h-9 border border-gray-300 rounded px-3 text-sm focus:outline-none focus:border-[#027fa5] bg-white" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">To Date</label>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="h-9 border border-gray-300 rounded px-3 text-sm focus:outline-none focus:border-[#027fa5] bg-white" />
          </div>
          <button onClick={() => setApplied(true)}
            className="h-9 px-4 rounded text-sm font-semibold text-white"
            style={{ background: SC.primary }}>
            Apply Period
          </button>
          {applied && (
            <button onClick={() => setApplied(false)}
              className="h-9 px-3 rounded text-sm text-gray-600 border border-gray-300 bg-white hover:bg-gray-50">
              All Periods
            </button>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer ml-1">
            <input type="checkbox" checked={showZero} onChange={e => setShowZero(e.target.checked)}
              className="accent-[#027fa5]" />
            Show zero-balance
          </label>
          <div className="ml-auto">
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search account…"
              className="h-9 border border-gray-300 rounded px-3 text-sm focus:outline-none focus:border-[#027fa5] w-44 bg-white" />
          </div>
        </div>

        {/* Balance status bar */}
        {totals && !isLoading && (
          <div className={`flex items-center justify-between px-5 py-1.5 text-xs font-semibold border-b
            ${isBalanced ? "bg-green-50 text-green-700 border-green-100" : "bg-red-50 text-red-600 border-red-100"}`}>
            <span>
              {isBalanced
                ? "✓  Trial Balance is BALANCED — Debit = Credit"
                : `⚠  Difference ₹${plain(Math.abs(totals.closing_dr - totals.closing_cr))} — Check for missing ledger postings`}
            </span>
            <span className="font-normal text-gray-500">
              {applied ? `Period: ${fromDate} → ${toDate}` : "All periods (no date filter)"}
              &nbsp;·&nbsp; {filtered.length} accounts shown
            </span>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-400 text-sm">
            <div className="w-6 h-6 rounded-full animate-spin"
              style={{ border: "3px solid #d2f1fa", borderTopColor: SC.primary }} />
            Loading Trial Balance…
          </div>
        )}

        {/* Table */}
        {!isLoading && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-gray-200 bg-gray-50">
                  <th className="px-4 py-2.5 text-left text-gray-600 font-semibold">Account</th>
                  <th className="px-3 py-2.5 text-left text-gray-500 font-semibold w-24">Code</th>
                  <th className="px-3 py-2.5 text-right text-gray-500 font-semibold whitespace-nowrap">Opening Dr ₹</th>
                  <th className="px-3 py-2.5 text-right text-gray-500 font-semibold whitespace-nowrap">Opening Cr ₹</th>
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap" style={{ color: SC.primary }}>Period Dr ₹</th>
                  <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap" style={{ color: SC.orange }}>Period Cr ₹</th>
                  <th className="px-3 py-2.5 text-right text-gray-700 font-bold whitespace-nowrap bg-blue-50/50">Closing Dr ₹</th>
                  <th className="px-3 py-2.5 text-right text-gray-700 font-bold whitespace-nowrap bg-blue-50/50">Closing Cr ₹</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && !isLoading && (
                  <tr><td colSpan={8} className="px-4 py-16 text-center text-gray-400 text-sm">
                    {search ? `No accounts match "${search}"` : "No account data found."}
                  </td></tr>
                )}

                {Array.from(groups.entries()).map(([label, gRows]) => {
                  const gDr = gRows.reduce((s, r) => s + r.closing_dr, 0);
                  const gCr = gRows.reduce((s, r) => s + r.closing_cr, 0);
                  return [
                    <tr key={`g-${label}`} className="border-t border-b border-gray-200" style={{ background: SC.tonal }}>
                      <td colSpan={2} className="px-4 py-1.5 text-xs font-bold" style={{ color: SC.primary }}>
                        {label}
                      </td>
                      <td colSpan={4} />
                      <td className="px-3 py-1.5 text-right font-bold text-gray-700 font-mono bg-blue-50/50">
                        {gDr > 0 ? plain(gDr) : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right font-bold text-gray-700 font-mono bg-blue-50/50">
                        {gCr > 0 ? plain(gCr) : "—"}
                      </td>
                    </tr>,
                    ...gRows.map((r, idx) => (
                      <tr key={r.id}
                        className={`border-b border-gray-50 hover:bg-blue-50/20 transition-colors
                          ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                        <td className="px-4 py-1.5 text-gray-700 pl-7">{r.name}</td>
                        <td className="px-3 py-1.5 text-gray-400 font-mono text-[11px]">{r.code || "—"}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-gray-600">
                          {r.ob_type === "Dr" && r.ob_amt > 0 ? plain(r.ob_amt) : <span className="text-gray-200">—</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-gray-600">
                          {r.ob_type !== "Dr" && r.ob_amt > 0 ? plain(r.ob_amt) : <span className="text-gray-200">—</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono" style={{ color: r.period_dr > 0 ? SC.primary : undefined }}>
                          {fmtN(r.period_dr)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono" style={{ color: r.period_cr > 0 ? SC.orange : undefined }}>
                          {fmtN(r.period_cr)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-semibold text-gray-800 bg-blue-50/30">
                          {fmtN(r.closing_dr)}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-semibold text-gray-800 bg-blue-50/30">
                          {fmtN(r.closing_cr)}
                        </td>
                      </tr>
                    )),
                  ];
                })}
              </tbody>

              {totals && filtered.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-400" style={{ background: SC.tonal }}>
                    <td colSpan={2} className="px-4 py-3 text-sm font-bold text-gray-800">Grand Total</td>
                    <td className="px-3 py-3 text-right font-bold font-mono text-sm">{plain(totals.opening_dr)}</td>
                    <td className="px-3 py-3 text-right font-bold font-mono text-sm">{plain(totals.opening_cr)}</td>
                    <td className="px-3 py-3 text-right font-bold font-mono text-sm" style={{ color: SC.primary }}>{plain(totals.period_dr)}</td>
                    <td className="px-3 py-3 text-right font-bold font-mono text-sm" style={{ color: SC.orange }}>{plain(totals.period_cr)}</td>
                    <td className="px-3 py-3 text-right font-bold font-mono text-sm text-gray-900 bg-blue-50/50">{plain(totals.closing_dr)}</td>
                    <td className="px-3 py-3 text-right font-bold font-mono text-sm text-gray-900 bg-blue-50/50">{plain(totals.closing_cr)}</td>
                  </tr>
                  {!isBalanced && (
                    <tr className="bg-red-50 border-t border-red-100">
                      <td colSpan={6} className="px-4 py-2 text-xs font-semibold text-red-600">
                        Difference — check for missing ledger postings
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-bold font-mono text-red-600">
                        {totals.closing_dr > totals.closing_cr ? plain(totals.closing_dr - totals.closing_cr) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-xs font-bold font-mono text-red-600">
                        {totals.closing_cr > totals.closing_dr ? plain(totals.closing_cr - totals.closing_dr) : "—"}
                      </td>
                    </tr>
                  )}
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
