import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Info, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Approver = { userId: string; username: string; departmentId: string; department: string };

type AuthorityRecord = {
  id: string;
  transactionType: string;
  typeCode: string;
  approvalLevel: string;
  approvers: Approver[];
};

const EMPTY_FORM = {
  transactionType: "",
  typeCode: "",
  approvalLevel: "",
  approvers: [] as Approver[],
};

const EMPTY_ROW: Approver = { userId: "", username: "", departmentId: "", department: "" };

export default function ApprovalAuthority() {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newRow, setNewRow] = useState<Approver>({ ...EMPTY_ROW });
  const [addingRow, setAddingRow] = useState(false);

  const { data: records = [] } = useQuery<AuthorityRecord[]>({ queryKey: ["/api/approval-authority"] });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"] });
  const { data: departments = [] } = useQuery<any[]>({ queryKey: ["/api/departments"] });

  const saveMutation = useMutation({
    mutationFn: async (payload: typeof EMPTY_FORM) => {
      if (editingId) return apiRequest("PATCH", `/api/approval-authority/${editingId}`, payload);
      return apiRequest("POST", "/api/approval-authority", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approval-authority"] });
      toast({ title: "Saved successfully" });
      setForm(EMPTY_FORM);
      setEditingId(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/approval-authority/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/approval-authority"] });
      setForm(EMPTY_FORM);
      setEditingId(null);
    },
  });

  function loadRecord(rec: AuthorityRecord) {
    setEditingId(rec.id);
    setForm({
      transactionType: rec.transactionType,
      typeCode: rec.typeCode,
      approvalLevel: rec.approvalLevel,
      approvers: rec.approvers ?? [],
    });
  }

  function handleCancel() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setAddingRow(false);
    setNewRow({ ...EMPTY_ROW });
  }

  function removeApprover(idx: number) {
    setForm(f => ({ ...f, approvers: f.approvers.filter((_, i) => i !== idx) }));
  }

  function handleUserSelect(userId: string) {
    const user = users.find((u: any) => u.id === userId);
    setNewRow(r => ({ ...r, userId, username: user?.username || user?.name || "" }));
  }

  function handleDeptSelect(departmentId: string) {
    const dept = departments.find((d: any) => d.id === departmentId);
    setNewRow(r => ({ ...r, departmentId, department: dept?.name || "" }));
  }

  function confirmAddRow() {
    if (!newRow.userId) return;
    setForm(f => ({ ...f, approvers: [...f.approvers, { ...newRow }] }));
    setNewRow({ ...EMPTY_ROW });
    setAddingRow(false);
  }

  return (
    <div className="p-6 bg-[#f5f0ed] min-h-screen">
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-xl font-bold text-[#027fa5]">Approval Authority</h1>
      </div>

      <div className="max-w-2xl bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Card Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <span className="font-semibold text-base text-gray-800">Approval Authority</span>
          <Info size={17} className="text-gray-400" />
        </div>

        <div className="px-5 pb-4 space-y-4">
          {/* Row 1: Transaction Type + Type */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <label className="absolute -top-2.5 left-3 bg-white px-1 text-xs text-gray-500">Transaction Type</label>
              <input
                data-testid="input-transaction-type"
                value={form.transactionType}
                onChange={e => setForm(f => ({ ...f, transactionType: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 pt-3 pb-2 text-sm focus:outline-none focus:border-[#027fa5]"
                placeholder="e.g. Purchase Order"
              />
            </div>
            <div className="relative w-40">
              <label className="absolute -top-2.5 left-3 bg-white px-1 text-xs text-gray-500">Type</label>
              <input
                data-testid="input-type-code"
                value={form.typeCode}
                onChange={e => setForm(f => ({ ...f, typeCode: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 pt-3 pb-2 text-sm focus:outline-none focus:border-[#027fa5]"
                placeholder="e.g. P.O"
              />
            </div>
          </div>

          {/* Row 2: Approval Level */}
          <div className="relative w-52">
            <label className="absolute -top-2.5 left-3 bg-white px-1 text-xs text-gray-500">Approval level</label>
            <input
              data-testid="input-approval-level"
              value={form.approvalLevel}
              onChange={e => setForm(f => ({ ...f, approvalLevel: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 pt-3 pb-2 text-sm focus:outline-none focus:border-[#027fa5]"
              placeholder="e.g. Level - 1"
            />
          </div>

          {/* Approvers Table */}
          <div className="border border-gray-200 rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#b8d9e8] text-gray-700">
                  <th className="px-4 py-2 text-left font-medium w-14">S.no</th>
                  <th className="px-4 py-2 text-left font-medium">Username</th>
                  <th className="px-4 py-2 text-left font-medium">Department</th>
                  <th className="w-10"></th>
                </tr>
              </thead>
              <tbody>
                {form.approvers.length === 0 && !addingRow && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-xs">
                      No approvers added yet. Click "Add approver" below.
                    </td>
                  </tr>
                )}
                {form.approvers.map((ap, idx) => (
                  <tr key={idx} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{idx + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-800">{ap.username}</td>
                    <td className="px-4 py-2.5 text-gray-600">{ap.department}</td>
                    <td className="px-2 py-2">
                      <button
                        onClick={() => removeApprover(idx)}
                        data-testid={`btn-remove-approver-${idx}`}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Inline add row */}
                {addingRow && (
                  <tr className="border-t border-gray-100 bg-[#f0f9ff]">
                    <td className="px-4 py-2 text-gray-400 text-xs">{form.approvers.length + 1}</td>
                    <td className="px-2 py-1.5">
                      <select
                        autoFocus
                        data-testid="select-new-user"
                        value={newRow.userId}
                        onChange={e => handleUserSelect(e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-[#027fa5] bg-white"
                      >
                        <option value="">— Select User —</option>
                        {users.map((u: any) => (
                          <option key={u.id} value={u.id}>{u.username || u.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        data-testid="select-new-department"
                        value={newRow.departmentId}
                        onChange={e => handleDeptSelect(e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-[#027fa5] bg-white"
                      >
                        <option value="">— Select Dept —</option>
                        {departments.map((d: any) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5 flex items-center gap-1 pt-2">
                      <button
                        onClick={confirmAddRow}
                        data-testid="btn-confirm-row"
                        className="text-[#027fa5] hover:text-[#025f7a] text-xs font-bold"
                        title="Confirm"
                      >✓</button>
                      <button
                        onClick={() => { setAddingRow(false); setNewRow({ ...EMPTY_ROW }); }}
                        className="text-gray-400 hover:text-gray-600 text-xs font-bold"
                        title="Cancel row"
                      >✕</button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Add approver link */}
            {!addingRow && (
              <div className="border-t border-gray-100 px-4 py-2">
                <button
                  onClick={() => setAddingRow(true)}
                  data-testid="btn-add-approver"
                  className="flex items-center gap-1 text-xs text-[#027fa5] hover:text-[#025f7a] font-medium transition-colors"
                >
                  <Plus size={13} /> Add approver
                </button>
              </div>
            )}
          </div>

          {/* Saved records pill list */}
          {records.length > 0 && (
            <div className="mt-1">
              <p className="text-xs text-gray-500 mb-1.5 font-medium">Saved configurations:</p>
              <div className="flex flex-wrap gap-2">
                {records.map(rec => (
                  <button
                    key={rec.id}
                    data-testid={`btn-load-record-${rec.id}`}
                    onClick={() => loadRecord(rec)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                      editingId === rec.id
                        ? "bg-[#027fa5] text-white border-[#027fa5]"
                        : "bg-white text-gray-600 border-gray-300 hover:border-[#027fa5] hover:text-[#027fa5]"
                    }`}
                  >
                    {rec.transactionType || "Untitled"} — {rec.approvalLevel}
                    {editingId === rec.id && (
                      <span
                        onClick={e => { e.stopPropagation(); deleteMutation.mutate(rec.id); }}
                        className="ml-2 text-red-300 hover:text-red-500 cursor-pointer"
                      >✕</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-4 px-5 py-4 border-t border-gray-100">
          <button
            onClick={handleCancel}
            data-testid="btn-cancel"
            className="px-8 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
            data-testid="btn-save"
            className="px-8 py-2 bg-[#d74700] hover:bg-[#b83c00] text-white rounded text-sm font-medium transition-colors disabled:opacity-60"
          >
            {saveMutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
