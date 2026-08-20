/**
 * xml-builder.js — Tally XML request builders.
 *
 * Rules:
 *  - All user-supplied strings are XML-escaped before insertion.
 *  - Company name is always injected from config (never hardcoded).
 *  - No host/port/company/financialYear/ledger/voucher types are hardcoded.
 */

/**
 * Escape a string for safe embedding inside Tally XML text nodes or attributes.
 * Tally XML is not HTML, but these five chars must still be escaped.
 */
export function escapeXml(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Minimal <ENVELOPE> wrapper used by every Tally request.
 * @param {string} bodyXml — inner XML (already built / pre-escaped)
 */
function envelope(bodyXml) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE>\n${bodyXml}\n</ENVELOPE>`;
}

/**
 * Build a TDLMESSAGE request (used for data export / fetch).
 */
function tdlMessage(fetchBlock) {
  return envelope(`  <HEADER>\n    <VERSION>1</VERSION>\n    <TALLYREQUEST>Export</TALLYREQUEST>\n    <TYPE>Collection</TYPE>\n    <ID>MyCollection</ID>\n  </HEADER>\n  <BODY>\n    <DESC>\n      <STATICVARIABLES>\n        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>\n      </STATICVARIABLES>\n      <TDL>\n        <TDLMESSAGE>\n${fetchBlock}\n        </TDLMESSAGE>\n      </TDL>\n    </DESC>\n  </BODY>`);
}

// ─── Company Discovery ───────────────────────────────────────────────────────

/**
 * Build XML to discover all companies currently loaded in Tally.
 * @returns {string}
 */
export function buildCompanyDiscoveryXml() {
  return envelope(
    `  <HEADER>\n    <VERSION>1</VERSION>\n    <TALLYREQUEST>Export</TALLYREQUEST>\n    <TYPE>Collection</TYPE>\n    <ID>List of Companies</ID>\n  </HEADER>\n  <BODY>\n    <DESC>\n      <STATICVARIABLES>\n        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>\n      </STATICVARIABLES>\n      <TDL>\n        <TDLMESSAGE>\n          <COLLECTION NAME="List of Companies" ISMODIFY="No">\n            <TYPE>Company</TYPE>\n            <FETCH>Name,StartingFrom,BooksFrom,LastVoucherDate,EulaAccepted</FETCH>\n          </COLLECTION>\n        </TDLMESSAGE>\n      </TDL>\n    </DESC>\n  </BODY>`
  );
}

// ─── Master Discovery ────────────────────────────────────────────────────────

/**
 * Build XML to fetch all Ledgers from Tally for the given company.
 * @param {string|null} company — exact company name in Tally; null = current
 */
export function buildLedgerDiscoveryXml(company) {
  const companyTag = company
    ? `        <SVCURRENTCOMPANY>${escapeXml(company)}</SVCURRENTCOMPANY>\n`
    : "";
  return envelope(
    `  <HEADER>\n    <VERSION>1</VERSION>\n    <TALLYREQUEST>Export</TALLYREQUEST>\n    <TYPE>Collection</TYPE>\n    <ID>LedgerList</ID>\n  </HEADER>\n  <BODY>\n    <DESC>\n      <STATICVARIABLES>\n        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>\n${companyTag}      </STATICVARIABLES>\n      <TDL>\n        <TDLMESSAGE>\n          <COLLECTION NAME="LedgerList" ISMODIFY="No">\n            <TYPE>Ledger</TYPE>\n            <FETCH>Name,Parent,OpeningBalance,ClosingBalance,IsBillwiseOn,IsRevenueItem,GSTPrimaryApplicable,GSTPanNo,PartyGSTIN,MobileNo,Email,MailingName,Address,PinCode,CountryName,StateName,LedgerPhone</FETCH>\n          </COLLECTION>\n        </TDLMESSAGE>\n      </TDL>\n    </DESC>\n  </BODY>`
  );
}

/**
 * Build XML to fetch all Voucher Types from Tally.
 * @param {string|null} company
 */
export function buildVoucherTypeDiscoveryXml(company) {
  const companyTag = company
    ? `        <SVCURRENTCOMPANY>${escapeXml(company)}</SVCURRENTCOMPANY>\n`
    : "";
  return envelope(
    `  <HEADER>\n    <VERSION>1</VERSION>\n    <TALLYREQUEST>Export</TALLYREQUEST>\n    <TYPE>Collection</TYPE>\n    <ID>VoucherTypeList</ID>\n  </HEADER>\n  <BODY>\n    <DESC>\n      <STATICVARIABLES>\n        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>\n${companyTag}      </STATICVARIABLES>\n      <TDL>\n        <TDLMESSAGE>\n          <COLLECTION NAME="VoucherTypeList" ISMODIFY="No">\n            <TYPE>VoucherType</TYPE>\n            <FETCH>Name,Parent,NumberingMethod,IsOptional,IsBankRecon</FETCH>\n          </COLLECTION>\n        </TDLMESSAGE>\n      </TDL>\n    </DESC>\n  </BODY>`
  );
}

/**
 * Build XML to fetch Stock Items (optional master).
 * @param {string|null} company
 */
export function buildStockItemDiscoveryXml(company) {
  const companyTag = company
    ? `        <SVCURRENTCOMPANY>${escapeXml(company)}</SVCURRENTCOMPANY>\n`
    : "";
  return envelope(
    `  <HEADER>\n    <VERSION>1</VERSION>\n    <TALLYREQUEST>Export</TALLYREQUEST>\n    <TYPE>Collection</TYPE>\n    <ID>StockItemList</ID>\n  </HEADER>\n  <BODY>\n    <DESC>\n      <STATICVARIABLES>\n        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>\n${companyTag}      </STATICVARIABLES>\n      <TDL>\n        <TDLMESSAGE>\n          <COLLECTION NAME="StockItemList" ISMODIFY="No">\n            <TYPE>StockItem</TYPE>\n            <FETCH>Name,Parent,BaseUnits,GSTApplicable,HSNCode,GSTPrimaryApplicable,ClosingBalance,StandardCost,StandardPrice</FETCH>\n          </COLLECTION>\n        </TDLMESSAGE>\n      </TDL>\n    </DESC>\n  </BODY>`
  );
}

// ─── Voucher Export ──────────────────────────────────────────────────────────

/**
 * Format a JS Date (or date string) as YYYYMMDD for Tally.
 */
export function toTallyDate(dateInput) {
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) throw new TypeError(`Invalid date: ${dateInput}`);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * Build XML to export vouchers of given type(s) between two dates.
 *
 * @param {object} opts
 * @param {string} opts.fromDate       — JS ISO date string or YYYYMMDD
 * @param {string} opts.toDate         — JS ISO date string or YYYYMMDD
 * @param {string|null} opts.company   — Tally company name
 * @param {string[]} [opts.voucherTypes] — filter by voucher type names; empty = all
 */
export function buildVoucherExportXml({ fromDate, toDate, company, voucherTypes = [] }) {
  const from = toTallyDate(fromDate);
  const to   = toTallyDate(toDate);
  const companyTag = company
    ? `        <SVCURRENTCOMPANY>${escapeXml(company)}</SVCURRENTCOMPANY>\n`
    : "";
  const fromTag = `        <SVFROMDATE TYPE="Date">${from}</SVFROMDATE>\n`;
  const toTag   = `        <SVTODATE TYPE="Date">${to}</SVTODATE>\n`;

  // Optional voucher-type filter
  let filterXml = "";
  if (voucherTypes.length > 0) {
    const conditions = voucherTypes
      .map(t => `$$IsEqual:$VoucherTypeName:"${escapeXml(t)}"`)
      .join(":OR:");
    filterXml = `\n            <FILTER>VoucherTypeFilter</FILTER>`;
    filterXml += `\n          <SYSTEM TYPE="Formulae"><FORMULA NAME="VoucherTypeFilter">${escapeXml(conditions)}</FORMULA></SYSTEM>`;
  }

  return envelope(
    `  <HEADER>\n    <VERSION>1</VERSION>\n    <TALLYREQUEST>Export</TALLYREQUEST>\n    <TYPE>Collection</TYPE>\n    <ID>VoucherCollection</ID>\n  </HEADER>\n  <BODY>\n    <DESC>\n      <STATICVARIABLES>\n        <SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>\n${companyTag}${fromTag}${toTag}      </STATICVARIABLES>\n      <TDL>\n        <TDLMESSAGE>\n          <COLLECTION NAME="VoucherCollection" ISMODIFY="No" ISINTERNALUSE="No">\n            <TYPE>Voucher</TYPE>\n            <CHILDOF>$$VchKeyName:Voucher</CHILDOF>\n            <BELONGSTO>$$SVFromDate to $$SVToDate</BELONGSTO>\n            <FETCH>GUID,AlterID,VoucherTypeName,VoucherNumber,Date,IsOptional,Narration,EffectiveDate,RemoteID,PartyLedgerName,PartyName,PlaceOfSupply,IsInvoice,BasicShippingDate,BasicShipDocumentNo,BasicBasketName,LedgerEntries,AllLedgerEntries,InventoryEntries,InventoryEntriesIn,InventoryEntriesOut,BillAllocations,CostCentreAllocations,BankAllocations,VoucherKey</FETCH>${filterXml}\n          </COLLECTION>\n        </TDLMESSAGE>\n      </TDL>\n    </DESC>\n  </BODY>`
  );
}

// ─── Voucher Import ──────────────────────────────────────────────────────────

/**
 * Build a single ledger entry XML element.
 *
 * @param {object} entry
 * @param {string} entry.ledgerName
 * @param {number} entry.amount        — positive = Dr, negative = Cr (Tally sign convention)
 * @param {string} [entry.gstClass]
 * @param {object[]} [entry.billAllocations]
 */
function buildLedgerEntryXml(entry, index) {
  const isDr = entry.amount >= 0;
  const absAmt = Math.abs(entry.amount).toFixed(2);
  const isDebit = isDr ? "Yes" : "No";

  let billXml = "";
  if (entry.billAllocations && entry.billAllocations.length > 0) {
    billXml = entry.billAllocations
      .map(b => {
        const bAmt = Math.abs(b.amount ?? entry.amount).toFixed(2);
        return `              <BILLALLOCATIONS.LIST>\n                <NAME>${escapeXml(b.name)}</NAME>\n                <BILLTYPE>${escapeXml(b.billType || "New Ref")}</BILLTYPE>\n                <AMOUNT>${isDr ? "" : "-"}${bAmt}</AMOUNT>\n              </BILLALLOCATIONS.LIST>`;
      })
      .join("\n");
  }

  const gstTag = entry.gstClass
    ? `            <GSTCLASS>${escapeXml(entry.gstClass)}</GSTCLASS>\n`
    : "";

  return `          <LEDGERENTRIES.LIST>\n            <LEDGERNAME>${escapeXml(entry.ledgerName)}</LEDGERNAME>\n            <ISDEEMEDPOSITIVE>${isDebit}</ISDEEMEDPOSITIVE>\n            <ISPARTYLEDGER>${entry.isParty ? "Yes" : "No"}</ISPARTYLEDGER>\n${gstTag}            <AMOUNT>${isDr ? "" : "-"}${absAmt}</AMOUNT>\n${billXml ? billXml + "\n" : ""}          </LEDGERENTRIES.LIST>`;
}

/**
 * Build XML to import (create or alter) a single voucher in Tally.
 *
 * @param {object} voucher
 * @param {string} voucher.voucherType     — exact Tally voucher type name
 * @param {string} voucher.voucherNumber   — voucher number string
 * @param {string} voucher.date            — ISO or YYYYMMDD
 * @param {string|null} voucher.company    — Tally company name
 * @param {string} [voucher.narration]
 * @param {string} [voucher.partyLedger]   — party name for invoice vouchers
 * @param {object[]} voucher.ledgerEntries — array of {ledgerName, amount, billAllocations?}
 * @param {string} [voucher.remoteId]      — external idempotency ID (mapped to RemoteID / TagID)
 * @param {string} [voucher.guid]          — for alterations
 */
export function buildVoucherImportXml(voucher) {
  const company = voucher.company ?? null;
  const companyTag = company
    ? `    <SVCURRENTCOMPANY>${escapeXml(company)}</SVCURRENTCOMPANY>\n`
    : "";

  const dateStr = toTallyDate(voucher.date);
  const effectiveDateTag = voucher.effectiveDate
    ? `        <EFFECTIVEDATE TYPE="Date">${toTallyDate(voucher.effectiveDate)}</EFFECTIVEDATE>\n`
    : "";

  const guidTag = voucher.guid
    ? `        <GUID>${escapeXml(voucher.guid)}</GUID>\n`
    : "";

  const remoteIdTag = voucher.remoteId
    ? `        <REMOTEID>${escapeXml(voucher.remoteId)}</REMOTEID>\n`
    : "";

  const narrationTag = voucher.narration
    ? `        <NARRATION>${escapeXml(voucher.narration)}</NARRATION>\n`
    : "";

  const partyTag = voucher.partyLedger
    ? `        <PARTYLEDGERNAME>${escapeXml(voucher.partyLedger)}</PARTYLEDGERNAME>\n`
    : "";

  const ledgerEntriesXml = (voucher.ledgerEntries || [])
    .map((e, i) => buildLedgerEntryXml(e, i))
    .join("\n");

  const action = voucher.guid ? "Alter" : "Create";

  return envelope(
    `  <HEADER>\n    <VERSION>1</VERSION>\n    <TALLYREQUEST>Import Data</TALLYREQUEST>\n    <TYPE>Vouchers</TYPE>\n    <SUBTYPE>${escapeXml(voucher.voucherType)}</SUBTYPE>\n  </HEADER>\n  <BODY>\n    <DESC>\n      <STATICVARIABLES>\n${companyTag}      </STATICVARIABLES>\n    </DESC>\n    <DATA>\n      <TALLYMESSAGE xmlns:UDF="TallyUDF">\n        <VOUCHER REMOTEID="${escapeXml(voucher.remoteId || "")}" VCHTYPE="${escapeXml(voucher.voucherType)}" ACTION="${action}" OBJVIEW="Accounting Voucher View">\n${guidTag}${remoteIdTag}${narrationTag}${partyTag}${effectiveDateTag}        <DATE TYPE="Date">${dateStr}</DATE>\n        <VOUCHERTYPENAME>${escapeXml(voucher.voucherType)}</VOUCHERTYPENAME>\n        <VOUCHERNUMBER>${escapeXml(voucher.voucherNumber || "")}</VOUCHERNUMBER>\n${ledgerEntriesXml}\n        </VOUCHER>\n      </TALLYMESSAGE>\n    </DATA>\n  </BODY>`
  );
}
