import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2, Edit, X, Loader2, UserCheck } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700" };
const EMPTY = { employeeCode: "", name: "", userId: "", department: "", designation: "", email: "", phone: "", dateOfJoining: "", dateOfBirth: "", address: "", emergencyContact: "", isActive: true };

function EmployeeForm({ initial, users, onClose }: any) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const qc = useQueryClient();
  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      const url = initial?.id ? `/api/employees/${initial.id}` : "/api/employees";
      const res = await fetch(url, { method: initial?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/employees"] }); onClose(); }
  });

  const F = ({ label, name, type = "text", span = false }: any) => (
    <div className={span ? "col-span-2" : ""}>
      <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>{label}</label>
      <input type={type} value={(form as any)[name] ?? ""} onChange={e => setForm((f: any) => ({ ...f, [name]: e.target.value }))}
        className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid={`input-${name}`} />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-auto">
      <div className="bg-white rounded-xl w-full max-w-2xl my-4" style={{ boxShadow: "2px 2px 4px 2px rgba(0,0,0,0.3)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#b8d2da" }}>
          <h2 className="text-lg font-bold" style={{ color: SC.primary }}>{initial?.id ? "Edit" : "New"} Employee</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          <F label="Employee Code *" name="employeeCode" />
          <F label="Full Name *" name="name" />
          <F label="Department" name="department" />
          <F label="Designation" name="designation" />
          <F label="Email" name="email" type="email" />
          <F label="Phone" name="phone" />
          <F label="Date of Joining" name="dateOfJoining" type="date" />
          <F label="Date of Birth" name="dateOfBirth" type="date" />
          <F label="Emergency Contact" name="emergencyContact" />
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Link to User Account</label>
            <select value={form.userId || ""} onChange={e => setForm((f: any) => ({ ...f, userId: e.target.value }))}
              className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="select-user">
              <option value="">No User Account</option>
              {users?.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.username})</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Address</label>
            <textarea value={form.address || ""} onChange={e => setForm((f: any) => ({ ...f, address: e.target.value }))} rows={2}
              className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="input-address" />
          </div>
          <div className="col-span-2 flex items-center gap-3">
            <input type="checkbox" id="isActive" checked={form.isActive} onChange={e => setForm((f: any) => ({ ...f, isActive: e.target.checked }))}
              className="w-4 h-4 rounded" data-testid="checkbox-active" />
            <label htmlFor="isActive" className="text-sm text-gray-700">Active Employee</label>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-5 py-2 rounded border text-sm" style={{ borderColor: "#00000030" }}>Cancel</button>
          <button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}
            className="px-5 py-2 rounded text-white text-sm font-medium flex items-center gap-2" style={{ background: SC.orange }} data-testid="button-save">
            {saveMut.isPending && <Loader2 size={14} className="animate-spin" />} Save Employee
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Employees() {
  const [search, setSearch] = useState(""); const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null);
  const qc = useQueryClient();
  const { data: employees = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"] });
  const del = useMutation({ mutationFn: (id: string) => fetch(`/api/employees/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/employees"] }) });
  const filtered = employees.filter((e: any) => e.name?.toLowerCase().includes(search.toLowerCase()) || e.employeeCode?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-800">Employees</h1><p className="text-sm text-gray-500 mt-0.5">Employee master — link to user accounts</p></div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }} data-testid="button-new-employee">
          <Plus size={16} /> New Employee
        </button>
      </div>
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="relative max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search employees..."
              className="w-full pl-9 pr-3 py-2 border rounded text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="input-search" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ background: "#d2f1fa" }}>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Code</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Name</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Department</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Designation</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Phone</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">User Account</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
              <th className="px-5 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? [...Array(3)].map((_, i) => <tr key={i}><td colSpan={8} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>) :
                filtered.length ? filtered.map((emp: any) => {
                  const user = users.find((u: any) => u.id === emp.userId);
                  return (
                    <tr key={emp.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-mono text-xs font-semibold" style={{ color: SC.primary }}>{emp.employeeCode}</td>
                      <td className="px-5 py-3 font-medium text-gray-800">{emp.name}</td>
                      <td className="px-5 py-3 text-gray-600">{emp.department || "—"}</td>
                      <td className="px-5 py-3 text-gray-600">{emp.designation || "—"}</td>
                      <td className="px-5 py-3 text-gray-500">{emp.phone || "—"}</td>
                      <td className="px-5 py-3">
                        {user ? <span className="flex items-center gap-1 text-xs" style={{ color: SC.primary }}><UserCheck size={12} /> {user.username}</span> : <span className="text-gray-400 text-xs">Not linked</span>}
                      </td>
                      <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${emp.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{emp.isActive ? "Active" : "Inactive"}</span></td>
                      <td className="px-5 py-3"><div className="flex gap-2 justify-end">
                        <button onClick={() => { setEditing(emp); setShowForm(true); }} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" data-testid={`button-edit-${emp.id}`}><Edit size={15} /></button>
                        <button onClick={() => { if (confirm("Delete?")) del.mutate(emp.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`button-delete-${emp.id}`}><Trash2 size={15} /></button>
                      </div></td>
                    </tr>
                  );
                }) : <tr><td colSpan={8} className="px-5 py-12 text-center text-gray-400">No employees found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && <EmployeeForm initial={editing} users={users} onClose={() => setShowForm(false)} />}
    </div>
  );
}
