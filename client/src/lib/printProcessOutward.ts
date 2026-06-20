export function buildProcessOutwardHTML(doc: any): string {
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
    const m = dt.getMonth(); const y = dt.getFullYear();
    const s = m >= 3 ? y : y - 1;
    return `${s}-${s + 1}`;
  }

  const items: any[] = doc.items || [];
  const totalQty = items.reduce((s: number, it: any) => s + parseFloat(it.qty || "0"), 0);
  const fy = fyLabel(doc.outward_date);

  const B = "border:1px solid #000";
  const itemTd = `${B};padding:3px 6px;vertical-align:top`;

  function itemRowsHTML() {
    if (items.length === 0) {
      return `<tr style="height:60px">
        <td style="${itemTd};text-align:center"></td>
        <td style="${itemTd}"></td>
        <td style="${itemTd}"></td>
        <td style="${itemTd}"></td>
        <td style="${itemTd}"></td>
        <td style="${itemTd}"></td>
        <td style="${itemTd};text-align:center"></td>
        <td style="${itemTd};text-align:center"></td>
      </tr>`;
    }
    return items.map((it: any, i: number) => `<tr>
      <td style="${itemTd};text-align:center;width:5%">${i + 1}</td>
      <td style="${itemTd};width:15%">${it.customer_ref || ""}</td>
      <td style="${itemTd};width:18%">${it.drawing_no || ""}</td>
      <td style="${itemTd}">${it.item_name || ""}${it.hsn ? `<div style="font-size:8.5px;color:#555">HSN: ${it.hsn}</div>` : ""}</td>
      <td style="${itemTd};width:20%">${it.process_nature || ""}</td>
      <td style="${itemTd};width:12%">${it.bill_ref || ""}</td>
      <td style="${itemTd};text-align:center;width:8%">${it.unit || ""}</td>
      <td style="${itemTd};text-align:center;width:8%">${parseFloat(it.qty || 0) > 0 ? parseFloat(it.qty).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""}</td>
    </tr>`).join("\n");
  }

  const partyAddr = [
    doc.supplier_address1 || doc.supplier_address || "",
    doc.supplier_address2 || "",
    [doc.supplier_city, doc.supplier_state].filter(Boolean).join(", "),
    doc.supplier_pincode || "",
  ].filter(Boolean).join("<br>");

  const partyName = doc.supplier_name || doc.supplier_name_manual || "";
  const voucherNo = doc.voucher_no || "";

  const infoCell = `${B};padding:2px 6px`;
  const infoLabel = `${infoCell};font-size:9px;color:#333`;
  const infoVal   = `${infoCell};font-weight:700;font-size:10px`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Process Outward — ${voucherNo}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; background: #fff; }
  @page { size: A4; margin: 10mm; }
  @media print {
    body { margin: 0; }
    .po-copy { page-break-after: avoid; box-shadow: none !important; margin: 0 !important; }
  }
  .po-copy {
    width: 210mm; min-height: 297mm;
    margin: 10px auto; background: #fff;
    box-shadow: 0 2px 8px rgba(0,0,0,0.18);
  }
  table { border-collapse: collapse; }
