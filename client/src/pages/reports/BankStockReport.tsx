import { useState, useMemo, Fragment } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { ReportShell, exportToCSV } from "@/components/ReportShell";

const SC = { primary: "#027fa5", tonal: "#d2f1fa", orange: "#d74700" };

function fmtQty(v: number | string | null | undefined) {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? "—" : n.toFixed(2);
}
function fmtAmt(v: number | string | null | undefined) {
  const n = parseFloat(String(v ?? 0));
  return isNaN(n) ? "—" : n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type ReportRow = {
  group_name: string; group_id: string;
  sub_group_name: string; sub_group_id: string;
  item_code: string; item_name: string;
  qty: string; unit: string; rate: string; amount: string;
  batch_no: string; expiry_date: string;
};

type SubGroup = {
  id: string; name: string;
  items: ReportRow[];
  total_qty: number; total_amount: number;
};
type Group = {
  id: string; name: string;
  subGroups: Map<string, SubGroup>;
  total_qty: number; total_amount: number;
};

function buildTree(rows: ReportRow[]) {
  const groups = new Map<string, Group>();
  for (const r of rows) {
    if (!groups.has(r.group_id)) {
      groups.set(r.group_id, { id: r.group_id, name: r.group_name, subGroups: new Map(), total_qty: 0, total_amount: 0 });
    }
    const g = groups.get(r.group_id)!;
    if (!g.subGroups.has(r.sub_group_id)) {
      g.subGroups.set(r.sub_group_id, { id: r.sub_group_id, name: r.sub_group_name, items: [], total_qty: 0, total_amount: 0 });
    }
    const sg = g.subGroups.get(r.sub_group_id)!;
    sg.items.push(r);
    const qty = parseFloat(r.qty || "0");
    const amt = parseFloat(r.amount || "0");
    sg.total_qty   += qty; sg.total_amount   += amt;
    g.total_qty    += qty; g.total_amount    += amt;
  }
  return [...groups.values()];
}

export default function BankStockReport() {
  const [search, setSearch] = useState("");

  const { data: rawRows = [], isLoading } = useQuery<ReportRow[]>({
    queryKey: ["/api/reports/bank-stock-report"],
    queryFn: () =>
      fetch("/api/reports/bank-stock-report", { credentials: "include" }).then(r => r.json()),
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return rawRows;
    const q = search.toLowerCase();
    return rawRows.filter(r =>
      [r.item_code, r.item_name, r.batch_no, r.group_name, r.sub_group_name].join(" ").toLowerCase().includes(q)
    );
  }, [rawRows, search]);

  const tree = useMemo(() => buildTree(filtered), [filtered]);

  const grand = useMemo(() => ({
    qty:    filtered.reduce((s, r) => s + parseFloat(r.qty    || "0"), 0),
    amount: filtered.reduce((s, r) => s + parseFloat(r.amount || "0"), 0),
  }), [filtered]);

  function handleExcel() {
    const headers = ["S.No", "Group", "Sub Group", "Item Code", "Item Name", "Qty", "Unit", "Rate", "Amount", "Batch No", "Expiry Date"];
    const rows = filtered.map((r, i) => [
      i + 1, r.group_name, r.sub_group_name, r.item_code, r.item_name,
      fmtQty(r.qty), r.unit, fmtAmt(r.rate), fmtAmt(r.amount), r.batch_no || "—", r.expiry_date || "—",
    ]);
    exportToCSV("BankStockReport.csv", headers, rows);
  }

  const TH = "px-4 py-2.5 text-xs font-bold text-gray-700 whitespace-nowrap text-left";
  const THR = "px-4 py-2.5 text-xs font-bold text-gray-700 whitespace-nowrap text-right";

  return (
    <ReportShell
      title="Bank Stock Report"
      search={search} onSearch={setSearch}
      onExcelExport={handleExcel}
      recordCount={filtered.length}
    >
      {/* Summary strip */}
      {!isLoading && filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-8 px-5 py-2 border-b border-gray-100 bg-gray-50/50 text-xs">
          <span className="text-gray-500">Total Qty: <b className="text-gray-800">{fmtQty(grand.qty)}</b></span>
          <span className="text-gray-500">Grand Total: <b className="text-green-700">₹{fmtAmt(grand.amount)}</b></span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ minWidth: 820 }}>
          <thead className="sticky top-0">
            <tr style={{ background: SC.tonal }}>
              <th className={TH}  style={{ width: 46 }}>S.no</th>
              <th className={TH}  style={{ width: 100 }}>Item Code</th>
              <th className={TH}>Item Name</th>
              <th className={THR} style={{ width: 70 }}>Qty</th>
              <th className={TH}  style={{ width: 60 }}>Unit</th>
              <th className={THR} style={{ width: 80 }}>Rate ₹</th>
              <th className={THR} style={{ width: 100 }}>Amount ₹</th>
              <th className={TH}  style={{ width: 80 }}>Batch No</th>
              <th className={TH}  style={{ width: 110 }}>Expiry Date</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={9} className="px-5 py-14 text-center text-gray-400">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-7 h-7 rounded-full animate-spin"
                    style={{ border: "3px solid #d2f1fa", borderTopColor: "#027fa5" }} />
                  <span>Loading…</span>
                </div>
              </td></tr>
            )}
            {!isLoading && tree.length === 0 && (
              <tr><td colSpan={9} className="px-5 py-14 text-center">
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <AlertCircle size={28} className="text-gray-300" />
                  <span className="text-sm">
                    {search ? "No items match the search." : "No bank stock items found."}
                  </span>
                </div>
              </td></tr>
            )}

            {!isLoading && tree.map(group => (
              <Fragment key={group.id}>
                {/* ── Group header ── */}
                <tr style={{ background: "#e0f4fc" }}>
                  <td colSpan={9} className="px-4 py-2 text-sm font-bold text-gray-800">
                    Group : {group.name}
                  </td>
                </tr>

                {[...group.subGroups.values()].map(sg => (
                  <Fragment key={sg.id}>
                    {/* ── Sub Group header ── */}
                    <tr style={{ background: "#f0f9ff" }}>
                      <td colSpan={9} className="px-6 py-1.5 text-xs font-semibold text-gray-600 italic">
                        Sub Group : {sg.name}
                      </td>
                    </tr>

                    {/* ── Item rows ── */}
                    {sg.items.map((row, idx) => (
                      <tr key={`${row.item_code}-${idx}`}
                        className={`border-t border-gray-50 hover:bg-[#f0f9ff] transition-colors
                          ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/20"}`}
                        data-testid={`row-item-${row.item_code}-${idx}`}>
                        <td className="px-4 py-2 text-xs text-gray-500">{String(idx + 1).padStart(2, "0")}</td>
                        <td className="px-4 py-2 text-xs font-mono font-semibold text-gray-500">{row.item_code}</td>
                        <td className="px-4 py-2 text-sm text-gray-800">{row.item_name}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium text-gray-700">{fmtQty(row.qty)}</td>
                        <td className="px-4 py-2 text-xs text-gray-500">{row.unit}</td>
                        <td className="px-4 py-2 text-sm text-right text-gray-600">{fmtAmt(row.rate)}</td>
                        <td className="px-4 py-2 text-sm text-right font-medium text-gray-700">{fmtAmt(row.amount)}</td>
                        <td className="px-4 py-2 text-xs text-gray-600">{row.batch_no || "—"}</td>
                        <td className="px-4 py-2 text-xs text-gray-500">{row.expiry_date || "—"}</td>
                      </tr>
                    ))}

                    {/* ── Sub Group total ── */}
                    <tr className="border-t border-gray-200" style={{ background: "#f5f5f5" }}>
                      <td colSpan={3} className="px-6 py-1.5 text-xs font-semibold text-gray-700">
                        {sg.name}
                      </td>
                      <td className="px-4 py-1.5 text-xs text-right font-semibold text-gray-700">
                        Total Qty : {fmtQty(sg.total_qty)}
                      </td>
                      <td colSpan={3} className="px-4 py-1.5 text-xs text-right font-semibold text-gray-700">
                        Total Amt ₹ : {fmtAmt(sg.total_amount)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </Fragment>
                ))}

                {/* ── Group total ── */}
                <tr className="border-t border-gray-300" style={{ background: "#d2f1fa" }}>
                  <td colSpan={3} className="px-4 py-2 text-sm font-bold text-gray-800">
                    {group.name}
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-bold text-gray-800">
                    Total Qty : {fmtQty(group.total_qty)}
                  </td>
                  <td colSpan={3} className="px-4 py-2 text-sm text-right font-bold text-gray-800">
                    Total Amt ₹ : {fmtAmt(group.total_amount)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </Fragment>
            ))}

            {/* ── Grand Total ── */}
            {!isLoading && filtered.length > 0 && (
              <tr className="border-t-2" style={{ background: SC.tonal }}>
                <td colSpan={3} className="px-4 py-3 text-sm font-bold text-gray-800" />
                <td className="px-4 py-3 text-sm font-bold text-gray-800">
                  Total Qty : {fmtQty(grand.qty)}
                </td>
                <td colSpan={3} className="px-4 py-3 text-sm text-right font-bold text-gray-800">
                  Grand Total ₹ : {fmtAmt(grand.amount)}
                </td>
                <td colSpan={2} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}
