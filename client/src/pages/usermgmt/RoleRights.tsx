import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Shield } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700" };

const MODULES = [
  { key: "dashboard", label: "Dashboard" },
  { key: "masters_suppliers", label: "Masters › Suppliers" },
  { key: "masters_customers", label: "Masters › Customers" },
  { key: "masters_employees", label: "Masters › Employees" },
  { key: "masters_inventory_categories", label: "Masters › Inventory Categories" },
  { key: "masters_accounts", label: "Masters › Chart of Accounts" },
  { key: "masters_warehouses", label: "Masters › Warehouses" },
  { key: "masters_uom", label: "Masters › Units of Measure" },
  { key: "masters_tax_rates", label: "Masters › Tax Rates" },
  { key: "purchase_invoices", label: "Purchase › Invoices" },
  { key: "inventory_items", label: "Inventory › Items" },
  { key: "sales_invoices", label: "Sales › Invoices" },
  { key: "accounts_journal", label: "Accounts › Journal Entries" },
  { key: "reports", label: "Reports" },
  { key: "tasks", label: "Tasks & Reminders" },
  { key: "tally", label: "Tally Integration" },
  { key: "user_management", label: "User Management" },
];

const RIGHTS = [
  { key: "canView", label: "View" },
  { key: "canCreate", label: "Create" },
  { key: "canEdit", label: "Edit" },
  { key: "canDelete", label: "Delete" },
  { key: "canApprove", label: "Approve" },
  { key: "canExport", label: "Export" },
];

type RightRow = Record<string, boolean>;

function initMatrix(existingRights: any[]): Record<string, RightRow> {
  const matrix: Record<string, RightRow> = {};
  for (const mod of MODULES) {
    const existing = existingRights.find((r: any) => r.module === mod.key);
    matrix[mod.key] = {
      canView: existing?.canView ?? false,
      canCreate: existing?.canCreate ?? false,
      canEdit: existing?.canEdit ?? false,
      canDelete: existing?.canDelete ?? false,
      canApprove: existing?.canApprove ?? false,
      canExport: existing?.canExport ?? false,
    };
  }
  return matrix;
}

export default function RoleRights() {
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [matrix, setMatrix] = useState<Record<string, RightRow>>({});
  const [loaded, setLoaded] = useState(false);
  const qc = useQueryClient();

  const { data: roles = [] } = useQuery<any[]>({ queryKey: ["/api/user-roles"] });
  const { data: existingRights = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/user-roles", selectedRoleId, "rights"],
    queryFn: async () => {
      if (!selectedRoleId) return [];
      const res = await fetch(`/api/user-roles/${selectedRoleId}/rights`, { credentials: "include" });
      return res.json();
    },
    enabled: !!selectedRoleId,
  });

  if (selectedRoleId && existingRights && !isLoading && !loaded) {
    setMatrix(initMatrix(existingRights));
    setLoaded(true);
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const lines = MODULES.map(mod => ({ module: mod.key, ...matrix[mod.key] }));
      const res = await fetch(`/api/user-roles/${selectedRoleId}/rights`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rights: lines }), credentials: "include"
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/user-roles", selectedRoleId, "rights"] })
  });

  function toggle(module: string, right: string) {
    setMatrix(m => ({
      ...m,
      [module]: { ...m[module], [right]: !m[module]?.[right] }
    }));
  }

  function toggleAll(right: string, val: boolean) {
    setMatrix(m => {
      const updated = { ...m };
      for (const mod of MODULES) {
        updated[mod.key] = { ...updated[mod.key], [right]: val };
      }
      return updated;
    });
  }

  function toggleRow(module: string, val: boolean) {
    setMatrix(m => ({
      ...m,
      [module]: RIGHTS.reduce((acc, r) => ({ ...acc, [r.key]: val }), {} as RightRow)
    }));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Role Rights</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure module-level permissions for each role</p>
        </div>
        {selectedRoleId && (
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }} data-testid="button-save-rights">
            {saveMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Rights
          </button>
        )}
      </div>

      {/* Role selector */}
      <div className="bg-white rounded-xl p-5" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
        <label className="block text-sm font-medium mb-2" style={{ color: "#5b5e66" }}>Select Role to Configure</label>
        <select value={selectedRoleId} onChange={e => { setSelectedRoleId(e.target.value); setLoaded(false); setMatrix({}); }}
          className="w-full max-w-xs border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="select-role">
          <option value="">— Choose a role —</option>
          {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        {!roles.length && <p className="text-xs text-gray-400 mt-2">No roles found. Create roles first in the Roles section.</p>}
      </div>

      {selectedRoleId && (
        <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
          {isLoading ? (
            <div className="py-16 text-center"><Loader2 size={24} className="animate-spin mx-auto text-gray-400" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#d2f1fa" }}>
                    <th className="text-left px-5 py-3 font-semibold text-gray-700 min-w-[220px]">Module</th>
                    {RIGHTS.map(r => (
                      <th key={r.key} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                        <div className="flex flex-col items-center gap-1">
                          <span>{r.label}</span>
                          <div className="flex gap-1">
                            <button onClick={() => toggleAll(r.key, true)} className="text-[10px] text-blue-500 hover:underline" title="All">All</button>
                            <span className="text-gray-300">·</span>
                            <button onClick={() => toggleAll(r.key, false)} className="text-[10px] text-red-400 hover:underline" title="None">None</button>
                          </div>
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center">All</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {MODULES.map((mod, idx) => {
                    const row = matrix[mod.key] || {};
                    const allOn = RIGHTS.every(r => row[r.key]);
                    const isGroup = mod.label.includes("›");
                    return (
                      <tr key={mod.key} className={`hover:bg-blue-50/30 ${idx % 2 === 0 ? "" : "bg-gray-50/30"}`}>
                        <td className="px-5 py-3">
                          <span className={`${isGroup ? "text-gray-600 text-xs" : "font-medium text-gray-800"}`}>{mod.label}</span>
                        </td>
                        {RIGHTS.map(r => (
                          <td key={r.key} className="px-4 py-3 text-center">
                            <input type="checkbox" checked={!!row[r.key]} onChange={() => toggle(mod.key, r.key)}
                              className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: SC.primary }}
                              data-testid={`check-${mod.key}-${r.key}`} />
                          </td>
                        ))}
                        <td className="px-4 py-3 text-center">
                          <input type="checkbox" checked={allOn} onChange={e => toggleRow(mod.key, e.target.checked)}
                            className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: SC.orange }}
                            data-testid={`check-all-${mod.key}`} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!selectedRoleId && (
        <div className="bg-white rounded-xl py-16 text-center" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
          <Shield size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400">Select a role above to configure its module rights</p>
        </div>
      )}
    </div>
  );
}
