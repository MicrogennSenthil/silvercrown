import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  ChevronRight, ChevronDown, Folder, FolderOpen, FileText,
  Plus, Pencil, Trash2, X, Save, AlertTriangle, CheckCircle,
  GripVertical, Info
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import DatePicker from "@/components/DatePicker";

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };
const p2 = (v: any) => parseFloat(String(v || 0)).toFixed(2);

// ─── Types ───────────────────────────────────────────────────────────────────
type NodeType = "category" | "gl" | "sl";
interface SelNode { type: NodeType; id: string }
interface DragItem { type: NodeType; id: string; categoryId: string; glId?: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function CrDrToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex border border-gray-300 rounded overflow-hidden text-sm font-medium h-[34px]">
      {["Credit", "Debit"].map(t => (
        <button key={t} type="button" onClick={() => onChange(t)}
          className="px-4 transition-colors"
          style={value === t ? { background: SC.primary, color: "#fff" } : { background: "#fff", color: "#6b7280" }}>
          {t}
        </button>
      ))}
    </div>
  );
}

function inp(extra = "") {
  return `w-full border border-gray-300 rounded px-3 h-[34px] text-sm outline-none focus:border-[#027fa5] ${extra}`;
}
function label(t: string, req = false) {
  return <label className="block text-xs text-gray-500 font-medium mb-1">{t}{req && <span className="text-red-500 ml-0.5">*</span>}</label>;
}

