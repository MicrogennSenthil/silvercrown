import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import {
  ReportShell, RTd, RTh, exportToCSV, printReport,
} from "@/components/ReportShell";

const SC = { primary: "#027fa5", tonal: "#d2f1fa" };

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthAgo() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
}

function fmtAmount(value: string | number | null | undefined) {
  return Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type CancelledInvoice = {
  id: string;
  voucher_no: string;
  invoice_date: string;
  cancelled_at: string | null;
  party_name: string;
  total_amount: string | number;
  remark: string;
};

export default function CancelInvoiceReport() {
  const [fromDate, setFromDate] = useState(monthAgo());
  const [toDate, setToDate] = useState(today());
  const [search, setSearch] = useState("");

  const { data: rows = [], isLoading } = useQuery<CancelledInvoice[]>({
    queryKey: ["/api/reports/engineering/cancel-invoice", fromDate, toDate],
    queryFn: () => fetch(
      `/api/reports/engineering/cancel-invoice?from=${fromDate}&to=${toDate}`,
      { credentials: "include" },
    ).then(r => r.json()),
  });

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(row =>
      [row.voucher_no, row.party_name, row.remark, row.invoice_date]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [rows, search]);

  const totalAmount = filteredRows.reduce(
    (sum, row) => sum + Number(row.total_amount || 0),
    0,
  );

  function handleExcel() {
    exportToCSV(
      `CancelInvoiceReport_${fromDate}_${toDate}.csv`,
      ["S.No", "Invoice No.", "Invoice Date", "Cancelled On", "Customer", "Amount", "Remark"],
      filteredRows.map((row, index) => [
        index + 1,
        row.voucher_no,
        fmtDate(row.invoice_date),
        fmtDateTime(row.cancelled_at),
        row.party_name,
        fmtAmount(row.total_amount),
        row.remark,
      ]),
    );
  }

  return (
    <ReportShell
      title="Cancel Invoice Report"
      search={search}
      onSearch={setSearch}
      fromDate={fromDate}
      toDate={toDate}
      onFromDate={setFromDate}
      onToDate={setToDate}
      onPrint={() => printReport("Cancel Invoice Report")}
      onExcelExport={handleExcel}
      onPdfExport={() => printReport("Cancel Invoice Report")}
      recordCount={filteredRows.length}
    >
      <div className="flex items-center gap-6 px-5 py-2 border-b border-gray-100 bg-gray-50/50 text-xs">
        <span className="text-gray-500">
          Cancelled invoices: <b className="text-gray-800">{filteredRows.length}</b>
        </span>
        <span className="text-gray-500">
          Total amount: <b style={{ color: SC.primary }}>₹{fmtAmount(totalAmount)}</b>
        </span>
      </div>

      <table className="w-full text-sm">
        <thead className="sticky top-0">
          <tr>
            <RTh>S.No</RTh>
            <RTh>Invoice No.</RTh>
            <RTh>Invoice Date</RTh>
            <RTh>Cancelled On</RTh>
            <RTh>Customer</RTh>
            <RTh right>Amount ₹</RTh>
            <RTh>Remark</RTh>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td colSpan={7} className="px-5 py-14 text-center text-gray-400">
                <div className="flex flex-col items-center gap-2">
                  <div className="w-7 h-7 rounded-full animate-spin"
                    style={{ border: "3px solid #d2f1fa", borderTopColor: "#027fa5" }} />
                  <span>Loading…</span>
                </div>
              </td>
            </tr>
          )}
          {!isLoading && filteredRows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-5 py-14 text-center">
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <AlertCircle size={28} className="text-gray-300" />
                  <span>
                    {search ? "No cancelled invoices match the search." : "No cancelled invoices for the selected period."}
                  </span>
                </div>
              </td>
            </tr>
          )}
          {!isLoading && filteredRows.map((row, index) => (
            <tr key={row.id} className="border-t border-gray-50 hover:bg-[#f0f9ff]">
              <RTd muted>{index + 1}</RTd>
              <RTd><span className="font-semibold" style={{ color: SC.primary }}>{row.voucher_no}</span></RTd>
              <RTd>{fmtDate(row.invoice_date)}</RTd>
              <RTd muted>{fmtDateTime(row.cancelled_at)}</RTd>
              <RTd>{row.party_name || "—"}</RTd>
              <RTd right><span className="font-semibold">₹{fmtAmount(row.total_amount)}</span></RTd>
              <RTd muted>{row.remark || "—"}</RTd>
            </tr>
          ))}
        </tbody>
        {!isLoading && filteredRows.length > 0 && (
          <tfoot>
            <tr style={{ background: SC.tonal }}>
              <td colSpan={5} className="px-3 py-2 text-right text-xs font-bold">Total</td>
              <td className="px-3 py-2 text-right text-xs font-bold">₹{fmtAmount(totalAmount)}</td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>
    </ReportShell>
  );
}