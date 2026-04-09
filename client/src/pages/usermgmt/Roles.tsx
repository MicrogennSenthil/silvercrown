import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit, X, Loader2, ShieldCheck } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700" };
const EMPTY = { name: "", description: "", isActive: true };

function RoleForm({ initial, onClose }: any) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const qc = useQueryClient();
  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      const url = initial?.id ? `/api/user-roles/${initial.id}` : "/api/user-roles";
      const res = await fetch(url, { method: initial?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/user-roles"] }); onClose(); }
  });
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md" style={{ boxShadow: "2px 2px 4px 2px rgba(0,0,0,0.3)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#b8d2da" }}>
          <h2 className="text-lg font-bold" style={{ color: SC.primary }}>{initial?.id ? "Edit" : "New"} Role</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Role Name *</label>
            <input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Purchase Manager, Stock Incharge"
              className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="input-name" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Description</label>
            <textarea value={form.description} onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))} rows={2}
              className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="input-description" />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm((f: any) => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 rounded" data-testid="checkbox-active" />
            <label htmlFor="isActive" className="text-sm text-gray-700">Active</label>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-5 py-2 rounded border text-sm" style={{ borderColor: "#00000030" }}>Cancel</button>
          <button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}
            className="px-5 py-2 rounded text-white text-sm font-medium flex items-center gap-2" style={{ background: SC.orange }} data-testid="button-save">
            {saveMut.isPending && <Loader2 size={14} className="animate-spin" />} Save Role
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Roles() {
  const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null);
  const qc = useQueryClient();
  const { data: roles = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/user-roles"] });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"] });
  const del = useMutation({
    mutationFn: (id: string) => fetch(`/api/user-roles/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/user-roles"] })
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">User Roles</h1>
          <p className="text-sm text-gray-500 mt-0.5">Define roles to group users by access level</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }} data-testid="button-new-role">
          <Plus size={16} /> New Role
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-36 bg-white rounded-xl animate-pulse" style={{ boxShadow: "1px 1px 2px rgba(0,0,0,0.1)" }} />)}
        </div>
      ) : roles.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles.map((role: any) => {
            const userCount = users.filter((u: any) => u.userRoleId === role.id).length;
            return (
              <div key={role.id} className="bg-white rounded-xl p-5" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#d2f1fa" }}>
                    <ShieldCheck size={20} style={{ color: SC.primary }} />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${role.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {role.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
                <div className="font-semibold text-gray-800 mb-1">{role.name}</div>
                <div className="text-xs text-gray-500 mb-3">{role.description || "No description"}</div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{userCount} user{userCount !== 1 ? "s" : ""}</span>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditing(role); setShowForm(true); }} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" data-testid={`button-edit-${role.id}`}><Edit size={14} /></button>
                    <button onClick={() => { if (confirm("Delete role?")) del.mutate(role.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`button-delete-${role.id}`}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl py-16 text-center" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
          <ShieldCheck size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-400">No roles defined yet. Create your first role.</p>
        </div>
      )}

      {showForm && <RoleForm initial={editing} onClose={() => setShowForm(false)} />}
    </div>
  );
}
