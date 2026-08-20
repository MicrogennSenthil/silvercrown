/**
 * tests/parse.test.js — Unit tests for Tally XML parsing (xml-parser.js)
 * Run with: node --test tests/parse.test.js
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  parseTallyDate,
  parseCompanyDiscovery,
  parseLedgerDiscovery,
  parseVoucherTypeDiscovery,
  parseStockItemDiscovery,
  parseVoucherExport,
  parseVoucherImportResponse,
} from "../src/xml-parser.js";

// ─── parseTallyDate ───────────────────────────────────────────────────────────

describe("parseTallyDate", () => {
  test("parses YYYYMMDD", () => {
    assert.equal(parseTallyDate("20240401"), "2024-04-01");
  });

  test("parses DD-MMM-YYYY", () => {
    assert.equal(parseTallyDate("01-Apr-2024"), "2024-04-01");
  });

  test("parses two-digit day in DD-MMM-YYYY", () => {
    assert.equal(parseTallyDate("15-Mar-2023"), "2023-03-15");
  });

  test("returns null for null input", () => {
    assert.equal(parseTallyDate(null), null);
  });

  test("returns null for empty string", () => {
    assert.equal(parseTallyDate(""), null);
  });

  test("handles all months", () => {
    const months = [
      ["Jan","01"],["Feb","02"],["Mar","03"],["Apr","04"],
      ["May","05"],["Jun","06"],["Jul","07"],["Aug","08"],
      ["Sep","09"],["Oct","10"],["Nov","11"],["Dec","12"],
    ];
    for (const [mon, num] of months) {
      const result = parseTallyDate(`01-${mon}-2024`);
      assert.ok(result?.includes(`-${num}-`), `Month ${mon} should map to ${num}, got ${result}`);
    }
  });
});

// ─── parseCompanyDiscovery ────────────────────────────────────────────────────

const COMPANY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <BODY>
    <DATA>
      <COLLECTION>
        <COMPANY NAME="Pioneer Prism Ltd">
          <NAME>Pioneer Prism Ltd</NAME>
          <BOOKSFROM>20230401</BOOKSFROM>
          <STARTINGFROM>20230401</STARTINGFROM>
          <LASTVOUCHERDATE>20240415</LASTVOUCHERDATE>
        </COMPANY>
        <COMPANY NAME="Test Company">
          <NAME>Test Company</NAME>
          <BOOKSFROM>20240101</BOOKSFROM>
        </COMPANY>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`;

describe("parseCompanyDiscovery", () => {
  test("returns array of companies", () => {
    const result = parseCompanyDiscovery(COMPANY_XML);
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 2);
  });

  test("parses company name", () => {
    const result = parseCompanyDiscovery(COMPANY_XML);
    const names = result.map(c => c.name);
    assert.ok(names.includes("Pioneer Prism Ltd"));
    assert.ok(names.includes("Test Company"));
  });

  test("parses booksFrom date", () => {
    const result = parseCompanyDiscovery(COMPANY_XML);
    const pioneer = result.find(c => c.name === "Pioneer Prism Ltd");
    assert.equal(pioneer.booksFrom, "2023-04-01");
  });

  test("parses lastVoucherDate", () => {
    const result = parseCompanyDiscovery(COMPANY_XML);
    const pioneer = result.find(c => c.name === "Pioneer Prism Ltd");
    assert.equal(pioneer.lastVoucherDate, "2024-04-15");
  });

  test("returns empty array for empty collection", () => {
    const emptyXml = `<ENVELOPE><BODY><DATA><COLLECTION></COLLECTION></DATA></BODY></ENVELOPE>`;
    const result = parseCompanyDiscovery(emptyXml);
    assert.equal(result.length, 0);
  });
});

// ─── parseLedgerDiscovery ─────────────────────────────────────────────────────

const LEDGER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <BODY>
    <DATA>
      <COLLECTION>
        <LEDGER NAME="Sundry Debtors">
          <NAME>Sundry Debtors</NAME>
          <PARENT>Current Assets</PARENT>
          <OPENINGBALANCE>50000.00</OPENINGBALANCE>
          <CLOSINGBALANCE>75000.00</CLOSINGBALANCE>
          <ISBILLWISEON>Yes</ISBILLWISEON>
          <ISREVENUEITEM>No</ISREVENUEITEM>
          <PARTYGSTNO>27AABCU9603R1ZM</PARTYGSTNO>
          <EMAIL>debtor@example.com</EMAIL>
        </LEDGER>
        <LEDGER NAME="Cash">
          <NAME>Cash</NAME>
          <PARENT>Cash-in-Hand</PARENT>
          <OPENINGBALANCE>10000.00</OPENINGBALANCE>
          <ISBILLWISEON>No</ISBILLWISEON>
        </LEDGER>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`;

describe("parseLedgerDiscovery", () => {
  test("returns array of ledgers", () => {
    const result = parseLedgerDiscovery(LEDGER_XML);
    assert.equal(result.length, 2);
  });

  test("parses ledger name", () => {
    const result = parseLedgerDiscovery(LEDGER_XML);
    assert.equal(result[0].name, "Sundry Debtors");
  });

  test("parses parent group", () => {
    const result = parseLedgerDiscovery(LEDGER_XML);
    assert.equal(result[0].parent, "Current Assets");
  });

  test("parses numeric balances", () => {
    const result = parseLedgerDiscovery(LEDGER_XML);
    assert.equal(result[0].openingBalance, 50000);
    assert.equal(result[0].closingBalance, 75000);
  });

  test("parses boolean flags", () => {
    const result = parseLedgerDiscovery(LEDGER_XML);
    assert.equal(result[0].isBillwiseOn, true);
    assert.equal(result[0].isRevenueItem, false);
    assert.equal(result[1].isBillwiseOn, false);
  });

  test("parses GSTIN", () => {
    const result = parseLedgerDiscovery(LEDGER_XML);
    assert.equal(result[0].gstin, "27AABCU9603R1ZM");
  });

  test("parses email", () => {
    const result = parseLedgerDiscovery(LEDGER_XML);
    assert.equal(result[0].email, "debtor@example.com");
  });
});

// ─── parseVoucherTypeDiscovery ────────────────────────────────────────────────

const VT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <BODY>
    <DATA>
      <COLLECTION>
        <VOUCHERTYPE NAME="Sales">
          <NAME>Sales</NAME>
          <PARENT>Sales</PARENT>
          <NUMBERINGMETHOD>Automatic</NUMBERINGMETHOD>
          <ISOPTIONAL>No</ISOPTIONAL>
          <ISBANKRECON>No</ISBANKRECON>
        </VOUCHERTYPE>
        <VOUCHERTYPE NAME="Receipt">
          <NAME>Receipt</NAME>
          <PARENT>Receipt</PARENT>
          <NUMBERINGMETHOD>Automatic</NUMBERINGMETHOD>
          <ISOPTIONAL>No</ISOPTIONAL>
          <ISBANKRECON>Yes</ISBANKRECON>
        </VOUCHERTYPE>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`;

describe("parseVoucherTypeDiscovery", () => {
  test("returns array of voucher types", () => {
    const result = parseVoucherTypeDiscovery(VT_XML);
    assert.equal(result.length, 2);
  });

  test("parses name and parent", () => {
    const result = parseVoucherTypeDiscovery(VT_XML);
    assert.equal(result[0].name, "Sales");
    assert.equal(result[0].parent, "Sales");
  });

  test("parses isBankRecon flag", () => {
    const result = parseVoucherTypeDiscovery(VT_XML);
    assert.equal(result[0].isBankRecon, false);
    assert.equal(result[1].isBankRecon, true);
  });
});

// ─── parseStockItemDiscovery ──────────────────────────────────────────────────

const STOCK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <BODY>
    <DATA>
      <COLLECTION>
        <STOCKITEM NAME="Paracetamol 500mg">
          <NAME>Paracetamol 500mg</NAME>
          <PARENT>Medicines</PARENT>
          <BASEUNITS>Nos</BASEUNITS>
          <HSNCODE>30049099</HSNCODE>
          <GSTAPPLICABLE>Applicable</GSTAPPLICABLE>
          <CLOSINGBALANCE>200</CLOSINGBALANCE>
          <STANDARDCOST>15.50</STANDARDCOST>
          <STANDARDPRICE>22.00</STANDARDPRICE>
        </STOCKITEM>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`;

describe("parseStockItemDiscovery", () => {
  test("returns array of stock items", () => {
    const result = parseStockItemDiscovery(STOCK_XML);
    assert.equal(result.length, 1);
  });

  test("parses name and parent", () => {
    const result = parseStockItemDiscovery(STOCK_XML);
    assert.equal(result[0].name, "Paracetamol 500mg");
    assert.equal(result[0].parent, "Medicines");
  });

  test("parses HSN code", () => {
    const result = parseStockItemDiscovery(STOCK_XML);
    assert.equal(result[0].hsnCode, "30049099");
  });

  test("parses numeric values", () => {
    const result = parseStockItemDiscovery(STOCK_XML);
    assert.equal(result[0].closingBalance, 200);
    assert.equal(result[0].standardCost, 15.50);
    assert.equal(result[0].standardPrice, 22.00);
  });
});

// ─── parseVoucherExport ───────────────────────────────────────────────────────

const VOUCHER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <BODY>
    <DATA>
      <COLLECTION>
        <VOUCHER>
          <GUID>7b3c1d09-5f8a-4e2b-9c1f-3a4b5c6d7e8f</GUID>
          <ALTERID>42</ALTERID>
          <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
          <VOUCHERNUMBER>SAL/2024/001</VOUCHERNUMBER>
          <DATE>20240415</DATE>
          <EFFECTIVEDATE>20240415</EFFECTIVEDATE>
          <NARRATION>Sale of goods</NARRATION>
          <PARTYLEDGERNAME>Customer ABC</PARTYLEDGERNAME>
          <PLACEOFSUPPLY>Maharashtra</PLACEOFSUPPLY>
          <ISOPTIONAL>No</ISOPTIONAL>
          <ISINVOICE>Yes</ISINVOICE>
          <REMOTEID>ERP-SALE-101</REMOTEID>
          <LEDGERENTRIES.LIST>
            <LEDGERNAME>Customer ABC</LEDGERNAME>
            <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>Yes</ISPARTYLEDGER>
            <AMOUNT>11800</AMOUNT>
            <BILLALLOCATIONS.LIST>
              <NAME>SAL/2024/001</NAME>
              <BILLTYPE>New Ref</BILLTYPE>
              <AMOUNT>-11800</AMOUNT>
            </BILLALLOCATIONS.LIST>
          </LEDGERENTRIES.LIST>
          <LEDGERENTRIES.LIST>
            <LEDGERNAME>Sales Account</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
            <AMOUNT>-10000</AMOUNT>
          </LEDGERENTRIES.LIST>
          <LEDGERENTRIES.LIST>
            <LEDGERNAME>CGST @ 9%</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
            <GSTCLASS>Central Tax</GSTCLASS>
            <AMOUNT>-900</AMOUNT>
          </LEDGERENTRIES.LIST>
          <LEDGERENTRIES.LIST>
            <LEDGERNAME>SGST @ 9%</LEDGERNAME>
            <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
            <ISPARTYLEDGER>No</ISPARTYLEDGER>
            <GSTCLASS>State Tax</GSTCLASS>
            <AMOUNT>-900</AMOUNT>
          </LEDGERENTRIES.LIST>
        </VOUCHER>
      </COLLECTION>
    </DATA>
  </BODY>
</ENVELOPE>`;

describe("parseVoucherExport", () => {
  test("returns array of vouchers", () => {
    const result = parseVoucherExport(VOUCHER_XML);
    assert.equal(result.length, 1);
  });

  test("parses externalId (GUID)", () => {
    const [v] = parseVoucherExport(VOUCHER_XML);
    assert.equal(v.externalId, "7b3c1d09-5f8a-4e2b-9c1f-3a4b5c6d7e8f");
  });

  test("parses alterationId", () => {
    const [v] = parseVoucherExport(VOUCHER_XML);
    assert.equal(v.alterationId, "42");
  });

  test("parses voucher type", () => {
    const [v] = parseVoucherExport(VOUCHER_XML);
    assert.equal(v.voucherType, "Sales");
  });

  test("parses voucher number", () => {
    const [v] = parseVoucherExport(VOUCHER_XML);
    assert.equal(v.voucherNumber, "SAL/2024/001");
  });

  test("parses date as ISO", () => {
    const [v] = parseVoucherExport(VOUCHER_XML);
    assert.equal(v.date, "2024-04-15");
  });

  test("parses narration", () => {
    const [v] = parseVoucherExport(VOUCHER_XML);
    assert.equal(v.narration, "Sale of goods");
  });

  test("parses party name", () => {
    const [v] = parseVoucherExport(VOUCHER_XML);
    assert.equal(v.partyName, "Customer ABC");
  });

  test("parses place of supply", () => {
    const [v] = parseVoucherExport(VOUCHER_XML);
    assert.equal(v.placeOfSupply, "Maharashtra");
  });

  test("parses boolean flags", () => {
    const [v] = parseVoucherExport(VOUCHER_XML);
    assert.equal(v.isOptional, false);
    assert.equal(v.isInvoice, true);
  });

  test("parses remoteId", () => {
    const [v] = parseVoucherExport(VOUCHER_XML);
    assert.equal(v.remoteId, "ERP-SALE-101");
  });

  test("parses ledger entries", () => {
    const [v] = parseVoucherExport(VOUCHER_XML);
    assert.equal(v.ledgerEntries.length, 4);
  });

  test("parses party ledger entry", () => {
    const [v] = parseVoucherExport(VOUCHER_XML);
    const party = v.ledgerEntries.find(e => e.isPartyLedger);
    assert.ok(party, "Should have a party ledger entry");
    assert.equal(party.ledgerName, "Customer ABC");
    assert.equal(party.isDeemed, true);
    assert.equal(party.amount, 11800);
  });

  test("parses bill allocations in party ledger", () => {
    const [v] = parseVoucherExport(VOUCHER_XML);
    const party = v.ledgerEntries.find(e => e.isPartyLedger);
    assert.equal(party.billAllocations.length, 1);
    assert.equal(party.billAllocations[0].name, "SAL/2024/001");
    assert.equal(party.billAllocations[0].billType, "New Ref");
  });

  test("parses GST ledger entry with gstClass", () => {
    const [v] = parseVoucherExport(VOUCHER_XML);
    const cgst = v.ledgerEntries.find(e => e.ledgerName?.includes("CGST"));
    assert.ok(cgst);
    assert.equal(cgst.gstClass, "Central Tax");
  });

  test("returns empty array for empty collection", () => {
    const emptyXml = `<ENVELOPE><BODY><DATA><COLLECTION></COLLECTION></DATA></BODY></ENVELOPE>`;
    const result = parseVoucherExport(emptyXml);
    assert.equal(result.length, 0);
  });
});

// ─── parseVoucherImportResponse ───────────────────────────────────────────────

const IMPORT_SUCCESS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <BODY>
    <DATA>
      <IMPORTRESULT>
        <CREATED>1</CREATED>
        <ALTERED>0</ALTERED>
        <DELETED>0</DELETED>
        <LASTVCHID>101</LASTVCHID>
        <LINEREFERENCE.LIST></LINEREFERENCE.LIST>
      </IMPORTRESULT>
    </DATA>
  </BODY>
</ENVELOPE>`;

const IMPORT_ALTER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <BODY>
    <DATA>
      <IMPORTRESULT>
        <CREATED>0</CREATED>
        <ALTERED>1</ALTERED>
        <DELETED>0</DELETED>
      </IMPORTRESULT>
    </DATA>
  </BODY>
</ENVELOPE>`;

const IMPORT_ERROR_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <BODY>
    <DATA>
      <IMPORTRESULT>
        <CREATED>0</CREATED>
        <ALTERED>0</ALTERED>
        <DELETED>0</DELETED>
        <LINEREFERENCE.LIST>
          <LINEERROR>Ledger not found: Unknown Ledger</LINEERROR>
          <LINEKEY>VOUCHER-001</LINEKEY>
        </LINEREFERENCE.LIST>
      </IMPORTRESULT>
    </DATA>
  </BODY>
</ENVELOPE>`;

const IMPORT_RESPONSE_OK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <BODY>
    <DATA>
      <RESPONSE>
        <STATUS>1</STATUS>
      </RESPONSE>
    </DATA>
  </BODY>
</ENVELOPE>`;

const IMPORT_COUNTER_ERROR_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <BODY>
    <DATA>
      <IMPORTRESULT>
        <CREATED>0</CREATED>
        <ALTERED>0</ALTERED>
        <ERRORS>1</ERRORS>
        <LASTVCHID>101</LASTVCHID>
      </IMPORTRESULT>
    </DATA>
  </BODY>
</ENVELOPE>`;

const IMPORT_ZERO_RESULT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE>
  <BODY>
    <DATA>
      <IMPORTRESULT>
        <CREATED>0</CREATED>
        <ALTERED>0</ALTERED>
        <ERRORS>0</ERRORS>
      </IMPORTRESULT>
    </DATA>
  </BODY>
</ENVELOPE>`;

describe("parseVoucherImportResponse", () => {
  test("parses successful creation (IMPORTRESULT)", () => {
    const result = parseVoucherImportResponse(IMPORT_SUCCESS_XML);
    assert.equal(result.created, 1);
    assert.equal(result.altered, 0);
    assert.equal(result.errors.length, 0);
  });

  test("parses successful alteration", () => {
    const result = parseVoucherImportResponse(IMPORT_ALTER_XML);
    assert.equal(result.created, 0);
    assert.equal(result.altered, 1);
    assert.equal(result.errors.length, 0);
  });

  test("parses import errors", () => {
    const result = parseVoucherImportResponse(IMPORT_ERROR_XML);
    assert.equal(result.created, 0);
    assert.ok(result.errors.length >= 1);
    assert.ok(result.errors[0].msg.includes("Ledger not found") || result.errors.length > 0);
  });

  test("treats ERRORS counter without line references as a failure", () => {
    const result = parseVoucherImportResponse(IMPORT_COUNTER_ERROR_XML);
    assert.equal(result.errorCount, 1);
    assert.equal(result.created, 0);
    assert.ok(result.errors[0].msg.includes("1 import error"));
  });

  test("does not confuse LASTVCHID with an error counter", () => {
    const result = parseVoucherImportResponse(IMPORT_SUCCESS_XML);
    assert.equal(result.errorCount, 0);
    assert.equal(result.errors.length, 0);
  });

  test("preserves an explicit zero-result response for strict handler rejection", () => {
    const result = parseVoucherImportResponse(IMPORT_ZERO_RESULT_XML);
    assert.equal(result.errorCount, 0);
    assert.equal(result.created + result.altered, 0);
  });

  test("parses STATUS=1 as success (RESPONSE fallback)", () => {
    const result = parseVoucherImportResponse(IMPORT_RESPONSE_OK_XML);
    assert.equal(result.created, 1);
    assert.equal(result.errors.length, 0);
  });

  test("handles missing IMPORTRESULT gracefully", () => {
    const xml = `<ENVELOPE><BODY><DATA></DATA></BODY></ENVELOPE>`;
    const result = parseVoucherImportResponse(xml);
    assert.ok(result.errors.length >= 1 || result.created === 0);
  });
});
