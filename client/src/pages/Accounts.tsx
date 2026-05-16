import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit, X, Loader2, ChevronDown, Search } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700" };
const TYPES = ["asset", "liability", "income", "expense", "equity"] as const;
const TYPE_COLORS: Record<string, string> = {
  asset: "bg-blue-100 text-blue-700", liability: "bg-red-100 text-red-700",
  income: "bg-green-100 text-green-700", expense: "bg-orange-100 text-orange-700",
  equity: "bg-purple-100 text-purple-700",
};
const GL_TYPE_LABELS: Record<string, string> = {
  bank: "Bank Accounts", cash: "Cash Accounts",
  sundry_debtor: "Sundry Debtors", sundry_creditor: "Sundry Creditors",
  purchase: "Purchase Accounts", expense: "Expense Accounts",
  tax: "Tax Accounts", roundoff: "Round Off",
  liability: "Liability Accounts", income: "Income Accounts",
  other: "Other Accounts",
};

type JeLine = { generalLedgerId: string; accountName: string; description: string; debit: number; credit: number };

function blankLine(): JeLine { return { generalLedgerId: "", accountName: "", description: "", debit: 0, credit: 0 }; }

// ── GL Account picker (searchable dropdown) ───────────────────────────────────
function GlPicker({ value, onChange, glAccounts }: {
  value: string; onChange: (id: string, name: string) => void; glAccounts: any[];
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const selected = glAccounts.find((g: any) => g.id === value);

  // Group by gl_type
  const groups: Record<string, any[]> = {};
  for (const g of glAccounts) {
    const label = GL_TYPE_LABELS[g.gl_type] || "Other";
    if (!groups[label]) groups[label] = [];
    groups[label].push(g);
  }

  const filteredGroups: Record<string, any[]> = {};
  if (q.trim()) {
    const lq = q.toLowerCase();
    for (const [label, items] of Object.entries(groups)) {
      const matched = items.filter((g: any) => g.name.toLowerCase().includes(lq) || (g.code || "").toLowerCase().includes(lq));
      if (matched.length > 0) filteredGroups[label] = matched;
    }
  } else {
    Object.assign(filteredGroups, groups);
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full border rounded px-2 py-1.5 text-sm text-left flex items-center justify-between hover:border-[#027fa5] transition-colors"
        style={{ borderColor: "#00000030" }}>
        <span className={selected ? "text-gray-800 truncate" : "text-gray-400"}>
          {selected ? selected.name : "Select GL Account…"}
        </span>
        <ChevronDown size={12} className="text-gray-400 shrink-0 ml-1" />
      </button>
      {open && (
        <div className="absolute z-50 top-full left-0 w-72 bg-white border border-gray-200 rounded-lg shadow-xl mt-0.5 flex flex-col max-h-64">
          <div className="p-2 border-b">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-2 text-gray-400" />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)}
                placeholder="Search GL account…"
                className="w-full border border-gray-200 rounded pl-6 pr-2 py-1.5 text-xs focus:outline-none focus:border-[#027fa5]" />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 text-xs">
            {Object.entries(filteredGroups).map(([label, items]) => (
              <div key={label}>
                <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide bg-gray-50 sticky top-0">
                  {label}
                </div>
                {items.map((g: any) => (
                  <button key={g.id} type="button"
                    onClick={() => { onChange(g.id, g.name); setOpen(false); setQ(""); }}
                    className={`w-full text-left px-3 py-1.5 hover:bg-[#d2f1fa] flex items-center justify-between gap-2 transition-colors ${g.id === value ? "bg-[#e8f6fb]" : ""}`}>
                    <span className="text-gray-800 font-medium">{g.name}</span>
                    {g.code && <span className="text-gray-400 text-[10px] shrink-0">{g.code}</span>}
                  </button>
                ))}
              </div>
            ))}
            {Object.keys(filteredGroups).length === 0 && (
              <p className="px-3 py-4 text-gray-400 text-center">No accounts found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Accounts() {
  const [tab, setTab] = useState<"accounts" | "journal">("accounts");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ code: "", name: "", type: "asset" as any, description: "" });
  const [jeForm, setJeForm] = useState({
    entryNumber: "", date: new Date().toISOString().split("T")[0],
    description: "", reference: "",
  });
  const [jeLines, setJeLines] = useState<JeLine[]>([blankLine(), blankLine()]);
  const [jeErr, setJeErr] = useState("");
  const [showJeForm, setShowJeForm] = useState(false);
  const qc = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/accounts"] });
  const { data: journal = [], isLoading: jeLoading } = useQuery<any[]>({ queryKey: ["/api/journal"] });
  const { data: glAccounts = [] } = useQuery<any[]>({ queryKey: ["/api/general-ledgers"] });

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/journal"] });
      setShowJeForm(false);
      setJeErr("");
      setJeForm({ entryNumber: "", date: new Date().toISOString().split("T")[0], description: "", reference: "" });
      setJeLines([blankLine(), blankLine()]);
    },
    onError: (e: any) => setJeErr(e.message || "Failed to save"),
  });

  const grouped = TYPES.reduce((acc, type) => {
    acc[type] = accounts.filter((a: any) => a.type === type);
    return acc;
  }, {} as Record<string, any[]>);

  const totalDr = jeLines.reduce((s, l) => s + Number(l.debit), 0);
  const totalCr = jeLines.reduce((s, l) => s + Number(l.credit), 0);
  const isBalanced = Math.abs(totalDr - totalCr) < 0.01;

  function handlePostJe() {
    setJeErr("");
    const activeLines = jeLines.filter(l => l.generalLedgerId && (l.debit > 0 || l.credit > 0));
    if (activeLines.length < 2) { setJeErr("Add at least 2 lines with GL accounts and amounts."); return; }
    if (!isBalanced) { setJeErr(`Not balanced — Debit ₹${totalDr.toFixed(2)} ≠ Credit ₹${totalCr.toFixed(2)}`); return; }
    if (!jeForm.entryNumber.trim()) { setJeErr("Entry number is required."); return; }
    saveJe.mutate({
      ...jeForm,
      lines: activeLines.map(l => ({
        generalLedgerId: l.generalLedgerId,
        accountName: l.accountName,
        description: l.description,
        debit: Number(l.debit),
        credit: Number(l.credit),
      })),
      totalDebit: totalDr,
      totalCredit: totalCr,
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Accounts & Finance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Chart of accounts and journal entries</p>
        </div>
        <button onClick={() => tab === "accounts" ? setShowForm(true) : setShowJeForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }}
          data-testid="button-new">
          <Plus size={16} /> {tab === "accounts" ? "New Account" : "New Journal Entry"}
        </button>
      </div>

      <div className="flex gap-1 bg-white rounded-lg p-1 w-fit" style={{ boxShadow: "1px 1px 2px rgba(0,0,0,0.1)" }}>
        {(["accounts", "journal"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} data-testid={`tab-${t}`}
            className={`px-4 py-2 rounded text-sm font-medium capitalize transition-colors ${tab === t ? "text-white" : "text-gray-600 hover:bg-gray-100"}`}
            style={tab === t ? { background: SC.primary } : {}}>
            {t === "journal" ? "Journal Entries" : "Chart of Accounts"}
          </button>
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
                    {grouped[type].map((acc: any) => (
                      <tr key={acc.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-mono text-xs font-semibold" style={{ color: SC.primary }}>{acc.code}</td>
                        <td className="px-5 py-3 font-medium text-gray-700">{acc.name}</td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{acc.description}</td>
                        <td className="px-5 py-3 text-right font-semibold text-gray-800">₹{Number(acc.balance || 0).toLocaleString("en-IN")}</td>
                        <td className="px-5 py-3">
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => { setEditing(acc); setForm({ code: acc.code, name: acc.name, type: acc.type, description: acc.description || "" }); setShowForm(true); }}
                              className="p-1.5 rounded hover:bg-blue-50 text-blue-500" data-testid={`button-edit-${acc.id}`}><Edit size={14} /></button>
                            <button onClick={() => { if (confirm("Delete account?")) delAcc.mutate(acc.id); }}
                              className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`button-delete-${acc.id}`}><Trash2 size={14} /></button>
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
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Voucher No</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Entry No.</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Date</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Description</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Reference</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600">Debit ₹</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600">Credit ₹</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-50">
                {jeLoading ? [...Array(3)].map((_, i) => (
                  <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
                )) : journal.length ? journal.map((je: any) => (
                  <tr key={je.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-mono text-xs font-semibold" style={{ color: SC.primary }}>{je.voucherNo || "—"}</td>
                    <td className="px-5 py-3 font-medium text-gray-600">{je.entry_number || je.entryNumber}</td>
                    <td className="px-5 py-3 text-gray-500">{je.date}</td>
                    <td className="px-5 py-3 text-gray-700">{je.description}</td>
                    <td className="px-5 py-3 text-gray-400">{je.reference || "—"}</td>
                    <td className="px-5 py-3 text-right text-gray-800">₹{Number(je.total_debit || je.totalDebit || 0).toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3 text-right text-gray-800">₹{Number(je.total_credit || je.totalCredit || 0).toLocaleString("en-IN")}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">No journal entries</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Account Form ── */}
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

      {/* ── Journal Entry Form ── */}
      {showJeForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-auto">
          <div className="bg-white rounded-xl w-full max-w-3xl my-4" style={{ boxShadow: "2px 2px 4px 2px rgba(0,0,0,0.3)" }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#b8d2da" }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: SC.primary }}>New Journal Entry</h2>
                <p className="text-xs text-gray-500 mt-0.5">Select GL accounts — this will post to the ledger automatically</p>
              </div>
              <button onClick={() => { setShowJeForm(false); setJeErr(""); }} className="p-2 rounded hover:bg-gray-100"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-4">
              {/* Header fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-600">Entry Number *</label>
                  <input value={jeForm.entryNumber} onChange={e => setJeForm(f => ({ ...f, entryNumber: e.target.value }))}
                    className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }}
                    placeholder="JV-001" data-testid="input-je-entryNumber" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-600">Date *</label>
                  <input type="date" value={jeForm.date} onChange={e => setJeForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }}
                    data-testid="input-je-date" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-600">Description *</label>
                  <input value={jeForm.description} onChange={e => setJeForm(f => ({ ...f, description: e.target.value }))}
                    className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }}
                    placeholder="Journal narration…" data-testid="input-je-description" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-600">Reference</label>
                  <input value={jeForm.reference} onChange={e => setJeForm(f => ({ ...f, reference: e.target.value }))}
                    className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }}
                    placeholder="Ref no / Cheque no…" data-testid="input-je-reference" />
                </div>
              </div>

              {/* Journal lines */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-gray-700 text-sm">Journal Lines</h3>
                  <button onClick={() => setJeLines(l => [...l, blankLine()])}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 rounded text-white" style={{ background: SC.primary }}>
                    <Plus size={12} /> Add Line
                  </button>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ background: "#d2f1fa" }}>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600 w-56">GL Account *</th>
                        <th className="text-left px-3 py-2 font-semibold text-gray-600">Narration</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600 w-28">Debit ₹</th>
                        <th className="text-right px-3 py-2 font-semibold text-gray-600 w-28">Credit ₹</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {jeLines.map((line, idx) => (
                        <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-2 py-1.5">
                            <GlPicker
                              value={line.generalLedgerId}
                              glAccounts={glAccounts}
                              onChange={(id, name) => setJeLines(l => l.map((li, i) => i === idx ? { ...li, generalLedgerId: id, accountName: name } : li))}
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input value={line.description}
                              onChange={e => setJeLines(l => l.map((li, i) => i === idx ? { ...li, description: e.target.value } : li))}
                              className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-[#027fa5]"
                              placeholder="Line narration…" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" step="0.01" value={line.debit || ""}
                              onChange={e => setJeLines(l => l.map((li, i) => i === idx ? { ...li, debit: Number(e.target.value), credit: 0 } : li))}
                              className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs text-right focus:outline-none focus:border-[#027fa5]"
                              placeholder="0.00" />
                          </td>
                          <td className="px-2 py-1.5">
                            <input type="number" min="0" step="0.01" value={line.credit || ""}
                              onChange={e => setJeLines(l => l.map((li, i) => i === idx ? { ...li, credit: Number(e.target.value), debit: 0 } : li))}
                              className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs text-right focus:outline-none focus:border-[#027fa5]"
                              placeholder="0.00" />
                          </td>
                          <td className="px-1 py-1.5 text-center">
                            {jeLines.length > 2 && (
                              <button onClick={() => setJeLines(l => l.filter((_, i) => i !== idx))}
                                className="p-1 text-red-400 hover:text-red-600"><X size={12} /></button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2" style={{ borderColor: "#b8d2da" }}>
                        <td colSpan={2} className="px-3 py-2 text-xs font-semibold text-right text-gray-600">Total:</td>
                        <td className="px-3 py-2 text-right font-bold text-gray-800">
                          ₹{totalDr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-gray-800">
                          ₹{totalCr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                {/* Balance indicator */}
                <div className={`mt-2 text-xs px-3 py-1.5 rounded font-semibold ${isBalanced && totalDr > 0 ? "bg-green-50 text-green-700" : !isBalanced && totalDr > 0 ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-400"}`}>
                  {totalDr === 0 && totalCr === 0
                    ? "Enter amounts to begin"
                    : isBalanced
                    ? "✓ Balanced — Debit = Credit"
                    : `⚠ Not balanced — Difference: ₹${Math.abs(totalDr - totalCr).toFixed(2)}`}
                </div>
              </div>

              {jeErr && (
                <div className="bg-red-50 border border-red-200 rounded px-4 py-2 text-sm text-red-600">{jeErr}</div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
              <button onClick={() => { setShowJeForm(false); setJeErr(""); }} className="px-5 py-2 rounded border text-sm" style={{ borderColor: "#00000030" }}>Cancel</button>
              <button onClick={handlePostJe} disabled={saveJe.isPending || !isBalanced || totalDr === 0}
                className="px-6 py-2 rounded text-white text-sm font-medium flex items-center gap-2 disabled:opacity-40"
                style={{ background: SC.orange }} data-testid="button-save-je">
                {saveJe.isPending && <Loader2 size={14} className="animate-spin" />}
                Post Journal Entry
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
