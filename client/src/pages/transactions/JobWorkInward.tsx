import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Trash2, Info, Upload, Camera, FolderOpen, X,
  Search, PencilLine, Loader2, AlertCircle, CheckCircle2
} from "lucide-react";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

// ── Quick-Add Party Modal ────────────────────────────────────────────────────
function QuickAddPartyModal({ defaultName, onCreated, onClose }: { defaultName: string; onCreated: (p: any) => void; onClose: () => void }) {
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: "", phone: "", address: "", gstin: "" }),
      });
      const party = await res.json();
      qc.invalidateQueries({ queryKey: ["/api/customers"] });
      onCreated(party);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6" style={{ fontFamily: "Source Sans Pro, sans-serif" }}>
        <h3 className="font-semibold text-gray-800 mb-4">Quick Add Party</h3>
        <div className="relative mb-4">
          <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10">Party Name *</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
            autoFocus data-testid="input-quick-party-name" />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-5 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700">Cancel</button>
          <button onClick={save} disabled={!name.trim() || saving}
            className="px-5 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }} data-testid="btn-quick-save-party">
            {saving ? "Saving..." : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Quick-Add Item Modal ─────────────────────────────────────────────────────
function QuickAddItemModal({ defaultName, onCreated, onClose }: { defaultName: string; onCreated: (it: any) => void; onClose: () => void }) {
  const [name, setName] = useState(defaultName);
  const [code, setCode] = useState("");
  const [hsn, setHsn] = useState("");
  const [uom, setUom] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const autoCode = code.trim() || `ITEM-${Date.now()}`;
      const res = await fetch("/api/purchase-store-items", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: autoCode, name: name.trim(), hsn_code: hsn, uom, isActive: true }),
      });
      const item = await res.json();
      qc.invalidateQueries({ queryKey: ["/api/purchase-store-items"] });
      onCreated(item);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.4)" }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6" style={{ fontFamily: "Source Sans Pro, sans-serif" }}>
        <h3 className="font-semibold text-gray-800 mb-4">Quick Add Item</h3>
        <div className="space-y-3">
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10">Item Name *</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
              autoFocus data-testid="input-quick-item-name" />
          </div>
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10">Item Code</label>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="Auto-generated if blank"
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
              data-testid="input-quick-item-code" />
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10">HSN</label>
              <input value={hsn} onChange={e => setHsn(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                data-testid="input-quick-item-hsn" />
            </div>
            <div className="relative flex-1">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10">Unit</label>
              <input value={uom} onChange={e => setUom(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                data-testid="input-quick-item-uom" />
            </div>
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-4">
          <button onClick={onClose} className="px-5 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700">Cancel</button>
          <button onClick={save} disabled={!name.trim() || saving}
            className="px-5 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }} data-testid="btn-quick-save-item">
            {saving ? "Saving..." : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Upload/Scan Modal ────────────────────────────────────────────────────────
function UploadScanModal({ onExtracted, onClose }: { onExtracted: (data: any) => void; onClose: () => void }) {
  const [stage, setStage] = useState<"pick" | "camera" | "extracting" | "error">("pick");
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function extract(file: File) {
    setStage("extracting");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/ai/extract-dc", {
        method: "POST", credentials: "include", body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Extraction failed");
      onExtracted(data);
      onClose();
    } catch (e: any) {
      setErrorMsg(e.message);
      setStage("error");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) extract(file);
  }

  async function startCamera() {
    setStage("camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setErrorMsg("Camera access denied or not available.");
      setStage("error");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    stopCamera();
    canvas.toBlob(blob => {
      if (blob) extract(new File([blob], "capture.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.9);
  }

  useEffect(() => () => { stopCamera(); }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" style={{ fontFamily: "Source Sans Pro, sans-serif" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Upload / Scan DC</h3>
          <button onClick={() => { stopCamera(); onClose(); }} className="text-gray-400 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>

        {stage === "pick" && (
          <div className="px-8 py-10 flex gap-8 justify-center">
            <button onClick={startCamera}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 hover:border-[#027fa5] hover:bg-[#d2f1fa]/30 transition-all group"
              data-testid="btn-scanner">
              <div className="w-16 h-16 rounded-full flex items-center justify-center group-hover:bg-[#d2f1fa] transition-colors" style={{ background: "#f0f9ff" }}>
                <Camera size={28} style={{ color: SC.primary }} />
              </div>
              <span className="text-sm font-semibold text-gray-700">Scanner / Camera</span>
            </button>
            <button onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-gray-200 hover:border-[#d74700] hover:bg-orange-50/30 transition-all group"
              data-testid="btn-local-folder">
              <div className="w-16 h-16 rounded-full flex items-center justify-center group-hover:bg-orange-50 transition-colors" style={{ background: "#fff7f0" }}>
                <FolderOpen size={28} style={{ color: SC.orange }} />
              </div>
              <span className="text-sm font-semibold text-gray-700">Local Folder</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} />
          </div>
        )}

        {stage === "camera" && (
          <div className="flex flex-col items-center gap-4 p-6">
            <video ref={videoRef} autoPlay playsInline className="w-full rounded-lg bg-black max-h-64 object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex gap-3">
              <button onClick={() => { stopCamera(); setStage("pick"); }}
                className="px-5 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700">Back</button>
              <button onClick={capturePhoto}
                className="px-6 py-2 rounded text-sm font-semibold text-white flex items-center gap-2"
                style={{ background: SC.primary }} data-testid="btn-capture">
                <Camera size={16} /> Capture
              </button>
            </div>
          </div>
        )}

        {stage === "extracting" && (
          <div className="flex flex-col items-center gap-4 py-12 px-6">
            <Loader2 size={36} className="animate-spin" style={{ color: SC.primary }} />
            <p className="text-sm text-gray-600 font-medium text-center">AI is reading your DC document...<br /><span className="text-xs text-gray-400">This usually takes 5–10 seconds</span></p>
          </div>
        )}

        {stage === "error" && (
          <div className="flex flex-col items-center gap-4 py-10 px-6">
            <AlertCircle size={36} className="text-red-500" />
            <p className="text-sm text-red-600 text-center font-medium">{errorMsg}</p>
            <div className="flex gap-3">
              <button onClick={() => setStage("pick")} className="px-5 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700">Try Again</button>
              <button onClick={onClose} className="px-5 py-2 rounded text-sm font-semibold text-white" style={{ background: SC.orange }}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Item Row ────────────────────────────────────────────────────────────────
type ItemRow = {
  _key: string;
  item_id: string;
  item_code: string;
  item_name: string;
  qty: string;
  unit: string;
  process: string;
  hsn: string;
  remark: string;
};

function newRow(): ItemRow {
  return { _key: crypto.randomUUID(), item_id: "", item_code: "", item_name: "", qty: "", unit: "", process: "", hsn: "", remark: "" };
}

// ── Inward Form ──────────────────────────────────────────────────────────────
function InwardForm({ editData, onBack }: { editData?: any; onBack: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!editData?.id;

  const { data: customers = [] } = useQuery<any[]>({ queryKey: ["/api/customers"] });
  const { data: storeItems = [] } = useQuery<any[]>({ queryKey: ["/api/purchase-store-items"] });

  const [partyId, setPartyId] = useState(editData?.party_id || "");
  const [partySearch, setPartySearch] = useState(editData?.party_name_db || editData?.party_name_manual || "");
  const [partyDropOpen, setPartyDropOpen] = useState(false);
  const [quickParty, setQuickParty] = useState<string | null>(null);

  const [inwardNo, setInwardNo] = useState(editData?.voucher_no || "");

  // Pre-load next voucher number when opening a new entry
  useEffect(() => {
    if (!isEdit && !inwardNo) {
      fetch("/api/voucher-series/next/job_work_inward", { credentials: "include" })
        .then(r => r.json())
        .then(d => { if (d.voucher_no) setInwardNo(d.voucher_no); })
        .catch(() => {});
    }
  }, []);
  const [inwardDate, setInwardDate] = useState(editData?.inward_date?.split("T")[0] || new Date().toISOString().split("T")[0]);
  const [partyDcNo, setPartyDcNo] = useState(editData?.party_dc_no || "");
  const [partyDcDate, setPartyDcDate] = useState(editData?.party_dc_date?.split("T")[0] || "");
  const [deliveryDate, setDeliveryDate] = useState(editData?.delivery_date?.split("T")[0] || "");
  const [workOrderNo, setWorkOrderNo] = useState(editData?.work_order_no || "");
  const [partyPoNo, setPartyPoNo] = useState(editData?.party_po_no || "");
  const [vehicleNo, setVehicleNo] = useState(editData?.vehicle_no || "");
  const [notes, setNotes] = useState(editData?.notes || "");

  const [items, setItems] = useState<ItemRow[]>(
    editData?.items?.length
      ? editData.items.map((it: any) => ({ _key: crypto.randomUUID(), item_id: it.item_id || "", item_code: it.item_code || "", item_name: it.item_name || "", qty: String(it.qty || ""), unit: it.unit || "", process: it.process || "", hsn: it.hsn || "", remark: it.remark || "" }))
      : [newRow()]
  );

  const [showScan, setShowScan] = useState(false);
  const [quickItem, setQuickItem] = useState<{ idx: number; name: string } | null>(null);
  const [error, setError] = useState("");
  const [aiSuccess, setAiSuccess] = useState(false);

  // Item search state per row
  const [itemSearch, setItemSearch] = useState<Record<string, string>>({});
  const [itemDropOpen, setItemDropOpen] = useState<string | null>(null);

  const totalQty = items.reduce((a, r) => a + (parseFloat(r.qty) || 0), 0);

  function updateRow(key: string, field: keyof ItemRow, val: string) {
    setItems(prev => prev.map(r => r._key === key ? { ...r, [field]: val } : r));
  }
  function addRow() { setItems(prev => [...prev, newRow()]); }
  function removeRow(key: string) { setItems(prev => prev.filter(r => r._key !== key)); }
  function removeAll() { setItems([newRow()]); }

  function selectItem(rowKey: string, item: any) {
    setItems(prev => prev.map(r => r._key === rowKey ? {
      ...r, item_id: item.id, item_code: item.code, item_name: item.name,
      unit: item.uom || r.unit, hsn: item.hsn_code || r.hsn,
    } : r));
    setItemSearch(prev => ({ ...prev, [rowKey]: item.name }));
    setItemDropOpen(null);
  }

  function onExtracted(data: any) {
    setAiSuccess(true);
    setTimeout(() => setAiSuccess(false), 3000);
    // Party
    if (data.partyName) {
      setPartySearch(data.partyName);
      const match = customers.find((s: any) => s.name.toLowerCase().includes(data.partyName.toLowerCase()));
      if (match) setPartyId(match.id);
    }
    if (data.dcNo) setPartyDcNo(data.dcNo);
    if (data.dcDate) setPartyDcDate(data.dcDate);
    if (data.deliveryDate) setDeliveryDate(data.deliveryDate);
    if (data.vehicleNo) setVehicleNo(data.vehicleNo);
    if (data.items?.length) {
      setItems(data.items.map((it: any) => {
        const match = storeItems.find((s: any) => s.code?.toLowerCase() === it.itemCode?.toLowerCase() || s.name?.toLowerCase() === it.itemName?.toLowerCase());
        return {
          _key: crypto.randomUUID(),
          item_id: match?.id || "",
          item_code: it.itemCode || match?.code || "",
          item_name: it.itemName || match?.name || "",
          qty: String(it.qty || ""),
          unit: it.unit || match?.uom || "",
          process: it.process || "",
          hsn: it.hsn || match?.hsn_code || "",
          remark: it.remark || "",
        };
      }));
    }
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        party_id: partyId || null,
        party_name_manual: partyId ? "" : partySearch,
        inward_date: inwardDate,
        party_dc_no: partyDcNo,
        party_dc_date: partyDcDate || null,
        delivery_date: deliveryDate || null,
        work_order_no: workOrderNo,
        party_po_no: partyPoNo,
        vehicle_no: vehicleNo,
        notes,
        items: items.filter(r => r.item_name || r.qty).map(r => ({
          item_id: r.item_id || null, item_code: r.item_code, item_name: r.item_name,
          qty: r.qty || "0", unit: r.unit, process: r.process, hsn: r.hsn, remark: r.remark,
        })),
      };
      const url = isEdit ? `/api/job-work-inward/${editData.id}` : "/api/job-work-inward";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Save failed"); }
      return res.json();
    },
    onSuccess: (data) => {
      if (!isEdit && data.voucher_no) setInwardNo(data.voucher_no);
      qc.invalidateQueries({ queryKey: ["/api/job-work-inward"] });
      onBack();
    },
    onError: (e: any) => setError(e.message),
  });

  const filteredCustomers = customers.filter((s: any) =>
    !partySearch || s.name.toLowerCase().includes(partySearch.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm">
        {/* Card Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800 text-base">Inward Entry</h2>
          <div className="flex items-center gap-2">
            {aiSuccess && (
              <span className="flex items-center gap-1.5 text-green-600 text-xs font-semibold">
                <CheckCircle2 size={14} /> AI data applied
              </span>
            )}
            <button
              onClick={() => setShowScan(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-colors hover:bg-[#d2f1fa]"
              style={{ borderColor: SC.primary, color: SC.primary }}
              data-testid="btn-upload-scan"
            >
              <Upload size={14} /> Upload / Scan
            </button>
            <Info size={16} className="text-gray-400 cursor-pointer" />
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Row 1 — Party Name | Inward No | Inward Date */}
          <div className="grid grid-cols-3 gap-4">
            {/* Party Name — searchable dropdown with quick-add */}
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Customer Name</label>
              <div className="flex">
                <input
                  value={partySearch}
                  onChange={e => { setPartySearch(e.target.value); setPartyId(""); setPartyDropOpen(true); }}
                  onFocus={() => setPartyDropOpen(true)}
                  placeholder="Search or type customer..."
                  className="flex-1 border border-gray-300 rounded-l px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                  data-testid="input-party-search"
                />
                <button
                  onClick={() => setQuickParty(partySearch)}
                  className="border border-l-0 border-gray-300 rounded-r px-2.5 text-gray-500 hover:bg-[#d2f1fa] hover:text-[#027fa5] transition-colors"
                  title="Quick add new party"
                  data-testid="btn-quick-add-party"
                >
                  <Plus size={14} />
                </button>
              </div>
              {partyDropOpen && partySearch && filteredCustomers.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-40 overflow-y-auto mt-0.5">
                  {filteredCustomers.slice(0, 8).map((s: any) => (
                    <button key={s.id} onClick={() => { setPartyId(s.id); setPartySearch(s.name); setPartyDropOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#d2f1fa] transition-colors"
                      data-testid={`opt-party-${s.id}`}>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Inward No */}
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Inward No</label>
              <input value={inwardNo} onChange={e => setInwardNo(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#027fa5]"
                style={{ color: SC.primary }}
                data-testid="input-inward-no" />
            </div>

            {/* Inward Date */}
            <div className="relative">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Inward Date</label>
              <input type="date" value={inwardDate} onChange={e => setInwardDate(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                data-testid="input-inward-date" />
            </div>
          </div>

          {/* Row 2 — DC details */}
          <div className="grid grid-cols-6 gap-3">
            <div className="relative col-span-1">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Party DC No</label>
              <input value={partyDcNo} onChange={e => setPartyDcNo(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                data-testid="input-party-dc-no" />
            </div>
            <div className="relative col-span-1">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Party Dc Date</label>
              <input type="date" value={partyDcDate} onChange={e => setPartyDcDate(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                data-testid="input-party-dc-date" />
            </div>
            <div className="relative col-span-1">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Delivery Date</label>
              <input type="date" value={deliveryDate} onChange={e => setDeliveryDate(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                data-testid="input-delivery-date" />
            </div>
            <div className="relative col-span-1">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Work Order No</label>
              <input value={workOrderNo} onChange={e => setWorkOrderNo(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                data-testid="input-work-order-no" />
            </div>
            <div className="relative col-span-1">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Party PO No</label>
              <input value={partyPoNo} onChange={e => setPartyPoNo(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                data-testid="input-party-po-no" />
            </div>
            <div className="relative col-span-1">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Vehicle No</label>
              <input value={vehicleNo} onChange={e => setVehicleNo(e.target.value)} placeholder="TN 00 AB 1234"
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                data-testid="input-vehicle-no" />
            </div>
          </div>

          {/* Item Grid */}
          <div className="border border-gray-200 rounded-lg overflow-hidden" onClick={() => { setPartyDropOpen(false); }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: SC.tonal }}>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-10">S.no</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-28">Item Code</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700">Item Name</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-16">Qty</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-16">Unit</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-24">Process</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-20">HSN</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700">Remark</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, i) => {
                  const filteredItems = storeItems.filter((s: any) =>
                    !itemSearch[row._key] || s.name?.toLowerCase().includes(itemSearch[row._key].toLowerCase()) || s.code?.toLowerCase().includes(itemSearch[row._key].toLowerCase())
                  );
                  return (
                    <tr key={row._key} className={`border-t border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                      data-testid={`row-item-${i}`}>
                      <td className="px-3 py-1.5 text-gray-500 text-center text-xs">{String(i + 1).padStart(2, "0")}</td>

                      {/* Item Code */}
                      <td className="px-2 py-1.5">
                        <input value={row.item_code} onChange={e => updateRow(row._key, "item_code", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-[#027fa5]"
                          data-testid={`input-item-code-${i}`} />
                      </td>

                      {/* Item Name — searchable with quick-add */}
                      <td className="px-2 py-1.5 relative">
                        <div className="flex">
                          <input
                            value={itemSearch[row._key] !== undefined ? itemSearch[row._key] : row.item_name}
                            onChange={e => {
                              setItemSearch(prev => ({ ...prev, [row._key]: e.target.value }));
                              updateRow(row._key, "item_name", e.target.value);
                              updateRow(row._key, "item_id", "");
                              setItemDropOpen(row._key);
                            }}
                            onFocus={() => setItemDropOpen(row._key)}
                            placeholder="Search item..."
                            className="flex-1 border border-gray-200 rounded-l px-2 py-1 text-xs outline-none focus:border-[#027fa5]"
                            data-testid={`input-item-name-${i}`}
                          />
                          <button
                            onClick={() => setQuickItem({ idx: i, name: itemSearch[row._key] || row.item_name })}
                            className="border border-l-0 border-gray-200 rounded-r px-1.5 text-gray-400 hover:bg-[#d2f1fa] hover:text-[#027fa5] transition-colors"
                            title="Quick add new item"
                            data-testid={`btn-quick-add-item-${i}`}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        {itemDropOpen === row._key && (itemSearch[row._key] || "").length > 0 && filteredItems.length > 0 && (
                          <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-36 overflow-y-auto mt-0.5">
                            {filteredItems.slice(0, 8).map((s: any) => (
                              <button key={s.id} onClick={() => selectItem(row._key, s)}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#d2f1fa] transition-colors"
                                data-testid={`opt-item-${s.id}`}>
                                <span className="font-medium">{s.code}</span> — {s.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>

                      <td className="px-2 py-1.5">
                        <input type="number" value={row.qty} onChange={e => updateRow(row._key, "qty", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-[#027fa5] text-right"
                          data-testid={`input-qty-${i}`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={row.unit} onChange={e => updateRow(row._key, "unit", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-[#027fa5]"
                          data-testid={`input-unit-${i}`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={row.process} onChange={e => updateRow(row._key, "process", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-[#027fa5]"
                          data-testid={`input-process-${i}`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={row.hsn} onChange={e => updateRow(row._key, "hsn", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-[#027fa5]"
                          data-testid={`input-hsn-${i}`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={row.remark} onChange={e => updateRow(row._key, "remark", e.target.value)}
                          placeholder="Enter the Remark Here"
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-[#027fa5] text-gray-400 placeholder:text-gray-300"
                          data-testid={`input-remark-${i}`} />
                      </td>
                      <td className="px-1 py-1.5 text-center">
                        <button onClick={() => removeRow(row._key)}
                          className="p-1 text-red-400 hover:text-red-600 rounded transition-colors"
                          data-testid={`btn-remove-row-${i}`}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Grid footer */}
            <div className="flex items-center justify-between px-3 py-2.5 border-t border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2">
                <button onClick={addRow}
                  className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded transition-colors"
                  style={{ color: SC.primary, border: `1px solid ${SC.primary}` }}
                  data-testid="btn-add-row">
                  <Plus size={12} /> Add Row
                </button>
                <button onClick={removeAll}
                  className="text-xs font-medium text-gray-500 hover:text-red-500 px-3 py-1.5 rounded border border-gray-200 transition-colors"
                  data-testid="btn-remove-all">
                  Remove all
                </button>
              </div>
              <div className="text-sm font-semibold text-gray-700">
                Total Quantity : <span style={{ color: SC.primary }}>{totalQty.toFixed(totalQty % 1 === 0 ? 0 : 2)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5] resize-none"
              data-testid="input-notes" />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-xs px-1">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onBack}
            className="px-8 py-2 rounded border text-sm font-semibold text-gray-700 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }} data-testid="btn-cancel">Cancel</button>
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            className="px-8 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }} data-testid="btn-save">
            {saveMut.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Modals */}
      {showScan && <UploadScanModal onExtracted={onExtracted} onClose={() => setShowScan(false)} />}
      {quickParty !== null && (
        <QuickAddPartyModal
          defaultName={quickParty}
          onCreated={p => { setPartyId(p.id); setPartySearch(p.name); setQuickParty(null); }}
          onClose={() => setQuickParty(null)}
        />
      )}
      {quickItem !== null && (
        <QuickAddItemModal
          defaultName={quickItem.name}
          onCreated={item => {
            const rowKey = items[quickItem.idx]?._key;
            if (rowKey) selectItem(rowKey, item);
            setQuickItem(null);
          }}
          onClose={() => setQuickItem(null)}
        />
      )}
    </div>
  );
}

// ── Job Work Inward List ─────────────────────────────────────────────────────
export default function JobWorkInward() {
  const [view, setView] = useState<"list" | "add" | "edit">("list");
  const [editData, setEditData] = useState<any>(null);
  const [search, setSearch] = useState("");

  const { data: records = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/job-work-inward"] });
  const qc = useQueryClient();

  const deleteMut = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/job-work-inward/${id}`, { method: "DELETE", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/job-work-inward"] }),
  });

  async function handleEdit(r: any) {
    const res = await fetch(`/api/job-work-inward/${r.id}`, { credentials: "include" });
    const data = await res.json();
    setEditData(data);
    setView("edit");
  }

  const filtered = records.filter(r =>
    !search || r.voucher_no?.toLowerCase().includes(search.toLowerCase()) ||
    r.party_name_db?.toLowerCase().includes(search.toLowerCase()) ||
    r.party_name_manual?.toLowerCase().includes(search.toLowerCase())
  );

  if (view === "add") return <InwardForm onBack={() => setView("list")} />;
  if (view === "edit") return <InwardForm editData={editData} onBack={() => { setEditData(null); setView("list"); }} />;

  return (
    <div className="p-6" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h1 className="font-semibold text-gray-800 text-base">Job Work Inward</h1>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by voucher / party..."
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded w-56 outline-none focus:border-[#027fa5]"
                data-testid="input-search" />
            </div>
          </div>
        </div>

        {/* Table */}
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: SC.tonal }}>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700 w-12">S.no</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Voucher No</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Date</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Party</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">DC No</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Vehicle</th>
              <th className="px-5 py-2.5 text-left font-semibold text-gray-700">Status</th>
              <th className="px-3 py-2.5 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} className="px-5 py-10 text-center text-gray-400 text-sm">Loading...</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Upload size={28} />
                    <div className="text-sm font-medium">No inward entries yet</div>
                    <div className="text-xs">Click "Add" to create your first Job Work Inward entry</div>
                  </div>
                </td>
              </tr>
            )}
            {filtered.map((r, i) => (
              <tr key={r.id} className={`border-t border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}
                data-testid={`row-inward-${r.id}`}>
                <td className="px-5 py-2.5 text-gray-500">{i + 1}</td>
                <td className="px-5 py-2.5 font-semibold text-gray-800" style={{ color: SC.primary }}>{r.voucher_no}</td>
                <td className="px-5 py-2.5 text-gray-600 text-xs">{r.inward_date ? new Date(r.inward_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                <td className="px-5 py-2.5 font-medium text-gray-700">{r.party_name_db || r.party_name_manual || <span className="text-gray-300">—</span>}</td>
                <td className="px-5 py-2.5 text-gray-600 text-xs">{r.party_dc_no || <span className="text-gray-300">—</span>}</td>
                <td className="px-5 py-2.5 text-gray-600 text-xs">{r.vehicle_no || <span className="text-gray-300">—</span>}</td>
                <td className="px-5 py-2.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${r.status === "Saved" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                    {r.status || "Draft"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <button onClick={() => handleEdit(r)}
                    className="p-1.5 rounded hover:bg-blue-50 transition-colors" style={{ color: SC.primary }}
                    data-testid={`btn-edit-${r.id}`}>
                    <PencilLine size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 py-3 border-t border-gray-100">
          <button className="px-8 py-2 rounded border text-sm font-medium text-gray-700 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }} data-testid="btn-cancel">Cancel</button>
          <button onClick={() => setView("add")}
            className="px-8 py-2 rounded text-sm font-semibold text-white"
            style={{ background: SC.orange }} data-testid="btn-add">Add</button>
        </div>
      </div>
    </div>
  );
}
