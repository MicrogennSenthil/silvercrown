/**
 * ReportShell — Standard report wrapper used by ALL reports in the system.
 *
 * STANDARD PROCEDURES (enforced centrally):
 *  • Search bar + From/To date range + Party/Item filter slot
 *  • Print button → opens print window with:
 *      – Company name, address, GSTIN, phone, email in header
 *      – Report title + date range sub-header
 *      – "Powered by Microgenn" footer with Page X / Y
 *  • Export dropdown → Excel/CSV | PDF (print) | View on Screen
 */
import { useState, useRef, useEffect } from "react";
import {
  Printer, Download, FileText, Monitor, Search, X,
  ChevronDown, Filter,
} from "lucide-react";

export interface ReportShellProps {
  title: string;
  search: string;
  onSearch: (v: string) => void;
  fromDate: string;
  toDate: string;
  onFromDate: (v: string) => void;
  onToDate: (v: string) => void;
  /** @deprecated — print is now handled internally by ReportShell */
  onPrint?: () => void;
  onExcelExport: () => void;
  /** @deprecated — PDF uses internal print */
  onPdfExport?: () => void;
  recordCount?: number;
  extraFilters?: React.ReactNode;
  children: React.ReactNode;
}

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

function fmtDisplayDate(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── DateField helper ──────────────────────────────────────────────────────────
function DateField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="relative border border-gray-200 rounded-lg bg-white flex items-center h-[36px] px-3 gap-2
      hover:border-[#027fa5] transition-colors focus-within:border-[#027fa5] focus-within:ring-1 focus-within:ring-[#027fa5]/20">
      <span className="text-[10px] font-semibold text-gray-400 absolute -top-2 left-2 bg-white px-1 leading-none">{label}</span>
      <input type="date" value={value} onChange={e => onChange(e.target.value)}
        className="text-sm text-gray-700 outline-none bg-transparent w-[120px]"
        data-testid={`input-report-${label.toLowerCase()}`} />
    </div>
  );
}

