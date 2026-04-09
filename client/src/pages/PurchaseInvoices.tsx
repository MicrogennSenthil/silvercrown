import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Scan, Trash2, Eye, X, Upload, Loader2, Edit } from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700", bg: "#f5f0ed" };

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

const EMPTY_ITEM = { description: "", quantity: 1, unit: "Nos", unitPrice: 0, taxRate: 18, taxAmount: 0, amount: 0 };
const EMPTY_INV = { invoiceNumber: "", supplierName: "", invoiceDate: new Date().toISOString().split("T")[0], dueDate: "", status: "draft", notes: "", subtotal: 0, taxAmount: 0, totalAmount: 0 };

function InvoiceForm({ initial, items: initItems, onSave, onClose }: any) {
  const [form, setForm] = useState({ ...EMPTY_INV, ...initial });
  const [items, setItems] = useState<any[]>(initItems?.length ? initItems.map((i: any) => ({ ...EMPTY_ITEM, ...i })) : [{ ...EMPTY_ITEM }]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const saveMut = useMutation({
    mutationFn: async (data: any) => {
      const url = initial?.id ? `/api/purchase/invoices/${initial.id}` : "/api/purchase/invoices";
      const method = initial?.id ? "PATCH" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message);
      return res.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/purchase/invoices"] }); onClose(); }
  });

  function calcItem(item: any) {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const taxRate = Number(item.taxRate) || 0;
    const subtotal = qty * price;
    const taxAmount = subtotal * taxRate / 100;
    return { ...item, taxAmount: taxAmount.toFixed(2), amount: (subtotal + taxAmount).toFixed(2) };
  }

  function updateItem(idx: number, field: string, value: any) {
    const updated = items.map((it, i) => i === idx ? calcItem({ ...it, [field]: value }) : it);
    setItems(updated);
    const subtotal = updated.reduce((s, it) => s + (Number(it.quantity) * Number(it.unitPrice)), 0);
    const tax = updated.reduce((s, it) => s + Number(it.taxAmount || 0), 0);
    setForm((f: any) => ({ ...f, subtotal: subtotal.toFixed(2), taxAmount: tax.toFixed(2), totalAmount: (subtotal + tax).toFixed(2) }));
  }

  async function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setScanning(true); setScanError("");
    try {
      const fd = new FormData(); fd.append("invoice", file);
      const res = await fetch("/api/purchase/scan", { method: "POST", body: fd, credentials: "include" });
      if (!res.ok) { const err = await res.json(); throw new Error(err.message); }
      const data = await res.json();
      setForm((f: any) => ({ ...f, supplierName: data.supplierName || f.supplierName, invoiceNumber: data.invoiceNumber || f.invoiceNumber, invoiceDate: data.invoiceDate || f.invoiceDate, dueDate: data.dueDate || f.dueDate, notes: data.notes || f.notes }));
      if (data.items?.length) {
        const mapped = data.items.map((it: any) => calcItem({ ...EMPTY_ITEM, ...it }));
        setItems(mapped);
        const subtotal = mapped.reduce((s: number, it: any) => s + (Number(it.quantity) * Number(it.unitPrice)), 0);
        const tax = mapped.reduce((s: number, it: any) => s + Number(it.taxAmount || 0), 0);
        setForm((f: any) => ({ ...f, subtotal: subtotal.toFixed(2), taxAmount: tax.toFixed(2), totalAmount: (subtotal + tax).toFixed(2) }));
      }
    } catch (err: any) { setScanError(err.message || "Scan failed"); }
    finally { setScanning(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  function submit() {
    saveMut.mutate({ ...form, items });
  }

  const F = ({ label, name, type = "text", required = false, half = false }: any) => (
    <div className={half ? "col-span-1" : "col-span-2"}>
      <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>{label}</label>
      <input type={type} value={form[name] || ""} onChange={e => setForm((f: any) => ({ ...f, [name]: e.target.value }))} required={required}
        className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-colors" style={{ borderColor: "#00000040", color: "#000000cc" }}
        data-testid={`input-${name}`} />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-auto">
      <div className="bg-white rounded-xl w-full max-w-4xl my-4" style={{ boxShadow: "2px 2px 4px 2px rgba(0,0,0,0.3)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#b8d2da" }}>
          <h2 className="text-lg font-bold" style={{ color: "#027fa5" }}>{initial?.id ? "Edit" : "New"} Purchase Invoice</h2>
          <div className="flex items-center gap-3">
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleScan} />
            <button onClick={() => fileRef.current?.click()} disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium transition-colors" style={{ background: "#f96a0b" }}
              data-testid="button-scan-invoice">
              {scanning ? <Loader2 size={16} className="animate-spin" /> : <Scan size={16} />}
              {scanning ? "Scanning..." : "Scan Invoice (AI)"}
            </button>
            <button onClick={onClose} className="p-2 rounded hover:bg-gray-100"><X size={18} /></button>
          </div>
        </div>

        {scanError && <div className="mx-6 mt-4 px-4 py-3 bg-red-50 text-red-600 rounded text-sm">{scanError}</div>}

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <F label="Invoice Number *" name="invoiceNumber" required half />
            <F label="Supplier Name" name="supplierName" half />
            <F label="Invoice Date *" name="invoiceDate" type="date" required half />
            <F label="Due Date" name="dueDate" type="date" half />
            <div className="col-span-1">
              <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Status</label>
              <select value={form.status} onChange={e => setForm((f: any) => ({ ...f, status: e.target.value }))}
                className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="select-status">
                {["draft", "pending", "approved", "paid", "cancelled"].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div className="col-span-1">
              <label className="block text-sm font-medium mb-1" style={{ color: "#5b5e66" }}>Notes</label>
              <input value={form.notes || ""} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))}
                className="w-full border-2 rounded px-3 py-2 text-sm focus:outline-none" style={{ borderColor: "#00000040" }} data-testid="input-notes" />
            </div>
          </div>

          {/* Line Items */}
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
                <thead><tr className="text-left" style={{ background: "#d2f1fa" }}>
                  <th className="px-3 py-2 font-semibold text-gray-600 min-w-[180px]">Description</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 w-20">Qty</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 w-20">Unit</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 w-28">Unit Price</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 w-20">Tax %</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 w-28">Tax Amt</th>
                  <th className="px-3 py-2 font-semibold text-gray-600 w-28">Amount</th>
                  <th className="px-3 py-2 w-10"></th>
                </tr></thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-100">
                      <td className="px-1 py-1"><input value={item.description} onChange={e => updateItem(idx, "description", e.target.value)} className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400" style={{ borderColor: "#00000030" }} /></td>
                      <td className="px-1 py-1"><input type="number" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400" style={{ borderColor: "#00000030" }} /></td>
                      <td className="px-1 py-1"><input value={item.unit} onChange={e => updateItem(idx, "unit", e.target.value)} className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400" style={{ borderColor: "#00000030" }} /></td>
                      <td className="px-1 py-1"><input type="number" value={item.unitPrice} onChange={e => updateItem(idx, "unitPrice", e.target.value)} className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400" style={{ borderColor: "#00000030" }} /></td>
                      <td className="px-1 py-1"><input type="number" value={item.taxRate} onChange={e => updateItem(idx, "taxRate", e.target.value)} className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400" style={{ borderColor: "#00000030" }} /></td>
                      <td className="px-3 py-1 text-gray-600 text-right">{Number(item.taxAmount || 0).toFixed(2)}</td>
                      <td className="px-3 py-1 font-semibold text-right">{Number(item.amount || 0).toFixed(2)}</td>
                      <td className="px-1 py-1 text-center"><button onClick={() => setItems(i => i.filter((_, j) => j !== idx))} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-4">
              <div className="text-sm space-y-1 min-w-[220px]">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal:</span><span className="font-medium">{fmt(Number(form.subtotal))}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Tax:</span><span className="font-medium">{fmt(Number(form.taxAmount))}</span></div>
                <div className="flex justify-between border-t pt-1 text-base font-bold" style={{ borderColor: "#b8d2da" }}><span>Total:</span><span style={{ color: SC.orange }}>{fmt(Number(form.totalAmount))}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-5 py-2 rounded border text-sm font-medium" style={{ borderColor: "#00000030" }}>Cancel</button>
          <button onClick={submit} disabled={saveMut.isPending}
            className="px-5 py-2 rounded text-white text-sm font-medium flex items-center gap-2" style={{ background: SC.orange }}
            data-testid="button-save-invoice">
            {saveMut.isPending && <Loader2 size={14} className="animate-spin" />}
            {initial?.id ? "Update" : "Save"} Invoice
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PurchaseInvoices() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [editItems, setEditItems] = useState<any[]>([]);
  const qc = useQueryClient();
  const { data: invoices = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/purchase/invoices"] });

  const deleteMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/purchase/invoices/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/purchase/invoices"] })
  });

  async function handleEdit(inv: any) {
    const res = await fetch(`/api/purchase/invoices/${inv.id}`, { credentials: "include" });
    const full = await res.json();
    setEditing(full); setEditItems(full.items || []); setShowForm(true);
  }

  const filtered = invoices.filter(i =>
    i.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
    i.supplierName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Purchase Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage incoming invoices — scan with AI</p>
        </div>
        <button onClick={() => { setEditing(null); setEditItems([]); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded text-white text-sm font-medium" style={{ background: SC.orange }}
          data-testid="button-new-invoice">
          <Plus size={16} /> New Invoice
        </button>
      </div>

      <div className="bg-white rounded-xl overflow-hidden" style={{ boxShadow: "1px 1px 2px 2px rgba(0,0,0,0.1)" }}>
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="relative max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search invoices..."
              className="w-full pl-9 pr-3 py-2 border rounded text-sm focus:outline-none focus:border-blue-400" style={{ borderColor: "#00000030" }}
              data-testid="input-search" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr style={{ background: "#d2f1fa" }}>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Invoice No.</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Supplier</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Date</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Due Date</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Amount</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
              <th className="px-5 py-3"></th>
            </tr></thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading ? [...Array(4)].map((_, i) => <tr key={i}><td colSpan={7} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>) :
                filtered.length ? filtered.map(inv => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium" style={{ color: SC.primary }}>{inv.invoiceNumber}</td>
                    <td className="px-5 py-3 text-gray-600">{inv.supplierName || "—"}</td>
                    <td className="px-5 py-3 text-gray-500">{inv.invoiceDate}</td>
                    <td className="px-5 py-3 text-gray-500">{inv.dueDate || "—"}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-800">{fmt(Number(inv.totalAmount))}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${inv.status === "paid" ? "bg-green-100 text-green-700" : inv.status === "approved" ? "bg-blue-100 text-blue-700" : inv.status === "cancelled" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{inv.status}</span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => handleEdit(inv)} className="p-1.5 rounded hover:bg-blue-50 text-blue-500" data-testid={`button-edit-${inv.id}`}><Edit size={15} /></button>
                        <button onClick={() => { if (confirm("Delete this invoice?")) deleteMut.mutate(inv.id); }} className="p-1.5 rounded hover:bg-red-50 text-red-400" data-testid={`button-delete-${inv.id}`}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                )) : <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">No invoices found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <InvoiceForm initial={editing} items={editItems} onSave={() => {}} onClose={() => setShowForm(false)} />}
    </div>
  );
}
