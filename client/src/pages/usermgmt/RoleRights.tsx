import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Shield } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa" };

type ModuleEntry =
  | { type: "header"; label: string }
  | { type: "item"; key: string; label: string };

const MODULES: ModuleEntry[] = [
  { type: "item",   key: "dashboard",                           label: "Dashboard" },

  // ── Masters ──
  { type: "header",                                             label: "Masters — Parties" },
  { type: "item",   key: "masters_suppliers",                   label: "Suppliers" },
  { type: "item",   key: "masters_customers",                   label: "Customers" },
  { type: "item",   key: "masters_cities",                      label: "City" },
  { type: "item",   key: "masters_states",                      label: "State" },
  { type: "item",   key: "masters_countries",                   label: "Country" },

  { type: "header",                                             label: "Masters — Items" },
  { type: "item",   key: "masters_products",                    label: "Product" },
  { type: "item",   key: "masters_processes",                   label: "Process" },
  { type: "item",   key: "masters_machines",                    label: "Machine" },
  { type: "item",   key: "masters_categories",                  label: "Category" },
  { type: "item",   key: "masters_sub_categories",              label: "Sub Category" },
  { type: "item",   key: "masters_purchase_approvals",          label: "Purchase Approval" },
  { type: "item",   key: "masters_approval_authority",          label: "Approval Authority" },
  { type: "item",   key: "masters_purchase_store_items",        label: "Purchase Store Item" },
  { type: "item",   key: "masters_stores",                      label: "Store Master" },
  { type: "item",   key: "masters_store_item_groups",           label: "Store Item Group" },
  { type: "item",   key: "masters_store_item_sub_groups",       label: "Store Item Sub Group" },
  { type: "item",   key: "masters_uom",                         label: "UOM" },
  { type: "item",   key: "masters_terms",                       label: "Terms" },
  { type: "item",   key: "masters_term_types",                  label: "Term Types" },
  { type: "item",   key: "masters_departments",                 label: "Department" },

  { type: "header",                                             label: "Masters — Accounts" },
  { type: "item",   key: "masters_chart_of_accounts",           label: "Chart of Accounts" },
  { type: "item",   key: "masters_voucher_types",               label: "Voucher Types" },
  { type: "item",   key: "masters_pay_mode_types",              label: "Pay Mode Types" },
  { type: "item",   key: "masters_ledger_categories",           label: "Ledger Categories" },
  { type: "item",   key: "masters_general_ledgers",             label: "General Ledger" },
  { type: "item",   key: "masters_ledger",                      label: "Ledger (Sub-Ledger)" },

  { type: "header",                                             label: "Masters — Administration" },
  { type: "item",   key: "masters_financial_years",             label: "Financial Years" },
  { type: "item",   key: "masters_year_end_closing",            label: "Year-End Closing" },
  { type: "item",   key: "masters_voucher_series",              label: "Voucher Numbering" },

  // ── Engineering ──
  { type: "header",                                             label: "Engineering" },
  { type: "item",   key: "engineering_job_work_inward",         label: "Job Work Inward" },
  { type: "item",   key: "engineering_job_work_despatch",       label: "Job Work Despatch" },
  { type: "item",   key: "engineering_job_work_invoice",        label: "Job Work Invoice" },
  { type: "item",   key: "engineering_returnable_inward",       label: "Returnable Inward" },
  { type: "item",   key: "engineering_returnable_outward",      label: "Returnable Outward" },
  { type: "item",   key: "engineering_gate_pass",               label: "Gate Pass" },

  // ── Inventory ──
  { type: "header",                                             label: "Inventory" },
  { type: "item",   key: "inventory_purchase_order",            label: "Purchase Order" },
  { type: "item",   key: "inventory_purchase_amendment",        label: "Purchase Amendment" },
  { type: "item",   key: "inventory_purchase_order_approval",   label: "Purchase Order Approval" },
  { type: "item",   key: "inventory_goods_receipt_note",        label: "Goods Receipt Note" },
  { type: "item",   key: "inventory_store_request_note",        label: "Store Request Note" },
  { type: "item",   key: "inventory_store_issue_indent",        label: "Store Issue Indent" },
  { type: "item",   key: "inventory_phy_reconciliation",        label: "PHY INV Reconciliation" },
  { type: "item",   key: "inventory_goods_receipt_return",      label: "Goods Receipt Return" },
  { type: "item",   key: "inventory_issue_indent_return",       label: "Issue Indent Return" },
  { type: "item",   key: "inventory_store_opening",             label: "Store Opening" },

  // ── Accounts ──
  { type: "header",                                             label: "Accounts" },
  { type: "item",   key: "accounts_voucher",                    label: "Voucher" },
  { type: "item",   key: "accounts_general_ledger",             label: "General Ledger" },
  { type: "item",   key: "accounts_ledger",                     label: "Ledger" },

  // ── Reports — Engineering ──
  { type: "header",                                             label: "Reports — Engineering" },
  { type: "item",   key: "report_eng_job_work_pending",         label: "Job Work Pending" },
  { type: "item",   key: "report_eng_despatch_pending",         label: "Despatch Pending" },
  { type: "item",   key: "report_eng_invoice_pending",          label: "Invoice Pending" },
  { type: "item",   key: "report_eng_despatch_register",        label: "Despatch Register" },

  // ── Reports — Inventory ──
  { type: "header",                                             label: "Reports — Inventory" },
  { type: "item",   key: "report_inv_stock_report",             label: "Stock Report" },
  { type: "item",   key: "report_inv_stock_report_value",       label: "Stock Report With Value" },
  { type: "item",   key: "report_inv_stock_ledger",             label: "Stock Ledger" },
  { type: "item",   key: "report_inv_bank_stock",               label: "Bank Stock Report" },
  { type: "item",   key: "report_inv_po_pending",               label: "PO Pending" },
  { type: "item",   key: "report_inv_material_register",        label: "Material Register" },
  { type: "item",   key: "report_inv_issue_register",           label: "Issue Register" },
  { type: "item",   key: "report_inv_receipt_list",             label: "Receipt List" },
  { type: "item",   key: "report_inv_expiry_item_list",         label: "Expiry Item List" },

  // ── Reports — Accounts ──
  { type: "header",                                             label: "Reports — Accounts" },
  { type: "item",   key: "report_acc_customer_receivable",      label: "Customer Receivable" },
  { type: "item",   key: "report_acc_supplier_payables",        label: "Supplier Payables" },
  { type: "item",   key: "report_acc_ledger_report",            label: "Ledger Report" },
  { type: "item",   key: "report_acc_trial_balance",            label: "Trial Balance" },
  { type: "item",   key: "report_acc_ageing_list",              label: "Ageing List" },

  // ── Other ──
  { type: "header",                                             label: "Other" },
  { type: "item",   key: "tasks_reminders",                     label: "Tasks & Reminders" },
  { type: "item",   key: "tally_integration",                   label: "Tally Integration" },
  { type: "item",   key: "reprint",                             label: "Reprint" },

  // ── User Management ──
  { type: "header",                                             label: "User Management" },
  { type: "item",   key: "usermgmt_users",                      label: "Users" },
  { type: "item",   key: "usermgmt_roles",                      label: "Roles" },
  { type: "item",   key: "usermgmt_role_rights",                label: "Role Rights" },

  { type: "item",   key: "software_setup",                      label: "Software Setup" },
];

