import { useState, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { ReportShell, ReportFilterSelect, RTh, RTd, exportToCSV } from "@/components/ReportShell";

const SC = { primary: "#027fa5", tonal: "#d2f1fa", orange: "#d74700" };

function today()    { return new Date().toISOString().slice(0, 10); }
function monthAgo() { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 10); }

function fmtQty(v: number | string | null | undefined) {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? "—" : n === 0 ? "—" : n.toFixed(2);
}
function fmtVal(v: number | string | null | undefined) {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? "—" : n === 0 ? "—" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

type OpeningRow = {
  item_code: string; item_name: string; unit: string;
  opening_qty: string; opening_val: string;
};
type TxnRow = {
  item_code: string; txn_type: string;
  ref_no: string; ref_date: string; stock_date: string; from_to: string;
  rate: string; receipt_qty: string; issue_qty: string; amount: string;
};
type LedgerData = { openings: OpeningRow[]; transactions: TxnRow[] };

type ItemGroup = {
  item_code: string; item_name: string; unit: string;
  opening_qty: number; opening_val: number;
  txns: TxnRow[];
  total_receipt_qty: number; total_issue_qty: number;
  total_receipt_val: number; total_issue_val: number;
  closing_qty: number; closing_val: number;
  avg_rate: number;
};

function buildGroups(openings: OpeningRow[], txns: TxnRow[]): ItemGroup[] {
  const map = new Map<string, ItemGroup>();
  for (const o of openings) {
    const oq = parseFloat(o.opening_qty || "0");
    const ov = parseFloat(o.opening_val || "0");
    map.set(o.item_code, {
      item_code: o.item_code, item_name: o.item_name, unit: o.unit,
      opening_qty: oq, opening_val: ov,
      txns: [],
      total_receipt_qty: 0, total_issue_qty: 0,
      total_receipt_val: 0, total_issue_val: 0,
      closing_qty: oq, closing_val: ov,
      avg_rate: oq > 0 ? ov / oq : 0,
    });
  }
  for (const t of txns) {
    let g = map.get(t.item_code);
    if (!g) {
      g = {
        item_code: t.item_code, item_name: t.item_code, unit: "Nos",
        opening_qty: 0, opening_val: 0,
        txns: [],
        total_receipt_qty: 0, total_issue_qty: 0,
        total_receipt_val: 0, total_issue_val: 0,
        closing_qty: 0, closing_val: 0,
        avg_rate: 0,
      };
      map.set(t.item_code, g);
    }
    g.txns.push(t);
    const rq = parseFloat(t.receipt_qty || "0");
    const iq = parseFloat(t.issue_qty   || "0");
    const amt = parseFloat(t.amount     || "0");
    if (rq > 0) { g.total_receipt_qty += rq; g.total_receipt_val += amt; }
    if (iq > 0) { g.total_issue_qty   += iq; g.total_issue_val   += amt; }
  }
  for (const g of map.values()) {
    g.closing_qty = g.opening_qty + g.total_receipt_qty - g.total_issue_qty;
    g.closing_val = g.opening_val + g.total_receipt_val - g.total_issue_val;
    g.avg_rate    = g.closing_qty > 0 ? g.closing_val / g.closing_qty : 0;
  }
  // Only return items that have transactions OR non-zero opening
  return [...map.values()]
    .filter(g => g.txns.length > 0 || g.opening_qty !== 0)
    .sort((a, b) => a.item_name.localeCompare(b.item_name));
}

export default function StockLedger() {
  const [search,     setSearch]     = useState("");
  const [fromDate,   setFromDate]   = useState(monthAgo());
  const [toDate,     setToDate]     = useState(today());
  const [itemFilter, setItemFilter] = useState("");

  const { data, isLoading } = useQuery<LedgerData>({
    queryKey: ["/api/reports/stock-ledger", fromDate, toDate, itemFilter],
    queryFn: () => {
      const params = new URLSearchParams({ from: fromDate, to: toDate });
      if (itemFilter) params.set("item_code", itemFilter);
      return fetch(`/api/reports/stock-ledger?${params}`, { credentials: "include" }).then(r => r.json());
    },
  });

  const allItems = useMemo(() =>
    [...new Set((data?.openings ?? []).map(r => r.item_code))].sort(), [data]);

  const groups = useMemo(() =>
    buildGroups(data?.openings ?? [], data?.transactions ?? []), [data]);

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    const q = search.toLowerCase();
    return groups.filter(g =>
      [g.item_code, g.item_name, g.unit].join(" ").toLowerCase().includes(q) ||
      g.txns.some(t => [t.ref_no, t.from_to].join(" ").toLowerCase().includes(q))
    );
  }, [groups, search]);

  // Grand totals
  const grand = useMemo(() => ({
    opening_qty:  filtered.reduce((s, g) => s + g.opening_qty, 0),
    opening_val:  filtered.reduce((s, g) => s + g.opening_val, 0),
    receipt_qty:  filtered.reduce((s, g) => s + g.total_receipt_qty, 0),
    receipt_val:  filtered.reduce((s, g) => s + g.total_receipt_val, 0),
    issue_qty:    filtered.reduce((s, g) => s + g.total_issue_qty, 0),
    issue_val:    filtered.reduce((s, g) => s + g.total_issue_val, 0),
    closing_qty:  filtered.reduce((s, g) => s + g.closing_qty, 0),
    closing_val:  filtered.reduce((s, g) => s + g.closing_val, 0),
  }), [filtered]);

  function handleExcel() {
    const headers = ["S.No","Item Code","Item Name","Unit","Ref No","Ref Date","Stock Date","From/To","Rate","Opening Qty","Receipt Qty","Issue Qty","Closing Qty"];
    const rows: (string | number)[][] = [];
    let sno = 1;
    for (const g of filtered) {
      rows.push([sno++, g.item_code, g.item_name, g.unit, "—", "—", "—", "Opening Balance", "", g.opening_qty.toFixed(2), "", "", ""]);
      for (const t of g.txns) {
        rows.push(["", "", "", "", t.ref_no||"—", fmtDate(t.ref_date), fmtDate(t.stock_date), t.from_to||"—",
          parseFloat(t.rate||"0").toFixed(2), "", t.receipt_qty||"0", t.issue_qty||"0", ""]);
      }
      rows.push(["", "", "", "", "Total Qty", "", "", "", "", g.opening_qty.toFixed(2), g.total_receipt_qty.toFixed(2), g.total_issue_qty.toFixed(2), g.closing_qty.toFixed(2)]);
    }
    exportToCSV(`StockLedger_${fromDate}_to_${toDate}.csv`, headers, rows);
  }

  const COL_HDR = "px-3 py-2.5 text-xs font-bold text-gray-700 whitespace-nowrap text-left";
  const COL_HDR_R = "px-3 py-2.5 text-xs font-bold text-gray-700 whitespace-nowrap text-right";

  return (
    <ReportShell
      title="Stock Ledger"
      search={search} onSearch={setSearch}
      fromDate={fromDate} toDate={toDate}
      onFromDate={setFromDate} onToDate={setToDate}
      onExcelExport={handleExcel}
      recordCount={filtered.length}
      extraFilters={
        <ReportFilterSelect
          label="Item" value={itemFilter} onChange={setItemFilter}
          options={allItems} allLabel="All Items" />
      }
    >
      {/* Summary strip */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-8 gap-y-1 px-5 py-2 border-b border-gray-100 bg-gray-50/50 text-xs">
          <span className="text-gray-500">Items: <b className="text-gray-800">{filtered.length}</b></span>
          <span className="text-gray-500">Opening: <b className="text-gray-800">{grand.opening_qty.toFixed(2)}</b></span>
          <span className="text-gray-500">Receipts: <b style={{ color: SC.primary }}>{grand.receipt_qty.toFixed(2)}</b></span>
          <span className="text-gray-500">Issues: <b style={{ color: SC.orange }}>{grand.issue_qty.toFixed(2)}</b></span>
          <span className="text-gray-500">Closing: <b className="text-green-700">{grand.closing_qty.toFixed(2)}</b></span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 980 }}>
          <thead className="sticky top-0">
            <tr style={{ background: SC.tonal }}>
              <th className={COL_HDR} style={{ width: 46 }}>S.no</th>
              <th className={COL_HDR} style={{ width: 90 }}>Item Code</th>
              <th className={COL_HDR}>Item Name</th>
              <th className={COL_HDR} style={{ width: 54 }}>Unit</th>
              <th className={COL_HDR} style={{ width: 90 }}>Ref No</th>
              <th className={COL_HDR} style={{ width: 100 }}>Ref Date</th>
              <th className={COL_HDR} style={{ width: 100 }}>Stock Date</th>
              <th className={COL_HDR}>From/To</th>
              <th className={COL_HDR_R} style={{ width: 70 }}>Rate ₹</th>
              <th className={COL_HDR_R} style={{ width: 88 }}>Opening Qty</th>
              <th className={COL_HDR_R} style={{ width: 88 }}>Receipt Qty</th>
              <th className={COL_HDR_R} style={{ width: 80 }}>Issue Qty</th>
              <th className={COL_HDR_R} style={{ width: 88 }}>Closing Qty</th>
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
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={13} className="px-5 py-14 text-center">
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <AlertCircle size={28} className="text-gray-300" />
                  <span className="text-sm">No stock ledger data found for the selected period.</span>
                </div>
              </td></tr>
            )}

            {!isLoading && filtered.map((g, gi) => (
              <Fragment key={g.item_code}>
                {/* ── Item opening row ── */}
                <tr key={`hdr-${g.item_code}`}
                  className="border-t-2 border-gray-200"
                  style={{ background: "#f0f9ff" }}
                  data-testid={`row-item-${g.item_code}`}>
                  <td className="px-3 py-2 text-xs text-gray-500 font-medium">{String(gi + 1).padStart(2, "0")}</td>
                  <td className="px-3 py-2 text-xs font-mono font-semibold text-gray-500">{g.item_code}</td>
                  <td className="px-3 py-2 text-sm font-semibold text-gray-800">{g.item_name}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{g.unit}</td>
                  <td className="px-3 py-2 text-xs text-gray-400">—</td>
                  <td className="px-3 py-2 text-xs text-gray-400">—</td>
                  <td className="px-3 py-2 text-xs text-gray-400">—</td>
                  <td className="px-3 py-2 text-xs text-gray-500 italic">Opening Balance</td>
                  <td className="px-3 py-2 text-xs text-right text-gray-600">
                    {g.opening_qty > 0 ? (g.opening_val / g.opening_qty).toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2 text-sm text-right font-semibold text-gray-700">{fmtQty(g.opening_qty)}</td>
                  <td className="px-3 py-2 text-xs text-right text-gray-400">—</td>
                  <td className="px-3 py-2 text-xs text-right text-gray-400">—</td>
                  <td className="px-3 py-2 text-xs text-right text-gray-400">—</td>
                </tr>

                {/* ── Transaction rows ── */}
                {g.txns.map((t, ti) => (
                  <tr key={`txn-${g.item_code}-${ti}`}
                    className={`border-t border-gray-100 hover:bg-[#f0f9ff] transition-colors
                      ${ti % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                    <td className="px-3 py-1.5" />
                    <td className="px-3 py-1.5" />
                    <td className="px-3 py-1.5" />
                    <td className="px-3 py-1.5" />
                    <td className="px-3 py-1.5 text-xs text-gray-600 font-mono">{t.ref_no || "—"}</td>
                    <td className="px-3 py-1.5 text-xs text-gray-500">{fmtDate(t.ref_date)}</td>
                    <td className="px-3 py-1.5 text-xs text-gray-500">{fmtDate(t.stock_date)}</td>
                    <td className="px-3 py-1.5 text-xs text-gray-700">{t.from_to || "—"}</td>
                    <td className="px-3 py-1.5 text-xs text-right text-gray-600">
                      {parseFloat(t.rate||"0") > 0 ? parseFloat(t.rate).toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-right text-gray-400">—</td>
                    <td className="px-3 py-1.5 text-xs text-right"
                      style={{ color: parseFloat(t.receipt_qty||"0") > 0 ? SC.primary : "#9ca3af" }}>
                      {fmtQty(t.receipt_qty)}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-right"
                      style={{ color: parseFloat(t.issue_qty||"0") > 0 ? SC.orange : "#9ca3af" }}>
                      {fmtQty(t.issue_qty)}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-right text-gray-400">—</td>
                  </tr>
                ))}

                {/* ── Item Total Qty row ── */}
                <tr key={`tot-qty-${g.item_code}`} className="border-t border-gray-200 bg-gray-50">
                  <td colSpan={8} className="px-3 py-1.5 text-xs font-semibold text-gray-600 pl-6">Total Qty</td>
                  <td className="px-3 py-1.5 text-xs text-right text-gray-500">—</td>
                  <td className="px-3 py-1.5 text-xs text-right font-semibold text-gray-700">{fmtQty(g.opening_qty)}</td>
                  <td className="px-3 py-1.5 text-xs text-right font-semibold" style={{ color: SC.primary }}>{fmtQty(g.total_receipt_qty)}</td>
                  <td className="px-3 py-1.5 text-xs text-right font-semibold" style={{ color: SC.orange }}>{fmtQty(g.total_issue_qty)}</td>
                  <td className="px-3 py-1.5 text-xs text-right font-semibold text-green-700">{fmtQty(g.closing_qty)}</td>
                </tr>

                {/* ── Item Total Value row ── */}
                <tr key={`tot-val-${g.item_code}`} className="bg-gray-50">
                  <td colSpan={8} className="px-3 py-1.5 text-xs font-semibold text-gray-500 pl-6">Total Value</td>
                  <td className="px-3 py-1.5 text-xs text-right text-gray-500">
                    {g.closing_qty > 0 ? g.avg_rate.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-right text-gray-600">{fmtVal(g.opening_val)}</td>
                  <td className="px-3 py-1.5 text-xs text-right" style={{ color: SC.primary }}>{fmtVal(g.total_receipt_val)}</td>
                  <td className="px-3 py-1.5 text-xs text-right" style={{ color: SC.orange }}>{fmtVal(g.total_issue_val)}</td>
                  <td className="px-3 py-1.5 text-xs text-right text-green-700">{fmtVal(g.closing_val)}</td>
                </tr>
              </Fragment>
            ))}

            {/* ── Grand Total ── */}
            {!isLoading && filtered.length > 0 && (
              <tr className="border-t-2" style={{ background: SC.tonal }}>
                <td colSpan={8} className="px-4 py-2.5 text-sm font-bold text-gray-800">
                  Grand Total — {filtered.length} item{filtered.length !== 1 ? "s" : ""}
                </td>
                <td className="px-3 py-2.5 text-sm text-right font-bold text-gray-600">—</td>
                <td className="px-3 py-2.5 text-sm text-right font-bold text-gray-700">{fmtQty(grand.opening_qty)}</td>
                <td className="px-3 py-2.5 text-sm text-right font-bold" style={{ color: SC.primary }}>{fmtQty(grand.receipt_qty)}</td>
                <td className="px-3 py-2.5 text-sm text-right font-bold" style={{ color: SC.orange }}>{fmtQty(grand.issue_qty)}</td>
                <td className="px-3 py-2.5 text-sm text-right font-bold text-green-700">{fmtQty(grand.closing_qty)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}
