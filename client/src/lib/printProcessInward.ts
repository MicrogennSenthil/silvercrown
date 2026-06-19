export function buildProcessInwardHTML(doc: any): string {
  function fmtDate(d: string) {
    if (!d) return "";
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  }
  function fmtAmt(v: any) {
    const n = parseFloat(v || 0);
    return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function numToWords(n: number): string {
    const a = ["", "One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
                "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen",
                "Seventeen","Eighteen","Nineteen"];
    const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
    if (n === 0) return "Zero";
    function conv(num: number): string {
      if (num < 20) return a[num];
      if (num < 100) return b[Math.floor(num/10)] + (num%10 ? " " + a[num%10] : "");
      if (num < 1000) return a[Math.floor(num/100)] + " Hundred" + (num%100 ? " " + conv(num%100) : "");
      if (num < 100000) return conv(Math.floor(num/1000)) + " Thousand" + (num%1000 ? " " + conv(num%1000) : "");
      if (num < 10000000) return conv(Math.floor(num/100000)) + " Lakh" + (num%100000 ? " " + conv(num%100000) : "");
      return conv(Math.floor(num/10000000)) + " Crore" + (num%10000000 ? " " + conv(num%10000000) : "");
    }
    const integer = Math.floor(n);
    const paise   = Math.round((n - integer) * 100);
    let result = conv(integer) + " Rupees";
    if (paise > 0) result += " and " + conv(paise) + " Paise";
    return result + " Only";
  }

  const items: any[] = doc.items || [];
  const taxable  = parseFloat(doc.taxable_amount  || 0);
  const cgst     = parseFloat(doc.cgst_amount     || 0);
  const sgst     = parseFloat(doc.sgst_amount     || 0);
  const igst     = parseFloat(doc.igst_amount     || 0);
  const total    = parseFloat(doc.total_amount     || 0);

  const supplierName = doc.supplier_name || doc.supplier_name_manual || "";
  const supplierAddr = [
    doc.supplier_address1 || doc.supplier_address || "",
    doc.supplier_address2 || "",
    [doc.supplier_city, doc.supplier_state].filter(Boolean).join(", "),
  ].filter(Boolean).join(", ");

  const itemRows = items.map((it: any, i: number) => `
    <tr>
      <td style="border:1px solid #000;padding:3px 5px;text-align:center">${i + 1}</td>
      <td style="border:1px solid #000;padding:3px 5px">
        <div style="font-weight:600">${it.item_name || ""}</div>
        ${it.hsn ? `<div style="font-size:8.5px;color:#555">HSN: ${it.hsn}</div>` : ""}
      </td>
      <td style="border:1px solid #000;padding:3px 5px;text-align:center">${it.unit || ""}</td>
      <td style="border:1px solid #000;padding:3px 5px;text-align:center">${parseFloat(it.qty||0).toLocaleString("en-IN",{minimumFractionDigits:3,maximumFractionDigits:3})}</td>
      <td style="border:1px solid #000;padding:3px 5px;text-align:right">${fmtAmt(it.rate)}</td>
      <td style="border:1px solid #000;padding:3px 5px;text-align:right">${fmtAmt(it.taxable_amount || (parseFloat(it.qty||0)*parseFloat(it.rate||0)))}</td>
      <td style="border:1px solid #000;padding:3px 5px;text-align:center">${parseFloat(it.cgst_rate||0) > 0 ? it.cgst_rate + "%" : (parseFloat(it.igst_rate||0) > 0 ? it.igst_rate + "%" : "")}</td>
      <td style="border:1px solid #000;padding:3px 5px;text-align:right">${fmtAmt(parseFloat(it.cgst_amount||0) + parseFloat(it.sgst_amount||0) + parseFloat(it.igst_amount||0))}</td>
      <td style="border:1px solid #000;padding:3px 5px;text-align:right;font-weight:600">${fmtAmt(it.amount)}</td>
    </tr>`).join("");

  const isInterState = igst > 0;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Process Inward Invoice — ${doc.voucher_no || ""}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #000; background: #fff; }
  @page { size: A4; margin: 10mm; }
  @media print { body { margin: 0; } .pi-copy { box-shadow: none !important; margin: 0 !important; } }
  .pi-copy { width: 210mm; min-height: 297mm; margin: 10px auto; background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.18); }
</style>
</head>
<body>
<div class="pi-copy">
<table style="width:100%;border-collapse:collapse;border:1px solid #000;font-size:10px">
<tbody>

  <tr>
    <td colspan="2" style="padding:5px 8px;border-bottom:1px solid #000">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="width:60%;vertical-align:top">
            <div style="font-weight:700;font-size:12px">SILVER CROWN METAL COATINGS</div>
            <div style="font-size:8.5px;margin-top:2px;line-height:1.5">
              646, Easwaran Chettiar Layout, Cross Cut Road,<br>
              Coimbatore - 641012<br>
              GSTIN/UIN : 33AANFS5823J1ZW<br>
              State : Tamil Nadu, Code : 33<br>
              Contact : 0422 2237070, 9500999138
            </div>
          </td>
          <td style="width:40%;vertical-align:top;text-align:right">
            <div style="font-weight:700;font-size:11px">PURCHASE INVOICE</div>
            <div style="font-size:9px;margin-top:4px">(Process Inward)</div>
            <div style="margin-top:4px;font-size:9px">
              <span style="font-weight:600">Invoice No : </span>${doc.voucher_no || ""}
            </div>
            <div style="font-size:9px">
              <span style="font-weight:600">Date : </span>${fmtDate(doc.inward_date)}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td style="width:55%;border-right:1px solid #000;border-bottom:1px solid #000;padding:4px 8px;vertical-align:top">
      <div style="font-size:8.5px;font-weight:600;margin-bottom:1px">Supplier</div>
      <div style="font-weight:700;font-size:10px">M/s. ${supplierName}</div>
      ${supplierAddr ? `<div style="font-size:9px;line-height:1.4;margin-top:1px">${supplierAddr}</div>` : ""}
      ${doc.supplier_gstin ? `<div style="font-size:9px">GSTIN : ${doc.supplier_gstin}</div>` : ""}
    </td>
    <td style="width:45%;border-bottom:1px solid #000;padding:4px 8px;vertical-align:top;font-size:9px">
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:1px 0;width:50%">Supplier Invoice No</td>
          <td style="padding:1px 0;font-weight:600">: ${doc.supplier_invoice_no || "&nbsp;"}</td>
        </tr>
        <tr>
          <td style="padding:1px 0">Supplier Invoice Date</td>
          <td style="padding:1px 0;font-weight:600">: ${fmtDate(doc.supplier_invoice_date)}</td>
        </tr>
        <tr>
          <td style="padding:1px 0">Against DC No.</td>
          <td style="padding:1px 0;font-weight:600">: ${doc.outward_voucher_no || "&nbsp;"}</td>
        </tr>
        <tr>
          <td style="padding:1px 0">Payment Mode</td>
          <td style="padding:1px 0;font-weight:600">: ${doc.payment_mode || "Credit"}</td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td colspan="2" style="padding:0;border-bottom:1px solid #000">
      <table style="width:100%;border-collapse:collapse;font-size:10px">
        <thead>
          <tr style="background:#f0f0f0">
            <th style="border:1px solid #000;padding:3px 4px;text-align:center;width:5%">Sl<br>No</th>
            <th style="border:1px solid #000;padding:3px 4px;text-align:center">Description of Service / Item</th>
            <th style="border:1px solid #000;padding:3px 4px;text-align:center;width:7%">UOM</th>
            <th style="border:1px solid #000;padding:3px 4px;text-align:center;width:8%">Qty</th>
            <th style="border:1px solid #000;padding:3px 4px;text-align:center;width:10%">Rate</th>
            <th style="border:1px solid #000;padding:3px 4px;text-align:center;width:10%">Taxable<br>Amt</th>
            <th style="border:1px solid #000;padding:3px 4px;text-align:center;width:8%">Tax<br>Rate</th>
            <th style="border:1px solid #000;padding:3px 4px;text-align:center;width:10%">Tax<br>Amt</th>
            <th style="border:1px solid #000;padding:3px 4px;text-align:center;width:10%">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          <tr>
            <td colspan="9" style="height:40px;border-left:1px solid #000;border-right:1px solid #000">&nbsp;</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td colspan="5" style="border:1px solid #000;padding:3px 8px;text-align:right;font-weight:700">Taxable Amount</td>
            <td colspan="4" style="border:1px solid #000;padding:3px 8px;text-align:right;font-weight:700">${fmtAmt(taxable)}</td>
          </tr>
          ${!isInterState && cgst > 0 ? `
          <tr>
            <td colspan="5" style="border:1px solid #000;padding:3px 8px;text-align:right">CGST</td>
            <td colspan="4" style="border:1px solid #000;padding:3px 8px;text-align:right">${fmtAmt(cgst)}</td>
          </tr>
          <tr>
            <td colspan="5" style="border:1px solid #000;padding:3px 8px;text-align:right">SGST</td>
            <td colspan="4" style="border:1px solid #000;padding:3px 8px;text-align:right">${fmtAmt(sgst)}</td>
          </tr>` : ""}
          ${isInterState && igst > 0 ? `
          <tr>
            <td colspan="5" style="border:1px solid #000;padding:3px 8px;text-align:right">IGST</td>
            <td colspan="4" style="border:1px solid #000;padding:3px 8px;text-align:right">${fmtAmt(igst)}</td>
          </tr>` : ""}
          <tr>
            <td colspan="5" style="border:1px solid #000;padding:3px 8px;text-align:right;font-weight:700;font-size:11px">TOTAL</td>
            <td colspan="4" style="border:1px solid #000;padding:3px 8px;text-align:right;font-weight:700;font-size:11px">${fmtAmt(total)}</td>
          </tr>
        </tfoot>
      </table>
    </td>
  </tr>

  <tr>
    <td colspan="2" style="padding:4px 8px;border-bottom:1px solid #000;font-size:9px">
      <span style="font-weight:600">Amount in Words : </span>${numToWords(total)}
    </td>
  </tr>

  ${doc.notes ? `<tr><td colspan="2" style="padding:3px 8px;border-bottom:1px solid #000;font-size:9px"><span style="font-weight:600">Notes : </span>${doc.notes}</td></tr>` : ""}

  <tr>
    <td colspan="2" style="padding:0;border-bottom:1px solid #000">
      <table style="width:100%;border-collapse:collapse;font-size:9px">
        <tr>
          <td style="border-right:1px solid #000;padding:6px 8px;width:55%;vertical-align:bottom">
            <div style="font-size:8.5px;margin-bottom:2px">Terms &amp; Conditions :</div>
            <div style="font-size:8.5px">1. Goods once sold will not be taken back.</div>
            <div style="font-size:8.5px">2. Subject to Coimbatore Jurisdiction.</div>
            <br>
            <div style="border-top:1px solid #000;padding-top:3px;text-align:center;font-size:8.5px">Receiver's Signature &amp; Stamp</div>
          </td>
          <td style="padding:6px 8px;width:45%;vertical-align:top">
            <div style="text-align:center;font-weight:700;font-size:9px;margin-bottom:6px">for SILVER CROWN METAL COATINGS</div>
            <br><br><br>
            <div style="border-top:1px solid #000;padding-top:3px;display:flex;justify-content:space-between;font-size:8.5px">
              <span>Prepared by</span><span>Verified by</span><span>Authorised Signatory</span>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <tr>
    <td colspan="2" style="text-align:center;font-size:8.5px;font-style:italic;padding:2px 8px">
      This is a Computer Generated Document
    </td>
  </tr>

</tbody>
</table>
</div>
</body>
</html>`;
}
