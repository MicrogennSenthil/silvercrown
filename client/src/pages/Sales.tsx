import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Trash2, Edit, X, Loader2 } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700" };
const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
const EMPTY_ITEM = { description: "", quantity: 1, unit: "Nos", unitPrice: 0, taxRate: 18, taxAmount: 0, amount: 0 };
const EMPTY_INV = { invoiceNumber: "", customerName: "", invoiceDate: new Date().toISOString().split("T")[0], dueDate: "", status: "draft", notes: "", subtotal: "0", taxAmount: "0", totalAmount: "0" };

function SalesForm({ initial, items: initItems, onClose }: any) {
  const [form, setForm] = useState({ ...EMPTY_INV, ...initial });
  const [items, setItems] = useState<any[]>(initItems?.length ? initItems : [{ ...EMPTY_ITEM }]);
  const qc = useQueryClient();
  const { data: customers = [] } = useQuery<any[]>({ queryKey: ["/api/customers"] });

  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      const url = initial?.id ? `/api/sales/invoices/${initial.id}` : "/api/sales/invoices";
      const res = await fetch(url, { method: initial?.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/sales/invoices"] }); onClose(); }
  });

  function calcItem(item: any) {
    const qty = Number(item.quantity) || 0, price = Number(item.unitPrice) || 0, tax = Number(item.taxRate) || 0;
    const sub = qty * price, taxAmt = sub * tax / 100;
    return { ...item, taxAmount: taxAmt.toFixed(2), amount: (sub + taxAmt).toFixed(2) };
  }

  function updateItem(idx: number, field: string, value: any) {
    const updated = items.map((it, i) => i === idx ? calcItem({ ...it, [field]: value }) : it);
    setItems(updated);
    const sub = updated.reduce((s, it) => s + Number(it.quantity) * Number(it.unitPrice), 0);
    const tax = updated.reduce((s, it) => s + Number(it.taxAmount || 0), 0);
    setForm((f: any) => ({ ...f, subtotal: sub.toFixed(2), taxAmount: tax.toFixed(2), totalAmount: (sub + tax).toFixed(2) }));
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-auto">
      <div className="bg-white rounded-xl w-full max-w-4xl my-4" style={{ boxShadow: "2px 2px 4px 2px rgba(0,0,0,0.3)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#b8d2da" }}>
          <h2 className="text-lg font-bold" style={{ color: SC.primary }}>{initial?.id ? "Edit" : "New"} Sales Invoice</h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {[["Invoice Number *", "invoiceNumber"], ["Invoice Date *", "invoiceDate", "date"], ["Due Date", "dueDate", "date"], ["Notes", "notes"]].map(([label, name, type = "text"]) => (
              <div key={name}>
                <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>{label}</label>
                <input type={type} value={form[name] || ""} onChange={e => setForm((f: any) => ({ ...f, [name]: e.target.value }))}
                  className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid={`input-${name}`} />
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Customer</label>
              <select value={form.customerId || ""} onChange={e => {
                const cust = customers.find((c: any) => c.id === e.target.value);
                setForm((f: any) => ({ ...f, customerId: e.target.value, customerName: cust?.name || "" }));
              }} className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="select-customer">
                <option value="">Select customer or type below</option>
                {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Customer Name</label>
              <input value={form.customerName || ""} onChange={e => setForm((f: any) => ({ ...f, customerName: e.target.value }))}
                className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="input-customerName" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Status</label>
              <select value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}
                className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="select-status">
                {["draft", "pending", "approved", "paid", "cancelled"].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">Line Items</h3>
              <button onClick={() => setItems(i => [...i, { ...EMPTY_ITEM }])}
                className="flex items-center gap-1 text-sm px-3 py-1.5 rounded text-white" style={{ background: SC.primary }} data-testid="button-add-item">
                <Plus size={14} /> Add Item
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead><tr style={{ background: "#d2f1fa" }}>
                  <th className="text-left px-3 py-2 font-semibold text-gray-600 min-w-[160px]">Description</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 w-16">Qty</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 w-16">Unit</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 w-24">Unit Price</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 w-16">Tax%</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 w-24">Amount</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr></thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      {["description", "quantity", "unit", "unitPrice", "taxRate"].map(field => (
                        <td key={field} className="px-1 py-1">
                          <input type={["quantity", "unitPrice", "taxRate"].includes(field) ? "number" : "text"} value={item[field]}
                            onChange={e => updateItem(idx, field, e.target.value)}
                            className="w-full border rounded px-2 py-1 text-sm focus:outline-none" style={{ borderColor: "#00000030" }} />
                        </td>
                      ))}
                      <td className="px-3 py-1 font-semibold text-right">{Number(item.amount || 0).toFixed(2)}</td>
                      <td className="px-1 py-1"><button onClick={() => setItems(i => i.filter((_, j) => j !== idx))} className="p-1 text-red-400 hover:text-red-600"><X size={12} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-3">
              <div className="text-sm space-y-1 min-w-[200px]">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal:</span><span>{fmt(Number(form.subtotal))}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Tax:</span><span>{fmt(Number(form.taxAmount))}</span></div>
                <div className="flex justify-between border-t pt-1 font-bold text-base" style={{ borderColor: "#b8d2da" }}><span>Total:</span><span style={{ color: SC.orange }}>{fmt(Number(form.totalAmount))}</span></div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-5 py-2 rounded border text-sm" style={{ borderColor: "#00000030" }}>Cancel</button>
          <button onClick={() => saveMut.mutate({ ...form, items })} disabled={saveMut.isPending}
            className="px-5 py-2 rounded text-white text-sm font-medium flex items-center gap-2" style={{ background: SC.orange }} data-testid="button-save-invoice">
            {saveMut.isPending && <Loader2 size={14} className="animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sales() {
  const [search, setSearch] = useState(""); const [showForm, setShowForm] = useState(false); const [editing, setEditing] = useState<any>(null); const [editItems, setEditItems] = useState<any[]>([]);
  const qc = useQueryClient();
  const { data: invoices = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/sales/invoices"] });
  const del = useMutation({ mutationFn: (id: string) => fetch(`/api/sales/invoices/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()), onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/sales/invoices"] }) });

  async function handleEdit(inv: any) {
    const res = await fetch(`/api/sales/invoices/${inv.id}`, { credentials: "include" });
    const full = await res.json(); setEditing(full); setEditItems(full.items || []); setShowForm(true);
  }

  const filtered = invoices.filter(i => i.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) || i.customerName?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-800">Sales Invoices</h1><p className="text-sm text-gray-500 mt-0.5">Manage outgoing sales invoices</p></div>
        <button onClick={() => { setEditing(null); setEditItems([]); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }} data-testid="button-new-invoice">
          <Plus size={16} /> New Invoice
        </button>
      </div>
      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="relative max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..."
              className="w-full pl-9 pr-3 py-2 border rounded text-sm focus:outline-none" style={{ borderColor: "#00000030" }} data-testid="input-search" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ background: "#d2f1fa" }}>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Invoice No.</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Customer</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Date</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Amount</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
              <th className="px-5 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? [...Array(3)].map((_, i) => <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>) :
                filtered.length ? filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium" style={{ color: SC.primary }}>{inv.invoiceNumber}</td>
                    <td className="px-5 py-3 text-gray-600">{inv.customerName || "—"}</td>
                    <td className="px-5 py-3 text-gray-500">{inv.invoiceDate}</td>
                    <td className="px-5 py-3 text-right font-semibold">{fmt(Number(inv.totalAmount))}</td>
                    <td className="px-5 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${inv.status === "paid" ? "bg-green-100 text-green-700" : inv.status === "approved" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-700"}`}>{inv.status}</span></td>
                    <td className="px-5 py-3"><div className="flex items-center gap-2 justify-end">
                      <button onClick={() => handleEdit(inv)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" data-testid={`button-edit-${inv.id}`}><Edit size={15} /></button>
                      <button onClick={() => { if (confirm("Delete?")) del.mutate(inv.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`button-delete-${inv.id}`}><Trash2 size={15} /></button>
                    </div></td>
                  </tr>
                )) : <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">No invoices found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && <SalesForm initial={editing} items={editItems} onClose={() => setShowForm(false)} />}
    </div>
  );
}
