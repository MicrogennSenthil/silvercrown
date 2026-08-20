import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { ReportShell, RTh, RTd } from "@/components/ReportShell";

const SC = { primary: "#027fa5", tonal: "#d2f1fa" };

type Mode = "summary" | "detailed";
type TaxMode = "with_tax" | "without_tax";

type PartyOption = { party_id: string | null; party_name: string };
type ItemOption = { item_id: string | null; item_name: string };
type SalesRow = {
  invoice_id: string;
  invoice_date: string;
  invoice_no: string;
  party_id: string | null;
  party_name: string;
  taxable_amount: string;
  tax_amount: string;
  charge_amount: string;
  invoice_total: string;
  invoice_item_id?: string;
  item_id?: string | null;
  item_code?: string;
  item_name?: string;
  unit?: string;
  qty?: string;
  rate?: string;
};
type ReportResponse = { rows: SalesRow[]; parties: PartyOption[]; items: ItemOption[] };

function today() { return new Date().toISOString().slice(0, 10); }
function firstDay() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function amount(value: string | number | undefined) {
  return parseFloat(String(value || 0)) || 0;
}
function fmtAmount(value: string | number | undefined) {
  return amount(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(value: string) {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
}
function selectedFilterParam(value: string, idKey: string, nameKey: string): [string, string] | null {
  if (value.startsWith("id:")) return [idKey, value.slice(3)];
  if (value.startsWith("name:")) return [nameKey, value.slice(5)];
  return null;
}

function ChoiceGroup<T extends string>({
  label, value, onChange, options,
}: {
  label: string; value: T; onChange: (value: T) => void; options: { value: T; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white p-0.5">
      <span className="pl-2 text-[11px] font-semibold text-gray-400">{label}</span>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
            value === option.value ? "bg-[#027fa5] text-white" : "text-gray-600 hover:bg-gray-100"
          }`}
          data-testid={`sales-statement-${label.toLowerCase()}-${option.value}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default function ConsolidatedSalesStatement() {
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState(firstDay());
  const [toDate, setToDate] = useState(today());
  const [partyFilter, setPartyFilter] = useState("");
  const [itemFilter, setItemFilter] = useState("");
  const [mode, setMode] = useState<Mode>("summary");
  const [taxMode, setTaxMode] = useState<TaxMode>("with_tax");

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ from: fromDate, to: toDate, mode, tax_mode: taxMode });
    const partyParam = selectedFilterParam(partyFilter, "party_id", "party_name");
    const itemParam = selectedFilterParam(itemFilter, "item_id", "item_name");
    if (partyParam) params.set(partyParam[0], partyParam[1]);
    if (itemParam) params.set(itemParam[0], itemParam[1]);
    return params.toString();
  }, [fromDate, toDate, mode, taxMode, partyFilter, itemFilter]);

  const { data, isLoading } = useQuery<ReportResponse>({
    queryKey: ["/api/reports/consolidated-sales-statement", queryString],
    queryFn: async () => {
      const response = await fetch(`/api/reports/consolidated-sales-statement?${queryString}`, { credentials: "include" });
      if (!response.ok) throw new Error("Could not load the sales statement.");
      return response.json();
    },
  });

  const rows = data?.rows || [];
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    const matches = (row: SalesRow) => [
      row.invoice_no, row.party_name, row.item_name, row.item_code,
    ].join(" ").toLowerCase().includes(query);
    if (mode === "summary") return rows.filter(matches);

    // Detail totals are invoice-level, so a search keeps every line for each matching invoice.
    const matchingInvoices = new Set(rows.filter(matches).map(row => row.invoice_id));
    return rows.filter(row => matchingInvoices.has(row.invoice_id));
  }, [rows, search, mode]);

  const invoices = new Set(filteredRows.map(row => row.invoice_id));
  const displayRows = useMemo(() => {
    const seenInvoices = new Set<string>();
    return filteredRows.map(row => {
      const isFirstInvoiceRow = !seenInvoices.has(row.invoice_id);
      seenInvoices.add(row.invoice_id);
      return { row, isFirstInvoiceRow };
    });
  }, [filteredRows]);
  const totalTaxable = filteredRows.reduce((sum, row) => sum + amount(row.taxable_amount), 0);
  const totalTax = filteredRows.reduce((sum, row) => sum + amount(row.tax_amount), 0);
  const totalInvoice = useMemo(() => {
    const invoiceTotals = new Map<string, number>();
    filteredRows.forEach(row => invoiceTotals.set(row.invoice_id, amount(row.invoice_total)));
    return Array.from(invoiceTotals.values()).reduce((sum, value) => sum + value, 0);
  }, [filteredRows]);

  const partyLabel = partyFilter
    ? partyFilter.startsWith("id:")
      ? data?.parties.find(p => p.party_id === partyFilter.slice(3))?.party_name || "Selected party"
      : partyFilter.slice(5)
    : "All Parties";
  const itemLabel = itemFilter
    ? itemFilter.startsWith("id:")
      ? data?.items.find(item => item.item_id === itemFilter.slice(3))?.item_name || "Selected item"
      : itemFilter.slice(5)
    : "All Items";

  function exportExcel() {
    const headers = mode === "detailed"
      ? ["S.No", "Date", "Invoice No", "Party Name", "Item Name", "Taxable Amount", ...(taxMode === "with_tax" ? ["Taxes"] : []), "Invoice Total"]
      : ["S.No", "Date", "Invoice No", "Party Name", "Taxable Amount", ...(taxMode === "with_tax" ? ["Taxes"] : []), "Invoice Total"];
    const sheetRows: (string | number)[][] = [
      ["Consolidated Sales Statement"],
      [`Period: ${fmtDate(fromDate)} to ${fmtDate(toDate)}`],
      [`View: ${mode === "summary" ? "Summary" : "Detailed"} | Tax: ${taxMode === "with_tax" ? "With Tax" : "Without Tax"} | Party: ${partyLabel} | Item: ${itemLabel}`],
      [],
      headers,
      ...displayRows.map(({ row, isFirstInvoiceRow }, index) => [
        index + 1,
        fmtDate(row.invoice_date),
        row.invoice_no,
        row.party_name,
        ...(mode === "detailed" ? [row.item_name || "—"] : []),
        amount(row.taxable_amount),
        ...(taxMode === "with_tax" ? [amount(row.tax_amount)] : []),
        mode === "detailed" && !isFirstInvoiceRow ? "" : amount(row.invoice_total),
      ]),
    ];

    sheetRows.push([
      "", "", "", `Grand Total (${invoices.size} invoice${invoices.size === 1 ? "" : "s"})`,
      ...(mode === "detailed" ? [""] : []),
      totalTaxable,
      ...(taxMode === "with_tax" ? [totalTax] : []),
      totalInvoice,
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
    worksheet["!cols"] = headers.map((header, index) => ({
      wch: index === 0 ? 8 : header === "Party Name" || header === "Item Name" ? 28 : 18,
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sales Statement");
    XLSX.writeFile(workbook, `Consolidated_Sales_Statement_${fromDate}_to_${toDate}.xlsx`);
  }

  const columnCount = mode === "detailed" ? (taxMode === "with_tax" ? 8 : 7) : (taxMode === "with_tax" ? 7 : 6);

  return (
    <ReportShell
      title="Consolidated Sales Statement"
      search={search}
      onSearch={setSearch}
      fromDate={fromDate}
      toDate={toDate}
      onFromDate={setFromDate}
      onToDate={setToDate}
      onExcelExport={exportExcel}
      recordCount={mode === "summary" ? filteredRows.length : invoices.size}
      extraFilters={
        <>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
            Party:
            <select
              value={partyFilter}
              onChange={event => setPartyFilter(event.target.value)}
              className="h-[30px] max-w-[200px] rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 outline-none focus:border-[#027fa5]"
              data-testid="filter-sales-statement-party"
            >
              <option value="">All Parties</option>
              {(data?.parties || []).map(party => (
                <option key={`${party.party_id || "manual"}-${party.party_name}`} value={party.party_id ? `id:${party.party_id}` : `name:${party.party_name}`}>
                  {party.party_name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
            Item:
            <select
              value={itemFilter}
              onChange={event => setItemFilter(event.target.value)}
              className="h-[30px] max-w-[200px] rounded-full border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 outline-none focus:border-[#027fa5]"
              data-testid="filter-sales-statement-item"
            >
              <option value="">All Items</option>
              {(data?.items || []).map(item => (
                <option key={`${item.item_id || "manual"}-${item.item_name}`} value={item.item_id ? `id:${item.item_id}` : `name:${item.item_name}`}>
                  {item.item_name}
                </option>
              ))}
            </select>
          </label>
          <ChoiceGroup
            label="View"
            value={mode}
            onChange={setMode}
            options={[{ value: "summary", label: "Summary" }, { value: "detailed", label: "Detailed" }]}
          />
          <ChoiceGroup
            label="Tax"
            value={taxMode}
            onChange={setTaxMode}
            options={[{ value: "with_tax", label: "With Tax" }, { value: "without_tax", label: "Without Tax" }]}
          />
        </>
      }
    >
      <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-2 text-xs text-gray-500 print:block">
        <span className="font-semibold text-gray-700">View:</span> {mode === "summary" ? "Summary" : "Detailed"}
        <span className="mx-2 text-gray-300">|</span>
        <span className="font-semibold text-gray-700">Tax:</span> {taxMode === "with_tax" ? "With Tax" : "Without Tax"}
        <span className="mx-2 text-gray-300">|</span>
        <span className="font-semibold text-gray-700">Party:</span> {partyLabel}
        <span className="mx-2 text-gray-300">|</span>
        <span className="font-semibold text-gray-700">Item:</span> {itemLabel}
        {itemFilter && <span className="ml-3 text-gray-400">The item filter selects complete invoices containing this item.</span>}
        {mode === "detailed" && <span className="ml-3 text-gray-400">Invoice Total appears once per invoice and includes saved charges.</span>}
      </div>

      {!isLoading && filteredRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-gray-100 bg-gray-50/50 px-5 py-2 text-xs">
          <span className="text-gray-500">Invoices: <b className="text-gray-800">{invoices.size}</b></span>
          {mode === "detailed" && <span className="text-gray-500">Items: <b className="text-gray-800">{filteredRows.length}</b></span>}
          <span className="text-gray-500">Taxable Amount: <b className="text-gray-800">₹{fmtAmount(totalTaxable)}</b></span>
          {taxMode === "with_tax" && <span className="text-gray-500">Taxes: <b className="text-gray-800">₹{fmtAmount(totalTax)}</b></span>}
          <span className="text-gray-500">Invoice Total: <b style={{ color: SC.primary }}>₹{fmtAmount(totalInvoice)}</b></span>
        </div>
      )}

      <table className="w-full text-sm">
        <thead className="sticky top-0">
          <tr>
            <RTh>S.no</RTh>
            <RTh>Date</RTh>
            <RTh>Invoice No</RTh>
            <RTh>Party Name</RTh>
            {mode === "detailed" && <RTh>Item Name</RTh>}
            <RTh right>Taxable Amount</RTh>
            {taxMode === "with_tax" && <RTh right>Taxes</RTh>}
            <RTh right>Invoice Total</RTh>
          </tr>
        </thead>
        <tbody>
          {isLoading && (
            <tr>
              <td colSpan={columnCount} className="px-5 py-14 text-center text-gray-400">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-7 w-7 animate-spin rounded-full" style={{ border: "3px solid #d2f1fa", borderTopColor: SC.primary }} />
                  <span>Loading sales statement…</span>
                </div>
              </td>
            </tr>
          )}
          {!isLoading && filteredRows.length === 0 && (
            <tr>
              <td colSpan={columnCount} className="px-5 py-14 text-center">
                <div className="flex flex-col items-center gap-2 text-gray-400">
                  <AlertCircle size={28} className="text-gray-300" />
                  <span className="text-sm">
                    {search || partyFilter || itemFilter ? "No invoices match the selected filters." : "No sales invoices in this date range."}
                  </span>
                </div>
              </td>
            </tr>
          )}
          {!isLoading && displayRows.map(({ row, isFirstInvoiceRow }, index) => (
            <tr
              key={mode === "detailed" ? row.invoice_item_id : row.invoice_id}
              className="border-t border-gray-50 transition-colors hover:bg-[#f0f9ff]"
              data-testid={`sales-statement-row-${row.invoice_id}`}
            >
              <RTd muted>{String(index + 1).padStart(2, "0")}</RTd>
              <RTd muted>{fmtDate(row.invoice_date)}</RTd>
              <RTd bold><span style={{ color: SC.primary }}>{row.invoice_no}</span></RTd>
              <RTd bold>{row.party_name || "—"}</RTd>
              {mode === "detailed" && (
                <RTd>
                  <span className="font-medium">{row.item_name || "—"}</span>
                  {row.item_code && <span className="ml-1.5 text-[11px] text-gray-400">[{row.item_code}]</span>}
                  {(row.qty || row.rate) && <div className="text-[10px] text-gray-400">Qty: {row.qty || "0"} {row.unit || ""} · Rate: ₹{fmtAmount(row.rate)}</div>}
                </RTd>
              )}
              <RTd right>{fmtAmount(row.taxable_amount)}</RTd>
              {taxMode === "with_tax" && <RTd right>{fmtAmount(row.tax_amount)}</RTd>}
              <RTd right bold>
                {mode === "detailed" && !isFirstInvoiceRow
                  ? <span className="text-gray-300">—</span>
                  : <span style={{ color: SC.primary }}>{fmtAmount(row.invoice_total)}</span>}
              </RTd>
            </tr>
          ))}
        </tbody>
        {!isLoading && filteredRows.length > 0 && (
          <tfoot>
            <tr style={{ background: SC.tonal }}>
              <td colSpan={mode === "detailed" ? 5 : 4} className="px-4 py-2.5 text-sm font-bold text-gray-700">
                Grand Total — {invoices.size} invoice{invoices.size === 1 ? "" : "s"}
              </td>
              <td className="px-4 py-2.5 text-right text-sm font-bold text-gray-700">₹{fmtAmount(totalTaxable)}</td>
              {taxMode === "with_tax" && <td className="px-4 py-2.5 text-right text-sm font-bold text-gray-700">₹{fmtAmount(totalTax)}</td>}
              <td className="px-4 py-2.5 text-right text-sm font-bold" style={{ color: SC.primary }}>₹{fmtAmount(totalInvoice)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </ReportShell>
  );
}