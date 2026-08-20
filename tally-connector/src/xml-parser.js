/**
 * xml-parser.js — Robust Tally XML response parser.
 *
 * Uses fast-xml-parser (a small, maintained, zero-dependency npm package)
 * to parse Tally's XML into plain JS objects, then normalises them into
 * the shapes expected by the ERP import API.
 */

import { XMLParser } from "fast-xml-parser";

const PARSER_OPTIONS = {
  ignoreAttributes:    false,
  attributeNamePrefix: "@_",
  removeNSPrefix:      true,
  parseAttributeValue: false,
  parseTagValue:       true,
  trimValues:          true,
  // Tally uses CDATA in some fields
  cdataPropName:       "__cdata",
  isArray: (name) => {
    // These are always arrays even if only one child exists
    return [
      "COMPANY",
      "LEDGER",
      "VOUCHERTYPE",
      "STOCKITEM",
      "VOUCHER",
      "LEDGERENTRIES.LIST",
      "ALLLLEDGERENTRIES.LIST",
      "ALLLEDGERENTRIES.LIST",
      "INVENTORYENTRIES.LIST",
      "INVENTORYENTRIESIN.LIST",
      "INVENTORYENTRIESOUT.LIST",
      "BILLALLOCATIONS.LIST",
      "BANKALLOCATIONS.LIST",
      "COSTALLOCATIONS.LIST",
      "LINEREFERENCE.LIST",
    ].includes(name);
  },
};

const parser = new XMLParser(PARSER_OPTIONS);

/**
 * Parse raw Tally XML string into a plain JS object.
 * @param {string} xml
 * @returns {object}
 */
export function parseTallyXml(xml) {
  if (!xml || typeof xml !== "string") {
    throw new TypeError("parseTallyXml: expected a non-empty string");
  }
  return parser.parse(xml);
}

/**
 * Extract a string value from a parsed object field.
 * Handles the CDATA wrapper that fast-xml-parser creates.
 */
function str(val) {
  if (val == null) return null;
  if (typeof val === "object" && val.__cdata != null) return String(val.__cdata).trim();
  return String(val).trim() || null;
}

function num(val) {
  if (val == null) return 0;
  const n = parseFloat(String(val).replace(/,/g, ""));
  return isNaN(n) ? 0 : n;
}

/**
 * Parse Tally date string (YYYYMMDD or DD-MMM-YYYY) to ISO date string (YYYY-MM-DD).
 * Returns null if unparseable.
 */
export function parseTallyDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  // YYYYMMDD
  if (/^\d{8}$/.test(s)) {
    const y = s.slice(0, 4);
    const m = s.slice(4, 6);
    const d = s.slice(6, 8);
    return `${y}-${m}-${d}`;
  }

  // DD-MMM-YYYY  e.g. "01-Apr-2024"
  const mmmMap = {
    Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",
    Jul:"07",Aug:"08",Sep:"09",Oct:"10",Nov:"11",Dec:"12"
  };
  const m2 = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m2) {
    const month = mmmMap[m2[2]] ?? "00";
    return `${m2[3]}-${month}-${String(m2[1]).padStart(2, "0")}`;
  }

  // Fallback: try native Date
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// ─── Company Discovery ───────────────────────────────────────────────────────

/**
 * Parse the response to buildCompanyDiscoveryXml().
 * @param {string} xml
 * @returns {{ name: string, booksFrom: string|null, lastVoucherDate: string|null }[]}
 */
export function parseCompanyDiscovery(xml) {
  const root = parseTallyXml(xml);
  const envelope = root?.ENVELOPE ?? root;
  const body = envelope?.BODY ?? envelope;
  const data = body?.DATA ?? body;
  const collection =
    data?.COLLECTION ??
    envelope?.BODY?.DATA?.COLLECTION ??
    {};

  const companies = [].concat(collection?.COMPANY ?? []).filter(Boolean);
  return companies.map(c => ({
    name:            str(c.NAME) ?? str(c["@_NAME"]) ?? "",
    booksFrom:       parseTallyDate(str(c.BOOKSFROM)),
    startingFrom:    parseTallyDate(str(c.STARTINGFROM)),
    lastVoucherDate: parseTallyDate(str(c.LASTVOUCHERDATE)),
    eulaAccepted:    str(c.EULAACCEPTED),
  }));
}

// ─── Master Parsing ──────────────────────────────────────────────────────────

/**
 * Parse ledger list response.
 * @param {string} xml
 * @returns {object[]}
 */
