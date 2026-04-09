import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit, X, Loader2 } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700" };
const TYPES = ["asset", "liability", "income", "expense", "equity"] as const;
const TYPE_COLORS: Record<string, string> = { asset: "bg-blue-100 text-blue-700", liability: "bg-red-100 text-red-700", income: "bg-green-100 text-green-700", expense: "bg-orange-100 text-orange-700", equity: "bg-purple-100 text-purple-700" };

export default function Accounts() {
  const [tab, setTab] = useState<"accounts" | "journal">("accounts");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ code: "", name: "", type: "asset" as any, description: "" });
  const [jeForm, setJeForm] = useState({ entryNumber: "", date: new Date().toISOString().split("T")[0], description: "", reference: "" });
  const [jeLines, setJeLines] = useState([{ accountName: "", description: "", debit: 0, credit: 0 }, { accountName: "", description: "", debit: 0, credit: 0 }]);
  const [showJeForm, setShowJeForm] = useState(false);
  const qc = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/accounts"] });
  const { data: journal = [], isLoading: jeLoading } = useQuery<any[]>({ queryKey: ["/api/journal"] });

  const saveAcc = useMutation({
    mutationFn: async (data: any) => {
      const url = editing?.id ? `/api/accounts/${editing.id}` : "/api/accounts";
      const res = await fetch(url, { method: editing?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/accounts"] }); setShowForm(false); setEditing(null); setForm({ code: "", name: "", type: "asset", description: "" }); }
  });

  const delAcc = useMutation({
    mutationFn: (id: string) => fetch(`/api/accounts/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/accounts"] })
  });

  const saveJe = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/journal"] }); setShowJeForm(false); setJeForm({ entryNumber: "", date: new Date().toISOString().split("T")[0], description: "", reference: "" }); setJeLines([{ accountName: "", description: "", debit: 0, credit: 0 }, { accountName: "", description: "", debit: 0, credit: 0 }]); }
  });

  const grouped = TYPES.reduce((acc, type) => {
    acc[type] = accounts.filter(a => a.type === type);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-800">Accounts & Finance</h1><p className="text-sm text-gray-500 mt-0.5">Chart of accounts and journal entries</p></div>
        <button onClick={() => tab === "accounts" ? setShowForm(true) : setShowJeForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }} data-testid="button-new">
          <Plus size={16} /> {tab === "accounts" ? "New Account" : "New Journal Entry"}
        </button>
      </div>

      <div className="flex gap-1 bg-white rounded-lg p-1 w-fit" style={{ boxShadow: "1px 1px 2px rgba(0,0,0,0.1)" }}>
        {(["accounts", "journal"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} data-testid={`tab-${t}`}
            className={`px-4 py-2 rounded text-sm font-medium capitalize transition-colors ${tab === t ? "text-white" : "text-gray-600 hover:bg-gray-100"}`}
            style={tab === t ? { background: SC.primary } : {}}>{t === "journal" ? "Journal Entries" : "Chart of Accounts"}</button>
        ))}
      </div>

      {tab === "accounts" ? (
        <div className="space-y-4">
          {TYPES.map(type => (
            <div key={type} className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
              <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${TYPE_COLORS[type]}`}>{type}</span>
                  <span className="text-sm text-gray-500">{grouped[type]?.length || 0} accounts</span>
                </div>
                <div className="text-sm font-semibold text-gray-700">
                  Total: ₹{(grouped[type] || []).reduce((s, a) => s + Number(a.balance || 0), 0).toLocaleString("en-IN")}
                </div>
              </div>
              {grouped[type]?.length ? (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-50">
                    {grouped[type].map(acc => (
                      <tr key={acc.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-mono text-xs font-semibold" style={{ color: SC.primary }}>{acc.code}</td>
                        <td className="px-5 py-3 font-medium text-gray-700">{acc.name}</td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{acc.description}</td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-800">₹{Number(acc.balance || 0).toLocaleString("en-IN")}</td>
                        <td className="px-5 py-3">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => { setEditing(acc); setForm({ code: acc.code, name: acc.name, type: acc.type, description: acc.description || "" }); setShowForm(true); }} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" data-testid={`button-edit-${acc.id}`}><Edit size={14} /></button>
                            <button onClick={() => { if (confirm("Delete account?")) delAcc.mutate(acc.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`button-delete-${acc.id}`}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <div className="px-5 py-4 text-sm text-gray-400 italic">No {type} accounts</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr style={{ background: "#d2f1fa" }}>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Entry No.</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Date</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Description</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Reference</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600">Debit</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600">Credit</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {jeLoading ? [...Array(3)].map((_, i) => <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>) :
                  journal.length ? journal.map((je: any) => (
                    <tr key={je.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium" style={{ color: SC.primary }}>{je.entryNumber}</td>
                      <td className="px-5 py-3 text-gray-500">{je.date}</td>
                      <td className="px-5 py-3 text-gray-700">{je.description}</td>
                      <td className="px-5 py-3 text-gray-400">{je.reference || "—"}</td>
                      <td className="px-5 py-3 text-right text-gray-800">₹{Number(je.totalDebit || 0).toLocaleString("en-IN")}</td>
                      <td className="px-5 py-3 text-right text-gray-800">₹{Number(je.totalCredit || 0).toLocaleString("en-IN")}</td>
                    </tr>
                  )) : <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">No journal entries</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Account Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md" style={{ boxShadow: "2px 2px 4px 2px rgba(0,0,0,0.3)" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#b8d2da" }}>
              <h2 className="text-lg font-bold" style={{ color: SC.primary }}>{editing?.id ? "Edit" : "New"} Account</h2>
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="p-2 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {[["Account Code *", "code"], ["Account Name *", "name"]].map(([label, key]) => (
                <div key={key}>
                  <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>{label}</label>
                  <input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid={`input-${key}`} />
                </div>
              ))}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Account Type *</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                  className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="select-type">
                  {TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Description</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="input-description" />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => { setShowForm(false); setEditing(null); }} className="px-5 py-2 rounded border text-sm" style={{ borderColor: "#00000030" }}>Cancel</button>
              <button onClick={() => saveAcc.mutate(form)} disabled={saveAcc.isPending}
                className="px-5 py-2 rounded text-white text-sm font-medium flex items-center gap-2" style={{ background: SC.orange }} data-testid="button-save-account">
                {saveAcc.isPending && <Loader2 size={14} className="animate-spin" />} Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Journal Entry Form */}
      {showJeForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl my-4" style={{ boxShadow: "2px 2px 4px 2px rgba(0,0,0,0.3)" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#b8d2da" }}>
              <h2 className="text-lg font-bold" style={{ color: SC.primary }}>New Journal Entry</h2>
              <button onClick={() => setShowJeForm(false)} className="p-2 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {[["Entry Number *", "entryNumber"], ["Date *", "date", "date"], ["Description *", "description"], ["Reference", "reference"]].map(([label, key, type = "text"]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>{label}</label>
                    <input type={type} value={(jeForm as any)[key]} onChange={e => setJeForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid={`input-je-${key}`} />
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center justify-between mb-2"><h3 className="font-semibold text-gray-700">Journal Lines</h3>
                  <button onClick={() => setJeLines(l => [...l, { accountName: "", description: "", debit: 0, credit: 0 }])}
                    className="flex items-center gap-1 text-sm px-3 py-1.5 rounded text-white" style={{ background: SC.primary }}>
                    <Plus size={14} /> Add Line
                  </button>
                </div>
                <table className="w-full text-sm">
                  <thead><tr style={{ background: "#d2f1fa" }}>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Account</th>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Description</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600 w-28">Debit</th>
                    <th className="text-right px-3 py-2 font-semibold text-gray-600 w-28">Credit</th>
                    <th className="w-8"></th>
                  </tr></thead>
                  <tbody>
                    {jeLines.map((line, idx) => (
                      <tr key={idx} className="border-b border-gray-100">
                        <td className="px-1 py-1"><input value={line.accountName} onChange={e => setJeLines(l => l.map((li, i) => i === idx ? { ...li, accountName: e.target.value } : li))}
                          className="w-full border rounded px-2 py-1 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} /></td>
                        <td className="px-1 py-1"><input value={line.description} onChange={e => setJeLines(l => l.map((li, i) => i === idx ? { ...li, description: e.target.value } : li))}
                          className="w-full border rounded px-2 py-1 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} /></td>
                        <td className="px-1 py-1"><input type="number" value={line.debit} onChange={e => setJeLines(l => l.map((li, i) => i === idx ? { ...li, debit: Number(e.target.value) } : li))}
                          className="w-full border rounded px-2 py-1 text-sm focus:outline-none text-right" style={{ borderColor: "#00000030" }} /></td>
                        <td className="px-1 py-1"><input type="number" value={line.credit} onChange={e => setJeLines(l => l.map((li, i) => i === idx ? { ...li, credit: Number(e.target.value) } : li))}
                          className="w-full border rounded px-2 py-1 text-sm focus:outline-none text-right" style={{ borderColor: "#00000030" }} /></td>
                        <td className="px-1 py-1"><button onClick={() => setJeLines(l => l.filter((_, i) => i !== idx))} className="p-1 text-red-400 hover:text-red-600"><X size={12} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr className="border-t-2" style={{ borderColor: "#b8d2da" }}>
                    <td colSpan={2} className="px-3 py-2 text-sm font-semibold text-right text-gray-600">Total:</td>
                    <td className="px-3 py-2 text-right font-bold text-gray-800">₹{jeLines.reduce((s, l) => s + Number(l.debit), 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-bold text-gray-800">₹{jeLines.reduce((s, l) => s + Number(l.credit), 0).toFixed(2)}</td>
                    <td></td>
                  </tr></tfoot>
                </table>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => setShowJeForm(false)} className="px-5 py-2 rounded border text-sm" style={{ borderColor: "#00000030" }}>Cancel</button>
              <button onClick={() => saveJe.mutate({ ...jeForm, lines: jeLines, totalDebit: jeLines.reduce((s, l) => s + Number(l.debit), 0), totalCredit: jeLines.reduce((s, l) => s + Number(l.credit), 0) })}
                disabled={saveJe.isPending} className="px-5 py-2 rounded text-white text-sm font-medium flex items-center gap-2" style={{ background: SC.orange }} data-testid="button-save-je">
                {saveJe.isPending && <Loader2 size={14} className="animate-spin" />} Post Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
