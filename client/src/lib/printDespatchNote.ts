export function buildDespatchNoteHTML(doc: any): string {
  function fmtDate(d: string) {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }

  const items: any[] = doc.items || [];

  const totalQty = items.reduce((s: number, it: any) => s + parseFloat(it.qty_despatched || "0"), 0);

  function buildItemRows() {
    if (!items.length) {
      return `<tr><td colspan="4" style="text-align:center;padding:10px;color:#999;font-size:10px">No items</td></tr>`;
    }
    return items.map((it: any, idx: number) => {
      const qty = parseFloat(it.qty_despatched || "0");
      const subParts: string[] = [];
      const poNo = it.work_order_no || doc.inward_work_order_no || doc.inward_party_po_no || "";
      const refNo = it.remark_ref || doc.party_dc_no || "";
      if (poNo) subParts.push(`PO : ${poNo}`);
      if (refNo) subParts.push(`REF : ${refNo}`);
      if (it.process) subParts.push(it.process);
      if (it.remark) subParts.push(it.remark);
      const subRow = subParts.join("     ");
      return `<tr>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center;vertical-align:top;width:5%">${idx + 1}</td>
        <td style="border:1px solid #000;padding:4px 6px;vertical-align:top">
          <div style="font-weight:600">${it.item_name || ""}</div>
          ${subRow ? `<div style="font-size:9.5px;color:#333;margin-top:2px">${subRow}</div>` : ""}
        </td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center;vertical-align:top;width:11%">${it.hsn || ""}</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center;vertical-align:top;width:14%">${qty > 0 ? qty.toFixed(3) + (it.unit ? " " + it.unit : "") : "&nbsp;"}</td>
      </tr>`;
    }).join("\n");
  }

  const itemRowsHTML = buildItemRows();

  const buyerLines = [
    doc.customer_address1 || doc.customer_address || "",
    doc.customer_address2 || "",
    [doc.customer_city, doc.customer_state].filter(Boolean).join(", "),
  ].filter(Boolean).join("<br>");

  function buildCopy(copyLabel: string) {
    return `<div class="dn-copy">
  <table style="width:100%;border-collapse:collapse;border:1px solid #000">
    <tr>
      <td style="padding:5px 8px;font-weight:700;font-size:13px;border-bottom:1px solid #000">Despatch Note</td>
      <td style="padding:5px 8px;text-align:right;font-size:10px;font-style:italic;border-bottom:1px solid #000">(${copyLabel})</td>
    </tr>
  </table>
  <table style="width:100%;border-collapse:collapse;border:1px solid #000;border-top:none">
    <tr>
      <td style="width:55%;border-right:1px solid #000;padding:6px 8px;vertical-align:top">
        <div style="font-weight:700;font-size:12px">SILVER CROWN METAL COATINGS</div>
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
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px;width:50%">Delivery Note No.</td>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px">Dated</td>
          </tr>
          <tr>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px;font-weight:600">${doc.voucher_no || "&nbsp;"}</td>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px;font-weight:600">${fmtDate(doc.despatch_date)}</td>
          </tr>
          <tr>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px">Reference No. &amp; Date.</td>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px">Other References</td>
          </tr>
          <tr>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px;font-weight:600">${doc.inward_voucher_no || "&nbsp;"}</td>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px;font-weight:600">${doc.party_dc_no || "&nbsp;"}</td>
          </tr>
          <tr>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px">Buyer's Order No.</td>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px">Dated</td>
          </tr>
          <tr>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px;font-weight:600">${doc.inward_party_po_no || doc.inward_work_order_no || "&nbsp;"}</td>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px;font-weight:600">${fmtDate(doc.inward_date || "")}</td>
          </tr>
          <tr>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px">Dispatch Doc No.</td>
            <td style="border-bottom:1px solid #000;border-right:1px solid #000;padding:3px 6px">&nbsp;</td>
          </tr>
          <tr>
            <td style="border-right:1px solid #000;padding:3px 6px;font-weight:600">${doc.vehicle_no || "&nbsp;"}</td>
            <td style="border-right:1px solid #000;padding:3px 6px">&nbsp;</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  <table style="width:100%;border-collapse:collapse;border:1px solid #000;border-top:none">
    <tr>
      <td style="width:55%;border-right:1px solid #000;padding:5px 8px;vertical-align:top">
        <div style="font-size:9.5px;font-weight:600;margin-bottom:2px">Buyer (Bill to)</div>
        <div style="font-size:10.5px;font-weight:700">${doc.party_name_db || "&nbsp;"}</div>
        <div style="font-size:9.5px;line-height:1.5">${buyerLines}</div>
        ${doc.customer_gstin ? `<div style="font-size:9.5px">GSTIN/UIN : ${doc.customer_gstin}</div>` : ""}
        ${doc.customer_state ? `<div style="font-size:9.5px">State Name : ${doc.customer_state}${doc.customer_gst_state_code ? ", Code : " + doc.customer_gst_state_code : ""}</div>` : ""}
      </td>
      <td style="width:45%;padding:5px 8px;vertical-align:top;font-size:9.5px">
        ${doc.party_phone ? `<div>Contact : ${doc.party_phone}</div>` : ""}
        ${doc.party_email ? `<div>E-Mail : ${doc.party_email}</div>` : ""}
        ${doc.notes ? `<div style="margin-top:3px">Remarks : ${doc.notes}</div>` : ""}
      </td>
    </tr>
  </table>
  <table style="width:100%;border-collapse:collapse;border:1px solid #000;border-top:none;font-size:10.5px">
    <thead>
      <tr style="background:#f0f0f0">
        <th style="border:1px solid #000;padding:4px 6px;text-align:center;width:5%">Sl No</th>
        <th style="border:1px solid #000;padding:4px 6px;text-align:left">Description of Services</th>
        <th style="border:1px solid #000;padding:4px 6px;text-align:center;width:11%">HSN/SAC</th>
        <th style="border:1px solid #000;padding:4px 6px;text-align:center;width:14%">Quantity</th>
      </tr>
    </thead>
    <tbody>
      ${itemRowsHTML}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="2" style="border:1px solid #000;padding:4px 8px">
          <span style="font-size:9px;font-style:italic">E. &amp; O.E</span>
        </td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center;font-weight:700">Total</td>
        <td style="border:1px solid #000;padding:4px 6px;text-align:center;font-weight:700">${totalQty > 0 ? totalQty.toFixed(3) : "&nbsp;"}</td>
      </tr>
    </tfoot>
  </table>
  <table style="width:100%;border-collapse:collapse;border:1px solid #000;border-top:none;font-size:9.5px">
    <tr>
      <td style="border-right:1px solid #000;padding:6px 8px;width:33%;vertical-align:top">
        Recd. in Good Condition<br><br><br>
        <div style="border-top:1px solid #000;padding-top:3px;text-align:center;font-size:9px">Receiver's Signature</div>
      </td>
      <td style="border-right:1px solid #000;padding:6px 8px;width:34%;vertical-align:top">
        for SILVER CROWN METAL COATINGS<br><br><br>
        <div style="border-top:1px solid #000;padding-top:3px;text-align:center;font-size:9px">Prepared by &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Verified by</div>
      </td>
      <td style="padding:6px 8px;width:33%;vertical-align:top">
        for SILVER CROWN METAL COATINGS<br><br><br>
        <div style="border-top:1px solid #000;padding-top:3px;text-align:center;font-size:9px">Authorised Signatory</div>
      </td>
    </tr>
  </table>
  <div style="text-align:center;font-size:9px;font-style:italic;padding:3px 8px;border:1px solid #000;border-top:none">
    LABOUR CHARGES ONLY - NOT FOR SALE
  </div>
</div>`;
  }

  const copies = [
    "ORIGINAL FOR CONSIGNEE",
    "DUPLICATE FOR TRANSPORTER",
    "TRIPLICATE FOR CONSIGNER",
  ];

  const copiesHTML = copies.map((label) => buildCopy(label)).join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Despatch Note — ${doc.voucher_no || ""}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; }
  .dn-copy { padding: 10px 14px; max-width: 800px; margin: 0 auto; }
  @media print {
    body { margin: 0; padding: 0; }
    .dn-copy { padding: 6px 10px; page-break-after: always; }
    .dn-copy:last-child { page-break-after: avoid; }
  }
</style>
</head>
<body>
${copiesHTML}
</body>
</html>`;
}