const ITEM_MODULES = MODULES.filter((m): m is Extract<ModuleEntry, { type: "item" }> => m.type === "item");

const RIGHTS = [
  { key: "canView",    label: "View" },
  { key: "canCreate",  label: "Create" },
  { key: "canEdit",    label: "Edit" },
  { key: "canDelete",  label: "Delete" },
  { key: "canApprove", label: "Approve" },
  { key: "canExport",  label: "Export" },
];

type RightRow = Record<string, boolean>;

function initMatrix(existingRights: any[]): Record<string, RightRow> {
  const matrix: Record<string, RightRow> = {};
  for (const mod of ITEM_MODULES) {
    const existing = existingRights.find((r: any) => r.module === mod.key);
    matrix[mod.key] = {
      canView:    existing?.canView    ?? false,
      canCreate:  existing?.canCreate  ?? false,
      canEdit:    existing?.canEdit    ?? false,
      canDelete:  existing?.canDelete  ?? false,
      canApprove: existing?.canApprove ?? false,
      canExport:  existing?.canExport  ?? false,
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
      const lines = ITEM_MODULES.map(mod => ({ module: mod.key, ...matrix[mod.key] }));
      const res = await fetch(`/api/user-roles/${selectedRoleId}/rights`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rights: lines }), credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/user-roles", selectedRoleId, "rights"] }),
  });

  function toggle(module: string, right: string) {
    setMatrix(m => ({ ...m, [module]: { ...m[module], [right]: !m[module]?.[right] } }));
  }

  function toggleAll(right: string, val: boolean) {
    setMatrix(m => {
      const updated = { ...m };
      for (const mod of ITEM_MODULES) updated[mod.key] = { ...updated[mod.key], [right]: val };
      return updated;
    });
  }

  function toggleRow(module: string, val: boolean) {
    setMatrix(m => ({
      ...m,
      [module]: RIGHTS.reduce((acc, r) => ({ ...acc, [r.key]: val }), {} as RightRow),
    }));
  }

  function toggleSection(headerLabel: string, val: boolean) {
    // Collect all item keys that belong to this section (between this header and the next)
    const headerIdx = MODULES.findIndex(m => m.type === "header" && m.label === headerLabel);
    if (headerIdx === -1) return;
    const keys: string[] = [];
    for (let i = headerIdx + 1; i < MODULES.length; i++) {
      if (MODULES[i].type === "header") break;
      if (MODULES[i].type === "item") keys.push((MODULES[i] as any).key);
    }
    setMatrix(m => {
      const updated = { ...m };
      for (const key of keys) {
        updated[key] = RIGHTS.reduce((acc, r) => ({ ...acc, [r.key]: val }), {} as RightRow);
      }
      return updated;
    });
  }

  function isSectionAllOn(headerLabel: string): boolean {
    const headerIdx = MODULES.findIndex(m => m.type === "header" && m.label === headerLabel);
    if (headerIdx === -1) return false;
    for (let i = headerIdx + 1; i < MODULES.length; i++) {
      if (MODULES[i].type === "header") break;
      const key = (MODULES[i] as any).key;
      if (!RIGHTS.every(r => matrix[key]?.[r.key])) return false;
    }
    return true;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Role Rights</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure module-level permissions for each role</p>
        </div>
        {selectedRoleId && (
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium"
            style={{ background: SC.orange }}
            data-testid="button-save-rights"
          >
            {saveMut.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Rights
          </button>
        )}
      </div>

      {/* Role selector */}
      <div className="bg-white rounded-xl p-5" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
        <label className="block text-sm font-medium mb-2" style={{ color: "#5b5e66" }}>Select Role to Configure</label>
        <select
          value={selectedRoleId}
          onChange={e => { setSelectedRoleId(e.target.value); setLoaded(false); setMatrix({}); }}
          className="w-full max-w-xs border-2 rounded px-3 py-2 text-sm focus:outline-none"
          style={{ borderColor: "#00000040" }}
          data-testid="select-role"
        >
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
                <thead className="sticky top-0 z-10">
                  <tr style={{ background: SC.tonal }}>
                    <th className="text-left px-5 py-3 font-semibold text-gray-700 min-w-[240px]">Module / Menu</th>
                    {RIGHTS.map(r => (
                      <th key={r.key} className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[80px]">
                        <div className="flex flex-col items-center gap-1">
                          <span>{r.label}</span>
                          <div className="flex gap-1">
                            <button onClick={() => toggleAll(r.key, true)} className="text-[10px] text-blue-500 hover:underline" data-testid={`btn-all-${r.key}`}>All</button>
                            <span className="text-gray-300">·</span>
                            <button onClick={() => toggleAll(r.key, false)} className="text-[10px] text-red-400 hover:underline" data-testid={`btn-none-${r.key}`}>None</button>
                          </div>
                        </div>
                      </th>
                    ))}
                    <th className="px-4 py-3 font-semibold text-gray-700 text-center min-w-[60px]">All</th>
                  </tr>
                </thead>
                <tbody>
                  {MODULES.map((entry, idx) => {
                    if (entry.type === "header") {
                      const allOn = isSectionAllOn(entry.label);
                      return (
                        <tr key={`hdr-${idx}`} style={{ background: "#f0f9ff" }} className="border-t-2 border-b border-blue-100">
                          <td className="px-5 py-2">
                            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: SC.primary }}>
                              {entry.label}
                            </span>
                          </td>
                          {RIGHTS.map(r => <td key={r.key} />)}
                          <td className="px-4 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={allOn}
                              title={`Toggle all in ${entry.label}`}
                              onChange={e => toggleSection(entry.label, e.target.checked)}
                              className="w-4 h-4 rounded cursor-pointer"
                              style={{ accentColor: SC.primary }}
                              data-testid={`check-section-${entry.label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                            />
                          </td>
                        </tr>
                      );
                    }

                    const row = matrix[entry.key] || {};
                    const allOn = RIGHTS.every(r => row[r.key]);
                    return (
                      <tr key={entry.key} className={`hover:bg-blue-50/30 border-b border-gray-50 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50/20"}`}>
                        <td className="px-5 py-2.5">
                          <span className="pl-3 text-gray-700 text-sm">{entry.label}</span>
                        </td>
                        {RIGHTS.map(r => (
                          <td key={r.key} className="px-4 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={!!row[r.key]}
                              onChange={() => toggle(entry.key, r.key)}
                              className="w-4 h-4 rounded cursor-pointer"
                              style={{ accentColor: SC.primary }}
                              data-testid={`check-${entry.key}-${r.key}`}
                            />
                          </td>
                        ))}
                        <td className="px-4 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={allOn}
                            onChange={e => toggleRow(entry.key, e.target.checked)}
                            className="w-4 h-4 rounded cursor-pointer"
                            style={{ accentColor: SC.orange }}
                            data-testid={`check-all-${entry.key}`}
                          />
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
