/**
 * scripts/setup-check.js — Pre-flight check for the Tally Connector.
 * Run with: npm run setup
 *
 * Checks:
 *   1. Node.js version >= 20
 *   2. fast-xml-parser installed
 *   3. .env or connector-config.json exists
 *   4. Required environment vars are set
 */

import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT  = resolve(__dir, "..");

let passed = 0;
let failed = 0;

function check(label, ok, hint = "") {
  if (ok) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}${hint ? " — " + hint : ""}`);
    failed++;
  }
}

console.log("\n🔍  Tally Connector — Setup Check\n");

// 1. Node version
const [major] = process.versions.node.split(".").map(Number);
check(`Node.js v${process.versions.node} (need >=20)`, major >= 20, "Install Node.js 20+ from https://nodejs.org");

// 2. fast-xml-parser
let fxpOk = false;
try {
  await import("fast-xml-parser");
  fxpOk = true;
} catch {}
check("fast-xml-parser installed", fxpOk, "Run: npm install");

// 3. Config file exists
const envExists  = existsSync(resolve(ROOT, ".env"));
const jsonExists = existsSync(resolve(ROOT, "connector-config.json"));
check(".env or connector-config.json present", envExists || jsonExists,
      "Copy .env.example to .env and fill in your values");

// 4. Load .env if present
if (envExists) {
  const { readFileSync } = await import("node:fs");
  const lines = readFileSync(resolve(ROOT, ".env"), "utf8").split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

// 5. Required env vars
check("ERP_BASE_URL set", !!process.env.ERP_BASE_URL,
      "Set ERP_BASE_URL in .env to your ERP server address");
check("ERP_CONNECTOR_TOKEN set", !!process.env.ERP_CONNECTOR_TOKEN,
      "Set ERP_CONNECTOR_TOKEN in .env — obtain from your ERP admin");
check("TALLY_HOST set (or defaults to localhost)", true); // always has default

// 6. HTTPS enforcement
if (process.env.ERP_BASE_URL) {
  const url = process.env.ERP_BASE_URL;
  const isHttps     = /^https:\/\//i.test(url);
  const isLocalhost = /^http:\/\/localhost(:\d+)?(\/|$)/i.test(url);
  check(
    "ERP_BASE_URL uses HTTPS (or localhost dev)",
    isHttps || isLocalhost,
    "Production ERP_BASE_URL must use https://"
  );
}

// Summary
console.log(`\n  ${passed} check(s) passed, ${failed} check(s) failed.\n`);

if (failed > 0) {
  console.error("  ⚠️   Fix the above issues before starting the connector.\n");
  process.exit(1);
} else {
  console.log("  🎉  All checks passed! Run `npm start` to start the connector.\n");
}
