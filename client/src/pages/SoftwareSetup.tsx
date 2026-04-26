import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot, Building2, Hash, Plug, CheckCircle2, Eye, EyeOff,
  Save, RefreshCw, AlertCircle
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
    const map: Record<string, string> = {};
    rawSettings.forEach(s => { map[s.key] = s.value || ""; });
    setValues(map);
  }, [rawSettings]);

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

              {/* Fields */}
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

              {/* Save button */}
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
