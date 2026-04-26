import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Search, Edit2, Upload, Scan, X, ChevronDown, FileText, CheckCircle } from "lucide-react";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };
const fmt = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" }) : "—";
const n2 = (v: number) => isNaN(v) ? "0.00" : v.toLocaleString("en-IN", { minimumFractionDigits:2, maximumFractionDigits:2 });
const p2 = (v: any) => parseFloat(v)||0;

type GrnItem = {
  id?: string; sno: number;
  item_code: string; item_name: string; batch_no: string; expiry_date: string;
  qty: number; unit: string; rate: number; taxable_amt: number;
  cgst_pct: number; cgst_amt: number; sgst_pct: number; sgst_amt: number;
  igst_pct: number; igst_amt: number; total: number;
};
type GrnForm = {
  grn_date: string; store_id: string; store_name: string;
  supplier_id: string; supplier_name_manual: string;
  dc_no: string; bill_no: string; bill_date: string;
  payment_mode: string; purchase_type: string;
  po_id: string; po_no: string; round_off: number; remark: string;
  grand_total: number;
  items: GrnItem[];
};

const blankItem = (): GrnItem => ({
  sno:1, item_code:"", item_name:"", batch_no:"", expiry_date:"",
  qty:0, unit:"Nos", rate:0, taxable_amt:0,
  cgst_pct:6, cgst_amt:0, sgst_pct:6, sgst_amt:0, igst_pct:0, igst_amt:0, total:0,
});
const blankForm = (): GrnForm => ({
  grn_date: new Date().toISOString().slice(0,10), store_id:"", store_name:"",
  supplier_id:"", supplier_name_manual:"", dc_no:"", bill_no:"", bill_date:"",
  payment_mode:"Cash", purchase_type:"PO", po_id:"", po_no:"", round_off:0, remark:"",
  grand_total:0, items:[{ ...blankItem() }],
});

function calcItem(it: GrnItem): GrnItem {
  const taxable_amt = p2(it.qty) * p2(it.rate);
  const cgst_amt    = taxable_amt * p2(it.cgst_pct) / 100;
  const sgst_amt    = taxable_amt * p2(it.sgst_pct) / 100;
  const igst_amt    = taxable_amt * p2(it.igst_pct) / 100;
  const total       = taxable_amt + cgst_amt + sgst_amt + igst_amt;
  return { ...it, taxable_amt, cgst_amt, sgst_amt, igst_amt, total };
}

