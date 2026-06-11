function amountInWords(amount: number): string {
  const ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function convert(n: number): string {
    if (n === 0) return "";
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    if (n < 1000) return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + convert(n % 100) : "");
    if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + convert(n % 1000) : "");
    if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + convert(n % 100000) : "");
    return convert(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + convert(n % 10000000) : "");
  }
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let result = "INR ";
  if (rupees > 0) result += convert(rupees);
  if (paise > 0) result += (rupees > 0 ? " and " : "") + convert(paise) + " paise";
  return result + " Only";
}

function fmtDate(d: string) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtAmt(n: number) {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function buildTaxInvoiceHTML(
  doc: any,
  isEInvoice: boolean,
  eInvData?: { irn?: string; ack_no?: string; ack_date?: string }
): string {
  const items: any[] = doc.items || [];
  const charges: any[] = doc.charges || [];

  const taxable = items.reduce((s, it) => s + parseFloat(it.amount || "0"), 0);
  const chargesAmt = charges.reduce((s, ch) => s + parseFloat(ch.amount || "0"), 0);

  const cgstRates = new Map<number, number>();
  const sgstRates = new Map<number, number>();
  const igstRates = new Map<number, number>();
  items.forEach(it => {
    const cr = parseFloat(it.cgst_rate || "0");
    const sr = parseFloat(it.sgst_rate || "0");
    const ir = parseFloat(it.igst_rate || "0");
    if (cr > 0) cgstRates.set(cr, (cgstRates.get(cr) || 0) + parseFloat(it.cgst_amt || "0"));
    if (sr > 0) sgstRates.set(sr, (sgstRates.get(sr) || 0) + parseFloat(it.sgst_amt || "0"));
    if (ir > 0) igstRates.set(ir, (igstRates.get(ir) || 0) + parseFloat(it.igst_amt || "0"));
  });
  const totalCgst = [...cgstRates.values()].reduce((s, v) => s + v, 0);
  const totalSgst = [...sgstRates.values()].reduce((s, v) => s + v, 0);
  const totalIgst = [...igstRates.values()].reduce((s, v) => s + v, 0);
  const grandTotal = taxable + totalCgst + totalSgst + totalIgst + chargesAmt;
  const totalQty = items.reduce((s, it) => s + parseFloat(it.qty_despatched || "0"), 0);

  const firstItem = items[0] || {};
  // Delivery Note: use despatch voucher (despatch mode) or inward voucher (direct invoice mode)
  const deliveryNoteNo = firstItem.despatch_voucher_no || firstItem.inward_voucher_no || "";
  // Customer DC No. (party_dc stored on items from inward)
  const dcNo = firstItem.party_dc || "";
  const poNo = firstItem.po_no || firstItem.work_order_no || "";
  const irn = eInvData?.irn || doc.irn || "";
  const ackNo = eInvData?.ack_no || doc.ack_no || "";
  const ackDateRaw = eInvData?.ack_date || doc.ack_date || "";
  const ackDate = fmtDate(ackDateRaw) || ackDateRaw;

  const buyerLines = [
    doc.customer_address1 || doc.party_address || "",
    doc.customer_address2 || "",
    [doc.customer_city, doc.customer_state].filter(Boolean).join(", "),
  ].filter(Boolean).join("<br>");

  function buildItemRows() {
    if (!items.length) {
      return `<tr><td colspan="7" style="text-align:center;padding:10px;color:#999;font-size:10px">No items</td></tr>`;
    }
    return items.map((it: any, idx: number) => {
      const qty = parseFloat(it.qty_despatched || "0");
      const rate = parseFloat(it.rate || "0");
      const amt = parseFloat(it.amount || "0");
      const desc = it.item_code ? `${it.item_code} - ${it.item_name || ""}` : (it.item_name || "");

      // ── Sub-detail sections (shown below item name) ──────────────────
      const sections: string[] = [];

      // Section 1: packing details / remark
      const packing = (it.packing_details || it.remark || "").trim();
      if (packing) sections.push(packing);

      // Section 2: DC No + PO No + WO No with dates
      const dcNo   = (it.party_dc || it.dc_no_from_inward || "").trim();
      const dcDate = it.dc_date ? fmtDate(it.dc_date) : "";
      const poNo   = (it.po_no || it.po_no_from_inward || "").trim();
      const woNo   = (it.work_order_no || "").trim();
      const refDate = it.inward_entry_date ? fmtDate(it.inward_entry_date) : "";
      const dcPoLines: string[] = [];
      if (dcNo) dcPoLines.push(`DC.NO.: ${dcNo}${dcDate ? " &ndash; " + dcDate : ""}`);
      if (poNo) dcPoLines.push(`PO.NO.: ${poNo}${refDate ? " &ndash; " + refDate : ""}`);
      if (woNo) dcPoLines.push(`WO.NO.: ${woNo}${refDate ? " &ndash; " + refDate : ""}`);
      if (dcPoLines.length) sections.push(dcPoLines.join("<br>"));

      // Section 3: process name
      const process = (it.process || "").trim();
      if (process) sections.push(process);

      const subHTML = sections.length
        ? `<div style="font-size:9px;color:#333;margin-top:3px;line-height:1.6">
             ${sections.join(`<div style="color:#aaa;margin:1px 0">&ndash;</div>`)}
           </div>`
        : "";

      return `<tr>
        <td style="border:1px solid #000;padding:3px 5px;text-align:center;vertical-align:top;width:4%">${idx + 1}</td>
        <td style="border:1px solid #000;padding:3px 5px;vertical-align:top"><strong>${desc}</strong>${subHTML}</td>
        <td style="border:1px solid #000;padding:3px 5px;text-align:center;vertical-align:top;width:9%">${it.hsn_code || it.hsn || ""}</td>
        <td style="border:1px solid #000;padding:3px 5px;text-align:right;vertical-align:top;width:10%">${qty > 0 ? qty.toFixed(2) + " " + (it.unit || "") : "&nbsp;"}</td>
        <td style="border:1px solid #000;padding:3px 5px;text-align:right;vertical-align:top;width:9%">${rate > 0 ? rate.toFixed(2) : "&nbsp;"}</td>
        <td style="border:1px solid #000;padding:3px 5px;text-align:center;vertical-align:top;width:7%">${it.unit || ""}</td>
        <td style="border:1px solid #000;padding:3px 5px;text-align:right;vertical-align:top;width:10%">${amt > 0 ? fmtAmt(amt) : "&nbsp;"}</td>
      </tr>`;
    }).join("\n");
  }

  const itemRowsHTML = buildItemRows();

  const taxRows = [
    ...[...cgstRates.entries()].filter(([, a]) => a > 0).map(([r, a]) =>
      `<tr>
        <td colspan="4" style="border-left:1px solid #000;border-right:1px solid #000;padding:2px 5px">&nbsp;</td>
        <td colspan="2" style="border:1px solid #000;padding:2px 5px;text-align:left;font-size:9.5px">CGST Output ${r}%</td>
        <td style="border:1px solid #000;padding:2px 5px;text-align:right;font-size:9.5px">${r} %&nbsp;&nbsp;&nbsp;&nbsp;${fmtAmt(a)}</td>
      </tr>`
    ),
    ...[...sgstRates.entries()].filter(([, a]) => a > 0).map(([r, a]) =>
      `<tr>
        <td colspan="4" style="border-left:1px solid #000;border-right:1px solid #000;padding:2px 5px">&nbsp;</td>
        <td colspan="2" style="border:1px solid #000;padding:2px 5px;text-align:left;font-size:9.5px">SGST Output ${r}%</td>
        <td style="border:1px solid #000;padding:2px 5px;text-align:right;font-size:9.5px">${fmtAmt(a)}</td>
      </tr>`
    ),
    ...[...igstRates.entries()].filter(([, a]) => a > 0).map(([r, a]) =>
      `<tr>
        <td colspan="4" style="border-left:1px solid #000;border-right:1px solid #000;padding:2px 5px">&nbsp;</td>
        <td colspan="2" style="border:1px solid #000;padding:2px 5px;text-align:left;font-size:9.5px">IGST Output ${r}%</td>
        <td style="border:1px solid #000;padding:2px 5px;text-align:right;font-size:9.5px">${r} %&nbsp;&nbsp;&nbsp;&nbsp;${fmtAmt(a)}</td>
      </tr>`
    ),
    ...(chargesAmt > 0 ? charges.map(ch =>
      `<tr>
        <td colspan="4" style="border-left:1px solid #000;border-right:1px solid #000;padding:2px 5px">&nbsp;</td>
        <td colspan="2" style="border:1px solid #000;padding:2px 5px;text-align:left;font-size:9.5px">${ch.charge_name || "Other Charges"}</td>
        <td style="border:1px solid #000;padding:2px 5px;text-align:right;font-size:9.5px">${fmtAmt(parseFloat(ch.amount || "0"))}</td>
      </tr>`
    ) : []),
  ].join("\n");

  const unitLabel = items[0]?.unit || "Nos";

  function buildCopy(copyLabel: string) {
    const eInvHeader = isEInvoice ? `
      <div style="font-size:9.5px;margin-bottom:5px;line-height:1.7">
        <div><span style="font-weight:600;display:inline-block;width:80px">IRN</span>: <span style="font-family:monospace;font-size:8.5px;word-break:break-all">${irn}</span></div>
        <div><span style="font-weight:600;display:inline-block;width:80px">Ack No.</span>: ${ackNo}</div>
        <div><span style="font-weight:600;display:inline-block;width:80px">Ack Date</span>: ${ackDate}</div>
      </div>` : "";

    return `<div class="ti-copy">
  <table style="width:100%;border-collapse:collapse;border:1px solid #000">
    <tr>
      <td style="padding:4px 8px;font-weight:700;font-size:12px;border-bottom:1px solid #000">Tax Invoice</td>
      <td style="padding:4px 8px;text-align:center;font-size:10px;font-style:italic;border-bottom:1px solid #000">(${copyLabel})</td>
      <td style="padding:4px 8px;text-align:right;font-weight:700;font-size:11px;border-bottom:1px solid #000">${isEInvoice ? "e-Invoice" : ""}</td>
    </tr>
  </table>
  ${eInvHeader ? `<div style="padding:4px 8px;border:1px solid #000;border-top:none">${eInvHeader}</div>` : ""}
  <table style="width:100%;border-collapse:collapse;border:1px solid #000;border-top:none">
    <tr>
      <td style="width:55%;border-right:1px solid #000;padding:6px 8px;vertical-align:top">
        <div style="font-weight:700;font-size:11.5px">SILVER CROWN METAL COATINGS</div>
        <div style="font-size:9.5px;margin-top:2px;line-height:1.55">
          646, Easwaran Chettiar Layout, Cross Cut Road,<br>
          Coimbatore - 641012<br>
          GSTIN/UIN : 33AANFS5823J1ZW<br>
          State Name : Tamil Nadu, Code : 33<br>
          Contact : 0422 2237070, 2237090, 9500999138<br>
          E-Mail : silvercrownmetalcoatings@gmail.com
        </div>
      </td>
      <td style="width:45%;padding:0;vertical-align:top">
        <table style="width:100%;border-collapse:collapse;font-size:9.5px">
          <tr>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px;width:55%">Invoice No.</td>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px">Dated</td>
          </tr>
          <tr>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px;font-weight:600">${doc.voucher_no || "&nbsp;"}</td>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px;font-weight:600">${fmtDate(doc.invoice_date)}</td>
          </tr>
          <tr>
            <td colspan="2" style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px">Delivery Note</td>
          </tr>
          <tr>
            <td colspan="2" style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px;font-weight:600">${deliveryNoteNo || "&nbsp;"}</td>
          </tr>
          <tr>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px">Dispatch Doc No.</td>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px">Delivery Note Date</td>
          </tr>
          <tr>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px;font-weight:600">${dcNo || (poNo ? "PO: " + poNo : "&nbsp;")}</td>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px;font-weight:600">${fmtDate(doc.invoice_date)}</td>
          </tr>
          <tr>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px">Dispatched through</td>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px">Destination</td>
          </tr>
          <tr>
            <td style="border-right:1px solid #000;padding:3px 6px;font-weight:600">${doc.transport || "&nbsp;"}</td>
            <td style="border-right:1px solid #000;padding:3px 6px;font-weight:600">${doc.term_of_delivery || "&nbsp;"}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <table style="width:100%;border-collapse:collapse;border:1px solid #000;border-top:none">
    <tr>
      <td style="padding:5px 8px;vertical-align:top">
        <div style="font-size:9.5px;font-weight:600;margin-bottom:2px">Buyer (Bill to)</div>
        <div style="font-size:10.5px;font-weight:700">${doc.party_name_db || "&nbsp;"}</div>
        <div style="font-size:9.5px;line-height:1.5">${buyerLines}</div>
        ${doc.customer_gstin ? `<div style="font-size:9.5px">GSTIN/UIN : ${doc.customer_gstin}</div>` : ""}
      </td>
    </tr>
  </table>
  <table class="items-table" style="width:100%;border-collapse:collapse;border:1px solid #000;border-top:none;font-size:10px">
    <thead>
      <tr style="background:#f0f0f0">
        <th style="border:1px solid #000;padding:3px 5px;text-align:center;width:4%">Sl<br>No.</th>
        <th style="border:1px solid #000;padding:3px 5px;text-align:left">Description of<br>Services</th>
        <th style="border:1px solid #000;padding:3px 5px;text-align:center;width:9%">HSN/SAC</th>
        <th style="border:1px solid #000;padding:3px 5px;text-align:right;width:10%">Quantity</th>
        <th style="border:1px solid #000;padding:3px 5px;text-align:right;width:9%">Rate</th>
        <th style="border:1px solid #000;padding:3px 5px;text-align:center;width:7%">per</th>
        <th style="border:1px solid #000;padding:3px 5px;text-align:right;width:10%">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRowsHTML}
      <!-- filler row — grows to fill remaining table height -->
      <tr class="filler-row">
        <td style="border-left:1px solid #000;border-right:1px solid #000;padding:0">&nbsp;</td>
        <td style="border-right:1px solid #000;padding:0"></td>
        <td style="border-right:1px solid #000;padding:0"></td>
        <td style="border-right:1px solid #000;padding:0"></td>
        <td style="border-right:1px solid #000;padding:0"></td>
        <td style="border-right:1px solid #000;padding:0"></td>
        <td style="border-right:1px solid #000;padding:0"></td>
      </tr>
      <!-- taxable sub-total -->
      <tr>
        <td colspan="6" style="border-left:1px solid #000;border-right:1px solid #000;padding:2px 5px;text-align:right">
          ${doc.remark ? `<div style="font-size:9.5px;text-align:left">${doc.remark}</div>` : ""}
        </td>
        <td style="border:1px solid #000;padding:3px 5px;text-align:right;font-weight:600">${fmtAmt(taxable)}</td>
      </tr>
      ${taxRows}
    </tbody>
    <tfoot>
      <tr style="font-weight:700">
        <td colspan="2" style="border:1px solid #000;padding:4px 6px;text-align:left">Total</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center">&nbsp;</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:right">${totalQty > 0 ? totalQty.toFixed(2) + " " + unitLabel : "&nbsp;"}</td>
        <td colspan="2" style="border:1px solid #000;padding:4px 6px">&nbsp;</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:right">&#8377;${fmtAmt(grandTotal)}</td>
      </tr>
    </tfoot>
  </table>
  <table style="width:100%;border-collapse:collapse;border:1px solid #000;border-top:none;font-size:9.5px">
    <tr>
      <td style="width:58%;border-right:1px solid #000;padding:5px 8px;vertical-align:top">
        <div style="font-style:italic;font-size:9px">Amount Chargeable (in words)</div>
        <div style="font-weight:600;margin-top:2px">${amountInWords(grandTotal)}</div>
        <div style="text-align:right;font-size:9px;font-style:italic;margin-top:2px">E. &amp; O.E</div>
      </td>
      <td style="width:42%;padding:5px 8px;vertical-align:top">
        <div style="font-weight:600;margin-bottom:4px">Company's Bank Details</div>
        <table style="border-collapse:collapse;font-size:9.5px;width:100%">
          ${doc.company_name ? `<tr>
            <td style="white-space:nowrap;padding:1px 0;vertical-align:top;width:38%">A/c Holder's Name</td>
            <td style="padding:1px 4px;vertical-align:top;width:4%">:</td>
            <td style="padding:1px 0;vertical-align:top;font-weight:600">${doc.company_name}</td>
          </tr>` : ""}
          <tr>
            <td style="white-space:nowrap;padding:1px 0;vertical-align:top">Bank Name</td>
            <td style="padding:1px 4px;vertical-align:top">:</td>
            <td style="padding:1px 0;vertical-align:top;font-weight:600">State Bank Of India</td>
          </tr>
          <tr>
            <td style="white-space:nowrap;padding:1px 0;vertical-align:top">A/c No.</td>
            <td style="padding:1px 4px;vertical-align:top">:</td>
            <td style="padding:1px 0;vertical-align:top;font-weight:600">3899 256 4002</td>
          </tr>
          <tr>
            <td style="white-space:nowrap;padding:1px 0;vertical-align:top">Branch &amp; IFS Code</td>
            <td style="padding:1px 4px;vertical-align:top">:</td>
            <td style="padding:1px 0;vertical-align:top;font-weight:600">Treasury Branch, Coimbatore &amp; SBIN0007639</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <table style="width:100%;border-collapse:collapse;border:1px solid #000;border-top:none;font-size:9.5px">
    <tr>
      <td style="border-right:1px solid #000;padding:5px 8px;width:35%;vertical-align:top;text-align:center">
        Customer's Seal and Signature<br><br><br><br>
      </td>
      <td style="padding:5px 8px;width:65%;vertical-align:top;text-align:center">
        <div style="font-size:9.5px;margin-bottom:4px">for SILVER CROWN METAL COATINGS</div>
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:4px">
          <div style="flex:1;text-align:center;font-size:9px;padding-top:40px">Prepared by</div>
          <div style="flex:1;text-align:center;font-size:9px;padding-top:40px">Verified by</div>
          <div style="flex:1;text-align:center;font-size:9px">
            ${doc.signature_image
              ? `<img src="${doc.signature_image}" style="max-height:52px;max-width:120px;object-fit:contain;display:block;margin:0 auto 2px auto" />`
              : `<div style="height:52px"></div>`
            }
            Authorised Signatory
          </div>
        </div>
      </td>
    </tr>
  </table>
  <div style="text-align:center;font-size:9px;font-style:italic;padding:3px 8px;border:1px solid #000;border-top:none">
    This is a Computer Generated Invoice
  </div>
</div>`;
  }

  const copies = [
    "ORIGINAL FOR RECIPIENT",
    "DUPLICATE FOR SUPPLIER",
    "EXTRA COPY",
  ];

  const copiesHTML = copies.map(label => buildCopy(label)).join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Tax Invoice — ${doc.voucher_no || ""}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; background: #fff; }
  .ti-copy {
    width: 210mm;
    height: 297mm;
    padding: 6mm 7mm;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  /* The items table grows to fill remaining space */
  .items-table {
    flex: 1;
    border-collapse: collapse;
    height: 100%;
  }
  /* The filler row expands to consume leftover height */
  .filler-row { height: 100%; }
  .filler-row td { border-left: 1px solid #000; border-right: 1px solid #000; }
  .filler-row td:last-child { border-right: 1px solid #000; }
  @page {
    size: A4 portrait;
    margin: 0;
  }
  @media print {
    html, body { width: 210mm; height: 297mm; margin: 0; padding: 0; }
    .ti-copy {
      width: 210mm;
      height: 297mm;
      padding: 6mm 7mm;
      page-break-after: always;
      page-break-inside: avoid;
    }
    .ti-copy:last-child { page-break-after: avoid; }
  }
  @media screen {
    body { background: #e0e0e0; padding: 10px 0; }
    .ti-copy { background: #fff; margin: 10px auto; box-shadow: 0 2px 8px rgba(0,0,0,0.18); }
  }
</style>
</head>
<body>
${copiesHTML}
</body>
</html>`;
}
