import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit, X, Loader2, Bell, CheckCircle, Clock, AlertCircle } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700" };
const PRIORITY_COLORS: Record<string, string> = { low: "bg-gray-100 text-gray-600", medium: "bg-yellow-100 text-yellow-700", high: "bg-red-100 text-red-700" };
const STATUS_COLORS: Record<string, string> = { pending: "bg-blue-100 text-blue-700", in_progress: "bg-orange-100 text-orange-700", completed: "bg-green-100 text-green-700", cancelled: "bg-gray-100 text-gray-500" };
const EMPTY = { title: "", description: "", dueDate: "", dueTime: "", priority: "medium" as any, status: "pending" as any, category: "general", isReminder: false, reminderDate: "" };

function TaskForm({ initial, onClose }: any) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const qc = useQueryClient();
  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      const url = initial?.id ? `/api/tasks/${initial.id}` : "/api/tasks";
      const res = await fetch(url, { method: initial?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/tasks"] }); onClose(); }
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg" style={{ boxShadow: "2px 2px 4px 2px rgba(0,0,0,0.3)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#b8d2da" }}>
          <h2 className="text-lg font-bold" style={{ color: SC.primary }}>{initial?.id ? "Edit" : "New"} {form.isReminder ? "Reminder" : "Task"}</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex gap-4">
            {[{ label: "Task", val: false }, { label: "Reminder", val: true }].map(opt => (
              <button key={String(opt.val)} onClick={() => setForm((f: any) => ({ ...f, isReminder: opt.val }))}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${form.isReminder === opt.val ? "text-white" : "text-gray-600 border"}`}
                style={form.isReminder === opt.val ? { background: SC.primary } : { borderColor: "#00000030" }}>{opt.label}</button>
            ))}
          </div>
          {[["Title *", "title"], ["Description", "description"], ["Category", "category"]].map(([label, key]) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>{label}</label>
              {key === "description" ?
                <textarea value={form[key] || ""} onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
                  className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} rows={2} data-testid={`input-${key}`} /> :
                <input value={form[key] || ""} onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
                  className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid={`input-${key}`} />}
            </div>
          ))}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Due Date</label>
              <input type="date" value={form.dueDate || ""} onChange={e => setForm((f: any) => ({ ...f, dueDate: e.target.value }))}
                className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="input-dueDate" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Due Time</label>
              <input type="time" value={form.dueTime || ""} onChange={e => setForm((f: any) => ({ ...f, dueTime: e.target.value }))}
                className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="input-dueTime" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Priority</label>
              <select value={form.priority} onChange={e => setForm((f: any) => ({ ...f, priority: e.target.value }))}
                className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="select-priority">
                {["low", "medium", "high"].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Status</label>
              <select value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}
                className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="select-status">
                {["pending", "in_progress", "completed", "cancelled"].map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
          </div>
          {form.isReminder && (
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Reminder Date</label>
              <input type="date" value={form.reminderDate || ""} onChange={e => setForm((f: any) => ({ ...f, reminderDate: e.target.value }))}
                className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="input-reminderDate" />
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-5 py-2 rounded border text-sm" style={{ borderColor: "#00000030" }}>Cancel</button>
          <button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending}
            className="px-5 py-2 rounded text-white text-sm font-medium flex items-center gap-2" style={{ background: SC.orange }} data-testid="button-save-task">
            {saveMut.isPending && <Loader2 size={14} className="animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Tasks() {
  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "reminders">("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const qc = useQueryClient();
  const { data: tasks = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/tasks"] });

  const del = useMutation({ mutationFn: (id: string) => fetch(`/api/tasks/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/tasks"] }) });
  const complete = useMutation({ mutationFn: (id: string) => fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }), credentials: "include" }).then(r => r.json()), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/tasks"] }) });

  const filtered = tasks.filter(t => {
    if (filter === "pending") return t.status === "pending" || t.status === "in_progress";
    if (filter === "completed") return t.status === "completed";
    if (filter === "reminders") return t.isReminder;
    return true;
  });

  const counts = { all: tasks.length, pending: tasks.filter(t => t.status === "pending" || t.status === "in_progress").length, completed: tasks.filter(t => t.status === "completed").length, reminders: tasks.filter(t => t.isReminder).length };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-800">Tasks & Reminders</h1><p className="text-sm text-gray-500 mt-0.5">Manage your tasks and set reminders</p></div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }} data-testid="button-new-task">
          <Plus size={16} /> New Task
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([["all", "All", "text-gray-700"], ["pending", "Pending", "text-yellow-600"], ["completed", "Completed", "text-green-600"], ["reminders", "Reminders", "text-blue-600"]] as const).map(([key, label, color]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`bg-white rounded-xl p-4 text-left transition-all ${filter === key ? "ring-2 ring-offset-1" : "hover:shadow-md"}`}
            style={{ boxShadow: "1px 1px 2px rgba(0,0,0,0.1)", ...(filter === key ? { ringColor: SC.primary } : {}) }}
            data-testid={`filter-${key}`}>
            <div className={`text-2xl font-bold ${color}`}>{counts[key]}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-3">
        {isLoading ? [...Array(4)].map((_, i) => <div key={i} className="h-20 bg-white rounded-xl animate-pulse" style={{ boxShadow: "1px 1px 2px rgba(0,0,0,0.1)" }} />) :
          filtered.length ? filtered.map(task => (
            <div key={task.id} className={`bg-white rounded-xl p-4 flex items-start gap-4 transition-colors ${task.status === "completed" ? "opacity-70" : ""}`}
              style={{ boxShadow: "1px 1px 2px rgba(0,0,0,0.1)" }}>
              <button onClick={() => task.status !== "completed" && complete.mutate(task.id)}
                className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${task.status === "completed" ? "bg-green-500 border-green-500" : "border-gray-300 hover:border-green-400"}`}
                data-testid={`button-complete-${task.id}`}>
                {task.status === "completed" && <CheckCircle size={12} className="text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className={`font-medium text-gray-800 ${task.status === "completed" ? "line-through text-gray-400" : ""}`}>{task.title}</div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {task.isReminder && <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full"><Bell size={10} /> Reminder</span>}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[task.status]}`}>{task.status.replace("_", " ")}</span>
                  </div>
                </div>
                {task.description && <div className="text-sm text-gray-500 mt-1">{task.description}</div>}
                <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">
                  {task.dueDate && <span className="flex items-center gap-1"><Clock size={11} /> {task.dueDate}{task.dueTime ? ` ${task.dueTime}` : ""}</span>}
                  {task.category && <span className="bg-gray-100 px-2 py-0.5 rounded-full">{task.category}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => { setEditing(task); setShowForm(true); }} className="p-1.5 rounded hover:bg-blue-50 text-blue-400" data-testid={`button-edit-${task.id}`}><Edit size={14} /></button>
                <button onClick={() => { if (confirm("Delete?")) del.mutate(task.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`button-delete-${task.id}`}><Trash2 size={14} /></button>
              </div>
            </div>
          )) : <div className="text-center py-12 text-gray-400">No {filter === "all" ? "" : filter} tasks found</div>}
      </div>

      {showForm && <TaskForm initial={editing} onClose={() => setShowForm(false)} />}
    </div>
  );
}
