import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Search, Edit2, FileText, X, Upload, Download, FileSpreadsheet, CheckCircle, Clock } from "lucide-react";
import * as XLSX from "xlsx";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700" };
const today = () => new Date().toISOString().slice(0, 10);
const p2 = (v: any) => parseFloat(v) || 0;
const n2 = (v: any) => Number(v || 0).toFixed(2);
const n3 = (v: any) => Number(v || 0).toFixed(3);

interface SopItem {
  sno: number;
  item_code: string;
  item_name: string;
  uom: string;
  opening_qty: number;
  rate: number;
  amount: number;
}

interface SopForm {
  opening_date: string;
  store_id: string;
  financial_year: string;
  status: "Draft" | "Posted";
  remark: string;
  items: SopItem[];
}

const blankItem = (sno = 1): SopItem => ({
  sno, item_code: "", item_name: "", uom: "Nos", opening_qty: 0, rate: 0, amount: 0,
});

const blankForm = (): SopForm => ({
  opening_date: today(), store_id: "", financial_year: "", status: "Draft", remark: "", items: [blankItem()],
});

function calcItem(it: SopItem): SopItem {
  return { ...it, amount: p2(it.opening_qty) * p2(it.rate) };
}

// ─── Excel template definition ──────────────────────────────────────────────
// Store column is first — allows multi-store bulk import in a single file
const TEMPLATE_HEADERS = ["Store *", "Item Code *", "Item Name *", "UOM", "Opening Qty *", "Rate (₹)"];
const TEMPLATE_SAMPLE   = [
  ["Main Store",  "RM-001", "MS Pipe 2 inch",   "Kg",  100, 45.50],
  ["Main Store",  "RM-002", "Copper Wire 2mm",  "Mtr", 200, 120.00],
  ["Branch Store","IC-001", "Ace A1-Smartphone", "Nos",  10, 200.00],
];

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_SAMPLE]);
  ws["!cols"] = [{ wch: 18 }, { wch: 14 }, { wch: 28 }, { wch: 8 }, { wch: 14 }, { wch: 12 }];
  TEMPLATE_HEADERS.forEach((_, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i });
    if (!ws[cell]) return;
    ws[cell].s = { fill: { fgColor: { rgb: "FFF9C4" } }, font: { bold: true } };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Store Opening");
  XLSX.writeFile(wb, "Store_Opening_Template.xlsx");
}