// Supplier search dropdown
function SupplierSelect({ value, name, onChange }: { value: string; name: string; onChange: (id: string, name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data: suppliers = [] } = useQuery<any[]>({ queryKey: ["/api/sub-ledgers/creditors"] });
  const filtered = (suppliers as any[]).filter((s: any) =>
    !q || s.name?.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm text-left flex items-center justify-between hover:border-[#027fa5] outline-none transition-colors"
        data-testid="btn-supplier-dropdown">
        <span className={name ? "text-gray-800" : "text-gray-400"}>{name || "Select Supplier"}</span>
        <ChevronDown size={14} className="text-gray-400"/>
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-56 overflow-hidden flex flex-col">
          <div className="p-2 border-b">
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search…" className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-[#027fa5]"/>
          </div>
          <div className="overflow-y-auto flex-1">
            {filtered.map((s: any) => (
              <button key={s.id} type="button"
                onClick={() => { onChange("", s.name); setOpen(false); setQ(""); }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[#d2f1fa] transition-colors">
                {s.name}
              </button>
            ))}
            {filtered.length === 0 && <p className="px-3 py-2 text-xs text-gray-400">No suppliers found</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// PO Selection panel
function PoSelectorPanel({ supplierId, selectedPoId, onSelect }: { supplierId: string; selectedPoId: string; onSelect: (po: any) => void }) {
  const { data: pos = [] } = useQuery<any[]>({
    queryKey: ["/api/purchase-orders"],
  });
  const approvedPos = (pos as any[]).filter((p: any) =>
    ["Approved","Draft"].includes(p.status) &&
    (!supplierId || p.supplier_id === supplierId || !p.supplier_id));
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
      <div className="grid font-semibold text-gray-600 bg-gray-50 border-b" style={{ gridTemplateColumns: "1fr 1fr 1fr 50px" }}>
        {["PO No","PO Date","PO Type","Select"].map(h => <div key={h} className="px-2 py-2">{h}</div>)}
      </div>
      <div className="max-h-40 overflow-y-auto">
        {approvedPos.length === 0 && (
          <div className="px-3 py-4 text-center text-gray-400">No approved POs available</div>
        )}
        {approvedPos.map((po: any) => (
          <div key={po.id} className={`grid border-b last:border-0 items-center ${selectedPoId===po.id?"bg-[#d2f1fa]":""}`}
            style={{ gridTemplateColumns: "1fr 1fr 1fr 50px" }}>
            <div className="px-2 py-2 font-semibold" style={{ color: SC.primary }}>{po.voucher_no}</div>
            <div className="px-2 py-2 text-gray-600">{fmt(po.po_date)}</div>
            <div className="px-2 py-2 text-gray-500">Purchase Order</div>
            <div className="px-2 py-2">
              <input type="checkbox" checked={selectedPoId===po.id}
                onChange={() => onSelect(po)}
                className="accent-[#d74700] w-4 h-4"/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// AI Scan modal
function ScanModal({ onClose, onExtracted }: { onClose: () => void; onExtracted: (data: any) => void }) {
  const [file, setFile] = useState<File|null>(null);
  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleScan() {
    if (!file) return;
    setScanning(true); setErr("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await fetch("/api/grn/scan-document", { method:"POST", credentials:"include", body: fd });
      const j = await r.json();
      if (!r.ok) { setErr(j.message || "Scan failed"); setScanning(false); return; }
      onExtracted(j.data);
      onClose();
    } catch (e: any) { setErr(e.message || "Scan failed"); }
    setScanning(false);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Scan size={16} style={{ color: SC.primary }}/> AI Scan Document
          </h3>
          <button onClick={onClose}><X size={16} className="text-gray-400"/></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">Upload a purchase bill or invoice image and our AI will extract the details automatically.</p>
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-[#027fa5] transition-colors mb-4">
          {file ? (
            <div className="flex items-center gap-2 justify-center">
              <FileText size={18} className="text-[#027fa5]"/>
              <span className="text-sm font-medium text-gray-700">{file.name}</span>
            </div>
          ) : (
            <>
              <Upload size={24} className="mx-auto mb-2 text-gray-400"/>
              <p className="text-sm text-gray-500">Click to upload image or PDF</p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, PDF supported</p>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden"
          onChange={e => { setFile(e.target.files?.[0]||null); setErr(""); }}/>
        {err && <p className="text-xs text-red-500 mb-3">{err}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={handleScan} disabled={!file || scanning}
            className="px-6 py-2 rounded text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: SC.primary }}>
            {scanning ? "Scanning…" : "Scan & Extract"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function GoodsReceiptNote() {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"list"|"form">("list");
  const [editId, setEditId] = useState<string|null>(null);
  const [form, setForm] = useState<GrnForm>(blankForm());
  const [search, setSearch] = useState("");
  const [showScan, setShowScan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const { data: grns = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/goods-receipt-notes"] });
  const { data: warehouses = [] } = useQuery<any[]>({ queryKey: ["/api/warehouses"] });

  const filtered = (grns as any[]).filter((g: any) => {
    if (!search) return true;
    const h = [g.voucher_no, g.supplier_name, g.store_name, g.bill_no, g.dc_no,
      g.payment_mode, g.status, String(g.grand_total||"")].join(" ").toLowerCase();
    return h.includes(search.toLowerCase());
  });

  // Totals
  const totalQty      = form.items.reduce((s, it) => s + p2(it.qty), 0);
  const taxableTotal  = form.items.reduce((s, it) => s + p2(it.taxable_amt), 0);
  const cgstTotal     = form.items.reduce((s, it) => s + p2(it.cgst_amt), 0);
  const sgstTotal     = form.items.reduce((s, it) => s + p2(it.sgst_amt), 0);
  const igstTotal     = form.items.reduce((s, it) => s + p2(it.igst_amt), 0);
  const grandTotal    = taxableTotal + cgstTotal + sgstTotal + igstTotal + p2(form.round_off);
  const grandRounded  = Math.round(grandTotal);
  const computedRoundOff = +(grandRounded - grandTotal).toFixed(2);

  function openNew() { setForm(blankForm()); setEditId(null); setErr(""); setMode("form"); }
  function openEdit(grn: any) {
    setForm({
      grn_date: grn.grn_date?.slice(0,10)||"", store_id: grn.store_id||"", store_name: grn.store_name||"",
      supplier_id: grn.supplier_id||"", supplier_name_manual: grn.supplier_name||grn.supplier_name_manual||"",
      dc_no: grn.dc_no||"", bill_no: grn.bill_no||"", bill_date: grn.bill_date?.slice(0,10)||"",
      payment_mode: grn.payment_mode||"Cash", purchase_type: grn.purchase_type||"PO",
      po_id: grn.po_id||"", po_no: grn.po_no||"", round_off: p2(grn.round_off), remark: grn.remark||"",
      grand_total: p2(grn.grand_total),
      items: (grn.items||[]).map((it: any) => ({
        ...it, qty: p2(it.qty), rate: p2(it.rate), taxable_amt: p2(it.taxable_amt),
        cgst_pct: p2(it.cgst_pct), cgst_amt: p2(it.cgst_amt), sgst_pct: p2(it.sgst_pct),
        sgst_amt: p2(it.sgst_amt), igst_pct: p2(it.igst_pct), igst_amt: p2(it.igst_amt), total: p2(it.total),
      })),
    });
    setEditId(grn.id); setErr(""); setMode("form");
    fetch(`/api/goods-receipt-notes/${grn.id}`, { credentials:"include" })
      .then(r => r.json()).then(full => {
        setForm(f => ({ ...f, items: (full.items||[]).map((it: any) => ({
          ...it, qty: p2(it.qty), rate: p2(it.rate), taxable_amt: p2(it.taxable_amt),
          cgst_pct: p2(it.cgst_pct), cgst_amt: p2(it.cgst_amt), sgst_pct: p2(it.sgst_pct),
          sgst_amt: p2(it.sgst_amt), igst_pct: p2(it.igst_pct), igst_amt: p2(it.igst_amt), total: p2(it.total),
        })) }));
      });
  }

  const deleteMut = useMutation({
    mutationFn: (id: string) => fetch(`/api/goods-receipt-notes/${id}`, { method:"DELETE", credentials:"include" }).then(r=>r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/goods-receipt-notes"] }),
  });

  // Handle PO selection — prefill items from PO
  async function handlePoSelect(po: any) {
    if (form.po_id === po.id) {
      setForm(f => ({ ...f, po_id:"", po_no:"" }));
      return;
    }
    const full = await fetch(`/api/purchase-orders/${po.id}`, { credentials:"include" }).then(r=>r.json());
    const items: GrnItem[] = (full.items||[]).map((it: any, i: number) => calcItem({
      sno: i+1, item_code: it.item_code||"", item_name: it.item_name||"", batch_no:"", expiry_date:"",
      qty: p2(it.qty), unit: it.unit||"Nos", rate: p2(it.rate), taxable_amt:0,
      cgst_pct: p2(it.cgst_pct||it.cgst_pct), cgst_amt:0,
      sgst_pct: p2(it.sgst_pct), sgst_amt:0, igst_pct: p2(it.igst_pct||0), igst_amt:0, total:0,
    }));
    setForm(f => ({
      ...f,
      po_id: po.id, po_no: po.voucher_no,
      supplier_id: full.supplier_id||"",
      supplier_name_manual: full.supplier_name||full.supplier_name_manual||"",
      payment_mode: full.payment_mode||"Cash",
      items: items.length > 0 ? items : [blankItem()],
    }));
  }

  // Handle AI extracted data
  function applyScannedData(data: any) {
    const items: GrnItem[] = (data.items||[]).map((it: any, i: number) => calcItem({
      sno: i+1, item_code: it.itemCode||"", item_name: it.itemName||"", batch_no: it.batchNo||"",
      expiry_date: it.expiryDate||"", qty: p2(it.qty), unit: it.unit||"Nos", rate: p2(it.rate),
      taxable_amt:0, cgst_pct: p2(it.cgstPct||6), cgst_amt:0,
      sgst_pct: p2(it.sgstPct||6), sgst_amt:0, igst_pct: p2(it.igstPct||0), igst_amt:0, total:0,
    }));
    setForm(f => ({
      ...f,
      supplier_name_manual: data.supplierName || f.supplier_name_manual,
      bill_no: data.billNo || f.bill_no,
      bill_date: data.billDate || f.bill_date,
      dc_no: data.dcNo || f.dc_no,
      payment_mode: data.paymentMode || f.payment_mode,
      items: items.length > 0 ? items : f.items,
    }));
  }

  function updItem(i: number, key: keyof GrnItem, val: any) {
    setForm(f => {
      const items = [...f.items];
      const updated = calcItem({ ...items[i], [key]: val });
      items[i] = updated;
      return { ...f, items };
    });
  }

  function addItem() {
    setForm(f => ({ ...f, items: [...f.items, { ...blankItem(), sno: f.items.length+1 }] }));
  }
  function removeItem(i: number) {
    setForm(f => ({ ...f, items: f.items.filter((_,idx) => idx !== i).map((it,idx) => ({ ...it, sno:idx+1 })) }));
  }

  async function handleSave() {
    setErr(""); setSaving(true);
    const payload = {
      ...form,
      round_off: computedRoundOff,
      grand_total: grandRounded,
      items: form.items,
    };
    const url = editId ? `/api/goods-receipt-notes/${editId}` : "/api/goods-receipt-notes";
    const method = editId ? "PATCH" : "POST";
    try {
      const r = await fetch(url, {
        method, credentials:"include",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) { setErr(j.message || "Save failed"); setSaving(false); return; }
      qc.invalidateQueries({ queryKey: ["/api/goods-receipt-notes"] });
      setMode("list");
    } catch (e: any) { setErr(e.message); }
    setSaving(false);
  }

  // ── List View ───────────────────────────────────────────────────────────────
  if (mode === "list") {
    return (
      <div className="p-4 md:p-6" style={{ background: SC.bg, minHeight:"100vh", fontFamily:"Source Sans Pro, sans-serif" }}>
        <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Goods Receipt Note</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search GRN…"
                  className="border border-gray-300 rounded-lg pl-8 pr-3 py-2 text-sm outline-none focus:border-[#027fa5] w-60"/>
              </div>
              <button onClick={openNew}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: SC.primary }} data-testid="btn-new-grn">
                <Plus size={15}/> New GRN
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ background:"#e8f6fb" }}>
                  {["GRN No","GRN Date","Supplier","Store","Bill No","Payment","Purchase Type","Grand Total ₹","Status","Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-700">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
                {!isLoading && filtered.length === 0 && (
                  <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-400">No goods receipt notes found</td></tr>
                )}
                {filtered.map((g: any) => (
                  <tr key={g.id} className="border-b hover:bg-[#f0f9ff] transition-colors">
                    <td className="px-4 py-3 font-semibold" style={{ color:SC.primary }}>{g.voucher_no}</td>
                    <td className="px-4 py-3 text-gray-700">{fmt(g.grn_date)}</td>
                    <td className="px-4 py-3 text-gray-800">{g.supplier_name||"—"}</td>
                    <td className="px-4 py-3 text-gray-600">{g.store_name||"—"}</td>
                    <td className="px-4 py-3 text-gray-600">{g.bill_no||"—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${g.payment_mode==="Credit"?"bg-orange-50 text-orange-700":"bg-blue-50 text-blue-600"}`}>
                        {g.payment_mode}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">{g.purchase_type==="PO"?"Purchase Order":"Direct Purchase"}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">₹ {n2(p2(g.grand_total))}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">{g.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(g)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-[#027fa5]"
                          data-testid={`btn-edit-${g.id}`}><Edit2 size={13}/></button>
                        <button onClick={() => { if (confirm("Delete this GRN?")) deleteMut.mutate(g.id); }}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                          data-testid={`btn-delete-${g.id}`}><Trash2 size={13}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── Form View ────────────────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6" style={{ background: SC.bg, minHeight:"100vh", fontFamily:"Source Sans Pro, sans-serif" }}>
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Goods Receipt Note</h2>
          <div className="flex items-center gap-3">
            {/* Search bar (display only) */}
            <div className="relative hidden md:block">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input readOnly placeholder="Search Despatch No, Date and Party Name…"
                className="border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm outline-none bg-gray-50 w-72"/>
            </div>
            {/* Upload / Scan button */}
            <button onClick={() => setShowScan(true)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              data-testid="btn-scan">
              <Upload size={14} className="text-[#027fa5]"/> Upload / Scan
            </button>
            <button className="p-2 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-500">
              <FileText size={15}/>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">

          {/* Row 1: GRN No, Date, Store | Purchase type radio */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left: header fields */}
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium">GRN No</label>
                  <input readOnly value={editId ? "(saved)" : "Auto"} className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2.5 text-sm text-gray-500"/>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">GRN Date</label>
                  <DatePicker value={form.grn_date} onChange={v => setForm(f=>({...f,grn_date:v}))}/>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Store</label>
                  <select value={form.store_id} onChange={e => {
                    const wh = (warehouses as any[]).find((w: any) => w.id === e.target.value);
                    setForm(f=>({...f,store_id:e.target.value,store_name:wh?.name||""}));
                  }}
                    className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                    data-testid="select-store">
                    <option value="">Select Store</option>
                    {(warehouses as any[]).map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium">Supplier Name</label>
                  <SupplierSelect value={form.supplier_id} name={form.supplier_name_manual}
                    onChange={(id,name) => setForm(f=>({...f,supplier_id:id,supplier_name_manual:name}))}/>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">DC No</label>
                  <input value={form.dc_no} onChange={e=>setForm(f=>({...f,dc_no:e.target.value}))}
                    className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                    placeholder="DC2110" data-testid="input-dcno"/>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium">Bill No</label>
                  <input value={form.bill_no} onChange={e=>setForm(f=>({...f,bill_no:e.target.value}))}
                    className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                    placeholder="PINV20450" data-testid="input-billno"/>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Bill Date</label>
                  <DatePicker value={form.bill_date} onChange={v => setForm(f=>({...f,bill_date:v}))}/>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Payment Mode</label>
                  <div className="flex gap-4 pt-2.5">
                    {["Cash","Credit"].map(m => (
                      <label key={m} className="flex items-center gap-1.5 text-sm cursor-pointer">
                        <input type="radio" checked={form.payment_mode===m}
                          onChange={() => setForm(f=>({...f,payment_mode:m}))}
                          className="accent-[#d74700]" data-testid={`radio-${m.toLowerCase()}`}/>
                        <span className={form.payment_mode===m?"font-semibold":"text-gray-600"}>{m}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: purchase type + PO selector */}
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center gap-6 mb-3">
                {[{val:"PO",label:"Purchase Order"},{val:"Direct",label:"Direct Purchase"}].map(pt => (
                  <label key={pt.val} className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" checked={form.purchase_type===pt.val}
                      onChange={() => {
                        if (form.purchase_type !== pt.val) {
                          setForm({ ...blankForm(), purchase_type: pt.val });
                        }
                      }}
                      className="accent-[#d74700]" data-testid={`radio-type-${pt.val}`}/>
                    <span className={`font-medium ${form.purchase_type===pt.val?"":"text-gray-500"}`}>{pt.label}</span>
                  </label>
                ))}
              </div>
              {form.purchase_type === "PO" ? (
                <PoSelectorPanel supplierId={form.supplier_id} selectedPoId={form.po_id} onSelect={handlePoSelect}/>
              ) : (
                <div className="flex items-center justify-center h-24 text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">
                  Direct purchase — no PO required
                </div>
              )}
              {form.po_no && (
                <div className="mt-2 flex items-center gap-2 text-xs text-green-700">
                  <CheckCircle size={12}/> PO <span className="font-semibold">{form.po_no}</span> selected — items loaded
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b" style={{ background:"#e8f6fb" }}>
                    {["S.no","Item Code","Item Name","Batch No","Expiry Date","Qty","Unit","Rate ₹","Taxable Amt ₹","CGST %","CGST ₹","SGST %","SGST ₹","IGST %","IGST ₹","Total ₹",""].map(h => (
                      <th key={h} className="px-2 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, i) => (
                    <tr key={i} className="border-b hover:bg-[#f0f9ff]">
                      <td className="px-2 py-1.5 text-gray-500 text-center w-8">{it.sno}</td>
                      <td className="px-1 py-1">
                        <input value={it.item_code} onChange={e => updItem(i,"item_code",e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1.5 w-20 outline-none focus:border-[#027fa5] text-xs"/>
                      </td>
                      <td className="px-1 py-1">
                        <input value={it.item_name} onChange={e => updItem(i,"item_name",e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1.5 w-32 outline-none focus:border-[#027fa5] text-xs"
                          placeholder="Item name"/>
                      </td>
                      <td className="px-1 py-1">
                        <input value={it.batch_no} onChange={e => updItem(i,"batch_no",e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1.5 w-20 outline-none focus:border-[#027fa5] text-xs"/>
                      </td>
                      <td className="px-1 py-1">
                        <input type="date" value={it.expiry_date} onChange={e => updItem(i,"expiry_date",e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1.5 w-28 outline-none focus:border-[#027fa5] text-xs"/>
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" value={it.qty||""} onChange={e => updItem(i,"qty",parseFloat(e.target.value)||0)}
                          className="border border-gray-200 rounded px-2 py-1.5 w-14 outline-none focus:border-[#027fa5] text-xs text-right"/>
                      </td>
                      <td className="px-1 py-1">
                        <input value={it.unit} onChange={e => updItem(i,"unit",e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1.5 w-14 outline-none focus:border-[#027fa5] text-xs"/>
                      </td>
                      <td className="px-1 py-1">
                        <input type="number" value={it.rate||""} onChange={e => updItem(i,"rate",parseFloat(e.target.value)||0)}
                          className="border border-gray-200 rounded px-2 py-1.5 w-16 outline-none focus:border-[#027fa5] text-xs text-right"/>
                      </td>
                      <td className="px-2 py-1 text-right text-gray-700 font-medium w-20">{n2(it.taxable_amt)}</td>
                      <td className="px-1 py-1">
                        <input type="number" value={it.cgst_pct||""} onChange={e => updItem(i,"cgst_pct",parseFloat(e.target.value)||0)}
                          className="border border-gray-200 rounded px-2 py-1.5 w-12 outline-none focus:border-[#027fa5] text-xs text-center"/>
                      </td>
                      <td className="px-2 py-1 text-right text-gray-600 w-16">{n2(it.cgst_amt)}</td>
                      <td className="px-1 py-1">
                        <input type="number" value={it.sgst_pct||""} onChange={e => updItem(i,"sgst_pct",parseFloat(e.target.value)||0)}
                          className="border border-gray-200 rounded px-2 py-1.5 w-12 outline-none focus:border-[#027fa5] text-xs text-center"/>
                      </td>
                      <td className="px-2 py-1 text-right text-gray-600 w-16">{n2(it.sgst_amt)}</td>
                      <td className="px-1 py-1">
                        <input type="number" value={it.igst_pct||""} onChange={e => updItem(i,"igst_pct",parseFloat(e.target.value)||0)}
                          className="border border-gray-200 rounded px-2 py-1.5 w-12 outline-none focus:border-[#027fa5] text-xs text-center"/>
                      </td>
                      <td className="px-2 py-1 text-right text-gray-600 w-16">{n2(it.igst_amt)}</td>
                      <td className="px-2 py-1 text-right font-semibold text-gray-800 w-20">{n2(it.total)}</td>
                      <td className="px-2 py-1">
                        <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600"
                          data-testid={`btn-del-item-${i}`}><Trash2 size={12}/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add row + summary */}
            <div className="flex items-center justify-between px-3 py-2 border-t bg-gray-50">
              <button onClick={addItem}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded hover:bg-[#d2f1fa] transition-colors"
                style={{ color: SC.primary }} data-testid="btn-add-item">
                <Plus size={12}/> Add Item
              </button>
              <div className="flex items-center gap-6 text-xs text-gray-600">
                <span>Total Quantity : <span className="font-bold text-gray-800">{totalQty}</span></span>
                <span>Total Amount : <span className="font-bold text-gray-800 text-sm">₹ {n2(grandRounded)}</span></span>
              </div>
            </div>
          </div>

          {/* Tax summary + Grand total */}
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tax Breakdown</div>
              <div className="space-y-1.5 text-sm">
                {[
                  { label:"Taxable Amount", val:taxableTotal, bold:false },
                  { label:"CGST", val:cgstTotal, bold:false },
                  { label:"SGST", val:sgstTotal, bold:false },
                  { label:"IGST", val:igstTotal, bold:false },
                  { label:"Round Off", val:computedRoundOff, bold:false },
                  { label:"Grand Total", val:grandRounded, bold:true },
                ].map(r => (
                  <div key={r.label} className="flex justify-between">
                    <span className={r.bold?"font-semibold text-gray-800":"text-gray-600"}>{r.label}</span>
                    <span className={r.bold?"font-bold text-gray-900":"text-gray-700"}>₹ {n2(r.val)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 font-medium">Remark</label>
                <textarea value={form.remark} onChange={e => setForm(f=>({...f,remark:e.target.value}))} rows={3}
                  className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5] resize-none"
                  placeholder="Remark" data-testid="input-remark"/>
              </div>
            </div>
          </div>

          {err && <div className="px-4 py-2 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">{err}</div>}

          {/* Accounting note for Credit */}
          {form.payment_mode === "Credit" && (
            <div className="flex items-start gap-2 px-4 py-2 rounded-lg text-xs" style={{ background:"#fef3c7", color:"#92400e" }}>
              <span className="font-bold">Ledger Posting (Credit):</span>
              <span>DR: Purchases + CGST Input + SGST Input + IGST Input &nbsp;|&nbsp; CR: Sundry Creditors ({form.supplier_name_manual||"Supplier"}) · Outstanding bill created</span>
            </div>
          )}
          {form.payment_mode === "Cash" && (
            <div className="flex items-start gap-2 px-4 py-2 rounded-lg text-xs" style={{ background:"#d1fae5", color:"#065f46" }}>
              <span className="font-bold">Ledger Posting (Cash):</span>
              <span>DR: Purchases + CGST Input + SGST Input + IGST Input &nbsp;|&nbsp; CR: Cash Account</span>
            </div>
          )}

          {/* Footer actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setMode("list")}
              className="px-8 py-2 border border-gray-300 rounded text-sm font-semibold text-gray-700 hover:bg-gray-50"
              data-testid="btn-cancel">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-12 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: SC.orange }} data-testid="btn-save">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>

      {showScan && (
        <ScanModal onClose={() => setShowScan(false)} onExtracted={applyScannedData}/>
      )}
    </div>
  );
}
