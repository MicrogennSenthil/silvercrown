/**
 * tests/xml.test.js — Unit tests for XML generation (xml-builder.js)
 * Run with: node --test tests/xml.test.js
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  escapeXml,
  toTallyDate,
  buildCompanyDiscoveryXml,
  buildLedgerDiscoveryXml,
  buildVoucherTypeDiscoveryXml,
  buildStockItemDiscoveryXml,
  buildVoucherExportXml,
  buildVoucherImportXml,
} from "../src/xml-builder.js";

// ─── escapeXml ────────────────────────────────────────────────────────────────

describe("escapeXml", () => {
  test("escapes ampersand", () => {
    assert.equal(escapeXml("A & B"), "A &amp; B");
  });

  test("escapes less-than", () => {
    assert.equal(escapeXml("a < b"), "a &lt; b");
  });

  test("escapes greater-than", () => {
    assert.equal(escapeXml("a > b"), "a &gt; b");
  });

  test("escapes double-quote", () => {
    assert.equal(escapeXml('say "hello"'), "say &quot;hello&quot;");
  });

  test("escapes single-quote", () => {
    assert.equal(escapeXml("it's"), "it&apos;s");
  });

  test("handles null/undefined gracefully", () => {
    assert.equal(escapeXml(null),      "");
    assert.equal(escapeXml(undefined), "");
  });

  test("leaves safe strings unchanged", () => {
    assert.equal(escapeXml("Pioneer Prism Ltd"), "Pioneer Prism Ltd");
  });

  test("escapes all special chars in one string", () => {
    const result = escapeXml(`<tag attr="val" x='y' a&b>`);
    assert.ok(!result.includes("<"),  "should not contain raw <");
    assert.ok(!result.includes(">"),  "should not contain raw >");
    assert.ok(!result.includes('"'),  "should not contain raw double-quote");
    assert.ok(!result.includes("'"),  "should not contain raw single-quote");
    // Raw ampersand followed by a letter (unescaped) should not appear
    assert.ok(!/&(?!amp;|lt;|gt;|quot;|apos;)/.test(result),
      "should not contain unescaped & (only &amp; etc. are allowed)");
    assert.ok(result.includes("&amp;"), "should contain &amp;");
  });
});

// ─── toTallyDate ─────────────────────────────────────────────────────────────

describe("toTallyDate", () => {
  test("converts ISO date string", () => {
    assert.equal(toTallyDate("2024-04-01"), "20240401");
  });

  test("converts JS Date object", () => {
    assert.equal(toTallyDate(new Date("2024-03-31T00:00:00Z")), "20240331");
  });

  test("throws on invalid input", () => {
    assert.throws(() => toTallyDate("not-a-date"), TypeError);
  });

  test("pads month and day", () => {
    assert.equal(toTallyDate("2024-01-05"), "20240105");
  });
});

// ─── buildCompanyDiscoveryXml ─────────────────────────────────────────────────

describe("buildCompanyDiscoveryXml", () => {
  test("returns valid XML string", () => {
    const xml = buildCompanyDiscoveryXml();
    assert.ok(typeof xml === "string");
    assert.ok(xml.includes("<?xml"));
    assert.ok(xml.includes("<ENVELOPE>"));
    assert.ok(xml.includes("</ENVELOPE>"));
  });

  test("requests Export type", () => {
    const xml = buildCompanyDiscoveryXml();
    assert.ok(xml.includes("Export"));
  });

  test("requests Company collection", () => {
    const xml = buildCompanyDiscoveryXml();
    assert.ok(xml.includes("Company") || xml.includes("COMPANY"));
  });
});

// ─── buildLedgerDiscoveryXml ──────────────────────────────────────────────────

describe("buildLedgerDiscoveryXml", () => {
  test("includes company name when provided", () => {
    const xml = buildLedgerDiscoveryXml("My Test Company");
    assert.ok(xml.includes("My Test Company"));
    assert.ok(xml.includes("SVCURRENTCOMPANY"));
  });

  test("escapes special chars in company name", () => {
    const xml = buildLedgerDiscoveryXml("Company & Sons <Ltd>");
    assert.ok(!xml.includes("& Sons"));
    assert.ok(xml.includes("&amp; Sons"));
    assert.ok(xml.includes("&lt;Ltd&gt;"));
  });

  test("omits SVCURRENTCOMPANY when company is null", () => {
    const xml = buildLedgerDiscoveryXml(null);
    assert.ok(!xml.includes("SVCURRENTCOMPANY"));
  });

  test("fetches Ledger type", () => {
    const xml = buildLedgerDiscoveryXml(null);
    assert.ok(xml.includes("Ledger") || xml.includes("LEDGER"));
  });
});

// ─── buildVoucherTypeDiscoveryXml ─────────────────────────────────────────────

describe("buildVoucherTypeDiscoveryXml", () => {
  test("includes VoucherType in collection", () => {
    const xml = buildVoucherTypeDiscoveryXml(null);
    assert.ok(xml.includes("VoucherType") || xml.includes("VOUCHERTYPE"));
  });
});

// ─── buildStockItemDiscoveryXml ───────────────────────────────────────────────

describe("buildStockItemDiscoveryXml", () => {
  test("includes StockItem in collection", () => {
    const xml = buildStockItemDiscoveryXml(null);
    assert.ok(xml.includes("StockItem") || xml.includes("STOCKITEM"));
  });
});

// ─── buildVoucherExportXml ────────────────────────────────────────────────────

describe("buildVoucherExportXml", () => {
  test("includes from and to dates", () => {
    const xml = buildVoucherExportXml({
      fromDate: "2024-04-01",
      toDate:   "2024-04-30",
      company:  null,
    });
    assert.ok(xml.includes("20240401"));
    assert.ok(xml.includes("20240430"));
  });

  test("includes SVFROMDATE and SVTODATE tags", () => {
    const xml = buildVoucherExportXml({
      fromDate: "2024-04-01",
      toDate:   "2024-04-30",
      company:  null,
    });
    assert.ok(xml.includes("SVFROMDATE"));
    assert.ok(xml.includes("SVTODATE"));
  });

  test("includes company name", () => {
    const xml = buildVoucherExportXml({
      fromDate: "2024-04-01",
      toDate:   "2024-04-30",
      company:  "Test Co",
    });
    assert.ok(xml.includes("Test Co"));
    assert.ok(xml.includes("SVCURRENTCOMPANY"));
  });

  test("includes voucher type filter when provided", () => {
    const xml = buildVoucherExportXml({
      fromDate: "2024-04-01",
      toDate:   "2024-04-30",
      company:  null,
      voucherTypes: ["Sales", "Credit Note"],
    });
    assert.ok(xml.includes("Sales") || xml.includes("VoucherTypeFilter"));
  });

  test("does not include filter block when voucherTypes is empty", () => {
    const xml = buildVoucherExportXml({
      fromDate: "2024-04-01",
      toDate:   "2024-04-30",
      company:  null,
      voucherTypes: [],
    });
    assert.ok(!xml.includes("VoucherTypeFilter"));
  });
});

// ─── buildVoucherImportXml ────────────────────────────────────────────────────

describe("buildVoucherImportXml", () => {
  const sampleVoucher = {
    voucherType:   "Purchase",
    voucherNumber: "PUR/001",
    date:          "2024-04-15",
    company:       "Test Co",
    narration:     "Test purchase & supplies",
    partyLedger:   "Supplier <XYZ>",
    remoteId:      "ERP-JOB-001",
    ledgerEntries: [
      { ledgerName: "Supplier <XYZ>", amount: -10000, isParty: true,
        billAllocations: [{ name: "PUR/001", billType: "New Ref", amount: 10000 }] },
      { ledgerName: "Purchase Account", amount: 10000 },
    ],
  };

  test("produces valid XML string", () => {
    const xml = buildVoucherImportXml(sampleVoucher);
    assert.ok(typeof xml === "string");
    assert.ok(xml.includes("<?xml"));
    assert.ok(xml.includes("ENVELOPE"));
  });

  test("escapes HTML special chars in narration", () => {
    const xml = buildVoucherImportXml(sampleVoucher);
    // narration has &
    assert.ok(xml.includes("&amp;"));
  });

  test("escapes special chars in ledger name", () => {
    const xml = buildVoucherImportXml(sampleVoucher);
    assert.ok(xml.includes("&lt;XYZ&gt;") || xml.includes("&lt;"));
  });

  test("includes remoteId for idempotency", () => {
    const xml = buildVoucherImportXml(sampleVoucher);
    assert.ok(xml.includes("ERP-JOB-001"));
    assert.ok(xml.includes("REMOTEID"));
  });

  test("uses CREATE action when no guid", () => {
    const xml = buildVoucherImportXml(sampleVoucher);
    assert.ok(xml.includes('ACTION="Create"'));
  });

  test("uses Alter action when guid provided", () => {
    const xml = buildVoucherImportXml({ ...sampleVoucher, guid: "existing-guid-123" });
    assert.ok(xml.includes('ACTION="Alter"'));
    assert.ok(xml.includes("existing-guid-123"));
  });

  test("includes date in YYYYMMDD format", () => {
    const xml = buildVoucherImportXml(sampleVoucher);
    assert.ok(xml.includes("20240415"));
  });

  test("includes voucher type name", () => {
    const xml = buildVoucherImportXml(sampleVoucher);
    assert.ok(xml.includes("Purchase"));
  });

  test("includes bill allocations", () => {
    const xml = buildVoucherImportXml(sampleVoucher);
    assert.ok(xml.includes("BILLALLOCATIONS.LIST"));
    assert.ok(xml.includes("New Ref"));
  });

  test("works with minimal voucher (no company, no narration, no bill alloc)", () => {
    const minVoucher = {
      voucherType:   "Journal",
      voucherNumber: "JNL/001",
      date:          "2024-04-01",
      ledgerEntries: [
        { ledgerName: "Cash", amount: 500 },
        { ledgerName: "Sales", amount: -500 },
      ],
    };
    const xml = buildVoucherImportXml(minVoucher);
    assert.ok(xml.includes("Journal"));
    assert.ok(xml.includes("JNL/001"));
    assert.ok(!xml.includes("SVCURRENTCOMPANY"));
  });
});
