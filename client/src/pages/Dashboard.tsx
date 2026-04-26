import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend
} from "recharts";
import { TrendingUp, TrendingDown, ArrowUpRight, Bell, Eye } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed", accent: "#f96a0b" };

// ─── Sample data (replace with API calls) ────────────────────────────────────
const TOP_PRODUCTS = [
  { name: "A1101", value: 85 }, { name: "A1102", value: 70 }, { name: "A1103", value: 60 },
  { name: "A1104", value: 90 }, { name: "A1105", value: 45 }, { name: "A1106", value: 75 },
  { name: "A1107", value: 55 }, { name: "A1108", value: 65 }, { name: "A1109", value: 80 },
];
const BAR_COLORS = ["#027fa5","#d74700","#f96a0b","#2563eb","#16a34a","#9333ea","#dc2626","#ca8a04","#0891b2"];

const JOB_WORK_PIE = [
  { name: "Inward",   value: 15, color: "#d74700" },
  { name: "Despatch", value: 40, color: "#027fa5" },
  { name: "Invoice",  value: 45, color: "#f96a0b" },
];

const AGEING = [
  { party: "ESS",    total: 2.5, d0:  "",  d15: 1,   d30: "",  d45: 1.5, d60: ""  },
  { party: "Pricol", total: 1.5, d0:  1,   d15: "",  d30: "",  d45: "",  d60: 0.5 },
  { party: "Rove",   total: 2,   d0:  "",  d15: 1.2, d30: 0.8, d45: "",  d60: ""  },
  { party: "Vigro",  total: 3.5, d0:  "",  d15: 1.2, d30: "",  d45: 1.3, d60: 1   },
  { party: "Simco",  total: 2,   d0:  "",  d15: 0.5, d30: 1,   d45: "",  d60: 0.5 },
  { party: "Lakshmi",total: 2.5, d0:  "",  d15: 1.2, d30: "",  d45: 1.3, d60: ""  },
];

const REMINDERS = [
  { sno: "01", desc: "Plasma Cutter Machine", due: "04-April", lapsed: "+16 Days", late: true },
  { sno: "02", desc: "Punching Press",        due: "12-April", lapsed: "+24 Days", late: true },
];

const OVERALL = [
  { label: "Job Work", value: 12 },
  { label: "Despatch", value: 38 },
  { label: "Invoice",  value: 50 },
  { label: "Purchase Order", value: "05" },
  { label: "Payments", value: 10 },
];