// ─── GL Edit Panel ────────────────────────────────────────────────────────────
function GLPanel({ gl, categories, onClose, onSaved }: { gl: any; categories: any[]; onClose: () => void; onSaved: () => void }) {
  const qc = useQueryClient();
  const [name, setName]   = useState(gl.name || "");
  const [ob, setOb]       = useState(gl.openingBalance || "0");
  const [bt, setBt]       = useState(gl.balanceType || "Dr");
  const [desc, setDesc]   = useState(gl.description || "");
  const [saving, setSaving] = useState(false);
  const [err, setErr]     = useState("");

  async function save() {
    setErr(""); setSaving(true);
    try {
      await apiRequest("PATCH", `/api/general-ledgers/${gl.id}`, { name, openingBalance: ob, balanceType: bt, description: desc });
      qc.invalidateQueries({ queryKey: ["/api/general-ledgers"] });
      onSaved();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="text-sm font-bold text-gray-800">Edit General Ledger</div>
        <button onClick={onClose}><X size={16} className="text-gray-400 hover:text-gray-700"/></button>
      </div>
      <div className="space-y-0.5">
        {label("Code")}
        <input value={gl.code} readOnly className={inp("bg-gray-50 text-gray-500 cursor-not-allowed")} data-testid="input-gl-code"/>
      </div>
      <div className="space-y-0.5">
        {label("Name", true)}
        <input value={name} onChange={e => setName(e.target.value)} className={inp()} data-testid="input-gl-name"/>
      </div>
      <div className="space-y-0.5">
        {label("Category")}
        <input value={categories.find(c => c.id === gl.categoryId)?.name || "—"} readOnly className={inp("bg-gray-50 text-gray-500 cursor-not-allowed")}/>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-0.5">
          {label("Opening Balance")}
          <input type="number" step="0.01" value={ob} onChange={e => setOb(e.target.value)}
            className={inp()} data-testid="input-gl-ob"/>
        </div>
        <div className="space-y-0.5">
          {label("Balance Type")}
          <select value={bt} onChange={e => setBt(e.target.value)} className={inp()} data-testid="select-gl-bt">
            <option value="Dr">Dr (Debit)</option>
            <option value="Cr">Cr (Credit)</option>
          </select>
        </div>
      </div>
      <div className="space-y-0.5">
        {label("Description")}
        <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2} className={inp()}/>
      </div>
      {err && <div className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={12}/>{err}</div>}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button onClick={onClose} className="border border-gray-300 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50">Cancel</button>
        <button onClick={save} disabled={saving}
          className="text-sm py-2 rounded-lg font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-1"
          style={{ background: SC.primary }} data-testid="btn-save-gl">
          <Save size={13}/>{saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ─── SL Edit Panel ────────────────────────────────────────────────────────────
type BillRow = { _key: string; refNo: string; refDate: string; voucherNo: string; voucherDate: string; amount: string; crDr: string };
function newBill(): BillRow { return { _key: crypto.randomUUID(), refNo: "", refDate: "", voucherNo: "", voucherDate: "", amount: "", crDr: "Cr" }; }

function SLPanel({ sl, generalLedgers, categories, onClose, onSaved }: { sl: any; generalLedgers: any[]; categories: any[]; onClose: () => void; onSaved: () => void }) {
  const qc = useQueryClient();
  const cat = categories.find(c => c.id === sl.categoryId || generalLedgers.find(g => g.id === sl.generalLedgerId)?.categoryId === c.id);
  const sameGLs = generalLedgers.filter(g => g.categoryId === (sl.categoryId || cat?.id));

  const [name, setName]   = useState(sl.name || "");
  const [glId, setGlId]   = useState(sl.generalLedgerId || "");
  const [levelType, setLevelType] = useState(sl.levelType || "Same");
  const [payType, setPayType]     = useState(sl.paymentType || "OnAccount");
  const [obEntry, setObEntry]     = useState<boolean>(sl.openingBalanceEntry ?? false);
  const [obAmt, setObAmt]   = useState(sl.openingBalance || "0");
  const [obType, setObType] = useState(sl.openingBalanceType || "Credit");
  const [cbAmt, setCbAmt]   = useState(sl.closingBalance || "0");
  const [cbType, setCbType] = useState(sl.closingBalanceType || "Credit");
  const [notes, setNotes]   = useState(sl.notes || "");
  const [bills, setBills]   = useState<BillRow[]>(
    sl.bills?.length ? sl.bills.map((b: any) => ({ _key: crypto.randomUUID(), refNo: b.refNo||"", refDate: b.refDate||"", voucherNo: b.voucherNo||"", voucherDate: b.voucherDate||"", amount: b.amount||"", crDr: b.crDr||"Cr" })) : []
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!name.trim()) { setErr("Name is required"); return; }
    setErr(""); setSaving(true);
    try {
      await apiRequest("PATCH", `/api/sub-ledgers/${sl.id}`, {
        name, generalLedgerId: glId, levelType, paymentType: payType,
        openingBalanceEntry: obEntry, openingBalance: obAmt, openingBalanceType: obType,
        closingBalance: cbAmt, closingBalanceType: cbType, notes,
        bills: bills.map(({ _key, ...b }) => b),
      });
      qc.invalidateQueries({ queryKey: ["/api/sub-ledgers"] });
      onSaved();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  function billField(row: BillRow, field: keyof Omit<BillRow,"_key">, val: string) {
    setBills(bs => bs.map(b => b._key === row._key ? { ...b, [field]: val } : b));
  }

  const billTotal = bills.reduce((s, b) => s + (parseFloat(b.amount)||0), 0);

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="font-bold text-gray-800">Edit Ledger / Sub-Ledger</div>
        <button onClick={onClose}><X size={16} className="text-gray-400 hover:text-gray-700"/></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          {label("Code")}
          <input value={sl.code} readOnly className={inp("bg-gray-50 text-gray-500 cursor-not-allowed")}/>
        </div>
        <div>
          {label("Name", true)}
          <input value={name} onChange={e => setName(e.target.value)} className={inp()} data-testid="input-sl-name"/>
        </div>
      </div>
      <div>
        {label("Under General Ledger")}
        <select value={glId} onChange={e => setGlId(e.target.value)} className={inp()} data-testid="select-sl-gl">
          <option value="">-- Select GL --</option>
          {sameGLs.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          {label("Level Type")}
          <select value={levelType} onChange={e => setLevelType(e.target.value)} className={inp()}>
            {["Same","Sub","Detailed"].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          {label("Payment Type")}
          <select value={payType} onChange={e => setPayType(e.target.value)} className={inp()}>
            {["OnAccount","Bill-by-Bill","Advance","Fixed"].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={obEntry} onChange={e => setObEntry(e.target.checked)}
            className="accent-[#027fa5]" id="ob-entry" data-testid="chk-ob-entry"/>
          <label htmlFor="ob-entry" className="text-xs font-medium text-gray-700 cursor-pointer">Opening Balance Entry</label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            {label("Opening Balance")}
            <input type="number" step="0.01" value={obAmt} onChange={e => setObAmt(e.target.value)} className={inp()} data-testid="input-sl-ob"/>
          </div>
          <div>
            {label("Type")}
            <CrDrToggle value={obType} onChange={setObType}/>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            {label("Closing Balance")}
            <input type="number" step="0.01" value={cbAmt} onChange={e => setCbAmt(e.target.value)} className={inp()} data-testid="input-sl-cb"/>
          </div>
          <div>
            {label("Type")}
            <CrDrToggle value={cbType} onChange={setCbType}/>
          </div>
        </div>
      </div>
      {obEntry && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-600">Bill-by-Bill Details</span>
            <button onClick={() => setBills(b => [...b, newBill()])} className="text-xs px-2 py-1 rounded flex items-center gap-1" style={{ color: SC.primary }}>
              <Plus size={11}/>Add Bill
            </button>
          </div>
          <div className="border border-gray-200 rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50 border-b">
                <th className="px-2 py-1.5 text-left">Ref No</th>
                <th className="px-2 py-1.5 text-left">Ref Date</th>
                <th className="px-2 py-1.5 text-right">Amount</th>
                <th className="px-2 py-1.5 text-center">Cr/Dr</th>
                <th className="w-6"></th>
              </tr></thead>
              <tbody>
                {bills.map(b => (
                  <tr key={b._key} className="border-b">
                    <td className="px-1 py-0.5"><input value={b.refNo} onChange={e => billField(b,"refNo",e.target.value)} className="w-full border-0 bg-transparent outline-none px-1 py-0.5 text-xs"/></td>
                    <td className="px-1 py-0.5"><DatePicker value={b.refDate} onChange={v => billField(b,"refDate",v)}/></td>
                    <td className="px-1 py-0.5"><input type="number" value={b.amount} onChange={e => billField(b,"amount",e.target.value)} className="w-full border-0 bg-transparent outline-none px-1 py-0.5 text-xs text-right"/></td>
                    <td className="px-1 py-0.5 text-center">
                      <select value={b.crDr} onChange={e => billField(b,"crDr",e.target.value)} className="text-xs border-0 bg-transparent outline-none">
                        <option>Cr</option><option>Dr</option>
                      </select>
                    </td>
                    <td className="px-1"><button onClick={() => setBills(bs => bs.filter(x => x._key !== b._key))}><X size={11} className="text-gray-400 hover:text-red-500"/></button></td>
                  </tr>
                ))}
                {bills.length === 0 && <tr><td colSpan={5} className="px-3 py-2 text-center text-gray-400">No bills added</td></tr>}
              </tbody>
              {bills.length > 0 && (
                <tfoot><tr className="bg-gray-50 border-t">
                  <td colSpan={2} className="px-2 py-1.5 text-xs font-semibold">Total</td>
                  <td className="px-2 py-1.5 text-right text-xs font-semibold">₹{p2(billTotal)}</td>
                  <td colSpan={2}></td>
                </tr></tfoot>
              )}
            </table>
          </div>
        </div>
      )}
      <div>
        {label("Notes")}
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inp()}/>
      </div>
      {err && <div className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={12}/>{err}</div>}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button onClick={onClose} className="border border-gray-300 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50">Cancel</button>
        <button onClick={save} disabled={saving}
          className="text-sm py-2 rounded-lg font-semibold text-white disabled:opacity-50 flex items-center justify-center gap-1"
          style={{ background: SC.primary }} data-testid="btn-save-sl">
          <Save size={13}/>{saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// ─── Add GL Form ──────────────────────────────────────────────────────────────
function AddGLPanel({ categoryId, onClose, onSaved }: { categoryId: string; onClose: () => void; onSaved: () => void }) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [ob, setOb]     = useState("0");
  const [bt, setBt]     = useState("Dr");
  const [saving, setSaving] = useState(false);
  const [err, setErr]   = useState("");

  async function save() {
    if (!code.trim() || !name.trim()) { setErr("Code and Name are required"); return; }
    setErr(""); setSaving(true);
    try {
      await apiRequest("POST", "/api/general-ledgers", { code, name, categoryId, openingBalance: ob, balanceType: bt, description: "" });
      qc.invalidateQueries({ queryKey: ["/api/general-ledgers"] });
      onSaved();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="text-sm font-bold text-gray-800">Add General Ledger</div>
        <button onClick={onClose}><X size={16} className="text-gray-400 hover:text-gray-700"/></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>{label("Code",true)}<input value={code} onChange={e => setCode(e.target.value)} className={inp()} data-testid="input-new-gl-code"/></div>
        <div>{label("Name",true)}<input value={name} onChange={e => setName(e.target.value)} className={inp()} data-testid="input-new-gl-name"/></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>{label("Opening Balance")}<input type="number" step="0.01" value={ob} onChange={e => setOb(e.target.value)} className={inp()}/></div>
        <div>{label("Balance Type")}<select value={bt} onChange={e => setBt(e.target.value)} className={inp()}><option value="Dr">Dr (Debit)</option><option value="Cr">Cr (Credit)</option></select></div>
      </div>
      {err && <div className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={12}/>{err}</div>}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button onClick={onClose} className="border border-gray-300 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50">Cancel</button>
        <button onClick={save} disabled={saving} className="text-sm py-2 rounded-lg font-semibold text-white disabled:opacity-50" style={{ background: SC.primary }} data-testid="btn-add-gl">
          {saving ? "Adding…" : "Add GL"}
        </button>
      </div>
    </div>
  );
}

// ─── Add SL Form ──────────────────────────────────────────────────────────────
function AddSLPanel({ glId, categoryId, generalLedgers, onClose, onSaved }: { glId: string; categoryId: string; generalLedgers: any[]; onClose: () => void; onSaved: () => void }) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [ob, setOb]     = useState("0");
  const [obType, setObType] = useState("Credit");
  const [saving, setSaving] = useState(false);
  const [err, setErr]   = useState("");

  async function save() {
    if (!code.trim() || !name.trim()) { setErr("Code and Name are required"); return; }
    setErr(""); setSaving(true);
    try {
      await apiRequest("POST", "/api/sub-ledgers", {
        code, name, generalLedgerId: glId, categoryId,
        levelType: "Same", paymentType: "OnAccount",
        openingBalanceEntry: false, openingBalance: ob, openingBalanceType: obType,
        closingBalance: "0", closingBalanceType: "Credit", notes: "",
      });
      qc.invalidateQueries({ queryKey: ["/api/sub-ledgers"] });
      onSaved();
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="text-sm font-bold text-gray-800">Add Sub-Ledger</div>
        <button onClick={onClose}><X size={16} className="text-gray-400 hover:text-gray-700"/></button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>{label("Code",true)}<input value={code} onChange={e => setCode(e.target.value)} className={inp()} data-testid="input-new-sl-code"/></div>
        <div>{label("Name",true)}<input value={name} onChange={e => setName(e.target.value)} className={inp()} data-testid="input-new-sl-name"/></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>{label("Opening Balance")}<input type="number" step="0.01" value={ob} onChange={e => setOb(e.target.value)} className={inp()}/></div>
        <div>{label("Balance Type")}
          <div className="mt-1"><CrDrToggle value={obType} onChange={setObType}/></div>
        </div>
      </div>
      {err && <div className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle size={12}/>{err}</div>}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button onClick={onClose} className="border border-gray-300 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50">Cancel</button>
        <button onClick={save} disabled={saving} className="text-sm py-2 rounded-lg font-semibold text-white disabled:opacity-50" style={{ background: SC.primary }} data-testid="btn-add-sl">
          {saving ? "Adding…" : "Add Ledger"}
        </button>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteModal({ item, type, onConfirm, onCancel }: { item: any; type: NodeType; onConfirm: () => void; onCancel: () => void }) {
  const obVal = parseFloat(item.openingBalance || "0");
  const cbVal = parseFloat(item.closingBalance || "0");
  const canDelete = type === "gl" || (obVal === 0 && cbVal === 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-96 space-y-4">
        <div className="flex items-center gap-2 text-red-600">
          <AlertTriangle size={20}/>
          <span className="font-bold">Delete {type === "gl" ? "General Ledger" : "Ledger"}</span>
        </div>
        {canDelete ? (
          <>
            <p className="text-sm text-gray-600">Are you sure you want to delete <strong>{item.name}</strong>? This action cannot be undone.</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={onCancel} className="border border-gray-300 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={onConfirm} className="text-sm py-2 rounded-lg font-semibold text-white bg-red-600 hover:bg-red-700" data-testid="btn-confirm-delete">Delete</button>
            </div>
          </>
        ) : (
          <>
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800">
              <div className="font-semibold mb-1">Cannot delete this ledger</div>
              <div className="text-xs space-y-0.5">
                <div>Opening Balance: <strong>₹{p2(obVal)}</strong>{obVal !== 0 && " — must be 0"}</div>
                <div>Closing Balance: <strong>₹{p2(cbVal)}</strong>{cbVal !== 0 && " — must be 0"}</div>
              </div>
              <p className="text-xs mt-2">Both balances must be zero before a ledger can be deleted.</p>
            </div>
            <button onClick={onCancel} className="w-full border border-gray-300 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50">Close</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
type PanelMode = "edit-gl" | "edit-sl" | "add-gl" | "add-sl" | null;

export default function GeneralLedgerTree() {
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: categories = [], isLoading: loadingCat } = useQuery<any[]>({ queryKey: ["/api/ledger-categories"] });
  const { data: generalLedgers = [], isLoading: loadingGL } = useQuery<any[]>({ queryKey: ["/api/general-ledgers"] });
  const { data: subLedgers = [], isLoading: loadingSL } = useQuery<any[]>({ queryKey: ["/api/sub-ledgers"] });

  // Expand state
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [expandedGLs, setExpandedGLs]   = useState<Set<string>>(new Set());

  // Panel state
  const [panel, setPanel]         = useState<PanelMode>(null);
  const [selectedGL, setSelectedGL] = useState<any>(null);
  const [selectedSL, setSelectedSL] = useState<any>(null);
  const [addGLCatId, setAddGLCatId] = useState("");
  const [addSLGLId, setAddSLGLId]   = useState("");
  const [addSLCatId, setAddSLCatId] = useState("");

  // Delete state
  const [deleteItem, setDeleteItem] = useState<{ item: any; type: "gl"|"sl" } | null>(null);
  const [toast, setToast]           = useState("");

  // Drag state
  const drag = useRef<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(""), 3000); }
  function closePanel() { setPanel(null); setSelectedGL(null); setSelectedSL(null); }

  function toggleCat(id: string) {
    setExpandedCats(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleGL(id: string) {
    setExpandedGLs(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  // ── Drag/Drop ──────────────────────────────────────────────────────────────
  function onDragStart(e: React.DragEvent, type: NodeType, id: string, categoryId: string, glId?: string) {
    drag.current = { type, id, categoryId, glId };
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e: React.DragEvent, targetId: string, targetType: NodeType, targetCatId: string) {
    e.preventDefault();
    if (!drag.current) return;
    if (drag.current.categoryId !== targetCatId) { e.dataTransfer.dropEffect = "none"; return; }
    if (drag.current.id === targetId) return;
    e.dataTransfer.dropEffect = "move";
    setDropTarget(targetId);
  }

  function onDragLeave() { setDropTarget(null); }

  async function onDrop(e: React.DragEvent, targetId: string, targetType: NodeType, targetCatId: string, targetGLId?: string) {
    e.preventDefault();
    setDropTarget(null);
    if (!drag.current || drag.current.id === targetId) return;
    if (drag.current.categoryId !== targetCatId) return; // Can't move between categories

    // Move SL to a different GL (drop onto GL header)
    if (drag.current.type === "sl" && targetType === "gl") {
      try {
        await apiRequest("PATCH", `/api/sub-ledgers/${drag.current.id}`, { generalLedgerId: targetId });
        qc.invalidateQueries({ queryKey: ["/api/sub-ledgers"] });
        showToast("Ledger moved successfully");
      } catch {}
    }
    // Move SL to same position as another SL (reorder within GL)
    else if (drag.current.type === "sl" && targetType === "sl" && drag.current.glId !== targetGLId) {
      try {
        await apiRequest("PATCH", `/api/sub-ledgers/${drag.current.id}`, { generalLedgerId: targetGLId });
        qc.invalidateQueries({ queryKey: ["/api/sub-ledgers"] });
        showToast("Ledger moved successfully");
      } catch {}
    }
    drag.current = null;
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function doDelete() {
    if (!deleteItem) return;
    try {
      if (deleteItem.type === "gl") {
        await apiRequest("DELETE", `/api/general-ledgers/${deleteItem.item.id}`);
        qc.invalidateQueries({ queryKey: ["/api/general-ledgers"] });
      } else {
        await apiRequest("DELETE", `/api/sub-ledgers/${deleteItem.item.id}`);
        qc.invalidateQueries({ queryKey: ["/api/sub-ledgers"] });
      }
      showToast(`${deleteItem.item.name} deleted`);
      if (panel && selectedGL?.id === deleteItem.item.id) closePanel();
      if (panel && selectedSL?.id === deleteItem.item.id) closePanel();
    } catch (e: any) { showToast(e.message || "Delete failed"); }
    finally { setDeleteItem(null); }
  }

  const loading = loadingCat || loadingGL || loadingSL;
  const sortedCategories = [...(categories as any[])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex h-full min-h-screen" style={{ background: SC.bg }}>
      {/* ── Tree Panel ───────────────────────────────────────────────────── */}
      <div className={`flex-1 p-6 overflow-y-auto transition-all ${panel ? "max-w-[60%]" : ""}`}>
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">General Ledger</h1>
            <p className="text-xs text-gray-500 mt-0.5">Manage your chart of accounts in a tree hierarchy</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="flex items-center gap-1"><Folder size={13} style={{ color: SC.orange }}/> GL Category</div>
            <div className="flex items-center gap-1"><FileText size={13} className="text-gray-400"/> Sub-Ledger</div>
            <div className="text-gray-300">|</div>
            <div className="flex items-center gap-1"><GripVertical size={13} className="text-gray-300"/> Drag to move</div>
          </div>
        </div>

        {loading && <div className="text-gray-400 text-sm">Loading…</div>}

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {sortedCategories.length === 0 && !loading && (
            <div className="p-8 text-center text-gray-400 text-sm">
              No ledger categories found. Add them in Masters → Ledger Categories.
            </div>
          )}

          {sortedCategories.map((cat: any) => {
            const glsInCat = (generalLedgers as any[]).filter(g => g.categoryId === cat.id).sort((a: any, b: any) => a.name.localeCompare(b.name));
            const isCatExpanded = expandedCats.has(cat.id);
            return (
              <div key={cat.id} className="border-b last:border-b-0">
                {/* ── Category Row ── */}
                <div
                  className="flex items-center gap-1 px-4 py-2.5 bg-gray-50 select-none group hover:bg-blue-50/40 transition-colors"
                  style={{ borderLeft: `3px solid ${SC.primary}` }}
                >
                  <button onClick={() => toggleCat(cat.id)} className="p-0.5 text-gray-400 hover:text-gray-700 flex-shrink-0" data-testid={`btn-expand-cat-${cat.id}`}>
                    {isCatExpanded ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
                  </button>
                  {isCatExpanded ? <FolderOpen size={18} style={{ color: SC.orange }}/> : <Folder size={18} style={{ color: SC.orange }}/>}
                  <span className="flex-1 text-sm font-bold text-gray-800 ml-1">{cat.name}</span>
                  <span className="text-xs text-gray-400 font-mono mr-2">{cat.code}</span>
                  <span className="text-xs text-gray-400 mr-2">{glsInCat.length} GL{glsInCat.length !== 1 ? "s" : ""}</span>
                  <button
                    onClick={() => { setAddGLCatId(cat.id); setPanel("add-gl"); setExpandedCats(s => { const n = new Set(s); n.add(cat.id); return n; }); }}
                    className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-xs px-2 py-0.5 rounded-md border border-[#027fa5] text-[#027fa5] hover:bg-[#027fa5] hover:text-white transition-all"
                    data-testid={`btn-add-gl-${cat.id}`}
                    title="Add General Ledger under this category"
                  >
                    <Plus size={11}/>GL
                  </button>
                </div>

                {/* ── GLs under category ── */}
                {isCatExpanded && glsInCat.map((gl: any) => {
                  const slsInGL = (subLedgers as any[]).filter(s => s.generalLedgerId === gl.id).sort((a: any, b: any) => a.name.localeCompare(b.name));
                  const isGLExp = expandedGLs.has(gl.id);
                  const isDropGL = dropTarget === gl.id;

                  return (
                    <div key={gl.id}
                      onDragOver={e => onDragOver(e, gl.id, "gl", cat.id)}
                      onDragLeave={onDragLeave}
                      onDrop={e => onDrop(e, gl.id, "gl", cat.id)}
                      className={`transition-colors ${isDropGL ? "bg-blue-50 border border-dashed border-[#027fa5]" : ""}`}
                    >
                      {/* GL Row */}
                      <div
                        draggable
                        onDragStart={e => onDragStart(e, "gl", gl.id, cat.id)}
                        className={`flex items-center gap-1 px-4 py-2 pl-10 border-b border-gray-100 select-none group cursor-grab active:cursor-grabbing hover:bg-blue-50/30 transition-colors ${selectedGL?.id === gl.id && panel === "edit-gl" ? "bg-[#d2f1fa]/60" : ""}`}
                      >
                        <GripVertical size={13} className="text-gray-300 flex-shrink-0"/>
                        <button onClick={() => toggleGL(gl.id)} className="p-0.5 text-gray-400 hover:text-gray-700 flex-shrink-0" data-testid={`btn-expand-gl-${gl.id}`}>
                          {isGLExp ? <ChevronDown size={14}/> : <ChevronRight size={14}/>}
                        </button>
                        {isGLExp ? <FolderOpen size={15} style={{ color: "#d97706" }}/> : <Folder size={15} style={{ color: "#d97706" }}/>}
                        <span className="flex-1 text-sm text-gray-700 font-medium ml-1">{gl.name}</span>
                        <span className="text-xs text-gray-400 font-mono mr-1">{gl.code}</span>
                        <span className="text-xs text-gray-400 mr-2">
                          ₹{p2(gl.openingBalance)} {gl.balanceType}
                        </span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setExpandedGLs(s => { const n = new Set(s); n.add(gl.id); return n; });
                              setLocation(`/accounts/ledger?mode=new&glId=${gl.id}&catId=${cat.id}&from=gl-tree`);
                            }}
                            className="text-xs px-1.5 py-0.5 rounded border border-green-500 text-green-700 hover:bg-green-50 flex items-center gap-0.5"
                            title="Add sub-ledger" data-testid={`btn-add-sl-${gl.id}`}
                          ><Plus size={10}/>SL</button>
                          <button
                            onClick={() => { setSelectedGL(gl); setPanel("edit-gl"); }}
                            className="p-1 rounded hover:bg-[#d2f1fa] text-gray-400 hover:text-[#027fa5]"
                            title="Edit GL" data-testid={`btn-edit-gl-${gl.id}`}
                          ><Pencil size={13}/></button>
                          <button
                            onClick={() => setDeleteItem({ item: gl, type: "gl" })}
                            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                            title="Delete GL" data-testid={`btn-delete-gl-${gl.id}`}
                          ><Trash2 size={13}/></button>
                        </div>
                      </div>

                      {/* Sub-ledgers under GL */}
                      {isGLExp && slsInGL.map((sl: any) => {
                        const isDropSL = dropTarget === sl.id;
                        return (
                          <div key={sl.id}
                            draggable
                            onDragStart={e => onDragStart(e, "sl", sl.id, cat.id, gl.id)}
                            onDragOver={e => onDragOver(e, sl.id, "sl", cat.id)}
                            onDragLeave={onDragLeave}
                            onDrop={e => onDrop(e, sl.id, "sl", cat.id, gl.id)}
                            className={`flex items-center gap-1 px-4 py-1.5 pl-16 border-b border-gray-50 select-none group cursor-grab active:cursor-grabbing hover:bg-blue-50/20 transition-colors
                              ${selectedSL?.id === sl.id && panel === "edit-sl" ? "bg-[#d2f1fa]/40" : ""}
                              ${isDropSL ? "border border-dashed border-[#027fa5] bg-blue-50" : ""}`}
                          >
                            <GripVertical size={12} className="text-gray-200 flex-shrink-0"/>
                            {/* Tree connector line */}
                            <div className="flex-shrink-0 w-4 h-4 border-l-2 border-b-2 border-gray-200 rounded-bl-sm -ml-1 mr-1"></div>
                            <FileText size={13} className="text-gray-400 flex-shrink-0"/>
                            <span className="flex-1 text-xs text-gray-600 ml-1">{sl.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono mr-1">{sl.code}</span>
                            <span className="text-[10px] text-gray-400 mr-2">
                              OB: ₹{p2(sl.openingBalance)} {sl.openingBalanceType?.slice(0,2)}
                            </span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setSelectedSL(sl); setPanel("edit-sl"); }}
                                className="p-1 rounded hover:bg-[#d2f1fa] text-gray-400 hover:text-[#027fa5]"
                                title="Edit ledger" data-testid={`btn-edit-sl-${sl.id}`}
                              ><Pencil size={12}/></button>
                              <button
                                onClick={() => setDeleteItem({ item: sl, type: "sl" })}
                                className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
                                title="Delete ledger" data-testid={`btn-delete-sl-${sl.id}`}
                              ><Trash2 size={12}/></button>
                            </div>
                          </div>
                        );
                      })}
                      {isGLExp && slsInGL.length === 0 && (
                        <div className="pl-16 pr-4 py-1.5 text-xs text-gray-400 italic border-b border-gray-50">
                          No sub-ledgers — click <span className="font-medium not-italic">+SL</span> to add one
                        </div>
                      )}
                    </div>
                  );
                })}
                {isCatExpanded && glsInCat.length === 0 && (
                  <div className="pl-10 pr-4 py-2 text-xs text-gray-400 italic">
                    No general ledgers — click <span className="font-medium not-italic">+GL</span> above to add one
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-3 text-xs text-gray-400">
          <Info size={12}/>
          <span>Hover over any row to see actions. Drag items to reorder or move between ledger groups (within the same category).</span>
        </div>
      </div>

      {/* ── Right Panel ──────────────────────────────────────────────────── */}
      {panel && (
        <div className="w-[420px] flex-shrink-0 bg-white border-l border-gray-200 shadow-xl overflow-y-auto">
          <div className="p-5">
            {panel === "edit-gl" && selectedGL && (
              <GLPanel gl={selectedGL} categories={categories as any[]} onClose={closePanel}
                onSaved={() => { closePanel(); showToast("General Ledger updated"); }} />
            )}
            {panel === "edit-sl" && selectedSL && (
              <SLPanel sl={selectedSL} generalLedgers={generalLedgers as any[]} categories={categories as any[]}
                onClose={closePanel} onSaved={() => { closePanel(); showToast("Ledger updated"); }} />
            )}
            {panel === "add-gl" && (
              <AddGLPanel categoryId={addGLCatId} onClose={closePanel}
                onSaved={() => { closePanel(); showToast("General Ledger added"); }} />
            )}
            {panel === "add-sl" && (
              <AddSLPanel glId={addSLGLId} categoryId={addSLCatId} generalLedgers={generalLedgers as any[]}
                onClose={closePanel} onSaved={() => { closePanel(); showToast("Sub-Ledger added"); }} />
            )}
          </div>
        </div>
      )}

      {/* ── Delete Modal ──────────────────────────────────────────────────── */}
      {deleteItem && (
        <DeleteModal item={deleteItem.item} type={deleteItem.type}
          onConfirm={doDelete} onCancel={() => setDeleteItem(null)} />
      )}

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2 z-50 animate-in slide-in-from-bottom-2">
          <CheckCircle size={15} className="text-green-400"/>{toast}
        </div>
      )}
    </div>
  );
}