// ── ReportShell ───────────────────────────────────────────────────────────────
export function ReportShell({
  title, search, onSearch,
  fromDate, toDate, onFromDate, onToDate,
  onExcelExport, recordCount, extraFilters, children,
}: ReportShellProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function handlePrint() {
    printReport(title, fromDate, toDate);
  }

  return (
    <div className="p-4" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">

        {/* Title bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100" style={{ background: SC.tonal }}>
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-gray-800 text-base tracking-wide">{title}</h1>
            {recordCount !== undefined && (
              <span className="text-xs bg-white border border-gray-200 rounded-full px-2.5 py-0.5 text-gray-500 font-medium">
                {recordCount} record{recordCount !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Primary filter bar */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-gray-100 flex-wrap bg-white">
          {/* Search */}
          <div className="relative min-w-[200px] max-w-xs flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input value={search} onChange={e => onSearch(e.target.value)}
              placeholder="Search anything…"
              className="w-full h-[36px] pl-8 pr-8 border border-gray-200 rounded-lg text-sm outline-none
                focus:border-[#027fa5] focus:ring-1 focus:ring-[#027fa5]/20 bg-white"
              data-testid="input-report-search" />
            {search && (
              <button onClick={() => onSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Dates */}
          <DateField label="From" value={fromDate} onChange={onFromDate} />
          <DateField label="To"   value={toDate}   onChange={onToDate} />

          <div className="flex-1" />

          {/* Export dropdown */}
          <div ref={exportRef} className="relative">
            <button onClick={() => setExportOpen(o => !o)}
              className="flex items-center gap-1.5 h-[36px] px-3 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium"
              data-testid="btn-report-export">
              <Download size={14} /> Export <ChevronDown size={11} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 z-[100] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden w-44">
                <button onClick={() => { onExcelExport(); setExportOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#d2f1fa] text-left"
                  data-testid="btn-export-excel">
                  <FileText size={14} className="text-green-600" /> Excel / CSV
                </button>
                <button onClick={() => { handlePrint(); setExportOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#d2f1fa] text-left"
                  data-testid="btn-export-pdf">
                  <FileText size={14} className="text-red-600" /> PDF
                </button>
                <button onClick={() => { handlePrint(); setExportOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#d2f1fa] text-left"
                  data-testid="btn-view-screen">
                  <Monitor size={14} className="text-blue-500" /> View on Screen
                </button>
              </div>
            )}
          </div>

          {/* Print */}
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 h-[36px] px-3 rounded-lg text-white text-sm font-semibold shadow-sm hover:opacity-90"
            style={{ background: SC.primary }} data-testid="btn-report-print">
            <Printer size={14} /> Print
          </button>
        </div>

        {/* Secondary filter bar */}
        {extraFilters && (
          <div className="flex items-center gap-3 px-5 py-2 border-b border-gray-100 bg-gray-50/40 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold">
              <Filter size={12} /> Filter by:
            </div>
            {extraFilters}
          </div>
        )}

        {/* Report body */}
        <div className="overflow-x-auto" id="report-printable">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── ReportFilterSelect ────────────────────────────────────────────────────────
export function ReportFilterSelect({
  label, value, onChange, options, allLabel = "All",
}: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; allLabel?: string;
}) {
  const [open, setOpen]     = useState(false);
  const [q, setQ]           = useState("");
  const ref                 = useRef<HTMLDivElement>(null);
  const inputRef            = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filtered = options.filter(o => !q || o.toLowerCase().includes(q.toLowerCase()));
  const isActive = !!value;

  function openMenu() {
    setQ(""); setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 40);
  }

  return (
    <div ref={ref} className="relative flex items-center gap-0.5">
      <button type="button" onClick={openMenu}
        className={`flex items-center gap-1.5 h-[30px] px-3 rounded-full text-xs font-semibold border transition-colors ${
          isActive
            ? "bg-[#027fa5] text-white border-[#027fa5] rounded-r-none pr-2"
            : "bg-white text-gray-600 border-gray-200 hover:border-[#027fa5] hover:text-[#027fa5]"
        }`}
        data-testid={`filter-${label.toLowerCase().replace(/\s/g, "-")}`}>
        <span className={isActive ? "text-white/70" : "text-gray-400"}>{label}:</span>
        <span className="max-w-[140px] truncate">{value || allLabel}</span>
        {!isActive && <ChevronDown size={11} />}
      </button>
      {isActive && (
        <button type="button" onClick={() => onChange("")}
          className="h-[30px] px-1.5 rounded-r-full bg-[#027fa5] border border-[#027fa5] text-white/70 hover:text-white hover:bg-[#026a8a] transition-colors"
          data-testid={`filter-clear-${label.toLowerCase().replace(/\s/g, "-")}`}>
          <X size={11} />
        </button>
      )}
      {open && (
        <div className="absolute left-0 top-full mt-1 z-[100] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden w-64">
          <div className="px-2.5 py-1.5 border-b border-gray-100">
            <div className="flex items-center gap-1.5">
              <Search size={12} className="text-gray-400" />
              <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
                placeholder={`Search ${label}…`}
                className="flex-1 text-xs outline-none py-0.5" />
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
            <button type="button" onClick={() => { onChange(""); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-[#d2f1fa] ${!value ? "font-bold text-[#027fa5]" : "text-gray-600"}`}>
              {allLabel}
            </button>
            {filtered.map(o => (
              <button key={o} type="button" onClick={() => { onChange(o); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-[#d2f1fa] truncate ${value === o ? "font-bold text-[#027fa5] bg-[#d2f1fa]" : "text-gray-700"}`}>
                {o}
              </button>
            ))}
            {filtered.length === 0 && <div className="px-3 py-3 text-xs text-gray-400 text-center">No matches</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Table helpers ─────────────────────────────────────────────────────────────
export function RTh({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-4 py-2.5 text-xs font-bold text-gray-700 whitespace-nowrap ${right ? "text-right" : "text-left"}`}
      style={{ background: "#d2f1fa" }}>
      {children}
    </th>
  );
}

export function RTd({ children, right, muted, bold, className = "", colSpan }: {
  children?: React.ReactNode; right?: boolean; muted?: boolean;
  bold?: boolean; className?: string; colSpan?: number;
}) {
  return (
    <td colSpan={colSpan}
      className={`px-4 py-2.5 text-sm ${right ? "text-right" : ""} ${muted ? "text-gray-400" : "text-gray-700"} ${bold ? "font-semibold" : ""} ${className}`}>
      {children}
    </td>
  );
}

// ── CSV export ────────────────────────────────────────────────────────────────
export function exportToCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const esc = (v: string | number | null | undefined) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv  = [headers, ...rows].map(r => r.map(esc).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── printReport — async, fetches company settings, adds header + footer ───────
export async function printReport(title: string, fromDate?: string, toDate?: string) {
  // Fetch company settings from the server
  let settingsMap: Record<string, string> = {};
  try {
    const res = await fetch("/api/settings", { credentials: "include" });
    if (res.ok) {
      const list: { key: string; value: string }[] = await res.json();
      settingsMap = Object.fromEntries(list.map(s => [s.key, s.value]));
    }
  } catch { /* silently ignore */ }

  const companyName    = settingsMap["company_name"]    || "Silver Crown Group of Companies";
  const companyAddr    = settingsMap["company_address"] || "";
  const companyCity    = settingsMap["company_city"]    || "";
  const companyState   = settingsMap["company_state"]   || "";
  const companyPin     = settingsMap["company_pincode"] || "";
  const companyGstin   = settingsMap["company_gstin"]   || "";
  const companyPhone   = settingsMap["company_phone"]   || "";
  const companyEmail   = settingsMap["company_email"]   || "";

  const addrParts = [companyAddr, companyCity, companyState, companyPin].filter(Boolean);
  const addrLine  = addrParts.join(", ");

  const dateRange = fromDate && toDate
    ? `Period: ${fmtDisplayDate(fromDate)} — ${fmtDisplayDate(toDate)}`
    : "";

  const printedOn = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const content = document.getElementById("report-printable")?.innerHTML || "";

  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) return;

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} — ${companyName}</title>
  <style>
    /* ── Base ── */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 12px;
      color: #111;
      background: #fff;
    }

    /* ── Company header ── */
    .print-header {
      border-bottom: 2px solid #027fa5;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
    .company-name {
      font-size: 17px;
      font-weight: 700;
      color: #027fa5;
      letter-spacing: 0.3px;
    }
    .company-meta {
      font-size: 10.5px;
      color: #555;
      margin-top: 2px;
      line-height: 1.5;
    }
    .report-title-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      margin-top: 8px;
    }
    .report-title {
      font-size: 13px;
      font-weight: 700;
      color: #111;
    }
    .report-meta {
      font-size: 10px;
      color: #666;
      text-align: right;
    }

    /* ── Table ── */
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    thead th {
      background: #d2f1fa;
      font-weight: 700;
      padding: 6px 8px;
      text-align: left;
      font-size: 11px;
      border-bottom: 2px solid #027fa5;
      white-space: nowrap;
    }
    thead th.right { text-align: right; }
    td {
      padding: 5px 8px;
      font-size: 11px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: top;
    }
    tbody tr:nth-child(even) td { background: #f8fafc; }
    tfoot td, tfoot th {
      background: #d2f1fa;
      font-weight: 700;
      padding: 6px 8px;
      font-size: 11px;
      border-top: 2px solid #027fa5;
    }

    /* ── Footer via @page paged media ── */
    @page {
      size: A4 landscape;
      margin: 15mm 12mm 20mm 12mm;

      @bottom-left {
        content: "Powered by Microgenn";
        font-size: 9px;
        color: #888;
        font-family: Arial, sans-serif;
      }
      @bottom-center {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 9px;
        color: #888;
        font-family: Arial, sans-serif;
      }
      @bottom-right {
        content: "Printed: ${printedOn.replace(/"/g, "'")}";
        font-size: 9px;
        color: #888;
        font-family: Arial, sans-serif;
      }
    }

    /* Hide screen-only elements */
    .no-print { display: none !important; }

    /* Page break before each new page of table */
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
  </style>
</head>
<body>
  <div class="print-header">
    <div class="company-name">${companyName}</div>
    <div class="company-meta">
      ${addrLine ? `<span>${addrLine}</span>` : ""}
      ${companyGstin ? `&nbsp;|&nbsp; GSTIN: <strong>${companyGstin}</strong>` : ""}
      ${companyPhone ? `&nbsp;|&nbsp; Ph: ${companyPhone}` : ""}
      ${companyEmail ? `&nbsp;|&nbsp; ${companyEmail}` : ""}
    </div>
    <div class="report-title-row">
      <div class="report-title">${title}</div>
      <div class="report-meta">
        ${dateRange ? `<div>${dateRange}</div>` : ""}
      </div>
    </div>
  </div>

  ${content}
</body>
</html>`);

  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 600);
}
