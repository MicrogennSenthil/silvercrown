import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot, Building2, Hash, Plug, CheckCircle2, Eye, EyeOff,
  Save, RefreshCw, AlertCircle, ExternalLink
} from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

type Setting = {
  key: string;
  value: string;
  label: string;
  category: string;
  input_type: string;
  description: string;
};

const CATEGORY_ICONS: Record<string, any> = {
  "AI Configuration": Bot,
  "Company": Building2,
  "Voucher Numbering": Hash,
  "Tally Integration": Plug,
};

const AI_PROVIDER_OPTIONS = [
  { value: "gemini", label: "Google Gemini" },
  { value: "groq", label: "Groq" },
];

const AI_MODEL_OPTIONS: Record<string, { value: string; label: string }[]> = {
  gemini: [
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash (Fast, Free)" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro (Accurate)" },
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (Latest)" },
  ],
  groq: [
    { value: "llama-3.2-11b-vision-preview", label: "Llama 3.2 11B Vision" },
    { value: "llama-3.2-90b-vision-preview", label: "Llama 3.2 90B Vision" },
  ],
};

function SettingInput({
  setting, value, onChange,
  allValues,
}: {
  setting: Setting;
  value: string;
  onChange: (v: string) => void;
  allValues: Record<string, string>;
}) {
  const [showPw, setShowPw] = useState(false);

  if (setting.input_type === "boolean") {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(value === "true" ? "false" : "true")}
          className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
          style={{ background: value === "true" ? SC.primary : "#d1d5db" }}
          data-testid={`toggle-${setting.key}`}
        >
          <span
            className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
            style={{ transform: value === "true" ? "translateX(22px)" : "translateX(2px)" }}
          />
        </button>
        <span className="text-sm text-gray-700">{value === "true" ? "Enabled" : "Disabled"}</span>
      </div>
    );
  }

  if (setting.input_type === "select") {
    // AI Provider select
    if (setting.key === "ai_provider") {
      return (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-[#027fa5]"
          data-testid={`select-${setting.key}`}
        >
          {AI_PROVIDER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      );
    }
    return (
      <input value={value} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
        data-testid={`input-${setting.key}`} />
    );
  }

  if (setting.input_type === "password") {
    return (
      <div className="relative">
        <input
          type={showPw ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Enter API key..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#027fa5] pr-10"
          data-testid={`input-${setting.key}`}
        />
        <button
          type="button"
          onClick={() => setShowPw(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );
  }

  // ai_model — dynamic dropdown based on selected provider
  if (setting.key === "ai_model") {
    const provider = allValues["ai_provider"] || "gemini";
    const models = AI_MODEL_OPTIONS[provider] || [];
    return (
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white outline-none focus:border-[#027fa5]"
        data-testid="select-ai_model"
      >
        {models.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        {!models.find(m => m.value === value) && value && (
          <option value={value}>{value}</option>
        )}
      </select>
    );
  }

  return (
    <input
      type={setting.input_type === "date" ? "date" : "text"}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
      data-testid={`input-${setting.key}`}
    />
  );
}

// ── Inline Voucher Series for Software Setup ─────────────────────────────────
function VoucherSeriesInline() {
  const qc = useQueryClient();
  const { data: series = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/voucher-series"] });
  const { data: fys = [] } = useQuery<any[]>({ queryKey: ["/api/financial-years"] });
  const [editing, setEditing] = useState<Record<string, any>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const currentFy = (fys as any[]).find((f: any) => f.is_current);
  const filtered = (series as any[]).filter((s: any) => !currentFy || s.financial_year_id === currentFy.id || !s.financial_year_id);

  const patchMut = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/voucher-series/${id}`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      return res.json();
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["/api/voucher-series"] });
      setEditing(prev => { const n = { ...prev }; delete n[id]; return n; });
      setSaved(prev => ({ ...prev, [id]: true }));
      setTimeout(() => setSaved(prev => { const n = { ...prev }; delete n[id]; return n; }), 2000);
    },
  });

  function getVal(row: any, field: string) {
    return editing[row.id]?.[field] !== undefined ? editing[row.id][field] : row[field];
  }
  function setVal(row: any, field: string, val: any) {
    setEditing(prev => ({ ...prev, [row.id]: { ...prev[row.id], [field]: val } }));
  }
  function save(row: any) {
    const updates = editing[row.id] || {};
    patchMut.mutate({ id: row.id, data: { ...row, ...updates, financial_year_id: row.financial_year_id } });
  }

  if (isLoading) return <div className="py-6 text-center text-gray-400 text-sm"><RefreshCw size={16} className="inline animate-spin mr-2" />Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-50">
        <span className="text-xs text-gray-500">
          {currentFy ? <>Showing series for <b>{currentFy.label}</b></> : "No current financial year set"}
        </span>
        <Link href="/masters/voucher-series">
          <span className="flex items-center gap-1 text-xs font-semibold cursor-pointer" style={{ color: SC.primary }}>
            <ExternalLink size={12} /> Manage Full Series
          </span>
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: SC.tonal }}>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Transaction</th>
              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Prefix</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">Digits</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">Start No</th>
              <th className="px-4 py-2 text-center text-xs font-semibold text-gray-700">Next Voucher</th>
              <th className="px-4 py-2 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row: any, i: number) => {
              const prefix = getVal(row, "prefix") || "";
              const digits = getVal(row, "digits") || 5;
              const startNo = getVal(row, "starting_number") || 1;
              const nextVoucher = `${prefix}${String(row.current_number || startNo).padStart(digits, "0")}`;
              const isDirty = !!editing[row.id];
              return (
                <tr key={row.id} className={`border-t border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}>
                  <td className="px-4 py-2 text-xs font-medium text-gray-700">{row.transaction_label}</td>
                  <td className="px-4 py-2">
                    <input value={prefix} onChange={e => setVal(row, "prefix", e.target.value.toUpperCase())}
                      className="w-20 border border-gray-200 rounded px-2 py-1 text-xs font-mono outline-none focus:border-[#027fa5]"
                      data-testid={`input-prefix-${row.id}`} />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input type="number" min={1} max={10} value={digits}
                      onChange={e => setVal(row, "digits", parseInt(e.target.value) || 5)}
                      className="w-14 border border-gray-200 rounded px-2 py-1 text-xs text-center outline-none focus:border-[#027fa5]"
                      data-testid={`input-digits-${row.id}`} />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <input type="number" min={1} value={startNo}
                      onChange={e => setVal(row, "starting_number", parseInt(e.target.value) || 1)}
                      className="w-16 border border-gray-200 rounded px-2 py-1 text-xs text-center outline-none focus:border-[#027fa5]"
                      data-testid={`input-start-${row.id}`} />
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: SC.tonal, color: SC.primary }}>{nextVoucher}</span>
                  </td>
                  <td className="px-4 py-2 text-center">
                    {saved[row.id] ? (
                      <CheckCircle2 size={14} className="text-green-500 mx-auto" />
                    ) : (
                      <button onClick={() => save(row)} disabled={!isDirty || patchMut.isPending}
                        className="text-xs font-semibold px-3 py-1 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        style={{ background: isDirty ? SC.orange : "#e5e7eb", color: isDirty ? "white" : "#9ca3af" }}
                        data-testid={`btn-save-series-${row.id}`}>Save</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SoftwareSetup() {
  const qc = useQueryClient();
  const { data: rawSettings = [], isLoading } = useQuery<Setting[]>({
    queryKey: ["/api/settings"],
  });

  // Local editable state — keyed by setting key
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("AI Configuration");

  useEffect(() => {
    if (!rawSettings.length) return;
    setValues(prev => {
      if (Object.keys(prev).length === rawSettings.length) return prev;
      const map: Record<string, string> = {};
      rawSettings.forEach(s => { map[s.key] = s.value || ""; });
      return map;
    });
  }, [rawSettings.length]);

  // Group by category
  const categories = Array.from(new Set(rawSettings.map(s => s.category)));
  const byCategory: Record<string, Setting[]> = {};
  rawSettings.forEach(s => {
    if (!byCategory[s.category]) byCategory[s.category] = [];
    byCategory[s.category].push(s);
  });

  const saveMut = useMutation({
    mutationFn: async (category: string) => {
      const items = (byCategory[category] || []).map(s => ({
        key: s.key,
        value: values[s.key] ?? "",
      }));
      const res = await fetch("/api/settings/bulk", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(items),
      });
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: (_, category) => {
      qc.invalidateQueries({ queryKey: ["/api/settings"] });
      setSaved(category);
      setTimeout(() => setSaved(null), 2500);
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" style={{ fontFamily: "Source Sans Pro, sans-serif" }}>
        <RefreshCw size={20} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto" style={{ fontFamily: "Source Sans Pro, sans-serif" }}>
      {/* Page Title */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-800">Software Setup</h1>
        <p className="text-sm text-gray-500 mt-1">Configure system-wide settings for AI, company info, voucher numbering, and integrations.</p>
      </div>

      <div className="flex gap-6">
        {/* Tab sidebar */}
        <div className="w-52 flex-shrink-0 space-y-1">
          {categories.map(cat => {
            const Icon = CATEGORY_ICONS[cat] || Building2;
            return (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors ${activeTab === cat ? "text-white" : "text-gray-600 hover:bg-gray-100"}`}
                style={activeTab === cat ? { background: SC.primary } : {}}
                data-testid={`tab-${cat.toLowerCase().replace(/\s/g, "-")}`}
              >
                <Icon size={15} />
                {cat}
              </button>
            );
          })}
        </div>

        {/* Settings panel */}
        <div className="flex-1 min-w-0">
          {categories.map(cat => cat === activeTab && (
            <div key={cat} className="bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Card header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-800 text-base">{cat}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {cat === "AI Configuration" && "Configure the AI provider used for document scanning and auto-fill."}
                    {cat === "Company" && "Basic company information and financial year dates."}
                    {cat === "Voucher Numbering" && "Prefix codes used when auto-generating voucher numbers."}
                    {cat === "Tally Integration" && "Connect to Tally accounting software for ledger sync."}
                  </p>
                </div>
                {saved === cat && (
                  <span className="flex items-center gap-1.5 text-green-600 text-xs font-semibold">
                    <CheckCircle2 size={14} /> Saved
                  </span>
                )}
              </div>

              {/* Voucher Numbering — inline series editor */}
              {cat === "Voucher Numbering" && <VoucherSeriesInline />}

              {/* All other categories — key-value settings */}
              {cat !== "Voucher Numbering" && (
                <div className="divide-y divide-gray-50">
                  {(byCategory[cat] || []).map(setting => (
                    <div key={setting.key} className="px-6 py-4 flex gap-6">
                      <div className="w-48 flex-shrink-0 pt-0.5">
                        <div className="text-sm font-medium text-gray-700">{setting.label}</div>
                        {setting.description && (
                          <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">{setting.description}</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <SettingInput
                          setting={setting}
                          value={values[setting.key] ?? ""}
                          onChange={v => setValues(prev => ({ ...prev, [setting.key]: v }))}
                          allValues={values}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* AI info banner */}
              {cat === "AI Configuration" && (
                <div className="mx-6 mb-4 mt-2 flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-xs text-blue-700 bg-blue-50 border border-blue-100">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>
                    The AI provider is used to auto-extract data from scanned delivery challans (DCs) in Job Work Inward and other transaction screens.
                    Get a free Gemini key at <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline font-medium">aistudio.google.com</a>.
                  </span>
                </div>
              )}

              {/* Tally info banner */}
              {cat === "Tally Integration" && (
                <div className="mx-6 mb-4 mt-2 flex items-start gap-2.5 px-3 py-2.5 rounded-lg text-xs text-amber-700 bg-amber-50 border border-amber-100">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>Tally sync posts ledger entries automatically when vouchers are saved. Make sure Tally is running and TallyPrime ODBC/API access is enabled on the specified host and port.</span>
                </div>
              )}

              {/* Save button — only for non-voucher-numbering tabs */}
              {cat !== "Voucher Numbering" && (
                <div className="flex justify-end px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                  <button
                    onClick={() => saveMut.mutate(cat)}
                    disabled={saveMut.isPending}
                    className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60 transition-colors"
                    style={{ background: SC.orange }}
                    data-testid={`btn-save-${cat.toLowerCase().replace(/\s/g, "-")}`}
                  >
                    <Save size={14} />
                    {saveMut.isPending ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
