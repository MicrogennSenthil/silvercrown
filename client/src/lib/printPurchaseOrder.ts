export function buildPurchaseOrderHTML(doc: any): string {
  function fmtDate(d: string) {
    if (!d) return "—";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  function n2(v: number) {
    return v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function toWords(n: number): string {
    if (n === 0) return "Zero";
    const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
                  "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen",
                  "Seventeen","Eighteen","Nineteen"];
    const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
    function chunk(n: number): string {
      if (n === 0) return "";
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? " " + ones[n%10] : "");
      return ones[Math.floor(n/100)] + " Hundred" + (n%100 ? " " + chunk(n%100) : "");
    }
    const crore = Math.floor(n / 10000000); n %= 10000000;
    const lakh  = Math.floor(n / 100000);   n %= 100000;
    const thou  = Math.floor(n / 1000);     n %= 1000;
    const rest  = n;
    const parts = [];
    if (crore) parts.push(chunk(crore) + " Crore");
    if (lakh)  parts.push(chunk(lakh)  + " Lakh");
    if (thou)  parts.push(chunk(thou)  + " Thousand");
    if (rest)  parts.push(chunk(rest));
    return parts.join(" ") || "Zero";
  }
  function amountInWords(total: number): string {
    const rupees = Math.floor(total);
    const paise  = Math.round((total - rupees) * 100);
    let w = "Rupees " + toWords(rupees);
    if (paise > 0) w += " and " + toWords(paise) + " Paise";
    return w + " Only";
  }

  const items: any[]   = doc.items   || [];
  const terms: any[]   = doc.terms   || [];
  const charges: any[] = doc.charges || [];

  const companyName    = doc.company_name    || "SILVER CROWN METAL COATINGS";
  const companyAddress = doc.company_address || "646, Easwaran Chettiar Layout, Cross Cut Road, Coimbatore - 641012";
  const companyPhone   = doc.company_phone   || "";
  const companyGstin   = doc.company_gstin   || "33AANFS5823J1ZW";
  const companyEmail   = doc.company_email   || "";
  const signatureImage = doc.signature_image || "";

  const supplierName    = doc.party_name_db  || doc.supplier_name_manual || "—";
  const supplierAddr1   = doc.supplier_address1 || doc.supplier_address  || "";
  const supplierAddr2   = doc.supplier_address2 || "";
  const supplierCity    = doc.supplier_city   || "";
  const supplierState   = doc.supplier_state  || "";
  const supplierPin     = doc.supplier_pincode || "";
  const supplierGstin   = doc.supplier_gstin  || "";
  const supplierPhone   = doc.supplier_phone  || doc.party_phone || "";

  const supplierLines = [
    supplierAddr1,
    supplierAddr2,
    [supplierCity, supplierState, supplierPin].filter(Boolean).join(", "),
  ].filter(Boolean).join("<br>");

  const taxableTotal = items.reduce((s, it) => s + (parseFloat(it.taxable_amt) || 0), 0);
  const cgstTotal    = items.reduce((s, it) => s + (parseFloat(it.cgst_amt)    || 0), 0);
  const sgstTotal    = items.reduce((s, it) => s + (parseFloat(it.sgst_amt)    || 0), 0);
  const igstTotal    = items.reduce((s, it) => s + (parseFloat(it.igst_amt)    || 0), 0);
  const chargesTotal = charges.reduce((s, c) => s + (parseFloat(c.amount) || 0), 0);
  const grandTotal   = taxableTotal + cgstTotal + sgstTotal + igstTotal + chargesTotal;

  const MIN_ROWS = 12;
  const padRows = Math.max(0, MIN_ROWS - items.length);

  function itemRows() {
    const rows: string[] = items.map((it, idx) => {
      const qty  = parseFloat(it.qty  || "0");
      const rate = parseFloat(it.rate || "0");
      const taxAmt = (parseFloat(it.taxable_amt)||0);
      const cgst   = parseFloat(it.cgst_amt || "0");
      const sgst   = parseFloat(it.sgst_amt || "0");
      const igst   = parseFloat(it.igst_amt || "0");
      const total  = parseFloat(it.total    || "0");
      const cgstPct = parseFloat(it.cgst_pct || "0");
      const sgstPct = parseFloat(it.sgst_pct || "0");
      const igstPct = parseFloat(it.igst_pct || "0");
      return `<tr>
        <td style="text-align:center">${idx + 1}</td>
        <td>${it.item_code || ""}</td>
        <td>${it.item_name || ""}</td>
        <td style="text-align:center">${qty > 0 ? qty.toFixed(3) : ""}</td>
        <td style="text-align:center">${it.unit || ""}</td>
        <td style="text-align:right">${rate > 0 ? n2(rate) : ""}</td>
        <td style="text-align:right">${taxAmt > 0 ? n2(taxAmt) : ""}</td>
        <td style="text-align:right">${cgst > 0 ? `${n2(cgst)}<br><span style="color:#666;font-size:8px">(${cgstPct}%)</span>` : "—"}</td>
        <td style="text-align:right">${sgst > 0 ? `${n2(sgst)}<br><span style="color:#666;font-size:8px">(${sgstPct}%)</span>` : "—"}</td>
        <td style="text-align:right">${igst > 0 ? `${n2(igst)}<br><span style="color:#666;font-size:8px">(${igstPct}%)</span>` : "—"}</td>
        <td style="text-align:right;font-weight:600">${total > 0 ? n2(total) : ""}</td>
      </tr>`;
    });
    for (let i = 0; i < padRows; i++) {
      rows.push(`<tr style="height:20px">
        <td></td><td></td><td></td><td></td><td></td>
        <td></td><td></td><td></td><td></td><td></td><td></td>
      </tr>`);
    }
    return rows.join("");
  }

  const termsHTML = terms.length > 0
    ? terms.map((t, i) => `<tr><td style="padding:2px 6px;color:#555;width:5%;text-align:center">${i+1}.</td><td style="padding:2px 6px">${t.term_type ? `<b>${t.term_type}:</b> ` : ""}${t.terms || ""}</td></tr>`).join("")
    : `<tr><td colspan="2" style="padding:4px 6px;color:#aaa;font-style:italic">No terms specified</td></tr>`;

  const chargesHTML = charges.length > 0
    ? charges.map(c => `<tr><td colspan="9" style="text-align:right;color:#555">${c.charge_type || "Additional Charges"}</td><td style="text-align:right">${n2(parseFloat(c.amount)||0)}</td></tr>`).join("")
    : "";

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Purchase Order — ${doc.voucher_no || ""}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #111; background: #fff; }
  @page { size: A4 landscape; margin: 8mm 10mm; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }

  .page { width: 277mm; min-height: 190mm; display: flex; flex-direction: column; }

  /* ── HEADER ── */
  .header-wrap { border: 1.5px solid #000; }
  .header-top { display: flex; align-items: stretch; }
  .company-block { flex: 1; padding: 6px 10px; border-right: 1px solid #000; }
  .company-name { font-size: 14px; font-weight: 700; color: #027fa5; letter-spacing: 0.3px; }
  .company-sub { font-size: 8.5px; color: #444; margin-top: 2px; line-height: 1.5; }
  .doc-title-block { width: 110px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px; }
  .doc-title { font-size: 13px; font-weight: 700; color: #027fa5; text-align: center; letter-spacing: 0.5px; }
  .doc-title-sub { font-size: 8px; color: #888; text-align: center; }

  /* ── META ROW ── */
  .meta-row { display: flex; border-top: 1px solid #000; }
  .meta-cell { flex: 1; padding: 5px 8px; border-right: 1px solid #000; font-size: 9px; }
  .meta-cell:last-child { border-right: none; }
  .meta-cell .label { color: #666; font-size: 8.5px; }
  .meta-cell .val { font-weight: 600; font-size: 9.5px; margin-top: 1px; }

  /* ── SUPPLIER ── */
  .supplier-row { display: flex; border-top: 1px solid #000; border-top-color: #027fa5; }
  .supplier-block { width: 55%; padding: 5px 8px; border-right: 1px solid #000; }
  .supplier-block .block-label { font-size: 8px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
  .supplier-block .supplier-name { font-size: 10px; font-weight: 700; }
  .supplier-block .supplier-info { font-size: 8.5px; color: #444; line-height: 1.5; margin-top: 2px; }
  .po-meta-block { flex: 1; padding: 5px 8px; }
  .po-meta-block table { width: 100%; }
  .po-meta-block td { font-size: 8.5px; padding: 1px 3px; }
  .po-meta-block td.lbl { color: #666; width: 45%; }
  .po-meta-block td.val { font-weight: 600; }

  /* ── DELIVERY ── */
  .delivery-row { border-top: 1px solid #000; padding: 4px 8px; font-size: 8.5px; }
  .delivery-row .lbl { color: #666; }

  /* ── ITEMS TABLE ── */
  .items-wrap { border-top: 1.5px solid #027fa5; margin-top: 4px; }
  table.items-tbl { width: 100%; border-collapse: collapse; }
  table.items-tbl th {
    background: #027fa5; color: #fff; font-size: 8.5px; font-weight: 600;
    padding: 4px 5px; text-align: left; border-right: 1px solid rgba(255,255,255,0.3);
    white-space: nowrap;
  }
  table.items-tbl th:last-child { border-right: none; }
  table.items-tbl td {
    font-size: 9px; padding: 4px 5px;
    border-right: 1px solid #e5e5e5; vertical-align: middle;
  }
  table.items-tbl td:last-child { border-right: none; }
  table.items-tbl tbody tr:nth-child(even) { background: #f7fcff; }

  /* ── TOTALS ── */
  .totals-row { border-top: 1.5px solid #027fa5; margin-top: 2px; }
  table.totals-tbl { width: 100%; border-collapse: collapse; }
  table.totals-tbl td { font-size: 9px; padding: 2px 5px; }
  .total-label { color: #555; text-align: right; width: 88%; padding-right: 10px; }
  .total-value { text-align: right; font-weight: 600; width: 12%; white-space: nowrap; }
  .grand-total-row td { background: #027fa5; color: #fff; font-weight: 700; font-size: 10px; padding: 4px 5px; }

  /* ── AMOUNT IN WORDS ── */
  .amt-words { border: 1px solid #ccc; border-top: none; padding: 3px 8px; font-size: 8.5px; background: #f0f9ff; }

  /* ── BOTTOM SECTION ── */
  .bottom-row { display: flex; border-top: 1px solid #000; margin-top: 4px; }
  .terms-block { flex: 1; padding: 5px 8px; border-right: 1px solid #000; }
  .terms-block .block-label { font-size: 8px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
  table.terms-tbl td { font-size: 8.5px; line-height: 1.4; }
  .sig-block { width: 140px; padding: 5px 10px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; min-height: 60px; }
  .sig-block img { max-height: 40px; max-width: 120px; object-fit: contain; margin-bottom: 4px; }
  .sig-line { border-top: 1px solid #000; width: 100%; text-align: center; font-size: 8px; color: #555; padding-top: 2px; margin-top: 4px; }
  .sig-company { font-size: 8px; font-weight: 600; color: #333; text-align: center; margin-top: 2px; }
</style>
</head><body>
<div class="page">

  <!-- HEADER -->
  <div class="header-wrap">
    <div class="header-top">
      <div class="company-block">
        <div class="company-name">${companyName.toUpperCase()}</div>
        <div class="company-sub">
          ${companyAddress}${companyPhone ? ` &nbsp;|&nbsp; Ph: ${companyPhone}` : ""}
          ${companyEmail ? ` &nbsp;|&nbsp; Email: ${companyEmail}` : ""}${companyGstin ? `<br>GSTIN: ${companyGstin}` : ""}
        </div>
      </div>
      <div class="doc-title-block">
        <div class="doc-title">PURCHASE<br>ORDER</div>
      </div>
    </div>

    <!-- SUPPLIER + PO META -->
    <div class="supplier-row">
      <div class="supplier-block">
        <div class="block-label">Supplier / Vendor</div>
        <div class="supplier-name">${supplierName}</div>
        <div class="supplier-info">
          ${supplierLines || ""}
          ${supplierGstin ? `<br>GSTIN: ${supplierGstin}` : ""}
          ${supplierPhone ? ` &nbsp;|&nbsp; Ph: ${supplierPhone}` : ""}
        </div>
      </div>
      <div class="po-meta-block">
        <table>
          <tr><td class="lbl">PO Number</td><td class="val">${doc.voucher_no || "—"}</td></tr>
          <tr><td class="lbl">PO Date</td><td class="val">${fmtDate(doc.po_date)}</td></tr>
          <tr><td class="lbl">Delivery Date</td><td class="val">${doc.schedule_date ? fmtDate(doc.schedule_date) : "—"}</td></tr>
          <tr><td class="lbl">Payment Mode</td><td class="val">${doc.payment_mode || "—"}</td></tr>
          <tr><td class="lbl">Priority</td><td class="val">${doc.priority || "—"}</td></tr>
          <tr><td class="lbl">Our Ref No</td><td class="val">${doc.our_ref_no || "—"}</td></tr>
          <tr><td class="lbl">Your Ref No</td><td class="val">${doc.your_ref_no || "—"}</td></tr>
          <tr><td class="lbl">Status</td><td class="val">${doc.status || "Draft"}</td></tr>
        </table>
      </div>
    </div>

    ${doc.delivery_location ? `<div class="delivery-row"><span class="lbl">Delivery Location: </span><b>${doc.delivery_location}</b></div>` : ""}
    ${doc.remark ? `<div class="delivery-row"><span class="lbl">Remark: </span>${doc.remark}</div>` : ""}
  </div>

  <!-- ITEMS TABLE -->
  <div class="items-wrap">
    <table class="items-tbl">
      <thead>
        <tr>
          <th style="width:3%;text-align:center">#</th>
          <th style="width:8%">Item Code</th>
          <th style="width:22%">Item Description</th>
          <th style="width:6%;text-align:center">Qty</th>
          <th style="width:5%;text-align:center">Unit</th>
          <th style="width:8%;text-align:right">Rate ₹</th>
          <th style="width:9%;text-align:right">Taxable ₹</th>
          <th style="width:9%;text-align:right">CGST ₹</th>
          <th style="width:9%;text-align:right">SGST ₹</th>
          <th style="width:9%;text-align:right">IGST ₹</th>
          <th style="width:10%;text-align:right">Total ₹</th>
        </tr>
      </thead>
      <tbody>${itemRows()}</tbody>
      <tfoot>
        ${chargesHTML}
        <tr style="background:#f5f5f5">
          <td colspan="6" style="text-align:right;color:#555">Taxable Amount</td>
          <td style="text-align:right;font-weight:600">${n2(taxableTotal)}</td>
          <td style="text-align:right;font-weight:600">${cgstTotal > 0 ? n2(cgstTotal) : "—"}</td>
          <td style="text-align:right;font-weight:600">${sgstTotal > 0 ? n2(sgstTotal) : "—"}</td>
          <td style="text-align:right;font-weight:600">${igstTotal > 0 ? n2(igstTotal) : "—"}</td>
          <td style="text-align:right;font-weight:600">${n2(taxableTotal + cgstTotal + sgstTotal + igstTotal)}</td>
        </tr>
        ${chargesTotal > 0 ? `<tr><td colspan="10" style="text-align:right;color:#555">Additional Charges</td><td style="text-align:right;font-weight:600">${n2(chargesTotal)}</td></tr>` : ""}
        <tr style="background:#027fa5">
          <td colspan="10" style="text-align:right;color:#fff;font-weight:700;font-size:10px;padding:5px">Grand Total</td>
          <td style="text-align:right;color:#fff;font-weight:700;font-size:10px;padding:5px">₹ ${n2(grandTotal)}</td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- AMOUNT IN WORDS -->
  <div class="amt-words"><b>Amount in Words:</b> ${amountInWords(grandTotal)}</div>

  <!-- BOTTOM: TERMS + SIGNATURE -->
  <div class="bottom-row">
    <div class="terms-block">
      <div class="block-label">Terms &amp; Conditions</div>
      <table class="terms-tbl"><tbody>${termsHTML}</tbody></table>
    </div>
    <div class="sig-block">
      <div class="sig-company">For ${companyName}</div>
      ${signatureImage ? `<img src="${signatureImage}" alt="Signature"/>` : `<div style="height:40px"></div>`}
      <div class="sig-line">Authorised Signatory</div>
    </div>
  </div>

</div>
</body></html>`;
}
