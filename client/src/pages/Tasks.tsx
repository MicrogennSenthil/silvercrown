import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Edit, X, Loader2, Bell, CheckCircle, Clock, User, Tag, Settings } from "lucide-react";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700" };
const PRIORITY_COLORS: Record<string, string> = { low: "bg-gray-100 text-gray-600", medium: "bg-yellow-100 text-yellow-700", high: "bg-red-100 text-red-700" };
const STATUS_COLORS: Record<string, string> = { pending: "bg-blue-100 text-blue-700", in_progress: "bg-orange-100 text-orange-700", completed: "bg-green-100 text-green-700", cancelled: "bg-gray-100 text-gray-500" };
const EMPTY = { title: "", description: "", dueDate: "", dueTime: "", priority: "medium" as any, status: "pending" as any, category: "", isReminder: false, reminderDate: "", assignedEmployeeId: "" };

// ── Category Manager (mini modal) ────────────────────────────────────────────
function CategoryManager({ onClose }: { onClose: () => void }) {
  const [newName, setNewName] = useState("");
  const qc = useQueryClient();
  const { data: cats = [] } = useQuery<any[]>({ queryKey: ["/api/task-categories"] });
  const addMut = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/task-categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }), credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/task-categories"] }); setNewName(""); },
  });
  const delMut = useMutation({
    mutationFn: async (id: string) => fetch(`/api/task-categories/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/task-categories"] }),
  });
  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-sm" style={{ boxShadow: "2px 2px 4px 2px rgba(0,0,0,0.3)" }}>
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "#b8d2da" }}>
          <h3 className="font-bold text-sm" style={{ color: SC.primary }}>Manage Task Categories</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div className="flex gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && newName.trim()) addMut.mutate(newName.trim()); }}
              placeholder="New category name…"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#027fa5]" />
            <button onClick={() => { if (newName.trim()) addMut.mutate(newName.trim()); }}
              disabled={addMut.isPending || !newName.trim()}
              className="px-3 py-2 rounded text-white text-sm font-medium disabled:opacity-40"
              style={{ background: SC.primary }}>
              {addMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            </button>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {(cats as any[]).length === 0 && <p className="text-xs text-gray-400 text-center py-3">No categories yet. Add one above.</p>}
            {(cats as any[]).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded bg-gray-50 hover:bg-[#d2f1fa] group">
                <span className="text-sm text-gray-700">{c.name}</span>
                <button onClick={() => delMut.mutate(c.id)}
                  className="p-1 text-red-400 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Task Form ─────────────────────────────────────────────────────────────────
function TaskForm({ initial, onClose }: any) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const [showCatMgr, setShowCatMgr] = useState(false);
  const qc = useQueryClient();

  // Task categories come from the existing categories master + any task-specific ones
  const { data: invCategories = [] } = useQuery<any[]>({ queryKey: ["/api/categories"] });
  const { data: taskCats = [] } = useQuery<any[]>({ queryKey: ["/api/task-categories"] });
  // Merge: task-specific categories first, then inventory categories (de-duped by name)
  const catNames = new Set((taskCats as any[]).map((c: any) => c.name.toLowerCase()));
  const categories = [
    ...(taskCats as any[]),
    ...(invCategories as any[]).filter((c: any) => !catNames.has(c.name.toLowerCase())),
  ];

  // Assigned To: prefer employees master; fall back to users master if employees empty
  const { data: employees = [] } = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const { data: users = [] } = useQuery<any[]>({ queryKey: ["/api/users"] });
  // Use employees if populated, otherwise fall back to users
  const assignees = (employees as any[]).length > 0 ? (employees as any[]) : (users as any[]);

  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      const url = initial?.id ? `/api/tasks/${initial.id}` : "/api/tasks";
      const res = await fetch(url, {
        method: initial?.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/tasks"] }); onClose(); },
  });

  const set = (key: string, val: any) => setForm((f: any) => ({ ...f, [key]: val }));

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-auto">
        <div className="bg-white rounded-xl w-full max-w-lg my-4" style={{ boxShadow: "2px 2px 4px 2px rgba(0,0,0,0.3)" }}>
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#b8d2da" }}>
            <h2 className="text-lg font-bold" style={{ color: SC.primary }}>
              {initial?.id ? "Edit" : "New"} {form.isReminder ? "Reminder" : "Task"}
            </h2>
            <button onClick={onClose} className="p-2 rounded hover:bg-gray-100"><X size={18} /></button>
          </div>

          <div className="p-6 space-y-4">
            {/* Task / Reminder toggle */}
            <div className="flex gap-3">
              {[{ label: "Task", val: false }, { label: "Reminder", val: true }].map(opt => (
                <button key={String(opt.val)} onClick={() => set("isReminder", opt.val)}
                  className={`px-4 py-2 rounded text-sm font-medium transition-colors ${form.isReminder === opt.val ? "text-white" : "text-gray-600 border"}`}
                  style={form.isReminder === opt.val ? { background: SC.primary } : { borderColor: "#00000030" }}>
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600">Title *</label>
              <input value={form.title} onChange={e => set("title", e.target.value)}
                className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#027fa5]"
                style={{ borderColor: "#00000040" }} placeholder="Task title…" data-testid="input-title" />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1 text-gray-600">Description</label>
              <textarea value={form.description} onChange={e => set("description", e.target.value)}
                className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#027fa5]"
                style={{ borderColor: "#00000040" }} rows={2} data-testid="input-description" />
            </div>

            {/* Category + Assigned To — side by side */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-600">Category</label>
                  <button onClick={() => setShowCatMgr(true)}
                    className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-[#027fa5] transition-colors">
                    <Settings size={10} /> Manage
                  </button>
                </div>
                <select value={form.category} onChange={e => set("category", e.target.value)}
                  className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#027fa5]"
                  style={{ borderColor: "#00000040" }} data-testid="select-category">
                  <option value="">— Select Category —</option>
                  {(categories as any[]).map((c: any) => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-600">Assigned To</label>
                <select value={form.assignedEmployeeId || ""} onChange={e => {
                    const selected = assignees.find((a: any) => a.id === e.target.value);
                    set("assignedEmployeeId", e.target.value);
                    set("assignedName", selected ? (selected.name || selected.username || "") : "");
                  }}
                  className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#027fa5]"
                  style={{ borderColor: "#00000040" }} data-testid="select-assigned-to">
                  <option value="">— Unassigned —</option>
                  {assignees.map((a: any) => (
                    <option key={a.id} value={a.id}>
                      {a.name || a.username}{(a.employeeCode || a.employee_code) ? ` (${a.employeeCode || a.employee_code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due Date + Due Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-600">Due Date</label>
                <DatePicker value={form.dueDate || ""} onChange={v => set("dueDate", v)} data-testid="input-dueDate" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-600">Due Time</label>
                <input type="time" value={form.dueTime || ""} onChange={e => set("dueTime", e.target.value)}
                  className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#027fa5]"
                  style={{ borderColor: "#00000040" }} data-testid="input-dueTime" />
              </div>
            </div>

            {/* Priority + Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-600">Priority</label>
                <select value={form.priority} onChange={e => set("priority", e.target.value)}
                  className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#027fa5]"
                  style={{ borderColor: "#00000040" }} data-testid="select-priority">
                  {["low", "medium", "high"].map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-600">Status</label>
                <select value={form.status} onChange={e => set("status", e.target.value)}
                  className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#027fa5]"
                  style={{ borderColor: "#00000040" }} data-testid="select-status">
                  {["pending", "in_progress", "completed", "cancelled"].map(s => (
                    <option key={s} value={s}>{s.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reminder Date */}
            {form.isReminder && (
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-600">Reminder Date</label>
                <DatePicker value={form.reminderDate || ""} onChange={v => set("reminderDate", v)} data-testid="input-reminderDate" />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
            <button onClick={onClose} className="px-5 py-2 rounded border text-sm" style={{ borderColor: "#00000030" }}>Cancel</button>
            <button onClick={() => saveMut.mutate(form)} disabled={saveMut.isPending || !form.title.trim()}
              className="px-5 py-2 rounded text-white text-sm font-medium flex items-center gap-2 disabled:opacity-40"
              style={{ background: SC.orange }} data-testid="button-save-task">
              {saveMut.isPending && <Loader2 size={14} className="animate-spin" />} Save
            </button>
          </div>
        </div>
      </div>
      {showCatMgr && <CategoryManager onClose={() => setShowCatMgr(false)} />}
    </>
  );
}

// ── Tasks Page ────────────────────────────────────────────────────────────────
export default function Tasks() {
  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "reminders">("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const qc = useQueryClient();
  const { data: tasks = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/tasks"] });

  const del = useMutation({
    mutationFn: (id: string) => fetch(`/api/tasks/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });
  const complete = useMutation({
    mutationFn: (id: string) => fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "completed" }), credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/tasks"] }),
  });

  const today = new Date().toISOString().slice(0, 10);
  const filtered = (tasks as any[]).filter(t => {
    if (filter === "pending") return t.status === "pending" || t.status === "in_progress";
    if (filter === "completed") return t.status === "completed";
    if (filter === "reminders") return t.is_reminder || t.isReminder;
    return true;
  });
  const overdueCount = (tasks as any[]).filter(t =>
    t.status !== "completed" && t.status !== "cancelled" &&
    (t.due_date || t.dueDate) && (t.due_date || t.dueDate) < today
  ).length;

  const counts = {
    all: tasks.length,
    pending: (tasks as any[]).filter(t => t.status === "pending" || t.status === "in_progress").length,
    completed: (tasks as any[]).filter(t => t.status === "completed").length,
    reminders: (tasks as any[]).filter(t => t.is_reminder || t.isReminder).length,
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tasks & Reminders</h1>
          <p className="text-sm text-gray-500 mt-0.5">Assign and track tasks across employees</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium"
          style={{ background: SC.orange }} data-testid="button-new-task">
          <Plus size={16} /> New Task
        </button>
      </div>

      {/* Overdue alert banner */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <Clock size={16} className="text-red-500 shrink-0" />
          <span><strong>{overdueCount} task{overdueCount > 1 ? "s are" : " is"} overdue</strong> — shown on the dashboard reminder panel.</span>
          <button onClick={() => setFilter("pending")} className="ml-auto text-xs underline text-red-600 hover:text-red-800">View pending</button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([["all", "All Tasks", "text-gray-700"], ["pending", "Pending", "text-yellow-600"], ["completed", "Completed", "text-green-600"], ["reminders", "Reminders", "text-blue-600"]] as const).map(([key, label, color]) => (
          <button key={key} onClick={() => setFilter(key)}
            className={`bg-white rounded-xl p-4 text-left transition-all ${filter === key ? "ring-2 ring-[#027fa5] ring-offset-1" : "hover:shadow-md"}`}
            style={{ boxShadow: "1px 1px 2px rgba(0,0,0,0.1)" }}
            data-testid={`filter-${key}`}>
            <div className={`text-2xl font-bold ${color}`}>{counts[key]}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </button>
        ))}
      </div>

      {/* Task list */}
      <div className="space-y-3">
        {isLoading
          ? [...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-xl animate-pulse" style={{ boxShadow: "1px 1px 2px rgba(0,0,0,0.1)" }} />
          ))
          : filtered.length
          ? filtered.map((task: any) => {
            const dueDate = task.due_date || task.dueDate || "";
            const isOverdue = dueDate && dueDate < today && task.status !== "completed" && task.status !== "cancelled";
            const assigneeName = task.assigned_employee_name || "";
            return (
              <div key={task.id}
                className={`bg-white rounded-xl p-4 flex items-start gap-4 transition-colors
                  ${task.status === "completed" ? "opacity-60" : ""}
                  ${isOverdue ? "border-l-4 border-red-400" : ""}`}
                style={{ boxShadow: "1px 1px 2px rgba(0,0,0,0.1)" }}>
                {/* Complete toggle */}
                <button onClick={() => task.status !== "completed" && complete.mutate(task.id)}
                  className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors
                    ${task.status === "completed" ? "bg-green-500 border-green-500" : "border-gray-300 hover:border-green-400"}`}
                  data-testid={`button-complete-${task.id}`}>
                  {task.status === "completed" && <CheckCircle size={12} className="text-white" />}
                </button>

                <div className="flex-1 min-w-0">
                  {/* Top row */}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className={`font-medium text-gray-800 ${task.status === "completed" ? "line-through text-gray-400" : ""}`}>
                      {task.title}
                      {isOverdue && <span className="ml-2 text-xs text-red-500 font-normal">(overdue)</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {(task.is_reminder || task.isReminder) && (
                        <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          <Bell size={10} /> Reminder
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[task.priority] || ""}`}>
                        {task.priority}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[task.status] || ""}`}>
                        {task.status?.replace("_", " ")}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  {task.description && (
                    <div className="text-sm text-gray-500 mt-1">{task.description}</div>
                  )}

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">
                    {dueDate && (
                      <span className={`flex items-center gap-1 ${isOverdue ? "text-red-500 font-semibold" : ""}`}>
                        <Clock size={11} /> {dueDate}{(task.due_time || task.dueTime) ? ` ${task.due_time || task.dueTime}` : ""}
                      </span>
                    )}
                    {(task.category) && (
                      <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded-full">
                        <Tag size={9} /> {task.category}
                      </span>
                    )}
                    {assigneeName && (
                      <span className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                        <User size={9} /> {assigneeName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => { setEditing(task); setShowForm(true); }}
                    className="p-1.5 rounded hover:bg-blue-50 text-blue-400"
                    data-testid={`button-edit-${task.id}`}><Edit size={14} /></button>
                  <button onClick={() => { if (confirm("Delete this task?")) del.mutate(task.id); }}
                    className="p-1.5 rounded hover:bg-red-50 text-red-400"
                    data-testid={`button-delete-${task.id}`}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })
          : (
            <div className="text-center py-12 text-gray-400">
              No {filter === "all" ? "" : filter} tasks found
            </div>
          )}
      </div>

      {showForm && <TaskForm initial={editing} onClose={() => setShowForm(false)} />}
    </div>
  );
}