function exportToExcel(items: SopItem[], sopNo: string) {
  const rows = items.map(it => ({
    "S.No": it.sno, "Item Code": it.item_code, "Item Name": it.item_name,
    "UOM": it.uom, "Opening Qty": it.opening_qty, "Rate (₹)": it.rate, "Amount (₹)": it.amount,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [{ wch: 6 }, { wch: 14 }, { wch: 30 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Store Opening");
  XLSX.writeFile(wb, `${sopNo || "Store_Opening"}.xlsx`);
}

export default function StoreOpening() {
  const qc = useQueryClient();
  const [mode, setMode]     = useState<"list"|"form">("list");
  const [editId, setEditId] = useState<string|null>(null);
  const [form, setForm]     = useState<SopForm>(blankForm());
  const [sopNo, setSopNo]   = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");
  const [importErr, setImportErr]     = useState("");
  const [importOk, setImportOk]       = useState("");
  const [bulkImporting, setBulkImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: sops = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/store-openings"] });
  const { data: warehouses = [] }      = useQuery<any[]>({ queryKey: ["/api/warehouses"] });
  const { data: allProducts = [] }     = useQuery<any[]>({ queryKey: ["/api/products"] });

  const totalQty    = form.items.reduce((s, it) => s + p2(it.opening_qty), 0);
  const totalAmount = form.items.reduce((s, it) => s + p2(it.amount), 0);

  const filtered = (sops as any[]).filter((s: any) => {
    if (!search) return true;
    return [s.voucher_no, s.store_name, s.status, s.financial_year].join(" ").toLowerCase().includes(search.toLowerCase());
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  const prodMap = Object.fromEntries((allProducts as any[]).map((p: any) => [p.code?.toLowerCase(), p]));

  function openNew() {
    setForm(blankForm()); setEditId(null); setErr(""); setImportErr(""); setImportOk("");
    setSopNo(""); setMode("form");
    fetch("/api/voucher-series/next/store_opening", { credentials: "include" })
      .then(r => r.json()).then(d => { if (d.voucher_no) setSopNo(d.voucher_no); });
  }

  async function openEdit(sop: any) {
    setSopNo(sop.voucher_no || ""); setImportErr(""); setImportOk("");
    const r = await fetch(`/api/store-openings/${sop.id}`, { credentials: "include" });
    const data = await r.json();
    setForm({
      opening_date: data.opening_date?.slice(0,10) || today(),
      store_id: data.store_id || "", financial_year: data.financial_year || "",
      status: data.status || "Draft", remark: data.remark || "",
      items: (data.items||[]).map((it: any, i: number) => calcItem({
        sno: i+1, item_code: it.item_code||"", item_name: it.item_name||"",
        uom: it.uom||"Nos", opening_qty: p2(it.opening_qty), rate: p2(it.rate), amount: p2(it.amount),
      })),
    });
    setEditId(sop.id); setErr(""); setMode("form");
  }

  function updItem(i: number, key: keyof SopItem, val: any) {
    setForm(f => {
      const items = [...f.items];
      // If item_code changed, try to auto-fill from product master
      if (key === "item_code") {
        const prod = prodMap[String(val).toLowerCase()];
        if (prod) {
          items[i] = calcItem({ ...items[i], item_code: prod.code, item_name: prod.name, uom: prod.uom||prod.unit||"Nos" });
          return { ...f, items };
        }
      }
      items[i] = calcItem({ ...items[i], [key]: val });
      return { ...f, items };
    });
  }

  function addItem() {
    setForm(f => ({ ...f, items: [...f.items, blankItem(f.items.length + 1)] }));
  }

  function removeItem(i: number) {
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, sno: idx + 1 })) }));
  }

  // ── Excel Import ──────────────────────────────────────────────────────────
  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    setImportErr(""); setImportOk("");
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (rows.length < 2) { setImportErr("Excel is empty or has no data rows."); return; }

        const hdr = rows[0].map((h: any) => String(h).toLowerCase().trim());
        const colIdx = {
          store: hdr.findIndex(h => h.includes("store")),
          code:  hdr.findIndex(h => h.includes("code")),
          name:  hdr.findIndex(h => h.includes("name")),
          uom:   hdr.findIndex(h => h.includes("uom") || h.includes("unit")),
          qty:   hdr.findIndex(h => h.includes("qty") || h.includes("quantity")),
          rate:  hdr.findIndex(h => h.includes("rate") || h.includes("price")),
        };
        if (colIdx.code < 0 || colIdx.qty < 0) {
          setImportErr("Required columns not found. Download the template to see expected format.");
          return;
        }

        // ── Multi-store bulk import ──────────────────────────────────────────
        if (colIdx.store >= 0) {
          // Group rows by store name
          const storeMap: Record<string, any[]> = {};
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const storeName = String(row[colIdx.store] || "").trim();
            const code = String(row[colIdx.code] || "").trim();
            const name = String(colIdx.name >= 0 ? row[colIdx.name] || "" : "").trim();
            const qty  = parseFloat(String(row[colIdx.qty] || "0")) || 0;
            const rate = parseFloat(String(colIdx.rate >= 0 ? row[colIdx.rate] || "0" : "0")) || 0;
            const uom  = colIdx.uom >= 0 ? String(row[colIdx.uom] || "Nos").trim() : "Nos";
            if (!storeName && !code && !name) continue;
            const key = storeName || "Unknown Store";
            if (!storeMap[key]) storeMap[key] = [];
            const prod = prodMap[code.toLowerCase()];
            storeMap[key].push({
              item_code: prod?.code || code,
              item_name: prod?.name || name || code,
              uom: prod?.uom || prod?.unit || uom,
              opening_qty: qty, rate,
            });
          }
          const entries = Object.entries(storeMap).map(([store_name, items]) => ({ store_name, items }));
          if (entries.length === 0) { setImportErr("No valid rows found in the file."); return; }

          setBulkImporting(true);
          try {
            const r = await fetch("/api/store-openings/bulk-import", {
              method: "POST", credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ opening_date: form.opening_date, financial_year: form.financial_year, entries }),
            });
            const result = await r.json();
            if (!r.ok) { setImportErr(result.message || "Bulk import failed."); return; }
            qc.invalidateQueries({ queryKey: ["/api/store-openings"] });
            qc.invalidateQueries({ queryKey: ["/api/warehouses"] });
            const newStoreMsg = result.storesCreated?.length > 0
              ? ` New stores created in master: ${result.storesCreated.join(", ")}.`
              : "";
            const summary = (result.created || []).map((c: any) => `${c.sopNo} → ${c.storeName} (${c.itemCount} items)`).join(", ");
            setImportOk(`✓ ${result.created?.length} SOP entries created across ${entries.length} store(s).${newStoreMsg} Entries: ${summary}`);
            // Go back to list so the user can see the created entries
            setMode("list");
          } catch (ex: any) { setImportErr("Bulk import failed: " + ex.message); }
          finally { setBulkImporting(false); }
          return;
        }

        // ── Single-store import (no Store column) ───────────────────────────
        const imported: SopItem[] = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const code = String(row[colIdx.code] || "").trim();
          const name = String(colIdx.name >= 0 ? row[colIdx.name] || "" : "").trim();
          const qty  = parseFloat(String(row[colIdx.qty] || "0")) || 0;
          const rate = parseFloat(String(colIdx.rate >= 0 ? row[colIdx.rate] || "0" : "0")) || 0;
          const uom  = colIdx.uom >= 0 ? String(row[colIdx.uom] || "Nos").trim() : "Nos";
          if (!code && !name) continue;
          const prod = prodMap[code.toLowerCase()];
          imported.push(calcItem({
            sno: imported.length + 1,
            item_code: prod?.code || code,
            item_name: prod?.name || name || code,
            uom: prod?.uom || prod?.unit || uom,
            opening_qty: qty, rate, amount: 0,
          }));
        }
        if (imported.length === 0) { setImportErr("No valid rows found in the file."); return; }
        setForm(f => ({ ...f, items: imported }));
        setImportOk(`${imported.length} item${imported.length !== 1 ? "s" : ""} imported. Select a store and save.`);
      } catch (ex: any) { setImportErr("Failed to read file: " + ex.message); }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }

  async function handleSave(status?: "Draft"|"Posted") {
    const finalStatus = status || form.status;
    setErr(""); setSaving(true);
    const payload = { ...form, status: finalStatus, total_qty: totalQty, total_amount: totalAmount };
    const url = editId ? `/api/store-openings/${editId}` : "/api/store-openings";
    const method = editId ? "PATCH" : "POST";
    try {
      const r = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) { const d = await r.json(); setErr(d.message || "Save failed"); return; }
      qc.invalidateQueries({ queryKey: ["/api/store-openings"] });
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      setMode("list");
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string, status: string) {
    const msg = status === "Posted"
      ? "Delete this Posted opening? Stock will be reversed to previous values."
      : "Delete this draft store opening?";
    if (!confirm(msg)) return;
    await fetch(`/api/store-openings/${id}`, { method: "DELETE", credentials: "include" });
    qc.invalidateQueries({ queryKey: ["/api/store-openings"] });
    qc.invalidateQueries({ queryKey: ["/api/products"] });
  }

  // ── List ──────────────────────────────────────────────────────────────────
  if (mode === "list") return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Store Opening</h1>
          <p className="text-sm text-gray-500">Set opening stock balances per store</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg text-white"
          style={{ background: SC.primary }} data-testid="btn-new-sop">
          <Plus size={15}/> New Store Opening
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-2.5 text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#027fa5]"
            placeholder="Search SOP No, Store, Status…" data-testid="input-search"/>
        </div>
        <span className="text-xs text-gray-400">{filtered.length} record{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            <FileText size={32} className="mx-auto mb-2 opacity-30"/>
            No store openings yet. Click "New Store Opening" to begin.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ background: "#e8f6fb" }}>
                {["SOP No","Date","Store","Fin Year","Items Qty","Total ₹","Status",""].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s: any) => (
                <tr key={s.id} className="border-b hover:bg-[#f0f9ff] transition-colors">
                  <td className="px-4 py-3 font-semibold" style={{ color: SC.primary }}>{s.voucher_no}</td>
                  <td className="px-4 py-3 text-gray-600">{s.opening_date?.slice(0,10)}</td>
                  <td className="px-4 py-3 text-gray-700">{s.store_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{s.financial_year || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{n3(s.total_qty)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800">₹ {n2(s.total_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium
                      ${s.status === "Posted" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {s.status === "Posted" ? <CheckCircle size={10}/> : <Clock size={10}/>} {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(s)} className="text-[#027fa5] hover:text-[#025f80]" data-testid={`btn-edit-${s.id}`}><Edit2 size={14}/></button>
                      <button onClick={() => handleDelete(s.id, s.status)} className="text-red-400 hover:text-red-600" data-testid={`btn-del-${s.id}`}><Trash2 size={14}/></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setMode("list")} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Store Opening</h1>
            <p className="text-xs text-gray-400">{editId ? `Editing ${sopNo}` : "New opening stock entry"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Excel import/export */}
          <button onClick={downloadTemplate}
            className="flex items-center gap-1.5 text-xs px-3 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
            title="Download Excel template for bulk import" data-testid="btn-download-template">
            <FileSpreadsheet size={13} className="text-green-600"/> Download Template
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={bulkImporting}
            className="flex items-center gap-1.5 text-xs px-3 py-2 border border-[#027fa5] rounded-lg font-medium hover:bg-[#e8f6fb] disabled:opacity-60"
            style={{ color: SC.primary }} data-testid="btn-import-excel">
            <Upload size={13}/> {bulkImporting ? "Importing…" : "Import Excel"}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport}/>
          {form.items.some(it => it.item_code) && (
            <button onClick={() => exportToExcel(form.items, sopNo)}
              className="flex items-center gap-1.5 text-xs px-3 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              data-testid="btn-export-excel">
              <Download size={13}/> Export Excel
            </button>
          )}
          <div className="w-px h-6 bg-gray-200 mx-1"/>
          <button onClick={() => setMode("list")} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={() => handleSave("Draft")} disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-semibold border-2 border-[#027fa5] text-[#027fa5] hover:bg-[#e8f6fb] disabled:opacity-60"
            data-testid="btn-save-draft">
            {saving ? "…" : "Save Draft"}
          </button>
          <button onClick={() => handleSave("Posted")} disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: SC.orange }} data-testid="btn-post">
            {saving ? "Posting…" : "Post & Update Stock"}
          </button>
        </div>
      </div>

      {err      && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">{err}</div>}
      {importErr && <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2 rounded-lg flex items-center gap-2"><span>⚠</span> {importErr}</div>}
      {importOk  && <div className="bg-green-50 border border-green-200 text-green-700 text-xs px-4 py-2 rounded-lg flex items-center gap-2"><CheckCircle size={13}/> {importOk}</div>}

      {/* Status banner */}
      <div className={`flex items-center gap-2 text-xs px-4 py-2.5 rounded-lg border
        ${form.status === "Posted" ? "bg-green-50 border-green-200 text-green-700" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
        {form.status === "Posted" ? <CheckCircle size={13}/> : <Clock size={13}/>}
        <span className="font-semibold">{form.status === "Posted" ? "Posted" : "Draft"}</span>
        {form.status === "Draft"
          ? ' — Stock will NOT be updated until you click "Post & Update Stock".'
          : " — Stock has been updated. Editing will reverse previous values and re-apply."}
      </div>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="grid grid-cols-5 gap-4">
          <div>
            <label className="text-xs text-gray-500 font-medium">SOP No</label>
            <input readOnly value={sopNo || "Loading…"}
              className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2.5 text-sm font-semibold"
              style={{ color: sopNo ? SC.primary : "#9ca3af" }} data-testid="input-sop-no"/>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Opening Date</label>
            <DatePicker value={form.opening_date} onChange={v => setForm(f => ({ ...f, opening_date: v }))}/>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Store *</label>
            <select value={form.store_id} onChange={e => setForm(f => ({ ...f, store_id: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
              data-testid="select-store">
              <option value="">Select Store</option>
              {(warehouses as any[]).map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Financial Year</label>
            <input value={form.financial_year}
              onChange={e => setForm(f => ({ ...f, financial_year: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
              placeholder="e.g. 2025-26" data-testid="input-fy"/>
          </div>
          <div>
            <label className="text-xs text-gray-500 font-medium">Status</label>
            <div className="flex gap-4 mt-2.5">
              {(["Draft","Posted"] as const).map(s => (
                <label key={s} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" checked={form.status === s} onChange={() => setForm(f => ({ ...f, status: s }))}
                    className="accent-[#027fa5]" data-testid={`radio-${s.toLowerCase()}`}/>
                  <span className={form.status === s ? "font-semibold" : "text-gray-500"}>{s}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Items grid */}
      <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
        <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Items</span>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>Enter Item Code to auto-fill from product master</span>
            <span>·</span>
            <span>Or import via Excel</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b" style={{ background: "#e8f6fb" }}>
                {["S.no","Item Code","Item Name","UOM","Opening Qty","Rate (₹)","Amount (₹)",""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.items.map((it, i) => (
                <tr key={i} className="border-b hover:bg-[#f0f9ff]">
                  <td className="px-3 py-1.5 text-gray-500 text-center w-8">{it.sno}</td>

                  {/* Item Code — auto-fill on blur */}
                  <td className="px-1 py-1">
                    <input value={it.item_code}
                      onChange={e => setForm(f => { const items=[...f.items]; items[i]={...items[i], item_code: e.target.value}; return {...f,items}; })}
                      onBlur={() => updItem(i, "item_code", it.item_code)}
                      className="border border-gray-300 rounded px-2 py-1.5 w-24 outline-none focus:border-[#027fa5] text-xs uppercase"
                      placeholder="Code" data-testid={`input-code-${i}`}/>
                  </td>

                  {/* Item Name */}
                  <td className="px-1 py-1">
                    <input value={it.item_name}
                      onChange={e => setForm(f => { const items=[...f.items]; items[i]={...items[i], item_name: e.target.value}; return {...f,items}; })}
                      className="border border-gray-300 rounded px-2 py-1.5 w-44 outline-none focus:border-[#027fa5] text-xs"
                      placeholder="Item Name" data-testid={`input-name-${i}`}/>
                  </td>

                  {/* UOM */}
                  <td className="px-1 py-1">
                    <input value={it.uom}
                      onChange={e => updItem(i, "uom", e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1.5 w-14 outline-none focus:border-[#027fa5] text-xs text-center"
                      data-testid={`input-uom-${i}`}/>
                  </td>

                  {/* Opening Qty */}
                  <td className="px-1 py-1">
                    <input type="number" step="0.001" value={it.opening_qty || ""}
                      onChange={e => updItem(i, "opening_qty", parseFloat(e.target.value)||0)}
                      className="border-2 border-[#027fa5] rounded px-2 py-1.5 w-24 outline-none focus:border-[#d74700] text-xs text-right font-semibold"
                      placeholder="0.000" data-testid={`input-qty-${i}`}/>
                  </td>

                  {/* Rate */}
                  <td className="px-1 py-1">
                    <input type="number" step="0.01" value={it.rate || ""}
                      onChange={e => updItem(i, "rate", parseFloat(e.target.value)||0)}
                      className="border border-gray-300 rounded px-2 py-1.5 w-24 outline-none focus:border-[#027fa5] text-xs text-right"
                      placeholder="0.00" data-testid={`input-rate-${i}`}/>
                  </td>

                  {/* Amount — auto-calc */}
                  <td className="px-2 py-1 text-right font-semibold text-gray-800 tabular-nums w-24">
                    {n2(it.amount)}
                  </td>

                  {/* Delete */}
                  <td className="px-2 py-1">
                    <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600"
                      data-testid={`btn-del-item-${i}`}><Trash2 size={12}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t bg-gray-50">
          <button onClick={addItem}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded hover:bg-[#d2f1fa] transition-colors"
            style={{ color: SC.primary }} data-testid="btn-add-item">
            <Plus size={12}/> Add Item
          </button>
          <div className="flex items-center gap-8 text-xs text-gray-600">
            <span>Total Qty: <span className="font-bold text-gray-800">{n3(totalQty)}</span></span>
            <span className="text-sm font-bold text-gray-800">Total Amount: ₹ {n2(totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Remark */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <label className="text-xs text-gray-500 font-medium block mb-1">Remark</label>
        <textarea value={form.remark} onChange={e => setForm(f => ({ ...f, remark: e.target.value }))}
          rows={2} placeholder="Notes about this opening entry…"
          className="w-full border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-[#027fa5] resize-none"
          data-testid="textarea-remark"/>
      </div>

      {/* Excel format guide */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <FileSpreadsheet size={14} className="text-blue-600"/>
          <span className="text-xs font-semibold text-blue-700">Excel Import Format</span>
          <button onClick={downloadTemplate}
            className="ml-auto flex items-center gap-1 text-xs text-blue-700 underline hover:no-underline"
            data-testid="btn-download-template-2">
            <Download size={11}/> Download Template
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="text-xs w-auto border border-blue-200 rounded">
            <thead>
              <tr className="bg-yellow-50">
                {TEMPLATE_HEADERS.map(h => (
                  <th key={h} className="px-3 py-1.5 border-r border-blue-200 text-left font-semibold text-gray-700 whitespace-nowrap last:border-r-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TEMPLATE_SAMPLE.map((row, i) => (
                <tr key={i} className="border-t border-blue-200">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-1.5 border-r border-blue-200 text-gray-600 last:border-r-0">{String(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-blue-600 mt-2">
          * Required. <strong>Store column enables multi-store bulk import</strong> — rows are grouped by store name and separate SOP entries are created for each store automatically.
          If a store name is not in the master, it will be created. Item Code auto-matches against product master.
        </p>
      </div>
    </div>
  );
}
