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
  batch_no: string;
  expiry_date: string;
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
  sno, item_code: "", item_name: "", uom: "Nos",
  batch_no: "", expiry_date: "", opening_qty: 0, rate: 0, amount: 0,
});

const blankForm = (): SopForm => ({
  opening_date: today(), store_id: "", financial_year: "", status: "Draft", remark: "", items: [blankItem()],
});

function calcItem(it: SopItem): SopItem {
  return { ...it, amount: p2(it.opening_qty) * p2(it.rate) };
}

// ─── Excel template definition ───────────────────────────────────────────────
const TEMPLATE_HEADERS = [
  "Store *", "Category", "Sub Category",
  "Item Code *", "Item Name *", "UOM",
  "Batch No", "Expiry Date",
  "DRG No", "SAP No", "HSN Code", "Location",
  "Rate ₹", "Cost ₹", "Min Qty", "Max Qty",
  "CGST %", "SGST %", "IGST %",
  "Opening Qty *",
];
const TEMPLATE_SAMPLE = [
  // Item with two batches – name shown only in first row
  ["Main Store", "Raw Materials", "Steel",  "RM-001", "MS Pipe 2 inch",  "Kg",  "BATCH-A1", "2026-12-31", "DRG-001", "SAP-001", "HSN0000", "A-01-01", 45.50, 40.00, 10, 500, 9, 9, 0, 100],
  ["Main Store", "",              "",       "RM-001", "",                "",    "BATCH-A2", "2027-06-30", "",        "",        "",        "",        45.50, 0,     0,  0,   0, 0, 0,  50],
  // Item with no batch
  ["Main Store", "Raw Materials", "Copper", "RM-002", "Copper Wire 2mm", "Mtr", "",         "",           "",        "",        "HSN0001", "A-02-01", 120.00,110.00, 5, 200, 9, 9, 0, 200],
  // Multi-batch item in another store
  ["Branch Store","Electronics","Phones",  "IC-001", "Ace A1 Smartphone","Nos", "BATCH-B1", "2027-01-15", "",       "SAP-002", "HSN0002", "B-01-01", 200.00,190.00, 2,  50, 9, 9, 0,  10],
  ["Branch Store","",           "",        "IC-001", "",                "",    "BATCH-B2", "2027-06-15", "",        "",        "",        "",        200.00, 0,     0,  0,  0, 0, 0,   5],
];

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_SAMPLE]);
  ws["!cols"] = [
    { wch: 16 }, { wch: 16 }, { wch: 14 },
    { wch: 12 }, { wch: 28 }, { wch: 8 },
    { wch: 12 }, { wch: 13 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 8 },  { wch: 8 },  { wch: 8 },
    { wch: 14 },
  ];
  TEMPLATE_HEADERS.forEach((_, i) => {
    const cell = XLSX.utils.encode_cell({ r: 0, c: i });
    if (!ws[cell]) return;
    ws[cell].s = { fill: { fgColor: { rgb: "027FA5" } }, font: { bold: true, color: { rgb: "FFFFFF" } } };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Store Opening");
  XLSX.writeFile(wb, "Store_Opening_Template.xlsx");
}

function exportToExcel(items: SopItem[], sopNo: string) {
  const rows = items.map(it => ({
    "S.No": it.sno, "Item Code": it.item_code, "Item Name": it.item_name,
    "UOM": it.uom, "Batch No": it.batch_no, "Expiry Date": it.expiry_date,
    "Opening Qty": it.opening_qty, "Rate (₹)": it.rate, "Amount (₹)": it.amount,
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 6 }, { wch: 14 }, { wch: 30 }, { wch: 8 },
    { wch: 14 }, { wch: 13 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
  ];
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
  const { data: financialYears = [] }  = useQuery<any[]>({ queryKey: ["/api/financial-years"] });
  const currentFY = (financialYears as any[]).find((y: any) => y.is_current);

  const totalQty    = form.items.reduce((s, it) => s + p2(it.opening_qty), 0);
  const totalAmount = form.items.reduce((s, it) => s + p2(it.amount), 0);

  const filtered = (sops as any[]).filter((s: any) => {
    if (!search) return true;
    return [s.voucher_no, s.store_name, s.status, s.financial_year].join(" ").toLowerCase().includes(search.toLowerCase());
  });

  const prodMap = Object.fromEntries((allProducts as any[]).map((p: any) => [p.code?.toLowerCase(), p]));

  function openNew() {
    const fyLabel = currentFY?.label || "";
    setForm({ ...blankForm(), financial_year: fyLabel });
    setEditId(null); setErr(""); setImportErr(""); setImportOk("");
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
        uom: it.uom||"Nos",
        batch_no: it.batch_no||"", expiry_date: it.expiry_date?.slice(0,10)||"",
        opening_qty: p2(it.opening_qty), rate: p2(it.rate), amount: p2(it.amount),
      })),
    });
    setEditId(sop.id); setErr(""); setMode("form");
  }

  function updItem(i: number, key: keyof SopItem, val: any) {
    setForm(f => {
      const items = [...f.items];
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

  // Add a batch row — copies item_code/name/uom from the current row but blanks batch/qty
  function addBatchRow(i: number) {
    setForm(f => {
      const src = f.items[i];
      const newRow: SopItem = { ...blankItem(0), item_code: src.item_code, item_name: src.item_name, uom: src.uom };
      const items = [
        ...f.items.slice(0, i + 1),
        newRow,
        ...f.items.slice(i + 1),
      ].map((it, idx) => ({ ...it, sno: idx + 1 }));
      return { ...f, items };
    });
  }

  function removeItem(i: number) {
    setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i).map((it, idx) => ({ ...it, sno: idx + 1 })) }));
  }

  // ── Excel Import ────────────────────────────────────────────────────────────
  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    setImportErr(""); setImportOk("");
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false });
        if (rows.length < 2) { setImportErr("Excel is empty or has no data rows."); return; }

        const hdr = rows[0].map((h: any) => String(h).toLowerCase().replace(/[₹*]/g, "").trim());
        const g = (keywords: string[]) => hdr.findIndex(h => keywords.some(k => h.includes(k)));
        const colIdx = {
          store:    g(["store"]),
          category: g(["category"]),
          subcat:   g(["sub category","sub_category","subcategory"]),
          code:     g(["item code","item_code","code"]),
          name:     g(["item name","item_name","name"]),
          uom:      g(["uom","unit"]),
          batch:    g(["batch no","batch_no","batch"]),
          expiry:   g(["expiry date","expiry_date","expiry","exp date","exp_date"]),
          drg:      g(["drg"]),
          sap:      g(["sap"]),
          hsn:      g(["hsn"]),
          location: g(["location"]),
          rate:     g(["rate"]),
          cost:     g(["cost"]),
          minqty:   g(["min qty","min_qty"]),
          maxqty:   g(["max qty","max_qty"]),
          cgst:     g(["cgst"]),
          sgst:     g(["sgst"]),
          igst:     g(["igst"]),
          qty:      g(["opening qty","opening_qty"]) >= 0 ? g(["opening qty","opening_qty"]) : g(["qty","quantity"]),
        };
        if (colIdx.qty < 0) {
          setImportErr("Required 'Opening Qty' column not found. Download the template to see the expected format.");
          return;
        }

        const getStr = (row: any[], idx: number) => idx >= 0 ? String(row[idx] || "").trim() : "";
        const getNum = (row: any[], idx: number) => idx >= 0 ? parseFloat(String(row[idx] || "0")) || 0 : 0;

        // ── Multi-store bulk import ───────────────────────────────────────────
        if (colIdx.store >= 0) {
          const storeMap: Record<string, any[]> = {};
          // Track last-seen item context per store for multi-batch rows
          const lastItem: Record<string, { code: string; name: string; uom: string }> = {};

          for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const storeName = getStr(row, colIdx.store);
            let code = getStr(row, colIdx.code);
            let name = getStr(row, colIdx.name);
            let uom  = getStr(row, colIdx.uom);
            const batch  = getStr(row, colIdx.batch);
            const expiry = getStr(row, colIdx.expiry);
            const qty    = getNum(row, colIdx.qty);

            // Skip completely empty rows
            if (!storeName && !code && !name && !batch && !qty) continue;

            const key = storeName || (Object.keys(storeMap).at(-1) ?? "Unknown Store");

            // Multi-batch: inherit item info from last seen item in this store
            if (!code && !name && (batch || qty) && lastItem[key]) {
              code = lastItem[key].code;
              name = lastItem[key].name;
              uom  = lastItem[key].uom || uom;
            }
            if (!code && !name) continue;

            if (!storeMap[key]) storeMap[key] = [];
            const prod = prodMap[code.toLowerCase()];
            const resolvedUom = uom || prod?.uom || prod?.unit || "Nos";

            // Remember this item for subsequent batch rows
            if (code) lastItem[key] = { code: prod?.code || code, name: prod?.name || name || code, uom: resolvedUom };

            storeMap[key].push({
              item_code:    prod?.code || code,
              item_name:    prod?.name || name || code,
              uom:          resolvedUom,
              batch_no:     batch,
              expiry_date:  expiry || null,
              opening_qty:  qty,
              rate:         getNum(row, colIdx.rate) || prod?.selling_price || 0,
              category:     getStr(row, colIdx.category),
              sub_category: getStr(row, colIdx.subcat),
              drg_no:       getStr(row, colIdx.drg),
              sap_no:       getStr(row, colIdx.sap),
              hsn_code:     getStr(row, colIdx.hsn),
              location:     getStr(row, colIdx.location),
              cost_price:   getNum(row, colIdx.cost),
              min_qty:      getNum(row, colIdx.minqty),
              max_qty:      getNum(row, colIdx.maxqty),
              cgst_rate:    getNum(row, colIdx.cgst),
              sgst_rate:    getNum(row, colIdx.sgst),
              igst_rate:    getNum(row, colIdx.igst),
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
              ? ` New stores created: ${result.storesCreated.join(", ")}.`
              : "";
            const summary = (result.created || []).map((c: any) => `${c.sopNo} → ${c.storeName} (${c.itemCount} rows)`).join(", ");
            setImportOk(`✓ ${result.created?.length} SOP entries created across ${entries.length} store(s).${newStoreMsg} ${summary}`);
            setMode("list");
          } catch (ex: any) { setImportErr("Bulk import failed: " + ex.message); }
          finally { setBulkImporting(false); }
          return;
        }

        // ── Single-store import (no Store column) ────────────────────────────
        const imported: SopItem[] = [];
        let lastCode = "", lastName = "", lastUom = "";
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          let code  = colIdx.code >= 0 ? String(row[colIdx.code] || "").trim() : "";
          let name  = colIdx.name >= 0 ? String(row[colIdx.name] || "").trim() : "";
          let uom   = colIdx.uom  >= 0 ? String(row[colIdx.uom]  || "Nos").trim() : "Nos";
          const batch  = getStr(row, colIdx.batch);
          const expiry = getStr(row, colIdx.expiry);
          const qty  = parseFloat(String(row[colIdx.qty] || "0")) || 0;
          const rate = getNum(row, colIdx.rate);

          // Multi-batch: inherit when item info blank but batch/qty present
          if (!code && !name && (batch || qty) && lastCode) {
            code = lastCode; name = lastName; uom = lastUom || uom;
          }
          if (!code && !name) continue;
          const prod = prodMap[code.toLowerCase()];
          const resolvedCode = prod?.code || code;
          const resolvedName = prod?.name || name || code;
          const resolvedUom  = uom || prod?.uom || prod?.unit || "Nos";
          if (code) { lastCode = resolvedCode; lastName = resolvedName; lastUom = resolvedUom; }
          imported.push(calcItem({
            sno: imported.length + 1,
            item_code: resolvedCode,
            item_name: resolvedName,
            uom: resolvedUom,
            batch_no: batch,
            expiry_date: expiry,
            opening_qty: qty, rate, amount: 0,
          }));
        }
        if (imported.length === 0) { setImportErr("No valid rows found in the file."); return; }
        setForm(f => ({ ...f, items: imported }));
        setImportOk(`${imported.length} row${imported.length !== 1 ? "s" : ""} imported. Select a store and save.`);
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

  // ── List ───────────────────────────────────────────────────────────────────
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

  // ── Form ───────────────────────────────────────────────────────────────────
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
          <button onClick={downloadTemplate}
            className="flex items-center gap-1.5 text-xs px-3 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
            title="Download Excel template (supports multi-batch rows)" data-testid="btn-download-template">
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

      {err       && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">{err}</div>}
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

      {/* Header fields */}
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
            <select value={form.financial_year}
              onChange={e => setForm(f => ({ ...f, financial_year: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
              data-testid="select-fy">
              <option value="">Select Year</option>
              {(financialYears as any[]).sort((a: any, b: any) => b.start_date?.localeCompare(a.start_date)).map((fy: any) => (
                <option key={fy.id} value={fy.label}>
                  {fy.label}{fy.is_current ? " (Current)" : ""}
                </option>
              ))}
            </select>
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
            <span>Use "+ Batch" to add multiple batches per item</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: 900 }}>
            <thead>
              <tr className="border-b" style={{ background: "#e8f6fb" }}>
                {["S.no","Item Code","Item Name","UOM","Batch No","Expiry Date","Opening Qty","Rate (₹)","Amount (₹)",""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {form.items.map((it, i) => {
                // Determine if this row is a continuation batch of the same item as the row above
                const isBatchContinue = i > 0 && form.items[i-1].item_code === it.item_code && it.item_code !== "";
                return (
                  <tr key={i} className={`border-b hover:bg-[#f0f9ff] ${isBatchContinue ? "bg-blue-50/30" : ""}`}>
                    <td className="px-3 py-1.5 text-gray-500 text-center w-8">{it.sno}</td>

                    {/* Item Code */}
                    <td className="px-1 py-1">
                      <input value={it.item_code}
                        onChange={e => setForm(f => { const items=[...f.items]; items[i]={...items[i], item_code: e.target.value}; return {...f,items}; })}
                        onBlur={() => updItem(i, "item_code", it.item_code)}
                        className={`border rounded px-2 py-1.5 w-24 outline-none focus:border-[#027fa5] text-xs uppercase
                          ${isBatchContinue ? "border-blue-200 bg-blue-50/50 text-gray-400" : "border-gray-300"}`}
                        placeholder="Code" data-testid={`input-code-${i}`}/>
                    </td>

                    {/* Item Name */}
                    <td className="px-1 py-1">
                      <input value={it.item_name}
                        onChange={e => setForm(f => { const items=[...f.items]; items[i]={...items[i], item_name: e.target.value}; return {...f,items}; })}
                        className={`border rounded px-2 py-1.5 w-40 outline-none focus:border-[#027fa5] text-xs
                          ${isBatchContinue ? "border-blue-200 bg-blue-50/50 text-gray-400" : "border-gray-300"}`}
                        placeholder="Item Name" data-testid={`input-name-${i}`}/>
                    </td>

                    {/* UOM */}
                    <td className="px-1 py-1">
                      <input value={it.uom}
                        onChange={e => updItem(i, "uom", e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1.5 w-14 outline-none focus:border-[#027fa5] text-xs text-center"
                        data-testid={`input-uom-${i}`}/>
                    </td>

                    {/* Batch No */}
                    <td className="px-1 py-1">
                      <input value={it.batch_no}
                        onChange={e => updItem(i, "batch_no", e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1.5 w-24 outline-none focus:border-[#027fa5] text-xs"
                        placeholder="Batch No" data-testid={`input-batch-${i}`}/>
                    </td>

                    {/* Expiry Date */}
                    <td className="px-1 py-1">
                      <input type="date" value={it.expiry_date}
                        onChange={e => updItem(i, "expiry_date", e.target.value)}
                        className="border border-gray-300 rounded px-2 py-1.5 w-32 outline-none focus:border-[#027fa5] text-xs"
                        data-testid={`input-expiry-${i}`}/>
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

                    {/* Amount */}
                    <td className="px-2 py-1 text-right font-semibold text-gray-800 tabular-nums w-24">
                      {n2(it.amount)}
                    </td>

                    {/* Actions */}
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-1.5">
                        {it.item_code && (
                          <button onClick={() => addBatchRow(i)}
                            className="text-[#027fa5] hover:text-[#025f80] text-[10px] border border-[#027fa5] rounded px-1.5 py-0.5 font-medium whitespace-nowrap"
                            title="Add another batch for this item"
                            data-testid={`btn-add-batch-${i}`}>
                            + Batch
                          </button>
                        )}
                        <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600"
                          data-testid={`btn-del-item-${i}`}><Trash2 size={12}/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
        <textarea value={form.remark}
          onChange={e => setForm(f => ({ ...f, remark: e.target.value }))}
          rows={2} placeholder="Notes about this opening entry…"
          className="w-full border border-gray-200 rounded px-3 py-2 text-sm outline-none focus:border-[#027fa5] resize-none"
          data-testid="textarea-remark"/>
      </div>

      {/* Excel import format note */}
      <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
        <div className="flex items-center gap-2 mb-2">
          <FileSpreadsheet size={14} className="text-green-600"/>
          <span className="text-xs font-semibold text-gray-700">Excel Import Format</span>
          <button onClick={downloadTemplate}
            className="ml-auto text-xs text-[#027fa5] underline hover:no-underline"
            data-testid="btn-download-template-bottom">
            Download Template
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="text-[10px] border border-gray-200 rounded">
            <thead>
              <tr style={{ background: "#027fa5" }}>
                {TEMPLATE_HEADERS.map(h => (
                  <th key={h} className="px-2 py-1.5 text-white font-semibold whitespace-nowrap border-r border-[#025f80]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TEMPLATE_SAMPLE.map((row, ri) => (
                <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2 py-1 border-r border-b border-gray-100 whitespace-nowrap text-gray-600">
                      {String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10px] text-gray-500">
          Tip: For items with multiple batch numbers, leave Item Code / Item Name blank in continuation rows — they will automatically inherit from the row above.
        </p>
      </div>
    </div>
  );
}
