import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, RefreshCw, ChevronRight, Info } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700" };
const n2 = (v: any) => Number(v || 0).toFixed(2);
const n3 = (v: any) => Number(v || 0).toFixed(3);

export default function YearEndClosing() {
  const qc = useQueryClient();
  const [step, setStep]       = useState<1 | 2 | 3>(1);
  const [newFyId, setNewFyId] = useState("");
  const [resetSeries, setResetSeries] = useState(true);
  const [processing, setProcessing]   = useState(false);
  const [result, setResult]   = useState<any>(null);
  const [err, setErr]         = useState("");

  const { data: financialYears = [] } = useQuery<any[]>({ queryKey: ["/api/financial-years"] });
  const { data: warehouses = [] }     = useQuery<any[]>({ queryKey: ["/api/warehouses"] });
  const { data: products = [] }       = useQuery<any[]>({ queryKey: ["/api/products"] });

  const currentFY  = (financialYears as any[]).find((y: any) => y.is_current);
  const futureFYs  = (financialYears as any[])
    .filter((y: any) => !y.is_current && y.start_date > (currentFY?.end_date || ""))
    .sort((a: any, b: any) => a.start_date.localeCompare(b.start_date));
  const selectedFY = (financialYears as any[]).find((y: any) => y.id === newFyId);

  // Summary: products with stock > 0
  const stockedProducts = (products as any[]).filter((p: any) => +p.current_stock > 0);
  const totalStockValue = stockedProducts.reduce((s: number, p: any) =>
    s + (+p.current_stock || 0) * (+p.selling_price || 0), 0);

  async function runClosing() {
    if (!newFyId) { setErr("Please select the new financial year to carry forward to."); return; }
    if (!currentFY) { setErr("No current financial year found. Set one in Financial Year master first."); return; }
    setErr(""); setProcessing(true);
    try {
      const r = await fetch("/api/year-end/close", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_fy_id: currentFY.id, new_fy_id: newFyId, reset_series: resetSeries }),
      });
      const data = await r.json();
      if (!r.ok) { setErr(data.message || "Year-end closing failed."); return; }
      qc.invalidateQueries({ queryKey: ["/api/financial-years"] });
      qc.invalidateQueries({ queryKey: ["/api/store-openings"] });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      setResult(data);
      setStep(3);
    } catch (e: any) { setErr(e.message); }
    finally { setProcessing(false); }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-800">Year-End Closing</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Carry forward closing stock to the new financial year as opening stock. This is a one-time operation per year.
        </p>
      </div>

      {/* How it works */}
      <div className="bg-[#e8f6fb] border border-[#027fa5]/30 rounded-xl p-4 text-sm text-[#027fa5] space-y-1.5">
        <div className="font-semibold flex items-center gap-2"><Info size={14}/> How this works</div>
        <ul className="list-disc pl-5 space-y-0.5 text-xs text-gray-700">
          <li>The <strong>current stock</strong> of every product becomes the <strong>opening stock</strong> for the new financial year.</li>
          <li>A new <strong>Store Opening</strong> entry (Draft) is auto-created per store — you can review and post it.</li>
          <li>If selected, <strong>voucher series</strong> (GRN, SII, GRR, etc.) are reset to their starting numbers for the new year.</li>
          <li>The new financial year is marked as <strong>Current</strong> automatically.</li>
          <li>This is <strong>non-destructive</strong> — historical data is fully preserved.</li>
        </ul>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2 text-xs">
        {[["1","Review","Current Year"], ["2","Configure","Select New Year"], ["3","Done","Closing Complete"]].map(([n, title, sub], i) => (
          <div key={n} className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${+n === step ? "border-[#027fa5] bg-[#e8f6fb] text-[#027fa5] font-semibold" : +n < step ? "border-green-400 bg-green-50 text-green-700" : "border-gray-200 text-gray-400"}`}>
              {+n < step ? <CheckCircle size={12}/> : <span className="font-bold">{n}</span>}
              <span>{title}</span>
              <span className="hidden sm:inline text-[10px] opacity-70">— {sub}</span>
            </div>
            {i < 2 && <ChevronRight size={14} className="text-gray-300"/>}
          </div>
        ))}
      </div>

      {err && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2.5 rounded-lg flex items-center gap-2"><AlertTriangle size={14}/> {err}</div>}

      {/* ── STEP 1: Review ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 font-medium mb-1">Current Financial Year</div>
              {currentFY ? (
                <div>
                  <div className="text-lg font-bold" style={{ color: SC.primary }}>{currentFY.label}</div>
                  <div className="text-xs text-gray-500">
                    {currentFY.start_date?.slice(0,10)} → {currentFY.end_date?.slice(0,10)}
                  </div>
                </div>
              ) : (
                <div className="text-amber-600 text-sm font-medium">No current year set. Go to Financial Years master.</div>
              )}
            </div>
            <div>
              <div className="text-xs text-gray-500 font-medium mb-1">Closing Stock Summary</div>
              <div className="text-lg font-bold text-gray-800">{n3(stockedProducts.reduce((s: number, p: any) => s + +p.current_stock, 0))} units</div>
              <div className="text-xs text-gray-500">across {stockedProducts.length} items · Est. value ₹{n2(totalStockValue)}</div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 border-b bg-gray-50 text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Stores ({(warehouses as any[]).filter((w: any) => w.is_active !== false).length} active)
            </div>
            <table className="w-full text-xs">
              <thead><tr className="border-b bg-gray-50">
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Store</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Location</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Opening SOP will be created</th>
              </tr></thead>
              <tbody>
                {(warehouses as any[]).filter((w: any) => w.is_active !== false).map((w: any) => (
                  <tr key={w.id} className="border-b">
                    <td className="px-4 py-2 font-medium text-gray-800">{w.name}</td>
                    <td className="px-4 py-2 text-gray-500">{w.location || "—"}</td>
                    <td className="px-4 py-2 text-right text-green-700">✓ Draft SOP</td>
                  </tr>
                ))}
                {(warehouses as any[]).filter((w: any) => w.is_active !== false).length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-4 text-center text-gray-400">No active stores found</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button onClick={() => { setErr(""); setStep(2); }} disabled={!currentFY}
              className="px-6 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: SC.primary }} data-testid="btn-next-step">
              Next: Configure →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Configure ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">
                New Financial Year to carry forward to *
              </label>
              {futureFYs.length > 0 ? (
                <select value={newFyId} onChange={e => setNewFyId(e.target.value)}
                  className="w-full border-2 border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                  data-testid="select-new-fy">
                  <option value="">-- Select Financial Year --</option>
                  {futureFYs.map((fy: any) => (
                    <option key={fy.id} value={fy.id}>{fy.label} ({fy.start_date?.slice(0,10)} → {fy.end_date?.slice(0,10)})</option>
                  ))}
                </select>
              ) : (
                <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm px-4 py-3 rounded-lg">
                  No future financial year found. Please create one in <strong>Masters → Financial Years</strong> before closing the year.
                </div>
              )}
            </div>

            <div className="flex items-start gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
              <input type="checkbox" checked={resetSeries} onChange={e => setResetSeries(e.target.checked)}
                className="mt-0.5 accent-[#027fa5]" id="reset-series" data-testid="chk-reset-series"/>
              <label htmlFor="reset-series" className="text-sm cursor-pointer">
                <div className="font-medium text-gray-800">Reset voucher series for new year</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  GRN, SII, GRR, IRN, SRN, SOP numbers restart from their configured starting number. Recommended.
                </div>
              </label>
            </div>

            {selectedFY && (
              <div className="bg-green-50 border border-green-200 text-green-800 text-sm px-4 py-3 rounded-lg">
                <div className="font-semibold mb-1">Ready to close: {currentFY?.label} → {selectedFY.label}</div>
                <ul className="text-xs space-y-0.5 list-disc pl-4">
                  <li>Current stock of all {stockedProducts.length} products will become opening stock for {selectedFY.label}</li>
                  <li>Draft Store Opening entries created for {(warehouses as any[]).filter((w: any) => w.is_active !== false).length} store(s)</li>
                  {resetSeries && <li>Voucher series reset to starting numbers</li>}
                  <li>{selectedFY.label} will be set as the active financial year</li>
                </ul>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <button onClick={() => setStep(1)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">← Back</button>
            <button onClick={runClosing} disabled={processing || !newFyId || futureFYs.length === 0}
              className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: SC.orange }} data-testid="btn-run-closing">
              {processing ? <><RefreshCw size={14} className="animate-spin"/> Processing…</> : "Run Year-End Closing"}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Done ── */}
      {step === 3 && result && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-300 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-green-800 font-bold text-base">
              <CheckCircle size={20}/> Year-End Closing Complete
            </div>
            <div className="text-sm text-green-700 space-y-1">
              <div>✓ Financial year changed: <strong>{result.from_fy}</strong> → <strong>{result.to_fy}</strong></div>
              <div>✓ <strong>{result.sops_created}</strong> Store Opening entries created (Draft) — review and post them in Store Opening</div>
              {result.series_reset && <div>✓ Voucher series reset for new year</div>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/inventory/store-opening"
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: SC.primary }}>
              Review Store Openings →
            </a>
            <button onClick={() => { setStep(1); setResult(null); setNewFyId(""); setErr(""); }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