</style>
</head>
<body>
<div class="po-copy">
<table style="width:100%;height:100%;border:1px solid #000;font-size:10px">
<tbody>

  <!-- ① Company header -->
  <tr>
    <td style="padding:5px 8px;border-bottom:1px solid #000;text-align:center">
      <div style="font-weight:700;font-size:13px">SILVER CROWN METAL COATINGS</div>
      <div style="font-size:8.5px;margin-top:1px">646, Easwaran Chettiar Layout, Cross Cut Road, Coimbatore - 641012</div>
      <div style="font-size:8.5px">GSTIN/UIN : 33AANFS5823J1ZW &nbsp;|&nbsp; Contact : 0422 2237070, 9500999138</div>
      <div style="font-weight:700;font-size:12px;margin-top:3px;letter-spacing:1px">DELIVERY CHALLAN</div>
    </td>
  </tr>

  <!-- ② Party + DC info row -->
  <tr>
    <td style="padding:0;border-bottom:1px solid #000">
      <table style="width:100%">
        <tr>
          <!-- Left: party address -->
          <td style="width:60%;border-right:1px solid #000;padding:5px 8px;vertical-align:top">
            <div style="font-size:8.5px;margin-bottom:1px">To,</div>
            <div style="font-weight:700;font-size:10px">M/s. ${partyName}</div>
            ${partyAddr ? `<div style="font-size:9px;line-height:1.5;margin-top:1px">${partyAddr}</div>` : ""}
            ${doc.supplier_gstin ? `<div style="font-size:9px">GSTIN : ${doc.supplier_gstin}</div>` : ""}
          </td>
          <!-- Right: 2×2 info grid — all cells bordered so lines join -->
          <td style="width:40%;padding:0;vertical-align:top">
            <table style="width:100%">
              <tr>
                <td style="${infoLabel};border-right:1px solid #000;border-bottom:1px solid #000">DC No.</td>
                <td style="${infoLabel};border-bottom:1px solid #000">Date</td>
              </tr>
              <tr>
                <td style="${infoVal};border-right:1px solid #000;border-bottom:1px solid #000">
                  ${voucherNo}${fy ? ` <span style="font-size:8px;font-weight:400">(${fy})</span>` : ""}
                </td>
                <td style="${infoVal};border-bottom:1px solid #000">${fmtDate(doc.outward_date)}</td>
              </tr>
              <tr>
                <td style="${infoLabel};border-right:1px solid #000;border-bottom:1px solid #000">Vehicle No.</td>
                <td style="${infoLabel};border-bottom:1px solid #000">Purpose</td>
              </tr>
              <tr>
                <td style="${infoVal};border-right:1px solid #000">${doc.vehicle_no || "&nbsp;"}</td>
                <td style="${infoVal}">${doc.purpose || "&nbsp;"}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ③ Items table -->
  <tr style="height:100%">
    <td style="padding:0;border-bottom:1px solid #000;vertical-align:top">
      <table style="width:100%;font-size:10px">
        <thead>
          <tr style="background:#f0f0f0">
            <th style="${B};padding:3px 4px;text-align:center;width:5%">Sl<br>No</th>
            <th style="${B};padding:3px 4px;text-align:center;width:15%">Customer<br>Ref</th>
            <th style="${B};padding:3px 4px;text-align:center;width:18%">Drawing No /<br>Description</th>
            <th style="${B};padding:3px 4px;text-align:center">Item / Description</th>
            <th style="${B};padding:3px 4px;text-align:center;width:20%">Process / Nature<br>of Work</th>
            <th style="${B};padding:3px 4px;text-align:center;width:12%">Bill No /<br>Ref</th>
            <th style="${B};padding:3px 4px;text-align:center;width:8%">UOM</th>
            <th style="${B};padding:3px 4px;text-align:center;width:8%">Qty</th>
          </tr>
        </thead>
        <tbody>${itemRowsHTML()}</tbody>
        <tfoot>
          <tr>
            <td colspan="7" style="${B};padding:3px 8px;text-align:right;font-weight:700">Total Qty</td>
            <td style="${B};padding:3px 6px;text-align:center;font-weight:700">
              ${totalQty > 0 ? totalQty.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "&nbsp;"}
            </td>
          </tr>
          <tr>
            <td colspan="8" style="${B};padding:3px 8px;text-align:right;font-size:8.5px;font-style:italic">E. &amp; O.E</td>
          </tr>
        </tfoot>
      </table>
    </td>
  </tr>

  <!-- ④ Notes (optional) -->
  ${doc.notes ? `<tr><td style="padding:3px 8px;border-bottom:1px solid #000;font-size:9px"><span style="font-weight:600">Note : </span>${doc.notes}</td></tr>` : ""}

  <!-- ⑤ Signature row -->
  <tr>
    <td style="padding:0;border-bottom:1px solid #000">
      <table style="width:100%">
        <tr>
          <td style="border-right:1px solid #000;padding:6px 8px;width:45%;vertical-align:bottom">
            Recd. in Good Condition<br><br><br>
            <div style="padding-top:3px;text-align:center;font-size:8.5px">Receiver's Signature</div>
          </td>
          <td style="padding:6px 8px;width:55%;vertical-align:top">
            <div style="text-align:center;font-weight:700;font-size:9px;margin-bottom:6px">for SILVER CROWN METAL COATINGS</div>
            <br><br><br>
            <div style="padding-top:3px;display:flex;justify-content:space-between;font-size:8.5px">
              <span>Prepared by</span><span>Checked by</span><span>Authorised Signatory</span>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- ⑥ Footer note -->
  <tr>
    <td style="text-align:center;font-size:8.5px;font-style:italic;padding:2px 8px">
      LABOUR CHARGES ONLY - NOT FOR SALE
    </td>
  </tr>

</tbody>
</table>
</div>
</body>
</html>`;
}
