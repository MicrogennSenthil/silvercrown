export function buildDespatchNoteHTML(doc: any): string {
  function fmtDate(d: string) {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  function fyLabel(dateStr: string): string {
    if (!dateStr) return "";
    const dt = new Date(dateStr);
    if (isNaN(dt.getTime())) return "";
    const month = dt.getMonth();
    const year  = dt.getFullYear();
    const fyStart = month >= 3 ? year : year - 1;
    return `${fyStart.toString().slice(-2)}-${(fyStart + 1).toString().slice(-2)}`;
  }

  const items: any[] = doc.items || [];
  const totalQty = items.reduce((s: number, it: any) => s + parseFloat(it.qty_despatched || "0"), 0);
  const fy = fyLabel(doc.despatch_date);

  // left/right borders only — no horizontal dividers between item rows
  const itemTd = "border-left:1px solid #000;border-right:1px solid #000;padding:3px 6px;vertical-align:top";

  function buildItemRows() {
    const rows: string[] = [];

    items.forEach((it: any, idx: number) => {
      const qty     = parseFloat(it.qty_despatched || "0");
      const poNo    = it.work_order_no || doc.inward_work_order_no || doc.inward_party_po_no || "";
      const process = it.process || "";
      const packing = it.packing_details || it.remark || "";

      const subLines: string[] = [];
      if (poNo)    subLines.push(`PO : ${poNo}`);
      if (process) subLines.push(process);
      if (packing) subLines.push(packing);

      const subHTML = subLines.length
        ? `<div style="font-size:9px;color:#333;margin-top:2px;line-height:1.7">${subLines.join("<br>")}</div>`
        : "";

      rows.push(`<tr>
        <td style="${itemTd};text-align:center;width:5%">${idx + 1}</td>
        <td style="${itemTd}">
          <div style="font-weight:600">${it.item_name || ""}</div>
          ${subHTML}
        </td>
        <td style="${itemTd};text-align:center;width:10%">${it.hsn || ""}</td>
        <td style="${itemTd};text-align:center;width:8%">${it.unit || it.uom_code || ""}</td>
        <td style="${itemTd};text-align:center;width:12%">${qty > 0 ? qty.toFixed(3) : "&nbsp;"}</td>
      </tr>`);
    });

    // Single filler row that expands to fill remaining cell height
    rows.push(`<tr style="height:100%">
      <td style="border-left:1px solid #000;border-right:1px solid #000">&nbsp;</td>
      <td style="border-left:1px solid #000;border-right:1px solid #000">&nbsp;</td>
      <td style="border-left:1px solid #000;border-right:1px solid #000">&nbsp;</td>
      <td style="border-left:1px solid #000;border-right:1px solid #000">&nbsp;</td>
      <td style="border-left:1px solid #000;border-right:1px solid #000">&nbsp;</td>
    </tr>`);

    return rows.join("\n");
  }

  const itemRowsHTML = buildItemRows();

  const buyerLines = [
    doc.customer_address1 || doc.customer_address || "",
    doc.customer_address2 || "",
    [doc.customer_city, doc.customer_state].filter(Boolean).join(", "),
  ].filter(Boolean).join("<br>");

  function buildCopy() {
    return `<div class="dn-copy">
<!--
  Outer table fills the full A4 height. The items row uses height:100% to claim
  all remaining vertical space after header/company/buyer/signature rows take
  their natural height — this is the most print-reliable full-page technique.
-->
<table style="width:100%;height:100%;border-collapse:collapse;border:1px solid #000;font-size:10px">
<tbody>

  <!-- ① TITLE ROW -->
  <tr>
    <td style="padding:4px 8px;border-bottom:1px solid #000;text-align:center">
      <span style="font-weight:700;font-size:14px">Despatch Note</span>
    </td>
  </tr>

  <!-- ② COMPANY + REFERENCE GRID -->
  <tr>
    <td style="padding:0;border-bottom:1px solid #000">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="width:55%;border-right:1px solid #000;padding:5px 8px;vertical-align:top">
            <div style="font-weight:700;font-size:12px">SILVER CROWN METAL COATINGS</div>
            <div style="font-size:9px;margin-top:2px;line-height:1.5">
              646, Easwaran Chettiar Layout, Cross Cut Road,<br>
              Coimbatore - 641012<br>
              GSTIN/UIN : 33AANFS5823J1ZW<br>
              State Name : Tamil Nadu, Code : 33<br>
              Contact : 0422 2237070, 2237090, 9500999138<br>
              E-Mail : silvercrownmetalcoatings@gmail.com
            </div>
          </td>
          <td style="width:45%;padding:0;vertical-align:top">
            <table style="width:100%;border-collapse:collapse;font-size:9px">
              <tr>
                <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:2px 6px;width:50%">Delivery Note No.</td>
                <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:2px 6px">Dated</td>
              </tr>
              <tr>
                <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:2px 6px;font-weight:600">
                  ${doc.voucher_no || "&nbsp;"}${fy ? `<span style="font-weight:400;font-size:8.5px;margin-left:4px">(${fy})</span>` : ""}
                </td>
                <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:2px 6px;font-weight:600">${fmtDate(doc.despatch_date)}</td>
              </tr>
              <tr>
                <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:2px 6px">Reference No. &amp; Date.</td>
                <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:2px 6px">Other References</td>
              </tr>
              <tr>
                <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:2px 6px;font-weight:600">${doc.inward_voucher_no || "&nbsp;"}</td>
                <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:2px 6px;font-weight:600">${doc.party_dc_no || "&nbsp;"}</td>
              </tr>
              <tr>
                <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:2px 6px">Buyer's Order No.</td>
                <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:2px 6px">Dated</td>
              </tr>
              <tr>
                <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:2px 6px;font-weight:600">${doc.inward_party_po_no || doc.inward_work_order_no || "&nbsp;"}</td>
                <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:2px 6px;font-weight:600">${fmtDate(doc.inward_date || "")}</td>
              </tr>
              <tr>
                <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:2px 6px">Dispatch Doc No.</td>
                <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:2px 6px">&nbsp;</td>
              </tr>
              <tr>
                <td style="border-right:1px solid #000;padding:2px 6px;font-weight:600">${doc.vehicle_no || "&nbsp;"}</td>
                <td style="border-right:1px solid #000;padding:2px 6px">&nbsp;</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ③ BUYER -->
  <tr>
    <td style="padding:0;border-bottom:1px solid #000">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="width:55%;border-right:1px solid #000;padding:4px 8px;vertical-align:top">
            <div style="font-size:9px;font-weight:600;margin-bottom:1px">Buyer (Bill to)</div>
            <div style="font-size:10px;font-weight:700">${doc.party_name_db || "&nbsp;"}</div>
            <div style="font-size:9px;line-height:1.45">${buyerLines}</div>
            ${doc.customer_gstin ? `<div style="font-size:9px">GSTIN/UIN : ${doc.customer_gstin}</div>` : ""}
            ${doc.customer_state ? `<div style="font-size:9px">State Name : ${doc.customer_state}${doc.customer_gst_state_code ? ", Code : " + doc.customer_gst_state_code : ""}</div>` : ""}
          </td>
          <td style="width:45%;padding:4px 8px;vertical-align:top;font-size:9px">
            ${doc.party_phone ? `<div>Contact : ${doc.party_phone}</div>` : ""}
            ${doc.party_email ? `<div>E-Mail : ${doc.party_email}</div>` : ""}
            ${doc.notes ? `<div style="margin-top:2px">Remarks : ${doc.notes}</div>` : ""}
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ④ ITEMS — height:100% makes this row fill ALL remaining vertical space -->
  <tr style="height:100%">
    <td style="padding:0;border-bottom:1px solid #000;vertical-align:top">
      <!--
        height:100% on this inner table causes it to fill the outer row's height.
        The filler <tr style="height:100%"> in tbody then expands to push tfoot to the bottom.
      -->
      <table style="width:100%;height:100%;border-collapse:collapse;font-size:10px">
        <thead>
          <tr style="background:#f0f0f0">
            <th style="border:1px solid #000;padding:3px 6px;text-align:center;width:5%">Sl<br>No</th>
            <th style="border:1px solid #000;padding:3px 6px;text-align:left">Description of Services</th>
            <th style="border:1px solid #000;padding:3px 6px;text-align:center;width:10%">HSN/SAC</th>
            <th style="border:1px solid #000;padding:3px 6px;text-align:center;width:8%">UOM</th>
            <th style="border:1px solid #000;padding:3px 6px;text-align:center;width:12%">Quantity</th>
          </tr>
        </thead>
        <tbody>
          ${itemRowsHTML}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="border:1px solid #000;padding:3px 8px">
              <span style="font-size:8.5px;font-style:italic">E. &amp; O.E</span>
            </td>
            <td style="border:1px solid #000;padding:3px 6px;text-align:center;font-weight:700">Total</td>
            <td style="border:1px solid #000;padding:3px 6px;text-align:center;font-weight:700">${totalQty > 0 ? totalQty.toFixed(3) : "&nbsp;"}</td>
          </tr>
        </tfoot>
      </table>
    </td>
  </tr>

  <!-- ⑤ SIGNATURES — all three copy labels shown in one row -->
  <tr>
    <td style="padding:0;border-bottom:1px solid #000">
      <table style="width:100%;border-collapse:collapse;font-size:9px">
        <tr>
          <td style="border-right:1px solid #000;padding:4px 8px;width:33%;vertical-align:top">
            <div style="font-size:7.5px;font-weight:700;margin-bottom:3px">ORIGINAL FOR CONSIGNEE</div>
            Recd. in Good Condition<br><br><br>
            <div style="border-top:1px solid #000;padding-top:3px;text-align:center;font-size:8.5px">Receiver's Signature</div>
          </td>
          <td style="border-right:1px solid #000;padding:4px 8px;width:34%;vertical-align:top">
            <div style="font-size:7.5px;font-weight:700;margin-bottom:3px">DUPLICATE FOR TRANSPORTER</div>
            for SILVER CROWN METAL COATINGS<br><br><br>
            <div style="border-top:1px solid #000;padding-top:3px;text-align:center;font-size:8.5px">Prepared by &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Verified by</div>
          </td>
          <td style="padding:4px 8px;width:33%;vertical-align:top">
            <div style="font-size:7.5px;font-weight:700;margin-bottom:3px">TRIPLICATE FOR CONSIGNER</div>
            for SILVER CROWN METAL COATINGS<br><br><br>
            <div style="border-top:1px solid #000;padding-top:3px;text-align:center;font-size:8.5px">Authorised Signatory</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ⑥ FOOTER -->
  <tr>
    <td style="text-align:center;font-size:8.5px;font-style:italic;padding:2px 8px">
      LABOUR CHARGES ONLY - NOT FOR SALE
    </td>
  </tr>

</tbody>
</table>
</div>`;
  }

  const copiesHTML = buildCopy();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Despatch Note — ${doc.voucher_no || ""}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; background: #fff; }

  .dn-copy {
    width: 210mm;
    height: 297mm;
    padding: 6mm 7mm;
    margin: 0 auto;
    overflow: hidden;
  }

  @page {
    size: A4 portrait;
    margin: 0;
  }
  @media print {
    html, body { width: 210mm; height: 297mm; margin: 0; padding: 0; }
    .dn-copy {
      width: 210mm;
      height: 297mm;
      padding: 6mm 7mm;
      page-break-after: always;
      page-break-inside: avoid;
      overflow: hidden;
    }
    .dn-copy:last-child { page-break-after: avoid; }
  }
  @media screen {
    body { background: #e0e0e0; padding: 10px 0; }
    .dn-copy { background: #fff; margin: 10px auto; box-shadow: 0 2px 8px rgba(0,0,0,0.18); }
  }
</style>
</head>
<body>
${copiesHTML}
</body>
</html>`;
}
