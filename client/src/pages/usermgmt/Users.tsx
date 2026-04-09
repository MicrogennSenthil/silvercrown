import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2, Edit, X, Loader2, User, Eye, EyeOff } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700" };
const ROLES = ["admin", "manager", "user"] as const;

function UserForm({ initial, employees, userRoles, onClose }: any) {
  const [form, setForm] = useState({
    username: "", password: "", name: "", email: "",
    role: "user" as any, employeeId: "", userRoleId: "",
    ...initial, password: ""
  });
  const [showPass, setShowPass] = useState(false);
  const qc = useQueryClient();

  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      const url = initial?.id ? `/api/users/${initial.id}` : "/api/users";
      const payload = { ...data };
      if (!payload.password) delete payload.password;
      const res = await fetch(url, { method: initial?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/users"] }); onClose(); }
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg" style={{ boxShadow: "2px 2px 4px 2px rgba(0,0,0,0.3)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#b8d2da" }}>
          <h2 className="text-lg font-bold" style={{ color: SC.primary }}>{initial?.id ? "Edit" : "New"} User</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Full Name *</label>
            <input value={form.name} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
              className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="input-name" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Username *</label>
            <input value={form.username} onChange={e => setForm((f: any) => ({ ...f, username: e.target.value }))} disabled={!!initial?.id}
              className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none disabled:bg-gray-50" style={{ borderColor: "#00000040" }} data-testid="input-username" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>{initial?.id ? "New Password" : "Password *"}</label>
            <div className="relative">
              <input type={showPass ? "text" : "password"} value={form.password} onChange={e => setForm((f: any) => ({ ...f, password: e.target.value }))}
                placeholder={initial?.id ? "Leave blank to keep current" : ""}
                className="w-full border-2 rounded px-3 py-2 pr-10 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="input-password" />
              <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Email</label>
            <input type="email" value={form.email || ""} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))}
              className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="input-email" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>System Role</label>
            <select value={form.role} onChange={e => setForm((f: any) => ({ ...f, role: e.target.value }))}
              className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="select-role">
              {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Custom Role</label>
            <select value={form.userRoleId || ""} onChange={e => setForm((f: any) => ({ ...f, userRoleId: e.target.value }))}
              className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="select-user-role">
              <option value="">No Custom Role</option>
              {userRoles?.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Linked Employee</label>
            <select value={form.employeeId || ""} onChange={e => setForm((f: any) => ({ ...f, employeeId: e.target.value }))}
              className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="select-employee">
              <option value="">Not Linked</option>
              {employees?.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.name} ({emp.employeeCode})</option>)}
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-5 py-2 rounded border text-sm" style={{ borderColor: "#00000030" }}>Cancel</button>
          <button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}
            className="px-5 py-2 rounded text-white text-sm font-medium flex items-center gap-2" style={{ background: SC.orange }} data-testid="button-save">
            {saveMut.isPending && <Loader2 size={14} className="animate-spin" />} {initial?.id ? "Update" : "Create"} User
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Users() {
  const [search, setSearch] = useState(""); const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null);
  const qc = useQueryClient();
  const { data: users = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/users"] });
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: userRoles = [] } = useQuery<any[]>({ queryKey: ["/api/user-roles"] });

  const del = useMutation({
    mutationFn: (id: string) => fetch(`/api/users/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/users"] })
  });

  const ROLE_COLORS: Record<string, string> = { admin: "bg-red-100 text-red-700", manager: "bg-blue-100 text-blue-700", user: "bg-gray-100 text-gray-700" };
  const filtered = users.filter((u: any) => u.name?.toLowerCase().includes(search.toLowerCase()) || u.username?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Users</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage system users and their accounts</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }} data-testid="button-new-user">
          <Plus size={16} /> New User
        </button>
      </div>

      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="relative max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
              className="w-full pl-9 pr-3 py-2 border rounded text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="input-search" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ background: "#d2f1fa" }}>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Name</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Username</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Email</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">System Role</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Custom Role</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Employee</th>
              <th className="px-5 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? [...Array(3)].map((_, i) => <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>) :
                filtered.map((u: any) => {
                  const emp = employees.find((e: any) => e.id === u.employeeId);
                  const role = userRoles.find((r: any) => r.id === u.userRoleId);
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0" style={{ background: SC.primary }}>
                            {u.name?.[0]?.toUpperCase() || u.username?.[0]?.toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-800">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-600 font-mono text-xs">{u.username}</td>
                      <td className="px-5 py-3 text-gray-500">{u.email || "—"}</td>
                      <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${ROLE_COLORS[u.role] || "bg-gray-100 text-gray-700"}`}>{u.role}</span></td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{role?.name || "—"}</td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{emp ? `${emp.name} (${emp.employeeCode})` : "—"}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => { setEditing(u); setShowForm(true); }} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" data-testid={`button-edit-${u.id}`}><Edit size={15} /></button>
                          <button onClick={() => { if (confirm("Delete user?")) del.mutate(u.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`button-delete-${u.id}`}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && <UserForm initial={editing} employees={employees} userRoles={userRoles} onClose={() => setShowForm(false)} />}
    </div>
  );
}
