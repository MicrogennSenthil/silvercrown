import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { createPortal } from "react-dom";
import {
  Plus, Trash2, Info, Upload, Camera, FolderOpen, X,
  Search, PencilLine, Loader2, AlertCircle, CheckCircle2, Receipt
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

// Normalize an uploaded image to a clean baseline JPEG before sending to the AI.
// Re-encodes via canvas (downscales oversized images, flattens transparency onto
// white, strips odd color profiles) — fixes most "invalid image data" errors.
// PDFs and non-image files pass through untouched.
async function normalizeImageFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file; // PDFs etc. → leave as-is
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
  const img: HTMLImageElement = await new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error("Could not read this image format. Please upload a JPG or PNG image, or take a photo instead."));
    im.src = dataUrl;
  });
  const maxDim = 2200;
  let { width, height } = img;
  if (!width || !height) return file;
  if (width > maxDim || height > maxDim) {
    const scale = Math.min(maxDim / width, maxDim / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) return file;
  const baseName = file.name.replace(/\.[^.]+$/, "") || "scan";
  return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
}

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
function QuickAddUomModal({ onCreated, onClose }: { onCreated: (u: any) => void; onClose: () => void }) {
  const [uomName, setUomName] = useState("");
  const [uomCode, setUomCode] = useState("");
  const [shortForm, setShortForm] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  async function save() {
    if (!uomName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/uom", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: uomCode.trim() || uomName.trim().toUpperCase(), name: uomName.trim(), shortForm: shortForm.trim() || uomCode.trim() || uomName.trim(), isActive: true }),
      });
      const u = await res.json();
      qc.invalidateQueries({ queryKey: ["/api/uom"] });
      onCreated(u);
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xs mx-4 p-5" style={{ fontFamily: "Source Sans Pro, sans-serif" }}>
        <h3 className="font-semibold text-gray-800 mb-3 text-sm">Quick Add Unit of Measure</h3>
        <div className="space-y-3">
          <div className="relative">
            <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10">Name *</label>
            <input value={uomName} onChange={e => setUomName(e.target.value)} autoFocus
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-[#027fa5]"
              placeholder="e.g. Numbers" data-testid="input-quick-uom-name" />
          </div>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10">Code</label>
              <input value={uomCode} onChange={e => setUomCode(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-[#027fa5]"
                placeholder="NOS" data-testid="input-quick-uom-code" />
            </div>
            <div className="relative flex-1">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10">Short Form</label>
              <input value={shortForm} onChange={e => setShortForm(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:border-[#027fa5]"
                placeholder="Nos" data-testid="input-quick-uom-short" />
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-4">
          <button onClick={onClose} className="px-4 py-1.5 border border-gray-300 rounded text-sm text-gray-700">Cancel</button>
          <button onClick={save} disabled={!uomName.trim() || saving}
            className="px-4 py-1.5 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }} data-testid="btn-quick-save-uom">
            {saving ? "Saving..." : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function QuickAddItemModal({ defaultName, onCreated, onClose }: { defaultName: string; onCreated: (it: any) => void; onClose: () => void }) {
  const [name, setName] = useState(defaultName);
  const [code, setCode] = useState("");
  const [hsn, setHsn] = useState("");
  const [uom, setUom] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAddUom, setShowAddUom] = useState(false);
  const qc = useQueryClient();
  const { data: uomList = [] } = useQuery<any[]>({ queryKey: ["/api/uom"] });

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const autoCode = code.trim() || `ITEM-${Date.now()}`;
      const res = await fetch("/api/products", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: autoCode, name: name.trim(), hsn_code: hsn, uom, isActive: true }),
      });
      const item = await res.json();
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      onCreated(item);
    } finally { setSaving(false); }
  }

  return (
    <>
      {showAddUom && (
        <QuickAddUomModal
          onCreated={u => { setUom(u.shortForm || u.code); setShowAddUom(false); }}
          onClose={() => setShowAddUom(false)}
        />
      )}
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
                <div className="flex">
                  <select value={uom} onChange={e => setUom(e.target.value)}
                    className="flex-1 border border-gray-300 rounded-l px-2 py-2.5 text-sm outline-none focus:border-[#027fa5] bg-white"
                    data-testid="select-quick-item-uom">
                    <option value="">— Select —</option>
                    {(uomList as any[]).filter((u: any) => u.isActive !== false).map((u: any) => (
                      <option key={u.id} value={u.shortForm || u.code}>{u.shortForm || u.code}</option>
                    ))}
                  </select>
                  <button onClick={() => setShowAddUom(true)} title="Add new unit"
                    className="border border-l-0 border-gray-300 rounded-r px-2 text-gray-500 hover:bg-[#d2f1fa] hover:text-[#027fa5] transition-colors"
                    data-testid="btn-quick-add-uom">
                    <Plus size={14} />
                  </button>
                </div>
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
    </>
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
      const prepared = await normalizeImageFile(file);
      const form = new FormData();
      form.append("file", prepared);
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

// ── Scan Item Verification Modal ─────────────────────────────────────────────
type PendingVerifyItem = {
  _key: string;
  aiName: string;
  item_id: string;
  item_code: string;
  item_name: string;
  sap_no: string;
  drg_no: string;
  qty: string;
  unit: string;
  hsn: string;
  process: string;
  remark: string;
};

function ScanItemVerifyModal({
  pendingData, storeItems, customers, onConfirm, onCancel,
}: {
  pendingData: any;
  storeItems: any[];
  customers: any[];
  onConfirm: (result: { partyId: string; partyName: string; dcNo: string; dcDate: string; deliveryDate: string; vehicleNo: string; items: PendingVerifyItem[] }) => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState<PendingVerifyItem[]>(() =>
    (pendingData.items || []).map((it: any) => {
      const match = storeItems.find((s: any) =>
        (it.itemCode && s.code?.toLowerCase() === it.itemCode?.toLowerCase()) ||
        (it.itemName && s.name?.toLowerCase() === it.itemName?.toLowerCase())
      );
      return {
        _key: crypto.randomUUID(),
        aiName: it.itemName || it.itemCode || "",
        item_id: match?.id || "",
        item_code: it.itemCode || match?.code || "",
        item_name: it.itemName || match?.name || "",
        sap_no: it.sapNo || match?.sapNo || match?.sap_no || "",
        drg_no: it.drgNo || match?.drgNo || match?.drg_no || "",
        qty: String(it.qty || ""),
        unit: (it.unit || match?.uom || "").toUpperCase(),
        hsn: it.hsn || match?.hsnCode || match?.hsn_code || "",
        process: it.process || "",
        remark: it.remark || "",
      };
    })
  );

  const [partyName, setPartyName] = useState(pendingData.partyName || "");
  const [partyId, setPartyId] = useState(() => {
    if (!pendingData.partyName) return "";
    const m = customers.find((c: any) => c.name.toLowerCase().includes((pendingData.partyName || "").toLowerCase()));
    return m?.id || "";
  });
  const [partyDropOpen, setPartyDropOpen] = useState(false);
  const [itemSearch, setItemSearch] = useState<Record<string, string>>({});
  const [itemDropOpen, setItemDropOpen] = useState<string | null>(null);

  function updateRow(key: string, field: keyof PendingVerifyItem, val: string) {
    setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: val } : r));
  }

  function selectMasterItem(rowKey: string, item: any) {
    setRows(prev => prev.map(r => r._key === rowKey ? {
      ...r, item_id: item.id, item_code: item.code, item_name: item.name,
      sap_no: item.sapNo || item.sap_no || r.sap_no, drg_no: item.drgNo || item.drg_no || r.drg_no,
      unit: (item.unit || item.uom || r.unit || "").toUpperCase(),
      hsn: item.hsnCode || item.hsn_code || r.hsn,
    } : r));
    setItemSearch(prev => ({ ...prev, [rowKey]: item.name }));
    setItemDropOpen(null);
  }

  const filteredParties = customers.filter((c: any) =>
    !partyName || c.name.toLowerCase().includes(partyName.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl mx-4 flex flex-col" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-gray-800 text-base">Verify Scanned Items</h3>
            <p className="text-xs text-gray-400 mt-0.5">Review and correct AI-extracted data before filling the inward grid</p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"><X size={18}/></button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Party + header info */}
          <div className="flex gap-4 items-end flex-wrap">
            <div className="relative" style={{ minWidth: 260 }}>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Customer Name <span className="text-amber-500">(AI detected — verify)</span>
              </label>
              <input
                value={partyName}
                onChange={e => { setPartyName(e.target.value); setPartyId(""); setPartyDropOpen(true); }}
                onFocus={() => setPartyDropOpen(true)}
                onBlur={() => setTimeout(() => setPartyDropOpen(false), 150)}
                className="w-full border border-gray-300 rounded px-3 h-[34px] text-sm outline-none focus:border-[#027fa5]"
              />
              {partyDropOpen && filteredParties.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-36 overflow-y-auto mt-0.5">
                  {filteredParties.map((c: any) => (
                    <button key={c.id} onMouseDown={() => { setPartyId(c.id); setPartyName(c.name); setPartyDropOpen(false); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#d2f1fa]">{c.name}</button>
                  ))}
                </div>
              )}
              {partyId && <span className="absolute top-0 right-0 text-xs text-green-600 font-semibold">✓ Matched</span>}
            </div>
            <div className="text-xs text-gray-500 pb-1.5 flex gap-4">
              {pendingData.dcNo && <span>DC No: <span className="font-semibold text-gray-700">{pendingData.dcNo}</span></span>}
              {pendingData.dcDate && <span>Date: <span className="font-semibold text-gray-700">{pendingData.dcDate}</span></span>}
              {pendingData.vehicleNo && <span>Vehicle: <span className="font-semibold text-gray-700">{pendingData.vehicleNo}</span></span>}
            </div>
          </div>

          {/* Items table */}
          <div>
            <div className="text-xs font-semibold text-gray-600 mb-2">
              Items ({rows.length}) &nbsp;<span className="font-normal text-gray-400">— Select from item master to link. Unmatched items will be auto-created on save.</span>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-visible">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "#d2f1fa" }}>
                    <th className="px-2 py-2.5 text-left font-semibold text-gray-700 w-8">#</th>
                    <th className="px-2 py-2.5 text-left font-semibold text-gray-700 w-44">AI Extracted</th>
                    <th className="px-2 py-2.5 text-left font-semibold text-gray-700">Item Master Match</th>
                    <th className="px-2 py-2.5 text-left font-semibold text-gray-700 w-20">Qty</th>
                    <th className="px-2 py-2.5 text-left font-semibold text-gray-700 w-20">Unit</th>
                    <th className="px-2 py-2.5 text-left font-semibold text-gray-700 w-24">HSN</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const isMatched = !!row.item_id;
                    const filteredItems = storeItems.filter((s: any) => {
                      const q = (itemSearch[row._key] !== undefined ? itemSearch[row._key] : row.item_name).toLowerCase();
                      return !q || s.name?.toLowerCase().includes(q) || s.code?.toLowerCase().includes(q);
                    });
                    return (
                      <tr key={row._key} className={`border-t border-gray-100 ${!isMatched ? "bg-amber-50/40" : ""}`}>
                        <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                        <td className="px-2 py-1.5 text-gray-500 max-w-[160px]">
                          <span className="block truncate" title={row.aiName}>{row.aiName || "—"}</span>
                        </td>
                        <td className="px-2 py-1.5 relative">
                          <div className="flex items-center gap-1">
                            {isMatched
                              ? <CheckCircle2 size={11} className="text-green-500 shrink-0"/>
                              : <AlertCircle size={11} className="text-amber-500 shrink-0"/>}
                            <input
                              value={itemSearch[row._key] !== undefined ? itemSearch[row._key] : row.item_name}
                              onChange={e => {
                                setItemSearch(prev => ({ ...prev, [row._key]: e.target.value }));
                                updateRow(row._key, "item_name", e.target.value);
                                updateRow(row._key, "item_id", "");
                                setItemDropOpen(row._key);
                              }}
                              onFocus={() => setItemDropOpen(row._key)}
                              onBlur={() => setTimeout(() => setItemDropOpen(null), 150)}
                              placeholder="Select or type item..."
                              className="flex-1 border border-gray-200 rounded px-2 h-7 text-xs outline-none focus:border-[#027fa5]"
                            />
                          </div>
                          {itemDropOpen === row._key && filteredItems.length > 0 && (
                            <div className="absolute top-full left-2 right-2 bg-white border border-gray-200 rounded shadow-lg z-40 max-h-60 overflow-y-auto mt-0.5">
                              {filteredItems.slice(0, 12).map((s: any) => (
                                <button key={s.id} onMouseDown={() => selectMasterItem(row._key, s)}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#d2f1fa] border-b border-gray-100 last:border-0 leading-tight">
                                  <div className="font-semibold text-gray-800 break-words">{s.name}</div>
                                  <div className="text-[10px] text-gray-400 truncate">{s.code}</div>
                                  {(s.sapNo || s.sap_no || s.drgNo || s.drg_no) && (
                                    <div className="text-[10px] text-gray-500 truncate">
                                      {(s.sapNo || s.sap_no) && <span>SAP: {s.sapNo || s.sap_no}</span>}
                                      {(s.sapNo || s.sap_no) && (s.drgNo || s.drg_no) && <span> · </span>}
                                      {(s.drgNo || s.drg_no) && <span>DRG: {s.drgNo || s.drg_no}</span>}
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <input type="number" value={row.qty} onChange={e => updateRow(row._key, "qty", e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 h-7 text-xs outline-none focus:border-[#027fa5]"/>
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={row.unit} onChange={e => updateRow(row._key, "unit", e.target.value.toUpperCase())}
                            className="w-full border border-gray-200 rounded px-2 h-7 text-xs outline-none focus:border-[#027fa5] uppercase"/>
                        </td>
                        <td className="px-2 py-1.5">
                          <input value={row.hsn} onChange={e => updateRow(row._key, "hsn", e.target.value)}
                            className="w-full border border-gray-200 rounded px-2 h-7 text-xs outline-none focus:border-[#027fa5]"/>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {rows.some(r => !r.item_id) && (
              <div className="mt-2 flex items-center gap-1.5 text-amber-600 text-xs">
                <AlertCircle size={12}/>
                <span>Highlighted rows have no item master match — they will be created as new items on save.</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onCancel}
            className="px-5 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ partyId, partyName, dcNo: pendingData.dcNo || "", dcDate: pendingData.dcDate || "", deliveryDate: pendingData.deliveryDate || "", vehicleNo: pendingData.vehicleNo || "", items: rows })}
            className="px-6 py-2 rounded text-sm font-semibold text-white"
            style={{ background: SC.primary }}
            data-testid="btn-verify-confirm">
            Confirm &amp; Fill Grid
          </button>
        </div>
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
  sap_no: string;
  drg_no: string;
  qty: string;
  unit: string;
  process: string;
  process_id: string;
  hsn: string;
  remark: string;
  work_order_no: string;
};

function newRow(): ItemRow {
  return { _key: crypto.randomUUID(), item_id: "", item_code: "", item_name: "", sap_no: "", drg_no: "", qty: "", unit: "", process: "", process_id: "", hsn: "", remark: "", work_order_no: "" };
}

// ── Inward Form ──────────────────────────────────────────────────────────────
function InwardForm({ editData, onBack }: { editData?: any; onBack: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!editData?.id;

  const { data: customers = [] } = useQuery<any[]>({ queryKey: ["/api/customers"] });
  const { data: allProducts = [] } = useQuery<any[]>({ queryKey: ["/api/products"] });
  const { data: allCategories = [] } = useQuery<any[]>({ queryKey: ["/api/categories"] });
  const { data: processes = [] } = useQuery<any[]>({ queryKey: ["/api/processes"] });
  const { data: uomList = [] } = useQuery<any[]>({ queryKey: ["/api/uom"] });
  const rawMatCatIds = new Set((allCategories as any[]).filter((c: any) => c.isRawMaterial || c.is_raw_material).map((c: any) => c.id));
  // Engineering screens: exclude raw material categories
  const storeItems = (allProducts as any[]).filter(
    (p: any) => p.isActive !== false && (rawMatCatIds.size === 0 || !rawMatCatIds.has(p.categoryId))
  );

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
  const [vehicleNo, setVehicleNo] = useState((editData?.vehicle_no || "").toUpperCase());
  const [notes, setNotes] = useState(editData?.notes || "");

  const [items, setItems] = useState<ItemRow[]>(
    editData?.items?.length
      ? editData.items.map((it: any) => ({ _key: crypto.randomUUID(), item_id: it.item_id || "", item_code: it.item_code || "", item_name: it.item_name || "", sap_no: it.sap_no || "", drg_no: it.drg_no || "", qty: String(it.qty || ""), unit: it.unit || "", process: it.process || "", process_id: it.process_id || "", hsn: it.hsn || "", remark: it.remark || "", work_order_no: it.work_order_no || "" }))
      : [newRow()]
  );

  const [showScan, setShowScan] = useState(false);
  const [pendingScannedData, setPendingScannedData] = useState<any | null>(null);
  const [quickItem, setQuickItem] = useState<{ idx: number; name: string } | null>(null);
  const { toast } = useToast();
  const [aiSuccess, setAiSuccess] = useState(false);
  const [highlightMissing, setHighlightMissing] = useState(false);

  // Item search state per row
  const [itemSearch, setItemSearch] = useState<Record<string, string>>({});
  const [itemDropOpen, setItemDropOpen] = useState<string | null>(null);
  const [itemDropRect, setItemDropRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const itemInputRef = useRef<HTMLInputElement | null>(null);
  const positionItemDrop = () => {
    const el = itemInputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setItemDropRect({ left: r.left, top: r.bottom + 2, width: r.width });
  };
  useEffect(() => {
    if (!itemDropOpen) return;
    positionItemDrop();
    const onScroll = () => positionItemDrop();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [itemDropOpen]);

  const totalQty = items.reduce((a, r) => a + (parseFloat(r.qty) || 0), 0);

  function updateRow(key: string, field: keyof ItemRow, val: string) {
    setItems(prev => prev.map(r => r._key === key ? { ...r, [field]: val } : r));
    if (field === "process_id" && val) setHighlightMissing(false);
  }
  function addRow() {
    const hasBlankProcess = items.some(r => !r.process_id);
    if (hasBlankProcess) {
      setHighlightMissing(true);
      toast({ title: "Process required", description: "Please select a Process for every row before adding a new one.", variant: "destructive" });
      return;
    }
    setItems(prev => [...prev, newRow()]);
  }
  function removeRow(key: string) {
    setItems(prev => prev.filter(r => r._key !== key));
    setHighlightMissing(false);
  }
  function removeAll() { setItems([newRow()]); setHighlightMissing(false); }

  function handleSave() {
    const activeItems = items.filter(r => r.item_name || r.qty);
    const hasBlankProcess = activeItems.some(r => !r.process_id);
    if (hasBlankProcess) {
      setHighlightMissing(true);
      toast({ title: "Process required", description: "Please select a Process for all rows before saving.", variant: "destructive" });
      return;
    }
    saveMut.mutate();
  }

  function selectItem(rowKey: string, item: any) {
    const currentRow = items.find(r => r._key === rowKey);
    const currentWO = currentRow?.work_order_no || "";
    const existing = items.find(r => r._key !== rowKey && r.item_id === item.id && (r.work_order_no || "") === currentWO);
    if (existing) {
      const msg = currentWO
        ? `${item.name} with Reference No "${currentWO}" is already in the list.`
        : `${item.name} is already in the list. Use a different Reference No to add it again.`;
      toast({ title: "Duplicate item", description: msg, variant: "destructive" });
      return;
    }
    setItems(prev => prev.map(r => r._key === rowKey ? {
      ...r, item_id: item.id, item_code: item.code, item_name: item.name,
      sap_no: item.sapNo || item.sap_no || r.sap_no, drg_no: item.drgNo || item.drg_no || r.drg_no,
      unit: (item.unit || item.uom || r.unit || "").toUpperCase(), hsn: item.hsnCode || item.hsn_code || r.hsn,
    } : r));
    setItemSearch(prev => ({ ...prev, [rowKey]: item.name }));
    setItemDropOpen(null);
  }

  function onExtracted(data: any) {
    // Show verification modal instead of directly filling the grid
    setPendingScannedData(data);
  }

  async function confirmScannedData(result: { partyId: string; partyName: string; dcNo: string; dcDate: string; deliveryDate: string; vehicleNo: string; items: any[] }) {
    let resolvedPartyId = result.partyId || "";
    const name = (result.partyName || "").trim();

    // Auto-create customer + ledger if party name provided but no master match
    if (name && !resolvedPartyId) {
      try {
        const res = await fetch("/api/customers", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        if (res.ok) {
          const created = await res.json();
          resolvedPartyId = created.id || "";
          qc.invalidateQueries({ queryKey: ["/api/customers"] });
          toast({ title: `Customer auto-created: ${name}`, description: "Sub-ledger also created under Sundry Debtors." });
        }
      } catch { /* fallback: inward save will resolve via party_name_manual */ }
    }

    setAiSuccess(true);
    setTimeout(() => setAiSuccess(false), 3000);
    if (name) {
      setPartySearch(name);
      setPartyId(resolvedPartyId);
    }
    if (result.dcNo) setPartyDcNo(result.dcNo);
    if (result.dcDate) setPartyDcDate(result.dcDate);
    if (result.deliveryDate) setDeliveryDate(result.deliveryDate);
    if (result.vehicleNo) setVehicleNo(result.vehicleNo.toUpperCase());
    if (result.items?.length) {
      setItems(result.items.map((it: any) => ({
        _key: crypto.randomUUID(),
        item_id: it.item_id || "",
        item_code: it.item_code || "",
        item_name: it.item_name || "",
        sap_no: it.sap_no || "",
        drg_no: it.drg_no || "",
        qty: String(it.qty || ""),
        unit: (it.unit || "").toUpperCase(),
        process: it.process || "",
        process_id: it.process_id || "",
        hsn: it.hsn || "",
        remark: it.remark || "",
        work_order_no: it.work_order_no || "",
      })));
    }
    setPendingScannedData(null);
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
          item_id: r.item_id || null, item_code: r.item_code, item_name: r.item_name, sap_no: r.sap_no || "", drg_no: r.drg_no || "",
          qty: r.qty || "0", unit: r.unit, process: r.process, process_id: r.process_id || null, hsn: r.hsn, remark: r.remark, work_order_no: r.work_order_no || "",
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
      qc.invalidateQueries({ queryKey: ["/api/products"] });
      onBack();
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
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
                  onBlur={() => setTimeout(() => setPartyDropOpen(false), 150)}
                  placeholder="Search or type customer..."
                  className="flex-1 border border-gray-300 rounded-l px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                  data-testid="input-party-search"
                />
                <button
                  onMouseDown={() => setQuickParty(partySearch)}
                  className="border border-l-0 border-gray-300 rounded-r px-2.5 text-gray-500 hover:bg-[#d2f1fa] hover:text-[#027fa5] transition-colors"
                  title="Quick add new party"
                  data-testid="btn-quick-add-party"
                >
                  <Plus size={14} />
                </button>
              </div>
              {partyDropOpen && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-30 max-h-52 overflow-y-auto mt-0.5">
                  {filteredCustomers.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-gray-400">No customers found</div>
                  ) : filteredCustomers.map((s: any) => (
                    <button key={s.id} onMouseDown={() => { setPartyId(s.id); setPartySearch(s.name); setPartyDropOpen(false); }}
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

            {/* Inward Date — min = today, no past dates */}
            <DatePicker
              label="Inward Date"
              value={inwardDate}
              onChange={setInwardDate}
              min={new Date().toISOString().split("T")[0]}
              data-testid="input-inward-date"
            />
          </div>

          {/* Row 2 — DC details */}
          <div className="grid grid-cols-6 gap-3">
            <div className="relative col-span-1">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Party DC No</label>
              <input value={partyDcNo} onChange={e => setPartyDcNo(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                data-testid="input-party-dc-no" />
            </div>
            <DatePicker
              label="Party DC Date"
              value={partyDcDate}
              onChange={setPartyDcDate}
              data-testid="input-party-dc-date"
            />
            <DatePicker
              label="Delivery Date"
              value={deliveryDate}
              onChange={setDeliveryDate}
              data-testid="input-delivery-date"
            />
            <div className="relative col-span-1">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Party PO No</label>
              <input value={partyPoNo} onChange={e => setPartyPoNo(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                data-testid="input-party-po-no" />
            </div>
            <div className="relative col-span-1">
              <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 z-10 leading-none">Vehicle No</label>
              <input value={vehicleNo} onChange={e => setVehicleNo(e.target.value.toUpperCase())} placeholder="TN 00 AB 1234"
                className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm outline-none focus:border-[#027fa5]"
                data-testid="input-vehicle-no" />
            </div>
          </div>

          {/* Item Grid */}
          <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto" onClick={() => { setPartyDropOpen(false); }}>
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr style={{ background: SC.tonal }}>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-10">S.no</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-28">Item Code</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700">Item Name</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-28">SAP No</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-28">DRG No</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-32">Qty</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-16">Unit</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-40">Process</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-gray-700 w-28">Reference No</th>
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
                              itemInputRef.current = e.currentTarget;
                              setItemSearch(prev => ({ ...prev, [row._key]: e.target.value }));
                              updateRow(row._key, "item_name", e.target.value);
                              updateRow(row._key, "item_id", "");
                              setItemDropOpen(row._key);
                              positionItemDrop();
                            }}
                            onFocus={e => { itemInputRef.current = e.currentTarget; setItemDropOpen(row._key); positionItemDrop(); }}
                            onBlur={() => setTimeout(() => setItemDropOpen(null), 150)}
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
                        {itemDropOpen === row._key && (itemSearch[row._key] || "").length > 0 && filteredItems.length > 0 && itemDropRect && createPortal(
                          <div
                            style={{ position: "fixed", left: itemDropRect.left, top: itemDropRect.top, width: itemDropRect.width, zIndex: 9999 }}
                            className="bg-white border border-gray-200 rounded-lg shadow-2xl max-h-72 overflow-y-auto"
                            onMouseDown={e => e.preventDefault()}>
                            {filteredItems.slice(0, 20).map((s: any) => (
                              <button key={s.id} onClick={() => selectItem(row._key, s)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-[#d2f1fa] transition-colors border-b border-gray-100 last:border-0 leading-tight"
                                data-testid={`opt-item-${s.id}`}>
                                <div className="font-semibold text-gray-800 break-words">{s.name}</div>
                                <div className="text-[10px] text-gray-400 truncate">{s.code}</div>
                                {(s.sapNo || s.sap_no || s.drgNo || s.drg_no) && (
                                  <div className="text-[10px] text-gray-500 truncate">
                                    {(s.sapNo || s.sap_no) && <span>SAP: {s.sapNo || s.sap_no}</span>}
                                    {(s.sapNo || s.sap_no) && (s.drgNo || s.drg_no) && <span> · </span>}
                                    {(s.drgNo || s.drg_no) && <span>DRG: {s.drgNo || s.drg_no}</span>}
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>,
                          document.body
                        )}
                      </td>

                      <td className="px-2 py-1.5">
                        <input value={row.sap_no} onChange={e => updateRow(row._key, "sap_no", e.target.value)}
                          placeholder="SAP No"
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-[#027fa5]"
                          data-testid={`input-sap-no-${i}`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={row.drg_no} onChange={e => updateRow(row._key, "drg_no", e.target.value)}
                          placeholder="DRG No"
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-[#027fa5]"
                          data-testid={`input-drg-no-${i}`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" value={row.qty} onChange={e => updateRow(row._key, "qty", e.target.value)}
                          className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm font-medium outline-none focus:border-[#027fa5] focus:ring-1 focus:ring-[#027fa5]/20 text-right bg-white"
                          placeholder="0.000"
                          data-testid={`input-qty-${i}`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <select value={row.unit} onChange={e => updateRow(row._key, "unit", e.target.value)}
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-[#027fa5] bg-white"
                          data-testid={`select-unit-${i}`}>
                          <option value="">—</option>
                          {(uomList as any[]).filter((u: any) => u.isActive !== false).map((u: any) => (
                            <option key={u.id} value={(u.shortForm || u.code || "").toUpperCase()}>{u.shortForm || u.code}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <select
                          value={row.process_id}
                          onChange={e => {
                            const sel = (processes as any[]).find((p: any) => p.id === e.target.value);
                            updateRow(row._key, "process_id", e.target.value);
                            updateRow(row._key, "process", sel?.name || "");
                          }}
                          className={`w-full border rounded px-2 py-1 text-xs outline-none focus:border-[#027fa5] bg-white ${highlightMissing && !row.process_id ? "border-red-400 bg-red-50" : "border-gray-200"}`}
                          data-testid={`select-process-${i}`}
                        >
                          <option value="">— Select —</option>
                          {(processes as any[]).filter((p: any) => p.is_active).map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                        {highlightMissing && !row.process_id && (
                          <p className="text-red-500 text-[10px] mt-0.5 leading-none">Required</p>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={row.work_order_no}
                          onChange={e => updateRow(row._key, "work_order_no", e.target.value)}
                          placeholder="Reference No"
                          className="w-full border border-gray-200 rounded px-2 py-1 text-xs outline-none focus:border-[#027fa5]"
                          data-testid={`input-work-order-no-${i}`} />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={row.hsn}
                          onChange={e => {
                            const val = e.target.value;
                            updateRow(row._key, "hsn", val);
                            if (val.length >= 4) {
                              const match = storeItems.find((s: any) => (s.hsnCode || s.hsn_code) && (s.hsnCode || s.hsn_code).trim() === val.trim());
                              if (match) {
                                setItems(prev => prev.map(r => r._key === row._key ? {
                                  ...r,
                                  hsn: val,
                                  item_id: match.id,
                                  item_code: match.code || r.item_code,
                                  item_name: match.name || r.item_name,
                                  unit: (match.uom || r.unit || "").toUpperCase(),
                                } : r));
                                setItemSearch(prev => ({ ...prev, [row._key]: match.name }));
                              }
                            }
                          }}
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

        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onBack}
            className="px-8 py-2 rounded border text-sm font-semibold text-gray-700 hover:bg-gray-50"
            style={{ borderColor: "#9ca3af" }} data-testid="btn-cancel">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saveMut.isPending}
            className="px-8 py-2 rounded text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: SC.orange }} data-testid="btn-save">
            {saveMut.isPending ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Modals */}
      {showScan && <UploadScanModal onExtracted={onExtracted} onClose={() => setShowScan(false)} />}
      {pendingScannedData && (
        <ScanItemVerifyModal
          pendingData={pendingScannedData}
          storeItems={storeItems}
          customers={customers as any[]}
          onConfirm={confirmScannedData}
          onCancel={() => setPendingScannedData(null)}
        />
      )}
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
  const [, navigate] = useLocation();

  const { data: records = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/job-work-inward"] });
  const { data: settingsList = [] } = useQuery<any[]>({ queryKey: ["/api/settings"] });
  const qc = useQueryClient();

  const enabledFlows: string[] = ((settingsList as any[]).find((s: any) => s.key === "jobwork_invoice_flow")?.value || "inward_despatch_invoice")
    .split(",").filter(Boolean);
  const canDirectInvoice = enabledFlows.includes("inward_direct");

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

  const filtered = records.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.voucher_no?.toLowerCase().includes(q) ||
      r.party_name_db?.toLowerCase().includes(q) ||
      r.party_name_manual?.toLowerCase().includes(q) ||
      r.vehicle_no?.toLowerCase().includes(q) ||
      r.party_dc_no?.toLowerCase().includes(q)
    );
  });

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
                placeholder="Search by voucher / party / vehicle..."
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded w-56 outline-none focus:border-[#027fa5]"
                data-testid="input-search" />
            </div>
            <button onClick={() => setView("add")}
              className="px-4 py-1.5 rounded text-sm font-semibold text-white"
              style={{ background: SC.orange }} data-testid="btn-new">
              + New
            </button>
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
              <th className="px-3 py-2.5"></th>
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
                    <div className="text-xs">Click "+ New" to create your first Job Work Inward entry</div>
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
                <td className="px-5 py-2.5 text-gray-600 text-xs font-mono tracking-wide">{r.vehicle_no ? String(r.vehicle_no).toUpperCase() : <span className="text-gray-300">—</span>}</td>
                <td className="px-5 py-2.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded ${r.status === "Saved" ? "bg-green-50 text-green-700" : "bg-yellow-50 text-yellow-700"}`}>
                    {r.status || "Draft"}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1">
                    {canDirectInvoice && r.despatch_status !== "Invoiced" && r.status === "Saved" && (
                      <button
                        onClick={() => navigate(`/engineering/job-work-invoice?party_id=${r.party_id || ""}&inward_id=${r.id}&flow=inward_direct`)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold transition-colors hover:bg-orange-50"
                        style={{ color: SC.orange, border: `1px solid ${SC.orange}` }}
                        title="Make Invoice (Direct)"
                        data-testid={`btn-make-invoice-${r.id}`}>
                        <Receipt size={12} /> Invoice
                      </button>
                    )}
                    <button onClick={() => handleEdit(r)}
                      className="p-1.5 rounded hover:bg-blue-50 transition-colors" style={{ color: SC.primary }}
                      data-testid={`btn-edit-${r.id}`}>
                      <PencilLine size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

      </div>
    </div>
  );
}
