/**
 * ReportShell — Standard report wrapper used by ALL reports in the system.
 * Provides: search, date range, print, Excel export, PDF export, screen-view.
 */
import { useState, useRef } from "react";
import { Printer, Download, FileText, Monitor, Search, X, ChevronDown } from "lucide-react";

export interface ReportShellProps {
  title: string;
  search: string;
  onSearch: (v: string) => void;
  fromDate: string;
  toDate: string;
  onFromDate: (v: string) => void;
  onToDate: (v: string) => void;
  onPrint: () => void;
  onExcelExport: () => void;
  onPdfExport: () => void;
  recordCount?: number;
  children: React.ReactNode;
}

const SC = { primary: "#027fa5", orange: "#d74700", tonal: "#d2f1fa", bg: "#f5f0ed" };

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative flex items-center">
      <div className="relative border border-gray-200 rounded-lg bg-white flex items-center h-[36px] px-3 gap-2 hover:border-[#027fa5] transition-colors focus-within:border-[#027fa5] focus-within:ring-1 focus-within:ring-[#027fa5]/20">
        <span className="text-[10px] font-semibold text-gray-400 absolute -top-2 left-2 bg-white px-1">{label}</span>
        <input
          type="date" value={value} onChange={e => onChange(e.target.value)}
          className="text-sm text-gray-700 outline-none bg-transparent w-[120px]"
          data-testid={`input-report-${label.toLowerCase().replace(/\s/g, "-")}`}
        />
      </div>
    </div>
  );
}

export function ReportShell({
  title, search, onSearch, fromDate, toDate, onFromDate, onToDate,
  onPrint, onExcelExport, onPdfExport, recordCount, children,
}: ReportShellProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  return (
    <div className="p-4" style={{ background: SC.bg, minHeight: "100vh", fontFamily: "Source Sans Pro, sans-serif" }}>
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden">

        {/* ── Title bar ──────────────────────────────────────────────────── */}
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

        {/* ── Filter / action bar ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search} onChange={e => onSearch(e.target.value)}
              placeholder="Search anything…"
              className="w-full h-[36px] pl-8 pr-8 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#027fa5] focus:ring-1 focus:ring-[#027fa5]/20 bg-white"
              data-testid="input-report-search"
            />
            {search && (
              <button onClick={() => onSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Date range */}
          <DateField label="From" value={fromDate} onChange={onFromDate} />
          <DateField label="To"   value={toDate}   onChange={onToDate} />

          {/* Spacer */}
          <div className="flex-1" />

          {/* Export dropdown */}
          <div ref={exportRef} className="relative">
            <button onClick={() => setExportOpen(o => !o)}
              className="flex items-center gap-1.5 h-[36px] px-3 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 font-medium"
              data-testid="btn-report-export">
              <Download size={14} /> Export <ChevronDown size={12} />
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden w-44"
                onMouseLeave={() => setExportOpen(false)}>
                <button onClick={() => { onExcelExport(); setExportOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#d2f1fa] text-left"
                  data-testid="btn-export-excel">
                  <FileText size={14} className="text-green-600" /> Excel / CSV
                </button>
                <button onClick={() => { onPdfExport(); setExportOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#d2f1fa] text-left"
                  data-testid="btn-export-pdf">
                  <FileText size={14} className="text-red-600" /> PDF
                </button>
                <button onClick={() => { onPrint(); setExportOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-[#d2f1fa] text-left"
                  data-testid="btn-view-screen">
                  <Monitor size={14} className="text-blue-500" /> View on Screen
                </button>
              </div>
            )}
          </div>

          {/* Print */}
          <button onClick={onPrint}
            className="flex items-center gap-1.5 h-[36px] px-3 rounded-lg text-white text-sm font-semibold shadow-sm hover:opacity-90"
            style={{ background: SC.primary }} data-testid="btn-report-print">
            <Printer size={14} /> Print
          </button>
        </div>

        {/* ── Report body (table injected by parent) ──────────────────────── */}
        <div className="overflow-x-auto" id="report-printable">
          {children}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Standard report table header cell */
export function RTh({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-4 py-2.5 text-xs font-bold text-gray-700 whitespace-nowrap ${right ? "text-right" : "text-left"}`}
      style={{ background: "#d2f1fa" }}>
      {children}
    </th>
  );
}

/** Standard report table data cell */
export function RTd({ children, right, muted, bold, className = "", colSpan }: {
  children?: React.ReactNode; right?: boolean; muted?: boolean; bold?: boolean; className?: string; colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`px-4 py-2.5 text-sm ${right ? "text-right" : ""} ${muted ? "text-gray-400" : "text-gray-700"} ${bold ? "font-semibold" : ""} ${className}`}>
      {children}
    </td>
  );
}

/** Export data to CSV file */
export function exportToCSV(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: string | number | null | undefined) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map(r => r.map(escape).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/** Print the report */
export function printReport(title: string) {
  const content = document.getElementById("report-printable")?.innerHTML || "";
  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(`
    <html><head><title>${title}</title>
    <style>
      body { font-family: 'Source Sans Pro', Arial, sans-serif; font-size: 13px; color: #111; margin: 20px; }
      h2 { font-size: 16px; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #d2f1fa; font-weight: bold; padding: 8px 10px; text-align: left; font-size: 12px; border-bottom: 2px solid #027fa5; }
      td { padding: 7px 10px; font-size: 12px; border-bottom: 1px solid #e5e7eb; }
      tr:nth-child(even) td { background: #f8fafc; }
      .no-print { display: none !important; }
      @media print { @page { size: A4 landscape; margin: 15mm; } }
    </style></head>
    <body><h2>${title}</h2>${content}</body></html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}
