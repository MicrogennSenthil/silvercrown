/**
 * config.js — Load and validate connector configuration.
 *
 * Priority order (highest → lowest):
 *   1. Environment variables
 *   2. connector-config.json in the same directory (gitignored, never committed)
 *   3. Hard defaults
 *
 * The token is always taken from the environment or connector-config.json;
 * it is NEVER hard-coded here.
 *
 * Per-job overrides: use makeTallyConfig(base, jobConnectorConfig) to build a
 * non-frozen shallow-merged config for a single job execution.  The frozen
 * base config is never mutated.  makeTallyConfig is also importable directly
 * from runtime-config.js (no side-effects, safe in tests).
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Re-export the pure helper so callers can use either import path
export { makeTallyConfig } from "./runtime-config.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = resolve(__dir, "..", "connector-config.json");

// Load optional local config file (gitignored)
let fileConfig = {};
if (existsSync(CONFIG_FILE)) {
  try {
    fileConfig = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
  } catch (err) {
    console.error("[config] Failed to parse connector-config.json:", err.message);
    process.exit(1);
  }
}

function get(envKey, fileKey, defaultValue) {
  const v = process.env[envKey] ?? fileConfig[fileKey ?? envKey] ?? defaultValue;
  return v === undefined ? undefined : String(v);
}

// ─── ERP (server-side) ───────────────────────────────────────────────────────

const erpBaseUrl = get("ERP_BASE_URL", "erpBaseUrl", "");
const erpToken   = get("ERP_CONNECTOR_TOKEN", "erpConnectorToken", "");

if (!erpBaseUrl) {
  console.error(
    "[config] ERP_BASE_URL is required. Set it in .env or connector-config.json."
  );
  process.exit(1);
}

// Enforce HTTPS except for localhost development
if (!/^https:\/\//i.test(erpBaseUrl)) {
  const isLocalhost = /^http:\/\/localhost(:\d+)?(\/|$)/i.test(erpBaseUrl);
  if (!isLocalhost) {
    console.error(
      "[config] ERP_BASE_URL must use HTTPS (http://localhost is allowed for local dev only). Got:",
      erpBaseUrl
    );
    process.exit(1);
  }
  console.warn(
    "[config] WARNING: ERP_BASE_URL uses plain HTTP. This is acceptable ONLY for localhost development."
  );
}

if (!erpToken) {
  console.error(
    "[config] ERP_CONNECTOR_TOKEN is required. Obtain it from the ERP admin and " +
    "store it in .env or connector-config.json — NEVER hard-code it."
  );
  process.exit(1);
}

// ─── Tally local endpoint (bootstrap/fallback) ───────────────────────────────

const tallyHost    = get("TALLY_HOST", "tallyHost", "localhost");
const tallyPort    = parseInt(get("TALLY_PORT", "tallyPort", "9000"), 10);
const tallyCompany = get("TALLY_COMPANY", "tallyCompany", "") || null; // null → first active company

// ─── Connector behaviour ─────────────────────────────────────────────────────

const pollIntervalMs      = parseInt(get("POLL_INTERVAL_MS",   "pollIntervalMs",   "30000"),  10);
const pollJobLimit        = parseInt(get("POLL_JOB_LIMIT",     "pollJobLimit",     "10"),     10);
const heartbeatIntervalMs = parseInt(get("HEARTBEAT_INTERVAL_MS", "heartbeatIntervalMs", "60000"), 10);
const backoffInitialMs    = parseInt(get("BACKOFF_INITIAL_MS", "backoffInitialMs", "5000"),   10);
const backoffMaxMs        = parseInt(get("BACKOFF_MAX_MS",     "backoffMaxMs",     "300000"), 10);

// ─── Logging ─────────────────────────────────────────────────────────────────

const LOG_LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const logLevelStr = (get("LOG_LEVEL", "logLevel", "info") || "info").toLowerCase();
const logLevel = LOG_LEVELS[logLevelStr] ?? LOG_LEVELS.info;

// ─── Exported frozen base config ─────────────────────────────────────────────

export const config = Object.freeze({
  erp: Object.freeze({
    baseUrl: erpBaseUrl.replace(/\/$/, ""), // strip trailing slash
    token:   erpToken,
    // token is intentionally NOT included in any logging paths
  }),
  tally: Object.freeze({
    host:    tallyHost,
    port:    tallyPort,
    company: tallyCompany,
    /** Full base URL for Tally HTTP server — connector sends requests here */
    get baseUrl() {
      return `http://${this.host}:${this.port}`;
    },
  }),
  poll: Object.freeze({
    intervalMs: pollIntervalMs,
    jobLimit:   pollJobLimit,
  }),
  heartbeat: Object.freeze({
    intervalMs: heartbeatIntervalMs,
  }),
  backoff: Object.freeze({
    initialMs: backoffInitialMs,
    maxMs:     backoffMaxMs,
  }),
  log: Object.freeze({
    level:    logLevel,
    levelStr: logLevelStr,
  }),
  version: "1.0.0",
  // connectorId resolved at runtime in index.js (hostname + port, no secrets)
  connectorId: get("CONNECTOR_ID", "connectorId", null) || null,
});

// makeTallyConfig is exported via the re-export at the top of this file
// (from ./runtime-config.js — pure function, no side-effects).
