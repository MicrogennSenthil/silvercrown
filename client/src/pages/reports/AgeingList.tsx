import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Phone, User, Plus, X, Settings2, Users, Truck } from "lucide-react";
import { ReportShell, RTh, RTd, exportToCSV } from "@/components/ReportShell";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa" };

/* ─── Types ─────────────────────────────────────────────────────────── */
type Bucket = { from: number; to: number };
type PartyType = "customer" | "supplier";

type AgeRow = {
  party_id: string;
  party_name: string;
  contact_no: string;
  contact_person: string;
  buckets: number[];
  others: number;
  total: number;
};

/* ─── Helpers ────────────────────────────────────────────────────────── */
function fmtAmt(n: number) {
  if (n === 0) return <span className="text-gray-300">0.00</span>;
  return <span>{n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
}
function plain(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const DEFAULT_BUCKETS: Bucket[] = [
  { from: 0,  to: 7  },
  { from: 7,  to: 14 },
  { from: 14, to: 21 },
  { from: 21, to: 28 },
];

function presetBuckets(interval: number): Bucket[] {
  return [
    { from: 0,          to: interval   },
    { from: interval,   to: interval*2 },
    { from: interval*2, to: interval*3 },
    { from: interval*3, to: interval*4 },
  ];
}

function bucketsToParam(bkts: Bucket[]) {
  return bkts.map(b => `${b.from}-${b.to}`).join(",");
}

function colLabel(b: Bucket, isAbove: boolean) {
  if (isAbove) return `Above ${b.from} Days`;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (b.from === 0) return `0–${pad(b.to)} Days`;
  return `${pad(b.from)}–${pad(b.to)} Days`;
}

/* ─── Customize Modal ────────────────────────────────────────────────── */
function CustomizeModal({
  initial, onApply, onClose,
}: {
  initial: Bucket[];
  onApply: (b: Bucket[]) => void;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Bucket[]>(initial.map(b => ({ ...b })));

  function set(idx: number, field: "from" | "to", val: string) {
    const n = parseInt(val, 10);
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: isNaN(n) ? 0 : n } : r));
  }

  function addRow() {
    const last = rows[rows.length - 1];
    setRows(prev => [...prev, { from: last?.to ?? 0, to: (last?.to ?? 0) + 7 }]);
  }

  function removeRow(idx: number) {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter((_, i) => i !== idx));
  }

  function applyPreset(interval: number) {
    setRows(presetBuckets(interval));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 z-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-800">Customize Ageing Days</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18}/>
          </button>
        </div>

        {/* Preset chips */}
        <p className="text-xs font-semibold text-gray-500 mb-2">Quick Presets</p>
        <div className="flex gap-3 mb-5">
          {[10, 15, 30].map(d => (
            <button
              key={d}
              onClick={() => applyPreset(d)}
              className="flex-1 py-2 rounded-lg border text-sm font-semibold transition-colors hover:bg-[#e6f7fd] border-gray-200 text-gray-700"
              data-testid={`preset-${d}`}>
              {d} Days
            </button>
          ))}
        </div>

        <p className="text-sm font-semibold text-gray-600 mb-3">Custom Ranges</p>

        <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="text-[10px] text-gray-400 absolute -top-2 left-2 bg-white px-0.5 z-10 leading-none">From</span>
                <input
                  type="number" min="0"
                  value={row.from}
                  onChange={e => set(idx, "from", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 text-center
                    focus:outline-none focus:border-[#027fa5] focus:ring-1 focus:ring-[#027fa5]/20"
                  data-testid={`bucket-from-${idx}`}/>
              </div>
              <div className="relative flex-1">
                <span className="text-[10px] text-gray-400 absolute -top-2 left-2 bg-white px-0.5 z-10 leading-none">To</span>
                <input
                  type="number" min="0"
                  value={row.to}
                  onChange={e => set(idx, "to", e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 text-center
                    focus:outline-none focus:border-[#027fa5] focus:ring-1 focus:ring-[#027fa5]/20"
                  data-testid={`bucket-to-${idx}`}/>
              </div>
              {rows.length > 1 && (
                <button onClick={() => removeRow(idx)}
                  className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors"
                  data-testid={`remove-bucket-${idx}`}>
                  <X size={14}/>
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addRow}
          className="mt-3 w-full py-2 rounded-lg border border-dashed border-gray-300 text-sm text-gray-500
            hover:border-[#027fa5] hover:text-[#027fa5] transition-colors flex items-center justify-center gap-1"
          data-testid="add-bucket">
          <Plus size={14}/> Add More
        </button>

        <div className="flex gap-3 mt-5">
          <button
            onClick={() => setRows(DEFAULT_BUCKETS.map(b => ({ ...b })))}
            className="flex-1 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-600
              hover:bg-gray-50 transition-colors"
            data-testid="clear-all">
            Reset
          </button>
          <button
            onClick={() => { onApply(rows); onClose(); }}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
            style={{ background: SC.orange }}
            data-testid="apply-buckets">
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────── */
export default function AgeingList() {
  const [search,    setSearch]    = useState("");
  const [buckets,   setBuckets]   = useState<Bucket[]>(DEFAULT_BUCKETS);
  const [showModal, setShowModal] = useState(false);
  const [party,     setParty]     = useState<PartyType>("customer");

  const rangesParam = bucketsToParam(buckets);
  const aboveLabel  = `Above ${buckets[buckets.length - 1]?.to ?? 0} Days`;
  const isCustomer  = party === "customer";

  const { data: apiData, isLoading } = useQuery<AgeRow[]>({
    queryKey: ["/api/reports/ageing-list", party, rangesParam],
    queryFn: () =>
      fetch(`/api/reports/ageing-list?party=${party}&ranges=${encodeURIComponent(rangesParam)}`, { credentials: "include" })
        .then(r => r.json()),
  });

  const rawRows: AgeRow[] = Array.isArray(apiData) ? apiData : [];

  const filtered = useMemo(() =>
    rawRows.filter(r => {
      if (!search.trim()) return true;
      return [r.party_name, r.contact_no, r.contact_person]
        .join(" ").toLowerCase().includes(search.toLowerCase());
    }),
  [rawRows, search]);

  const grandTotal = useMemo(() => filtered.reduce((s, r) => s + r.total, 0), [filtered]);

  const colTotals = useMemo(() => {
    const bkts = Array(buckets.length).fill(0);
    let others = 0, total = 0;
    filtered.forEach(r => {
      r.buckets.forEach((v, i) => { bkts[i] = (bkts[i] || 0) + v; });
      others += r.others;
      total  += r.total;
    });
    return { bkts, others, total };
  }, [filtered, buckets.length]);

  function handleExcel() {
    const partyLabel = isCustomer ? "Customer Name" : "Supplier Name";
    const headers = [
      "S.No", partyLabel,
      ...buckets.map((b, i) => colLabel(b, i === buckets.length - 1)),
      aboveLabel, "Others", "Total",
      "Contact No", "Contact Person",
    ];
    const csvRows = filtered.map((r, i) => [
      i + 1, r.party_name,
      ...r.buckets.map(plain),
      plain(r.others), plain(r.total),
      r.contact_no || "", r.contact_person || "",
    ]);
    exportToCSV(`AgeingList_${party}.csv`, headers, csvRows);
  }

  /* ── Filter bar extras ── */
  const extraFilters = (
    <div className="flex items-center gap-2">
      {/* Customer / Supplier toggle */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-semibold">
        <button
          onClick={() => setParty("customer")}
          data-testid="btn-party-customer"
          className="flex items-center gap-1.5 px-3 py-1.5 transition-colors"
          style={isCustomer
            ? { background: SC.primary, color: "#fff" }
            : { background: "#fff", color: "#6b7280" }}>
          <Users size={13}/> Customer
        </button>
        <button
          onClick={() => setParty("supplier")}
          data-testid="btn-party-supplier"
          className="flex items-center gap-1.5 px-3 py-1.5 transition-colors border-l border-gray-200"
          style={!isCustomer
            ? { background: SC.orange, color: "#fff" }
            : { background: "#fff", color: "#6b7280" }}>
          <Truck size={13}/> Supplier
        </button>
      </div>

      {/* Customize Aging Days */}
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors"
        style={{ background: SC.primary }}
        data-testid="btn-customize-days">
        <Settings2 size={14}/> Customize Aging Days
      </button>
    </div>
  );

  const partyLabel = isCustomer ? "Customer Name" : "Supplier Name";
  const summaryLabel = isCustomer ? "Customers" : "Suppliers";
  const emptyMsg = isCustomer
    ? "No outstanding customer receivables found."
    : "No outstanding supplier payables found.";

  return (
    <>
      {showModal && (
        <CustomizeModal
          initial={buckets}
          onApply={setBuckets}
          onClose={() => setShowModal(false)}/>
      )}

      <ReportShell
        title="Ageing List"
        search={search} onSearch={setSearch}
        onExcelExport={handleExcel}
        recordCount={filtered.length}
        extraFilters={extraFilters}
      >
        {/* Summary strip */}
        {!isLoading && filtered.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-8 gap-y-1 px-5 py-2 border-b border-gray-100 bg-gray-50/50 text-xs">
            <span className="text-gray-500">
              {summaryLabel}: <b className="text-gray-800">{filtered.length}</b>
            </span>
            <span className="text-gray-500">
              Grand Total:{" "}
              <b className="font-bold" style={{ color: isCustomer ? SC.primary : SC.orange }}>
                ₹ {plain(grandTotal)}
              </b>
            </span>
            <span className="text-gray-400 italic">
              Buckets: {buckets.map(b => `${b.from}–${b.to}`).join(", ")} → Above {buckets[buckets.length-1]?.to}
            </span>
            <span
              className="ml-auto text-[11px] px-2 py-0.5 rounded font-semibold"
              style={isCustomer
                ? { background: "#e0f2fe", color: SC.primary }
                : { background: "#fff7ed", color: SC.orange }}>
              {isCustomer ? "Receivables" : "Payables"}
            </span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: Math.max(900, 200 + buckets.length * 100 + 300) }}>
            <thead className="sticky top-0">
              <tr>
                <RTh>S.no</RTh>
                <RTh>{partyLabel}</RTh>
                {buckets.map((b, i) => (
                  <RTh key={i} right>{colLabel(b, false)}</RTh>
                ))}
                <RTh right className="text-red-600">{aboveLabel}</RTh>
                <RTh right className="text-gray-500">Others</RTh>
                <RTh right className="font-bold">Total</RTh>
                <RTh>Contact No</RTh>
                <RTh>Contact Person</RTh>
              </tr>
            </thead>

            <tbody>
              {isLoading && (
                <tr><td colSpan={buckets.length + 7} className="px-5 py-14 text-center text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-7 h-7 rounded-full animate-spin"
                      style={{ border: "3px solid #d2f1fa", borderTopColor: "#027fa5" }} />
                    <span>Loading…</span>
                  </div>
                </td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={buckets.length + 7} className="px-5 py-14 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <AlertCircle size={28} className="text-gray-300"/>
                    <span className="text-sm">
                      {search ? `No ${summaryLabel.toLowerCase()} match the search.` : emptyMsg}
                    </span>
                  </div>
                </td></tr>
              )}
              {!isLoading && filtered.map((row, idx) => (
                <tr key={row.party_id}
                  className={`border-t border-gray-50 hover:bg-[#f0f9ff] transition-colors
                    ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/20"}`}
                  data-testid={`row-age-${idx}`}>
                  <RTd muted>{String(idx + 1).padStart(2, "0")}</RTd>
                  <td className="px-4 py-2.5 font-semibold text-gray-800">{row.party_name}</td>
                  {row.buckets.map((v, bi) => {
                    const isLast = bi === row.buckets.length - 1;
                    const cls = isLast && v > 0 ? "text-red-600 font-bold"
                      : bi === row.buckets.length - 2 && v > 0 ? "text-orange-600 font-semibold"
                      : bi === row.buckets.length - 3 && v > 0 ? "text-amber-600 font-semibold"
                      : "";
                    return (
                      <RTd key={bi} right>
                        <span className={cls}>{fmtAmt(v)}</span>
                      </RTd>
                    );
                  })}
                  <RTd right muted>{fmtAmt(row.others)}</RTd>
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums text-gray-800">
                    {plain(row.total)}
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
              ))}
            </tbody>

            {!isLoading && filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2" style={{ background: SC.tonal }}>
                  <td colSpan={2} className="px-4 py-2.5 text-sm font-bold text-gray-700">
                    Grand Total — {filtered.length} {summaryLabel.toLowerCase()}
                  </td>
                  {colTotals.bkts.map((v, i) => (
                    <RTd key={i} right bold>{fmtAmt(v)}</RTd>
                  ))}
                  <RTd right bold muted>{fmtAmt(colTotals.others)}</RTd>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-gray-800 tabular-nums">
                    ₹ {plain(colTotals.total)}
                  </td>
                  <td colSpan={2}/>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </ReportShell>
    </>
  );
}
