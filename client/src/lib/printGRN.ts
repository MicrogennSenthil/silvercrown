export function buildGRNHTML(doc: any): string {
  const items: any[] = doc.items || [];

  const fmtDate = (d: string) => {
    if (!d) return "—";
    const dt = new Date(d);
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };
  const fmtAmt = (v: any) => {
    const n = parseFloat(v) || 0;
    return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  function amountInWords(amount: number): string {
    const ones = ["", "One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
      "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
    const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
    function convert(n: number): string {
      if (n === 0) return "";
      if (n < 20) return ones[n] + " ";
      if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? " " + ones[n%10] : "") + " ";
      if (n < 1000) return ones[Math.floor(n/100)] + " Hundred " + convert(n%100);
      if (n < 100000) return convert(Math.floor(n/1000)) + "Thousand " + convert(n%1000);
      if (n < 10000000) return convert(Math.floor(n/100000)) + "Lakh " + convert(n%100000);
      return convert(Math.floor(n/10000000)) + "Crore " + convert(n%10000000);
    }
    const rupees = Math.floor(amount);
    const paise = Math.round((amount - rupees) * 100);
    let words = convert(rupees).trim();
    if (words === "") words = "Zero";
    words = words + " Rupees";
    if (paise > 0) words += " and " + convert(paise).trim() + " Paise";
    return words + " Only";
  }

  const taxGroups: Record<string, { taxable: number; cgst: number; sgst: number; igst: number }> = {};
  items.forEach(it => {
    const pct = parseFloat(it.cgst_pct || 0) + parseFloat(it.sgst_pct || 0) + parseFloat(it.igst_pct || 0);
    const key = `GST ${pct}%`;
    if (!taxGroups[key]) taxGroups[key] = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
    taxGroups[key].taxable += parseFloat(it.taxable_amt || 0);
    taxGroups[key].cgst   += parseFloat(it.cgst_amt || 0);
    taxGroups[key].sgst   += parseFloat(it.sgst_amt || 0);
    taxGroups[key].igst   += parseFloat(it.igst_amt || 0);
  });

  const taxRows = Object.entries(taxGroups).map(([label, t]) => `
    <tr>
      <td>${label}</td>
      <td style="text-align:right">${fmtAmt(t.taxable)}</td>
      <td style="text-align:right">${fmtAmt(t.cgst)}</td>
      <td style="text-align:right">${fmtAmt(t.sgst)}</td>
      <td style="text-align:right">${fmtAmt(t.igst)}</td>
    </tr>`).join("");

  const totalTaxable = items.reduce((s, it) => s + parseFloat(it.taxable_amt || 0), 0);
  const totalCgst    = items.reduce((s, it) => s + parseFloat(it.cgst_amt || 0), 0);
  const totalSgst    = items.reduce((s, it) => s + parseFloat(it.sgst_amt || 0), 0);
  const totalIgst    = items.reduce((s, it) => s + parseFloat(it.igst_amt || 0), 0);
  const grandTotal   = parseFloat(doc.grand_total || 0);

  const itemRows = items.map((it, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${it.item_code || ""}</td>
      <td>${it.item_name || ""}</td>
      <td style="text-align:center">${it.batch_no || "—"}</td>
      <td style="text-align:center">${it.expiry_date ? fmtDate(it.expiry_date) : "—"}</td>
      <td style="text-align:right">${fmtAmt(it.qty)}</td>
      <td style="text-align:center">${it.unit || ""}</td>
      <td style="text-align:right">${fmtAmt(it.rate)}</td>
      <td style="text-align:right">${fmtAmt(it.taxable_amt)}</td>
      <td style="text-align:center">${parseFloat(it.cgst_pct || 0)}%</td>
      <td style="text-align:right">${fmtAmt(it.cgst_amt)}</td>
      <td style="text-align:center">${parseFloat(it.sgst_pct || 0)}%</td>
      <td style="text-align:right">${fmtAmt(it.sgst_amt)}</td>
      <td style="text-align:right"><strong>${fmtAmt(it.total)}</strong></td>
    </tr>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>GRN — ${doc.voucher_no}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Arial', sans-serif; font-size: 10px; color: #111; background: #fff; }
  .grn-page {
    width: 210mm;
    min-height: 280mm;
    max-height: 285mm;
    padding: 6mm 7mm;
    margin: 0 auto;
    overflow: hidden;
  }
  @page { size: A4 portrait; margin: 0; }
  @media print {
    html, body { width: 210mm; height: 297mm; margin: 0; padding: 0; }
    .grn-page { width: 210mm; padding: 6mm 7mm; overflow: hidden; }
  }
  @media screen {
    body { background: #e0e0e0; padding: 10px 0; }
    .grn-page { background: #fff; margin: 10px auto; box-shadow: 0 2px 8px rgba(0,0,0,0.18); }
  }
  .header { border: 1.5px solid #222; padding: 5px 8px; margin-bottom: 5px; }
  .company { font-size: 13px; font-weight: bold; color: #027fa5; text-align: center; letter-spacing: 0.5px; }
  .sub { font-size: 8px; text-align: center; color: #444; }
  .doc-title { font-size: 10px; font-weight: bold; text-align: center; margin: 3px 0; text-transform: uppercase; letter-spacing: 1px; }
  .meta-row { display: flex; gap: 5px; margin-bottom: 4px; }
  .meta-box { flex: 1; border: 1px solid #bbb; padding: 3px 5px; }
  .meta-box label { display: block; font-size: 7px; color: #888; text-transform: uppercase; margin-bottom: 1px; }
  .meta-box span { font-size: 9px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 5px; font-size: 8.5px; }
  th { background: #027fa5; color: #fff; padding: 3px 4px; text-align: left; }
  td { padding: 2px 4px; border-bottom: 1px solid #e5e5e5; vertical-align: middle; }
  tr:nth-child(even) td { background: #f7fbfd; }
  .tax-table th { background: #6b7280; }
  .total-row td { font-weight: 700; border-top: 1.5px solid #027fa5; }
  .grand-box { background: #027fa5; color: #fff; padding: 4px 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }
  .grand-box .label { font-size: 10px; font-weight: bold; }
  .grand-box .amount { font-size: 12px; font-weight: bold; }
  .words-box { border: 1px solid #bbb; padding: 4px 6px; font-style: italic; font-size: 8.5px; margin-bottom: 5px; }
  .footer { display: flex; justify-content: space-between; padding-top: 16px; }
  .sign-box { text-align: center; border-top: 1px solid #333; width: 140px; padding-top: 3px; font-size: 8.5px; }
</style>
</head><body><div class="grn-page">
<div class="header">
  <div class="company">SILVER CROWN METAL COATINGS</div>
  <div class="sub">GSTIN: 33AANFS5823J1ZW &nbsp;|&nbsp; No.10A, Industrial Estate, Chennai - 600 032 &nbsp;|&nbsp; Ph: +91 44 0000 0000</div>
  <div class="doc-title">Goods Receipt Note</div>
</div>

<div class="meta-row">
  <div class="meta-box"><label>GRN No.</label><span>${doc.voucher_no || "—"}</span></div>
  <div class="meta-box"><label>GRN Date</label><span>${fmtDate(doc.grn_date)}</span></div>
  <div class="meta-box"><label>Supplier Bill No.</label><span>${doc.bill_no || "—"}</span></div>
  <div class="meta-box"><label>Bill Date</label><span>${doc.bill_date ? fmtDate(doc.bill_date) : "—"}</span></div>
  <div class="meta-box"><label>DC No.</label><span>${doc.dc_no || "—"}</span></div>
  <div class="meta-box"><label>Payment Mode</label><span>${doc.payment_mode || "—"}</span></div>
</div>
<div class="meta-row">
  <div class="meta-box" style="flex:2"><label>Supplier</label><span>${doc.supplier_name || "—"}</span></div>
  <div class="meta-box" style="flex:2"><label>Store / Warehouse</label><span>${doc.store_name || doc.store_name_db || "—"}</span></div>
  <div class="meta-box"><label>Status</label><span>${doc.status || "Draft"}</span></div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:28px">#</th>
      <th>Code</th>
      <th>Item Name</th>
      <th style="text-align:center">Batch No</th>
      <th style="text-align:center">Expiry</th>
      <th style="text-align:right">Qty</th>
      <th style="text-align:center">Unit</th>
      <th style="text-align:right">Rate ₹</th>
      <th style="text-align:right">Taxable ₹</th>
      <th style="text-align:center">CGST%</th>
      <th style="text-align:right">CGST ₹</th>
      <th style="text-align:center">SGST%</th>
      <th style="text-align:right">SGST ₹</th>
      <th style="text-align:right">Total ₹</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
    <tr class="total-row">
      <td colspan="8" style="text-align:right">Totals:</td>
      <td style="text-align:right">${fmtAmt(totalTaxable)}</td>
      <td></td>
      <td style="text-align:right">${fmtAmt(totalCgst)}</td>
      <td></td>
      <td style="text-align:right">${fmtAmt(totalSgst)}</td>
      <td style="text-align:right">${fmtAmt(totalTaxable + totalCgst + totalSgst + totalIgst)}</td>
    </tr>
  </tbody>
</table>

<div style="display:flex; gap:10px; margin-bottom:8px;">
  <div style="flex:1">
    <table class="tax-table">
      <thead><tr><th>Tax Slab</th><th style="text-align:right">Taxable ₹</th><th style="text-align:right">CGST ₹</th><th style="text-align:right">SGST ₹</th><th style="text-align:right">IGST ₹</th></tr></thead>
      <tbody>
        ${taxRows}
        <tr class="total-row">
          <td>Total</td>
          <td style="text-align:right">${fmtAmt(totalTaxable)}</td>
          <td style="text-align:right">${fmtAmt(totalCgst)}</td>
          <td style="text-align:right">${fmtAmt(totalSgst)}</td>
          <td style="text-align:right">${fmtAmt(totalIgst)}</td>
        </tr>
      </tbody>
    </table>
  </div>
  <div style="width:200px;">
    <table>
      <tbody>
        <tr><td>Taxable Amount</td><td style="text-align:right">${fmtAmt(totalTaxable)}</td></tr>
        <tr><td>CGST</td><td style="text-align:right">${fmtAmt(totalCgst)}</td></tr>
        <tr><td>SGST</td><td style="text-align:right">${fmtAmt(totalSgst)}</td></tr>
        ${totalIgst > 0 ? `<tr><td>IGST</td><td style="text-align:right">${fmtAmt(totalIgst)}</td></tr>` : ""}
        ${parseFloat(doc.round_off || 0) !== 0 ? `<tr><td>Round Off</td><td style="text-align:right">${fmtAmt(doc.round_off)}</td></tr>` : ""}
      </tbody>
    </table>
  </div>
</div>

<div class="grand-box">
  <span class="label">Grand Total</span>
  <span class="amount">₹ ${fmtAmt(grandTotal)}</span>
</div>

<div class="words-box">
  <strong>Amount in Words:</strong> ${amountInWords(grandTotal)}
</div>

${doc.remark ? `<div class="words-box"><strong>Remark:</strong> ${doc.remark}</div>` : ""}

<div class="footer">
  <div class="sign-box">Received By</div>
  <div class="sign-box">Store In-charge</div>
  <div class="sign-box">Authorised Signatory</div>
</div>
</div>
</body></html>`;
}
