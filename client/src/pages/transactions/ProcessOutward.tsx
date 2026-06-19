import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Printer, PencilLine, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import DatePicker from "@/components/DatePicker";
import { buildProcessOutwardHTML } from "@/lib/printProcessOutward";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

function today() { return new Date().toISOString().split("T")[0]; }
function fmtDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtNum(v: any, dp = 2) {
  const n = parseFloat(v || 0);
  return n.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

type PoItem = {
  _key: string;
  item_id: string; item_code: string; item_name: string;
  customer_ref: string; drawing_no: string; hsn: string;
  process_nature: string; bill_ref: string;
  qty: string; unit: string;
};

function newRow(): PoItem {
  return { _key: crypto.randomUUID(), item_id: "", item_code: "", item_name: "",
           customer_ref: "", drawing_no: "", hsn: "", process_nature: "",
           bill_ref: "", qty: "", unit: "" };
}

// ── Form ──────────────────────────────────────────────────────────────────────
function PoForm({ editData, onBack }: { editData?: any; onBack: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isEdit = !!editData?.id;

  const { data: suppliers = [] } = useQuery<any[]>({ queryKey: ["/api/suppliers"] });
  const { data: products = [] }  = useQuery<any[]>({ queryKey: ["/api/products"] });

  const [voucherNo,    setVoucherNo]    = useState(editData?.voucher_no || "");
  const [outwardDate,  setOutwardDate]  = useState(editData?.outward_date?.split("T")[0] || today());
  const [supplierId,   setSupplierId]   = useState(editData?.supplier_id || "");
  const [suppSearch,   setSuppSearch]   = useState(editData?.supplier_name || "");
  const [suppOpen,     setSuppOpen]     = useState(false);
  const [vehicleNo,    setVehicleNo]    = useState(editData?.vehicle_no || "");
  const [purpose,      setPurpose]      = useState(editData?.purpose || "");
  const [notes,        setNotes]        = useState(editData?.notes || "");
  const [items,        setItems]        = useState<PoItem[]>(
    editData?.items?.length
      ? editData.items.map((it: any) => ({ _key: crypto.randomUUID(), ...it, qty: String(it.qty || "") }))
      : [newRow()]
  );
  const [itemSearch,   setItemSearch]   = useState<Record<string, string>>({});
  const [itemDropOpen, setItemDropOpen] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit && !voucherNo) {
      fetch("/api/voucher-series/next/process_outward", { credentials: "include" })
        .then(r => r.json()).then(d => { if (d.voucher_no) setVoucherNo(d.voucher_no); }).catch(() => {});
    }
  }, [isEdit, voucherNo]);

  const filteredSuppliers = (suppliers as any[]).filter((s: any) =>
    !suppSearch || s.name.toLowerCase().includes(suppSearch.toLowerCase())
  );

  function selectSupplier(s: any) {
    setSupplierId(s.id); setSuppSearch(s.name); setSuppOpen(false);
  }

  function updateRow(key: string, field: keyof PoItem, val: string) {
    setItems(prev => prev.map(r => r._key === key ? { ...r, [field]: val } : r));
  }

  function selectItem(key: string, item: any) {
    setItems(prev => prev.map(r => r._key === key ? {
      ...r, item_id: item.id, item_code: item.code, item_name: item.name,
      hsn: item.hsn_code || r.hsn, unit: (item.unit || item.uom || r.unit || "").toUpperCase(),
    } : r));
    setItemSearch(prev => ({ ...prev, [key]: item.name }));
    setItemDropOpen(null);
  }

  const totalQty = items.reduce((s, r) => s + (parseFloat(r.qty) || 0), 0);

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        outward_date: outwardDate, supplier_id: supplierId || null,
        supplier_name_manual: !supplierId ? suppSearch : "",
        vehicle_no: vehicleNo, purpose, notes,
        items: items.filter(r => r.item_name || r.qty).map(r => ({
          item_id: r.item_id || null, item_code: r.item_code, item_name: r.item_name,
          customer_ref: r.customer_ref, drawing_no: r.drawing_no, hsn: r.hsn,
          process_nature: r.process_nature, bill_ref: r.bill_ref,
          qty: parseFloat(r.qty) || 0, unit: r.unit,
        })),
      };
      if (isEdit) return apiRequest("PATCH", `/api/process-outward/${editData.id}`, payload);
      return apiRequest("POST", "/api/process-outward", payload);
    },
    onSuccess: async (data: any) => {
      qc.invalidateQueries({ queryKey: ["/api/process-outward"] });
      toast({ title: isEdit ? "Updated" : "Saved", description: `${data.voucher_no} saved.` });
      // Ask for print
      if (!isEdit && confirm(`${data.voucher_no} saved. Print DC now?`)) {
        const full = await fetch(`/api/process-outward/${data.id}`, { credentials: "include" }).then(r => r.json());
        const w = window.open("", "_blank");
        if (w) { w.document.write(buildProcessOutwardHTML(full)); w.document.close(); setTimeout(() => w.print(), 600); }
      }
      onBack();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const th = "border border-gray-400 px-2 py-1.5 text-center text-xs font-semibold bg-gray-100";
  const td = "border border-gray-300 px-1 py-0.5";

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="flex items-center justify-between px-6 py-3 border-b" style={{ background: SC.tonal }}>
        <div>
          <div className="text-lg font-bold" style={{ color: SC.primary }}>Process Outward</div>
          <div className="text-xs text-gray-500">Send items for testing / calibration</div>
        </div>
        <div className="flex gap-2">
          <button onClick={onBack} className="px-4 py-1.5 rounded border text-sm bg-white">Cancel</button>
          <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
            className="px-4 py-1.5 rounded text-sm font-semibold text-white"
            style={{ background: SC.orange }}>
            {saveMut.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {/* Header fields */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-xs font-semibold text-gray-600">DC No.</label>
            <input value={voucherNo} readOnly className="w-full border rounded px-2 py-1 text-sm bg-gray-50 font-semibold" style={{ color: SC.primary }} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Date *</label>
            <DatePicker value={outwardDate} onChange={setOutwardDate} className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          <div className="relative">
            <label className="text-xs font-semibold text-gray-600">Supplier / Agency *</label>
            <input value={suppSearch} onChange={e => { setSuppSearch(e.target.value); setSuppOpen(true); setSupplierId(""); }}
              onFocus={() => setSuppOpen(true)} onBlur={() => setTimeout(() => setSuppOpen(false), 200)}
              className="w-full border rounded px-2 py-1 text-sm" placeholder="Search supplier…" />
            {suppOpen && filteredSuppliers.length > 0 && (
              <div className="absolute z-30 bg-white border rounded shadow-lg w-full max-h-48 overflow-auto mt-0.5">
                {filteredSuppliers.slice(0, 30).map((s: any) => (
                  <div key={s.id} className="px-3 py-1.5 hover:bg-blue-50 cursor-pointer text-sm"
                    onMouseDown={() => selectSupplier(s)}>{s.name}</div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600">Vehicle No.</label>
            <input value={vehicleNo} onChange={e => setVehicleNo(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm" placeholder="TN 12 AB 3456" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-gray-600">Purpose</label>
            <input value={purpose} onChange={e => setPurpose(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm" placeholder="Testing / Calibration / etc." />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-gray-600">Notes</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm" placeholder="Additional notes…" />
          </div>
        </div>

        {/* Items table */}
        <div className="overflow-x-auto rounded border">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className={th} style={{ width: 36 }}>#</th>
                <th className={th} style={{ width: 130 }}>Customer Ref</th>
                <th className={th} style={{ minWidth: 140 }}>Item / Description</th>
                <th className={th} style={{ width: 120 }}>Drawing No</th>
                <th className={th} style={{ width: 70 }}>HSN</th>
                <th className={th} style={{ minWidth: 140 }}>Process / Nature of Work</th>
                <th className={th} style={{ width: 100 }}>Bill / Ref No</th>
                <th className={th} style={{ width: 60 }}>UOM</th>
                <th className={th} style={{ width: 80 }}>Qty</th>
                <th className={th} style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, idx) => {
                const filtItems = (products as any[]).filter((p: any) =>
                  !itemSearch[row._key] || p.name.toLowerCase().includes((itemSearch[row._key] || "").toLowerCase()) ||
                  p.code.toLowerCase().includes((itemSearch[row._key] || "").toLowerCase())
                );
                return (
                  <tr key={row._key} className="hover:bg-blue-50">
                    <td className={`${td} text-center text-gray-500`}>{idx + 1}</td>
                    <td className={td}>
                      <input value={row.customer_ref} onChange={e => updateRow(row._key, "customer_ref", e.target.value)}
                        className="w-full px-1 py-0.5 text-xs border-0 focus:outline-none bg-transparent" />
                    </td>
                    <td className={`${td} relative`}>
                      <input value={itemSearch[row._key] ?? row.item_name}
                        onChange={e => { setItemSearch(p => ({ ...p, [row._key]: e.target.value })); updateRow(row._key, "item_name", e.target.value); setItemDropOpen(row._key); }}
                        onFocus={() => setItemDropOpen(row._key)}
                        onBlur={() => setTimeout(() => setItemDropOpen(null), 200)}
                        className="w-full px-1 py-0.5 text-xs border-0 focus:outline-none bg-transparent" placeholder="Search item…" />
                      {itemDropOpen === row._key && filtItems.length > 0 && (
                        <div className="absolute z-30 bg-white border rounded shadow-lg left-0 top-full w-64 max-h-40 overflow-auto">
                          {filtItems.slice(0, 20).map((p: any) => (
                            <div key={p.id} className="px-2 py-1 hover:bg-blue-50 cursor-pointer text-xs" onMouseDown={() => selectItem(row._key, p)}>
                              <span className="font-medium">{p.name}</span> <span className="text-gray-400">{p.code}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className={td}>
                      <input value={row.drawing_no} onChange={e => updateRow(row._key, "drawing_no", e.target.value)}
                        className="w-full px-1 py-0.5 text-xs border-0 focus:outline-none bg-transparent" />
                    </td>
                    <td className={td}>
                      <input value={row.hsn} onChange={e => updateRow(row._key, "hsn", e.target.value)}
                        className="w-full px-1 py-0.5 text-xs border-0 focus:outline-none bg-transparent" />
                    </td>
                    <td className={td}>
                      <input value={row.process_nature} onChange={e => updateRow(row._key, "process_nature", e.target.value)}
                        className="w-full px-1 py-0.5 text-xs border-0 focus:outline-none bg-transparent" placeholder="e.g. Zinc Plating" />
                    </td>
                    <td className={td}>
                      <input value={row.bill_ref} onChange={e => updateRow(row._key, "bill_ref", e.target.value)}
                        className="w-full px-1 py-0.5 text-xs border-0 focus:outline-none bg-transparent" />
                    </td>
                    <td className={td}>
                      <input value={row.unit} onChange={e => updateRow(row._key, "unit", e.target.value.toUpperCase())}
                        className="w-full px-1 py-0.5 text-xs border-0 focus:outline-none bg-transparent text-center" />
                    </td>
                    <td className={td}>
                      <input type="number" value={row.qty} onChange={e => updateRow(row._key, "qty", e.target.value)}
                        className="w-full px-1 py-0.5 text-xs border-0 focus:outline-none bg-transparent text-right" />
                    </td>
                    <td className={`${td} text-center`}>
                      <button onClick={() => setItems(p => p.filter(r => r._key !== row._key))}
                        className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={8} className="border border-gray-300 px-2 py-1 text-right text-xs font-semibold text-gray-600">Total Qty</td>
                <td className="border border-gray-300 px-2 py-1 text-right text-xs font-bold">{fmtNum(totalQty, 3)}</td>
                <td className="border border-gray-300"></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <button onClick={() => setItems(p => [...p, newRow()])}
          className="mt-2 flex items-center gap-1 text-xs px-3 py-1 rounded border"
          style={{ color: SC.primary, borderColor: SC.primary }}>
          <Plus size={13} /> Add Row
        </button>
      </div>
    </div>
  );
}

// ── List ──────────────────────────────────────────────────────────────────────
export default function ProcessOutward() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "form">("list");
  const [editData, setEditData] = useState<any>(null);
  const [search, setSearch] = useState("");

  const { data: records = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/process-outward"] });

  const delMut = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/process-outward/${id}`, {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/process-outward"] }); toast({ title: "Deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  async function printRecord(id: string) {
    const doc = await fetch(`/api/process-outward/${id}`, { credentials: "include" }).then(r => r.json());
    const w = window.open("", "_blank");
    if (w) { w.document.write(buildProcessOutwardHTML(doc)); w.document.close(); setTimeout(() => w.print(), 600); }
  }

  function openNew() { setEditData(null); setView("form"); }
  function openEdit(r: any) { setEditData(r); setView("form"); }
  function back() { setEditData(null); setView("list"); qc.invalidateQueries({ queryKey: ["/api/process-outward"] }); }

  if (view === "form") return <PoForm editData={editData} onBack={back} />;

  const filtered = (records as any[]).filter((r: any) =>
    !search || r.voucher_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.purpose?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full" style={{ fontFamily: "Source Sans Pro, sans-serif", background: SC.bg }}>
      <div className="flex items-center justify-between px-6 py-3 border-b bg-white">
        <div>
          <div className="text-xl font-bold" style={{ color: SC.primary }}>Process Outward</div>
          <div className="text-xs text-gray-500">DC for items sent for testing / calibration</div>
        </div>
        <button onClick={openNew} className="flex items-center gap-1 px-4 py-2 rounded text-white text-sm font-semibold"
          style={{ background: SC.orange }}>
          <Plus size={15} /> New Entry
        </button>
      </div>

      <div className="px-6 py-3 bg-white border-b">
        <div className="relative max-w-xs">
          <Search size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border rounded text-sm" placeholder="Search DC no, supplier, purpose…" />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? <div className="text-center py-12 text-gray-400">Loading…</div> : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ background: SC.tonal }}>
                  <th className="px-3 py-2 text-left text-xs font-semibold">DC No.</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Supplier / Agency</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Purpose</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Vehicle No</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">No records found</td></tr>
                ) : filtered.map((r: any) => (
                  <tr key={r.id} className="border-t hover:bg-blue-50">
                    <td className="px-3 py-2 font-semibold" style={{ color: SC.primary }}>{r.voucher_no}</td>
                    <td className="px-3 py-2">{fmtDate(r.outward_date)}</td>
                    <td className="px-3 py-2">{r.supplier_name || "—"}</td>
                    <td className="px-3 py-2 text-gray-600">{r.purpose || "—"}</td>
                    <td className="px-3 py-2 text-gray-500">{r.vehicle_no || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => printRecord(r.id)} title="Print DC"
                          className="p-1 rounded hover:bg-blue-100 text-blue-600"><Printer size={14} /></button>
                        <button onClick={() => openEdit(r)} title="Edit"
                          className="p-1 rounded hover:bg-orange-100 text-orange-600"><PencilLine size={14} /></button>
                        <button onClick={() => { if (confirm("Delete this entry?")) delMut.mutate(r.id); }}
                          title="Delete" className="p-1 rounded hover:bg-red-100 text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
