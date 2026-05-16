import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Search } from "lucide-react";
import { ReportShell, exportToCSV } from "@/components/ReportShell";

const SC = { primary: "#027fa5", tonal: "#d2f1fa" };

function fmt(v: any) {
  const n = parseFloat(String(v ?? 0));
  if (isNaN(n)) return "0.00";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

type LedgerAccount = {
  id: string;
  name: string;
  code: string;
  account_type: "gl" | "sl";
  gl_type: string;
  gl_name: string | null;
  group_label: string;
};
type StmtRow = {
  refNo: string; txnDate: string; voucherNo: string;
  narration: string; sourceType: string;
  debit: number; credit: number; balance: number; balanceType: string;
};
type StmtData = {
  openingBalance: number; openingBalanceType: string;
  statement: StmtRow[];
};

const GL_TYPE_LABELS: Record<string, string> = {
  bank: "Bank Accounts",
  cash: "Cash Accounts",
  sundry_debtor: "Sundry Debtors",
  sundry_creditor: "Sundry Creditors",
  purchase: "Purchase Accounts",
  expense: "Expense Accounts",
  tax: "Tax Accounts",
  roundoff: "Round Off",
  liability: "Liability Accounts",
  income: "Income Accounts",
  other: "Other Accounts",
};

export default function LedgerReport() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const fmt2 = (d: Date) => d.toISOString().split("T")[0];

  const [selectedId, setSelectedId] = useState("");
  const [selectedType, setSelectedType] = useState<"gl" | "sl">("sl");
  const [fromDate, setFromDate] = useState(fmt2(firstDay));
  const [toDate, setToDate] = useState(fmt2(today));
  const [search, setSearch] = useState("");
  const [applyDates, setApplyDates] = useState(false);

  const { data: allAccounts = [] } = useQuery<LedgerAccount[]>({
    queryKey: ["/api/ledger-accounts"],
  });

  const { data: stmtData, isLoading } = useQuery<StmtData>({
    queryKey: ["/api/ledger-accounts", selectedType, selectedId, "statement"],
    queryFn: () =>
      fetch(`/api/ledger-accounts/${selectedType}/${selectedId}/statement`, { credentials: "include" }).then(r => r.json()),
    enabled: !!selectedId,
  });

  const rows: StmtRow[] = stmtData?.statement ?? [];

  const filtered = useMemo(() => {
    let res = rows;
    if (applyDates && fromDate && toDate) {
      const f = new Date(fromDate).getTime();
      const t = new Date(toDate).getTime();
      res = res.filter(r => {
        if (!r.txnDate) return true;
        const d = new Date(r.txnDate).getTime();
        return d >= f && d <= t;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      res = res.filter(r =>
        [r.voucherNo, r.refNo, r.narration, r.sourceType].join(" ").toLowerCase().includes(q)
      );
    }
    return res;
  }, [rows, applyDates, fromDate, toDate, search]);

  const totalDebit  = filtered.reduce((s, r) => s + r.debit, 0);
  const totalCredit = filtered.reduce((s, r) => s + r.credit, 0);
  const closingBal  = filtered.length > 0 ? filtered[filtered.length - 1].balance : (stmtData?.openingBalance ?? 0);
  const closingType = filtered.length > 0 ? filtered[filtered.length - 1].balanceType : (stmtData?.openingBalanceType?.slice(0, 2) ?? "Cr");

  const selectedAccount = allAccounts.find(a => a.id === selectedId);

  function handleExport() {
    const headers = ["#", "Date", "Voucher No", "Ref No", "Narration", "Source", "Debit ₹", "Credit ₹", "Balance ₹", "Bal Type"];
    const data = filtered.map((r, i) => [
      i + 1, fmtDate(r.txnDate), r.voucherNo || "—", r.refNo || "—",
      r.narration || "—", r.sourceType || "—",
      r.debit > 0 ? fmt(r.debit) : "0.00",
      r.credit > 0 ? fmt(r.credit) : "0.00",
      fmt(r.balance), r.balanceType,
    ]);
    exportToCSV(`LedgerReport_${selectedAccount?.name || "Account"}.csv`, headers, data);
  }

  // Group accounts for the select optgroups
  const groups = useMemo(() => {
    const map = new Map<string, LedgerAccount[]>();
    for (const a of allAccounts) {
      const label = a.account_type === "gl"
        ? (GL_TYPE_LABELS[a.gl_type] || "Other Accounts")
        : (a.gl_name || "Sub-Ledgers");
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(a);
    }
    return map;
  }, [allAccounts]);

  return (
    <ReportShell
      title="Ledger Report"
      subtitle="Account-wise ledger statement with running balance"
      icon={<TrendingUp size={18} />}
      onExcelExport={selectedId ? handleExport : undefined}
    >
      {/* ── Filters ── */}
      <div className="flex flex-wrap items-end gap-3 p-4 border-b border-gray-100 bg-gray-50">
        {/* Account selector */}
        <div className="flex flex-col gap-1 min-w-[280px]">
          <label className="text-xs font-semibold text-gray-600">Account / Sub-Ledger</label>
          <select
            data-testid="select-account"
            value={selectedId}
            onChange={e => {
              const val = e.target.value;
              if (!val) { setSelectedId(""); return; }
              const [type, id] = val.split("|");
              setSelectedId(id);
              setSelectedType(type as "gl" | "sl");
              setApplyDates(false);
            }}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none focus:ring-2"
            style={{ "--tw-ring-color": SC.primary } as any}
          >
            <option value="">— Select Account —</option>
            {Array.from(groups.entries()).map(([label, accounts]) => (
              <optgroup key={label} label={label}>
                {accounts.map(a => (
                  <option key={a.id} value={`${a.account_type}|${a.id}`}>
                    {a.name}{a.code ? ` (${a.code})` : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600">From Date</label>
          <input
            type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            data-testid="input-from-date"
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600">To Date</label>
          <input
            type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            data-testid="input-to-date"
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm focus:outline-none"
          />
        </div>
        <button
          onClick={() => setApplyDates(true)}
          disabled={!selectedId}
          data-testid="button-apply-dates"
          className="h-9 px-4 rounded-md text-sm font-semibold text-white disabled:opacity-40 transition-colors"
          style={{ background: SC.primary }}
        >
          Apply
        </button>
        {applyDates && (
          <button
            onClick={() => setApplyDates(false)}
            data-testid="button-clear-dates"
            className="h-9 px-3 rounded-md text-sm text-gray-500 border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
          >
            Show All
          </button>
        )}

        {/* Search */}
        <div className="flex flex-col gap-1 ml-auto">
          <label className="text-xs font-semibold text-gray-600">Search</label>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Voucher, narration…"
              data-testid="input-search"
              className="h-9 pl-8 pr-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none w-48"
            />
          </div>
        </div>
      </div>

      {/* ── Account Header ── */}
      {stmtData && selectedAccount && (
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ background: SC.tonal }}>
          <div className="flex items-center gap-2">
            <TrendingUp size={14} style={{ color: SC.primary }} />
            <span className="text-sm font-bold text-gray-800">{selectedAccount.name}</span>
            {selectedAccount.code && <span className="text-xs text-gray-500">({selectedAccount.code})</span>}
            {selectedAccount.gl_name && (
              <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: SC.tonal, color: SC.primary }}>
                {selectedAccount.gl_name}
              </span>
            )}
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase"
              style={{ background: selectedAccount.account_type === "gl" ? "#f0fdf4" : "#fff7ed", color: selectedAccount.account_type === "gl" ? "#166534" : "#9a3412" }}
            >
              {selectedAccount.account_type === "gl" ? "GL Account" : "Sub-Ledger"}
            </span>
          </div>
          <div className="flex items-center gap-5 text-xs text-gray-600">
            <span>
              Opening Balance:{" "}
              <strong className="font-mono">₹{fmt(stmtData.openingBalance)}</strong>{" "}
              <span className="text-gray-400">{stmtData.openingBalanceType?.slice(0, 2)}</span>
            </span>
            {filtered.length > 0 && (
              <span>
                Closing Balance:{" "}
                <strong className="font-mono" style={{ color: SC.primary }}>₹{fmt(closingBal)}</strong>{" "}
                <span className="text-gray-400">{closingType}</span>
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── No account selected ── */}
      {!selectedId && (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <TrendingUp size={40} className="opacity-30" />
          <p className="text-sm">Select an account above to view its ledger statement.</p>
        </div>
      )}

      {/* ── Loading ── */}
      {selectedId && isLoading && (
        <div className="flex items-center justify-center py-20 text-gray-400 text-sm">
          Loading statement…
        </div>
      )}

      {/* ── Table ── */}
      {selectedId && !isLoading && stmtData && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2.5 text-left text-gray-500 font-semibold w-8">#</th>
                <th className="px-3 py-2.5 text-left text-gray-500 font-semibold whitespace-nowrap">Date</th>
                <th className="px-3 py-2.5 text-left text-gray-500 font-semibold whitespace-nowrap">Voucher / Ref No</th>
                <th className="px-3 py-2.5 text-left text-gray-500 font-semibold">Narration / Source</th>
                <th className="px-3 py-2.5 text-right text-gray-500 font-semibold whitespace-nowrap">Debit ₹</th>
                <th className="px-3 py-2.5 text-right text-gray-500 font-semibold whitespace-nowrap">Credit ₹</th>
                <th className="px-3 py-2.5 text-right text-gray-500 font-semibold whitespace-nowrap">Balance ₹</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening balance row */}
              <tr className="border-b border-gray-50 bg-blue-50/40">
                <td className="px-3 py-1.5 text-gray-400 text-center">—</td>
                <td className="px-3 py-1.5 text-gray-500 italic whitespace-nowrap">Opening</td>
                <td className="px-3 py-1.5 text-gray-500 italic" colSpan={2}>Opening Balance</td>
                <td className="px-3 py-1.5 text-right font-mono text-gray-600">
                  {stmtData.openingBalanceType !== "Credit" ? fmt(stmtData.openingBalance) : "—"}
                </td>
                <td className="px-3 py-1.5 text-right font-mono text-gray-600">
                  {stmtData.openingBalanceType === "Credit" ? fmt(stmtData.openingBalance) : "—"}
                </td>
                <td className="px-3 py-1.5 text-right font-mono font-semibold" style={{ color: SC.primary }}>
                  {fmt(stmtData.openingBalance)}{" "}
                  <span className="text-gray-400 text-[10px]">{stmtData.openingBalanceType?.slice(0, 2)}</span>
                </td>
              </tr>

              {/* No transactions */}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                    {rows.length === 0
                      ? "No transactions posted yet."
                      : "No transactions match the selected date range / search."}
                  </td>
                </tr>
              )}

              {/* Transaction rows */}
              {filtered.map((r, i) => (
                <tr
                  key={i}
                  data-testid={`stmt-row-${i}`}
                  className={`border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"} hover:bg-blue-50/20 transition-colors`}
                >
                  <td className="px-3 py-1.5 text-gray-400 text-center">{i + 1}</td>
                  <td className="px-3 py-1.5 text-gray-600 whitespace-nowrap">{fmtDate(r.txnDate)}</td>
                  <td className="px-3 py-1.5">
                    <div className="font-semibold text-gray-700">{r.voucherNo || r.refNo || "—"}</div>
                    {r.refNo && r.refNo !== r.voucherNo && (
                      <div className="text-gray-400 text-[10px]">Ref: {r.refNo}</div>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="text-gray-600 truncate max-w-[260px]">{r.narration || "—"}</div>
                    {r.sourceType && (
                      <span
                        className="inline-block text-[10px] px-1.5 py-0.5 rounded mt-0.5 font-medium"
                        style={{ background: SC.tonal, color: SC.primary }}
                      >
                        {r.sourceType === "grn" ? "Purchase" : r.sourceType === "job_work_invoice" ? "Sales Invoice" : r.sourceType}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-red-600">
                    {r.debit > 0 ? fmt(r.debit) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono text-green-700">
                    {r.credit > 0 ? fmt(r.credit) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono font-semibold" style={{ color: SC.primary }}>
                    {fmt(r.balance)}{" "}
                    <span className="text-gray-400 text-[10px]">{r.balanceType}</span>
                  </td>
                </tr>
              ))}
            </tbody>

            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50">
                  <td colSpan={4} className="px-3 py-2.5 text-xs font-semibold text-gray-600">
                    Closing Balance &nbsp;
                    <span className="font-normal text-gray-400">({filtered.length} transactions)</span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold text-red-600">
                    {fmt(totalDebit)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold text-green-700">
                    {fmt(totalCredit)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono text-sm font-bold" style={{ color: SC.primary }}>
                    {fmt(closingBal)}{" "}
                    <span className="text-xs font-semibold text-gray-500">{closingType}</span>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </ReportShell>
  );
}
