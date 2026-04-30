import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, CheckCircle, XCircle, Loader2, Settings, Clock, Database, ArrowRight } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700" };

const SYNC_TYPES = [
  { key: "purchases", label: "Purchase Vouchers", desc: "Sync all purchase invoices to Tally" },
  { key: "sales", label: "Sales Vouchers", desc: "Sync all sales invoices to Tally" },
  { key: "inventory", label: "Stock Items", desc: "Sync inventory items and categories" },
  { key: "accounts", label: "Ledger Accounts", desc: "Sync chart of accounts" },
  { key: "full", label: "Full Sync", desc: "Sync everything to Tally" },
];

export default function TallyIntegration() {
  const [syncing, setSyncing] = useState<string | null>(null);
  const [tallyConfig, setTallyConfig] = useState({ host: "localhost", port: "9000", company: "Pioneer Prism" });
  const qc = useQueryClient();

  const { data: logs = [] } = useQuery<any[]>({ queryKey: ["/api/tally/logs"] });

  const syncMut = useMutation({
    mutationFn: (syncType: string) => fetch("/api/tally/sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ syncType }), credentials: "include" }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/tally/logs"] }); setSyncing(null); },
    onError: () => setSyncing(null)
  });

  async function handleSync(type: string) {
    setSyncing(type); syncMut.mutate(type);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Tally Integration</h1>
        <p className="text-sm text-gray-500 mt-0.5">Sync your ERP data with Tally accounting software</p>
      </div>

      {/* Connection Config */}
      <div className="bg-white rounded-xl p-5" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
        <div className="flex items-center gap-2 mb-4">
          <Settings size={18} style={{ color: SC.primary }} />
          <h2 className="font-semibold text-gray-700">Tally Connection Settings</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[["Tally Host", "host", "e.g. localhost"], ["Port", "port", "e.g. 9000"], ["Company Name", "company", "Company in Tally"]].map(([label, key, placeholder]) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>{label}</label>
              <input value={(tallyConfig as any)[key]} onChange={e => setTallyConfig(c => ({ ...c, [key]: e.target.value }))}
                placeholder={placeholder}
                className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid={`input-tally-${key}`} />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
          <span className="text-sm text-gray-600">Tally ERP 9 / TallyPrime compatible</span>
          <span className="text-xs text-gray-400">· Ensure Tally is running with Remote Access enabled</span>
        </div>
      </div>

      {/* Sync Options */}
      <div>
        <h2 className="font-semibold text-gray-700 mb-3">Sync Operations</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SYNC_TYPES.map(({ key, label, desc }) => (
            <div key={key} className="bg-white rounded-xl p-5" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#d2f1fa" }}>
                  <Database size={18} style={{ color: SC.primary }} />
                </div>
                {key === "full" && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">Recommended</span>}
              </div>
              <div className="font-semibold text-gray-700 mb-1">{label}</div>
              <div className="text-xs text-gray-500 mb-4">{desc}</div>
              <button
                onClick={() => handleSync(key)}
                disabled={syncing !== null}
                className="w-full flex items-center justify-center gap-2 py-2 rounded text-white text-sm font-medium transition-opacity disabled:opacity-60"
                style={{ background: key === "full" ? SC.orange : SC.primary }}
                data-testid={`button-sync-${key}`}>
                {syncing === key ? <><Loader2 size={14} className="animate-spin" /> Syncing...</> : <><RefreshCw size={14} /> Sync Now <ArrowRight size={12} /></>}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Sync History */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Clock size={16} style={{ color: SC.primary }} />
          <h2 className="font-semibold text-gray-700">Sync History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ background: "#d2f1fa" }}>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Sync Type</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Records</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Time</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Error</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {logs.length ? logs.map((log: any) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-700 capitalize">{log.syncType.replace("_", " ")}</td>
                  <td className="px-5 py-3">
                    <span className={`flex items-center gap-1 text-xs font-medium w-fit px-2 py-0.5 rounded-full ${log.status === "success" ? "bg-green-100 text-green-700" : log.status === "partial" ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                      {log.status === "success" ? <CheckCircle size={11} /> : <XCircle size={11} />}
                      {log.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-600">{log.recordsSynced}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{new Date(log.syncedAt).toLocaleString("en-IN")}</td>
                  <td className="px-5 py-3 text-red-500 text-xs">{log.errorMessage || "—"}</td>
                </tr>
              )) : <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">No sync history yet. Click Sync Now to start.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