export function parseLedgerDiscovery(xml) {
  const root = parseTallyXml(xml);
  const collection = deepGet(root, "ENVELOPE.BODY.DATA.COLLECTION") ?? {};
  const ledgers = [].concat(collection?.LEDGER ?? []).filter(Boolean);
  return ledgers.map(l => ({
    name:           str(l.NAME) ?? str(l["@_NAME"]) ?? "",
    parent:         str(l.PARENT),
    openingBalance: num(l.OPENINGBALANCE),
    closingBalance: num(l.CLOSINGBALANCE),
    isBillwiseOn:   str(l.ISBILLWISEON) === "Yes",
    isRevenueItem:  str(l.ISREVENUEITEM) === "Yes",
    gstin:          str(l.PARTYGSTNO) ?? str(l.PARTYGSTINNO) ?? str(l.PARTYGSTNNUMBER) ?? null,
    panNo:          str(l.GSTPANNO),
    mailingName:    str(l.MAILINGNAME),
    address:        str(l.ADDRESS),
    pinCode:        str(l.PINCODE),
    country:        str(l.COUNTRYNAME),
    state:          str(l.STATENAME),
    email:          str(l.EMAIL),
    mobileNo:       str(l.MOBILENO) ?? str(l.LEDGERPHONE),
  }));
}

/**
 * Parse voucher type list response.
 * @param {string} xml
 * @returns {object[]}
 */
export function parseVoucherTypeDiscovery(xml) {
  const root = parseTallyXml(xml);
  const collection = deepGet(root, "ENVELOPE.BODY.DATA.COLLECTION") ?? {};
  const vtypes = [].concat(collection?.VOUCHERTYPE ?? []).filter(Boolean);
  return vtypes.map(v => ({
    name:             str(v.NAME) ?? str(v["@_NAME"]) ?? "",
    parent:           str(v.PARENT),
    numberingMethod:  str(v.NUMBERINGMETHOD),
    isOptional:       str(v.ISOPTIONAL) === "Yes",
    isBankRecon:      str(v.ISBANKRECON) === "Yes",
  }));
}

/**
 * Parse stock item list response.
 * @param {string} xml
 * @returns {object[]}
 */
export function parseStockItemDiscovery(xml) {
  const root = parseTallyXml(xml);
  const collection = deepGet(root, "ENVELOPE.BODY.DATA.COLLECTION") ?? {};
  const items = [].concat(collection?.STOCKITEM ?? []).filter(Boolean);
  return items.map(s => ({
    name:         str(s.NAME) ?? str(s["@_NAME"]) ?? "",
    parent:       str(s.PARENT),
    baseUnits:    str(s.BASEUNITS),
    hsnCode:      str(s.HSNCODE),
    gstApplicable:str(s.GSTAPPLICABLE),
    closingBalance: num(s.CLOSINGBALANCE),
    standardCost:   num(s.STANDARDCOST),
    standardPrice:  num(s.STANDARDPRICE),
  }));
}

// ─── Voucher Export Parsing ──────────────────────────────────────────────────

/**
 * Parse a bill-allocation list item.
 */
function parseBillAllocation(b) {
  return {
    name:     str(b.NAME),
    billType: str(b.BILLTYPE),
    amount:   num(b.AMOUNT),
  };
}

/**
 * Parse a bank-allocation list item.
 */
function parseBankAllocation(bk) {
  return {
    transactionType: str(bk.TRANSACTIONTYPE),
    bankName:        str(bk.BANKNAME),
    instrumentDate:  parseTallyDate(str(bk.INSTRUMENTDATE)),
    instrumentNo:    str(bk.INSTRUMENTNO),
    amount:          num(bk.AMOUNT),
  };
}

/**
 * Parse a ledger-entry list item.
 */
function parseLedgerEntry(e) {
  const billAllocs = [].concat(
    e["BILLALLOCATIONS.LIST"] ?? []
  ).filter(Boolean).map(parseBillAllocation);
  const bankAllocs = [].concat(
    e["BANKALLOCATIONS.LIST"] ?? []
  ).filter(Boolean).map(parseBankAllocation);
  return {
    ledgerName:      str(e.LEDGERNAME),
    isDeemed:        str(e.ISDEEMEDPOSITIVE) === "Yes",
    isPartyLedger:   str(e.ISPARTYLEDGER) === "Yes",
    gstClass:        str(e.GSTCLASS),
    amount:          num(e.AMOUNT),
    billAllocations: billAllocs,
    bankAllocations: bankAllocs,
  };
}

/**
 * Normalise a single parsed VOUCHER object into the canonical ERP inbound shape.
 *
 * @param {object} v — raw parsed voucher object
 * @returns {object} normalised voucher
 */