const TRANSACTIONS = [
  { sno: "01", inwNo: "INW2145", inwDate: "02-Feb-2026", party: "Lakshmi Works", item: "Steel Pipe", unit: "Nos", qty: 20, process: "Zinc Coating" },
  { sno: "02", inwNo: "INW2146", inwDate: "02-Feb-2026", party: "Pricol",        item: "Steel Pipe", unit: "Nos", qty: 20, process: "Zinc Coating" },
];

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, lastPct, lastUp }: { label: string; value: number; lastPct: string; lastUp: boolean }) {
  return (
    <div className="bg-white rounded-xl p-4 flex items-start gap-3 flex-1" style={{ boxShadow: "1px 1px 3px 1px rgba(0,0,0,0.12)" }}>
      <div className="flex-shrink-0 mt-1">
        <div className="w-9 h-9 rounded flex items-center justify-center" style={{ background: "#e8f4f8" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={SC.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
          </svg>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs text-gray-500 font-medium">Monthly</div>
            <div className="text-3xl font-bold leading-tight" style={{ color: SC.primary }}>
              {String(value).padStart(2, "0")}
            </div>
            <div className="text-sm font-semibold text-gray-700 mt-0.5">{label}</div>
          </div>
          <TrendingUp size={20} className="text-green-500 mt-1 flex-shrink-0" />
        </div>
        <div className="flex items-center gap-1 mt-2">
          <span className="text-xs text-gray-400">Last Month</span>
          <span className={`text-xs font-semibold flex items-center gap-0.5 ${lastUp ? "text-green-600" : "text-red-500"}`}>
            {lastPct} {lastUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Custom Pie label ─────────────────────────────────────────────────────────
const RADIAN = Math.PI / 180;
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) {
  const r = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + r * Math.cos(-midAngle * RADIAN);
  const y = cy + r * Math.sin(-midAngle * RADIAN);
  return <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight="bold">{`${(percent * 100).toFixed(0)}%`}</text>;
}

// ─── WIP Circle ───────────────────────────────────────────────────────────────
function WipCircle({ pct }: { pct: number }) {
  const r = 42, circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx="55" cy="55" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
      <circle cx="55" cy="55" r={r} fill="none" stroke={SC.primary} strokeWidth="10"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 55 55)" />
      <text x="55" y="50" textAnchor="middle" fontSize="20" fontWeight="bold" fill={SC.primary}>{pct}%</text>
      <text x="55" y="66" textAnchor="middle" fontSize="10" fill="#6b7280">Onprocess</text>
    </svg>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [chartFilter, setChartFilter] = useState("Last 10-days");

  return (
    <div className="space-y-4 text-sm">

      {/* ── Top Stat Cards ── */}
      <div className="flex gap-4">
        <StatCard label="Inward"  value={20} lastPct="02%" lastUp={false} />
        <StatCard label="Despatch" value={12} lastPct="08%" lastUp={true} />
        <StatCard label="Invoice"  value={8}  lastPct="12%" lastUp={true} />
      </div>

      {/* ── Main Grid ── */}
      <div className="flex gap-4">

        {/* ── Left column ── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Charts row */}
          <div className="flex gap-4">
            {/* Top-10 Product */}
            <div className="flex-1 bg-white rounded-xl p-4" style={{ boxShadow: "1px 1px 3px 1px rgba(0,0,0,0.1)" }}>
              <div className="text-sm font-semibold text-gray-700 mb-3">Top - 10 Product</div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={TOP_PRODUCTS} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                  <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                    {TOP_PRODUCTS.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Job Work Pie */}
            <div className="w-52 bg-white rounded-xl p-4 flex flex-col" style={{ boxShadow: "1px 1px 3px 1px rgba(0,0,0,0.1)" }}>
              <div className="text-sm font-semibold text-gray-700 mb-1">Job Work</div>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={JOB_WORK_PIE} cx="50%" cy="50%" outerRadius={62} dataKey="value" labelLine={false} label={PieLabel}>
                    {JOB_WORK_PIE.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }}
                    formatter={(v, e: any) => <span style={{ color: e.color }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Over-all Chart */}
          <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 3px 1px rgba(0,0,0,0.1)" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-semibold text-gray-700">Over-all Chart</span>
              <div className="flex items-center gap-1 border rounded px-2 py-1 text-xs text-gray-500 cursor-pointer" style={{ borderColor: "#00000020" }}>
                {chartFilter} <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
              </div>
            </div>
            {/* Summary boxes */}
            <div className="grid grid-cols-5 divide-x divide-gray-100 border-b border-gray-100">
              {OVERALL.map((o, i) => (
                <div key={i} className={`px-4 py-3 text-center ${i === 0 ? "text-white" : ""}`}
                  style={i === 0 ? { background: SC.primary } : {}}>
                  <div className={`text-xs font-medium mb-1 ${i === 0 ? "text-white/80" : "text-gray-500"}`}>{o.label}</div>
                  <div className={`text-xl font-bold ${i === 0 ? "text-white" : "text-gray-800"}`}>{o.value}</div>
                </div>
              ))}
            </div>
            {/* Transaction table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: SC.tonal }}>
                    {["S.No", "Inw No", "Inw Date", "Party Name", "Item Name", "Unit", "Qty", "Nature Of Process"].map(h =>
                      <th key={h} className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {TRANSACTIONS.map(r => (
                    <tr key={r.sno} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-500">{r.sno}</td>
                      <td className="px-3 py-2 font-semibold" style={{ color: SC.primary }}>{r.inwNo}</td>
                      <td className="px-3 py-2 text-gray-600">{r.inwDate}</td>
                      <td className="px-3 py-2 text-gray-700">{r.party}</td>
                      <td className="px-3 py-2 text-gray-700">{r.item}</td>
                      <td className="px-3 py-2 text-gray-600">{r.unit}</td>
                      <td className="px-3 py-2 font-semibold text-gray-800">{r.qty}</td>
                      <td className="px-3 py-2 text-gray-600">{r.process}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="w-80 flex-shrink-0 space-y-4">

          {/* Ageing List */}
          <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 3px 1px rgba(0,0,0,0.1)" }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <div>
                <span className="font-semibold text-gray-700 text-sm">Ageing List </span>
                <span className="text-gray-500 text-xs">(Receivable)</span>
                <span className="ml-1 text-gray-400 text-xs">▼</span>
              </div>
              <span className="text-xs text-gray-400">Amount in Lakhs</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: SC.tonal }}>
                    <th className="text-left px-3 py-2 font-semibold text-gray-600">Party</th>
                    <th className="text-right px-2 py-2 font-semibold text-gray-600">Total</th>
                    <th className="text-right px-2 py-2 font-semibold text-gray-600 whitespace-nowrap">0-15<br/>Days</th>
                    <th className="text-right px-2 py-2 font-semibold text-gray-600 whitespace-nowrap">15-30<br/>Days</th>
                    <th className="text-right px-2 py-2 font-semibold text-gray-600 whitespace-nowrap">30-45<br/>Days</th>
                    <th className="text-right px-2 py-2 font-semibold text-gray-600 whitespace-nowrap">45-60<br/>Days</th>
                    <th className="text-right px-2 py-2 font-semibold text-gray-600 whitespace-nowrap">&gt;60<br/>Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {AGEING.map(r => (
                    <tr key={r.party} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-700">{r.party}</td>
                      <td className="px-2 py-2 text-right font-semibold" style={{ color: SC.primary }}>₹ {r.total}</td>
                      <td className="px-2 py-2 text-right text-gray-600">{r.d0  ? `₹ ${r.d0}`  : ""}</td>
                      <td className="px-2 py-2 text-right text-gray-600">{r.d15 ? `₹ ${r.d15}` : ""}</td>
                      <td className="px-2 py-2 text-right text-gray-600">{r.d30 ? `₹ ${r.d30}` : ""}</td>
                      <td className="px-2 py-2 text-right text-gray-600">{r.d45 ? `₹ ${r.d45}` : ""}</td>
                      <td className="px-2 py-2 text-right text-gray-600">{r.d60 ? `₹ ${r.d60}` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Reminder */}
          <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 3px 1px rgba(0,0,0,0.1)" }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <Bell size={14} style={{ color: SC.orange }} />
              <span className="font-semibold text-gray-700 text-sm">Quick reminder</span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: SC.tonal }}>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">S.No</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600">Description</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">Due Date</th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 whitespace-nowrap">Date Lapsed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {REMINDERS.map(r => (
                  <tr key={r.sno} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-500">{r.sno}</td>
                    <td className="px-3 py-2 text-gray-700">{r.desc}</td>
                    <td className="px-3 py-2 text-gray-600">{r.due}</td>
                    <td className="px-3 py-2">
                      <span className="px-1.5 py-0.5 rounded text-xs font-semibold" style={{ background: "#fff0e6", color: SC.orange }}>{r.lapsed}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Work In Process */}
          <div className="bg-white rounded-xl p-4 flex flex-col items-center gap-2" style={{ boxShadow: "1px 1px 3px 1px rgba(0,0,0,0.1)" }}>
            <div className="w-full flex items-center justify-between mb-1">
              <span className="font-semibold text-gray-700 text-sm">Work In Process (WIP)</span>
            </div>
            <WipCircle pct={64} />
            <button className="flex items-center gap-2 px-6 py-2 rounded text-white text-sm font-semibold" style={{ background: SC.orange }} data-testid="button-wip-view">
              <Eye size={14} /> View
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