function normaliseVoucher(v) {
  // Ledger entries can appear under multiple field names depending on voucher type
  const allLedgerEntries = [
    ...[].concat(v["LEDGERENTRIES.LIST"] ?? []),
    ...[].concat(v["ALLLEDGERENTRIES.LIST"] ?? []),
    ...[].concat(v["ALLLLEDGERENTRIES.LIST"] ?? []), // Tally sometimes typos this
  ].filter(Boolean).map(parseLedgerEntry);

  const bankAllocs = [].concat(v["BANKALLOCATIONS.LIST"] ?? [])
    .filter(Boolean).map(parseBankAllocation);

  return {
    externalId:    str(v.GUID),
    alterationId:  str(v.ALTERID),
    voucherType:   str(v.VOUCHERTYPENAME),
    voucherNumber: str(v.VOUCHERNUMBER),
    date:          parseTallyDate(str(v.DATE)),
    effectiveDate: parseTallyDate(str(v.EFFECTIVEDATE)),
    narration:     str(v.NARRATION),
    partyName:     str(v.PARTYLEDGERNAME) ?? str(v.PARTYNAME),
    placeOfSupply: str(v.PLACEOFSUPPLY),
    isOptional:    str(v.ISOPTIONAL) === "Yes",
    isInvoice:     str(v.ISINVOICE) === "Yes",
    remoteId:      str(v.REMOTEID),
    voucherKey:    str(v.VOUCHERKEY),
    ledgerEntries: allLedgerEntries,
    bankAllocations: bankAllocs,
  };
}

/**
 * Parse the response to buildVoucherExportXml().
 * @param {string} xml
 * @returns {object[]} array of normalised voucher objects
 */
export function parseVoucherExport(xml) {
  const root = parseTallyXml(xml);
  const collection = deepGet(root, "ENVELOPE.BODY.DATA.COLLECTION") ?? {};
  const vouchers = [].concat(collection?.VOUCHER ?? []).filter(Boolean);
  return vouchers.map(normaliseVoucher);
}

// ─── Voucher Import Response Parsing ─────────────────────────────────────────

/**
 * Parse Tally's response to a voucher import (TALLYMESSAGE response).
 *
 * @param {string} xml
 * @returns {{ created: number, altered: number, deleted: number, errorCount: number, errors: {msg: string, key: string|null}[] }}
 */
export function parseVoucherImportResponse(xml) {
  const root = parseTallyXml(xml);
  const envelope = root?.ENVELOPE ?? root;

  // Tally returns a LINEERROR or CREATED/ALTERED counters in BODY > DATA > IMPORTRESULT
  const importResult = deepGet(envelope, "BODY.DATA.IMPORTRESULT");

  if (importResult) {
    const created = num(importResult.CREATED);
    const altered = num(importResult.ALTERED);
    const deleted = num(importResult.DELETED);
    const errorCount = num(importResult.ERRORS)
      + num(importResult.EXCEPTIONS)
      + num(importResult.CANCELLED);

    const lineErrors = [].concat(importResult["LINEREFERENCE.LIST"] ?? [])
      .filter(Boolean)
      .map(r => ({
        msg: str(r.LINEERROR) ?? str(r.ERRORMSG) ?? "Unknown error",
        key: str(r.LINEKEY) ?? null,
      }));

    const directError = str(importResult.LINEERROR)
      || str(deepGet(envelope, "BODY.DATA.LINEERROR"));
    if (directError && !lineErrors.some(error => error.msg === directError)) {
      lineErrors.push({ msg: directError, key: null });
    }
    if (errorCount > 0 && lineErrors.length === 0) {
      lineErrors.push({
        msg: `Tally reported ${errorCount} import error(s)`,
        key: null,
      });
    }

    return { created, altered, deleted, errorCount, errors: lineErrors };
  }

  // Fallback: look for RESPONSE element (older Tally versions)
  const response = deepGet(envelope, "BODY.DATA.RESPONSE") ?? deepGet(envelope, "RESPONSE");
  if (response) {
    const statusStr = str(response.STATUS) ?? "";
    if (statusStr === "1") {
      return { created: 1, altered: 0, deleted: 0, errorCount: 0, errors: [] };
    }
    const errMsg = str(response.DESC) ?? str(response.LINEERROR) ?? "Unknown import error";
    return {
      created: 0,
      altered: 0,
      deleted: 0,
      errorCount: 1,
      errors: [{ msg: errMsg, key: null }],
    };
  }

  return {
    created: 0,
    altered: 0,
    deleted: 0,
    errorCount: 1,
    errors: [{ msg: "No recognizable import result in response", key: null }],
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Safely traverse a dot-separated path in a nested object.
 */
function deepGet(obj, path) {
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}
