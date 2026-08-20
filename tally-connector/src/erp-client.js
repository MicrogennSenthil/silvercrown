/**
 * erp-client.js — Authenticated HTTPS client for the ERP server.
 *
 * All communication uses HTTPS (enforced by config.js, http://localhost allowed for dev).
 * The Bearer token is read from config and NEVER logged.
 *
 * Server contracts:
 *   POST /api/tally/connector/heartbeat
 *   GET  /api/tally/connector/jobs?limit=N
 *   POST /api/tally/connector/jobs/:id/complete   body: { result }
 *   POST /api/tally/connector/import              body: { jobId, vouchers }
 */

import https from "node:https";
import http  from "node:http";
import { logger } from "./logger.js";

/**
 * Make an authenticated JSON request to the ERP.
 * Token is sent in the Authorization header and NEVER written to logs.
 *
 * @param {object} opts
 * @param {string} opts.baseUrl   — ERP base URL (no trailing slash)
 * @param {string} opts.token     — Bearer token (not logged)
 * @param {string} opts.method    — HTTP method
 * @param {string} opts.path      — URL path starting with /
 * @param {object} [opts.body]    — JSON body (for POST)
 * @param {number} [opts.timeoutMs=20000]
 * @returns {Promise<{ status: number, body: any }>}
 */
export function erpRequest({ baseUrl, token, method, path, body, timeoutMs = 20000 }) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const isHttps = url.protocol === "https:";
    const transport = isHttps ? https : http;

    const bodyStr  = body != null ? JSON.stringify(body) : null;
    const bodyBuf  = bodyStr ? Buffer.from(bodyStr, "utf8") : null;

    const headers = {
      "Authorization": `Bearer ${token}`,   // token only in header, never in logs
      "Accept":        "application/json",
      "Content-Type":  "application/json",
    };
    if (bodyBuf) headers["Content-Length"] = bodyBuf.byteLength;

    const options = {
      hostname: url.hostname,
      port:     url.port || (isHttps ? 443 : 80),
      path:     url.pathname + url.search,
      method:   method.toUpperCase(),
      headers,
    };

    const req = transport.request(options, (res) => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString("utf8");
        let parsed;
        try { parsed = JSON.parse(raw); } catch { parsed = raw; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(Object.assign(new Error("ERP request timeout"), { code: "ERP_TIMEOUT" }));
    });

    req.on("error", err => {
      if (!err.code) err.code = "ERP_CONNECT_ERROR";
      reject(err);
    });

    if (bodyBuf) req.write(bodyBuf);
    req.end();
  });
}

// ─── Endpoint wrappers ────────────────────────────────────────────────────────

/**
 * POST /api/tally/connector/heartbeat
 *
 * Sends connector alive signal plus Tally health status.
 * tallyStatus: "ok" | "offline" | "error"
 * companies:   array from company discovery (may be empty)
 */
export async function sendHeartbeat({
  baseUrl,
  token,
  connectorId,
  tallyHost,
  tallyPort,
  tallyCompany,
  tallyStatus,
  tallyError,
  companies,
  version,
}) {
  // Build payload — never include the token in it
  const body = {
    connectorId,
    tallyHost,
    tallyPort,
    tallyCompany:    tallyCompany ?? null,
    tallyStatus:     tallyStatus  ?? "unknown",
    tallyError:      tallyError   ?? null,
    companies:       Array.isArray(companies) ? companies : [],
    version,
    ts: new Date().toISOString(),
  };

  const res = await erpRequest({
    baseUrl, token, method: "POST",
    path: "/api/tally/connector/heartbeat",
    body,
  });

  if (res.status >= 400) {
    // Log status only — no token, no body content that could carry secrets
    logger.warn(`[erp-client] Heartbeat returned HTTP ${res.status}`);
  }
  return res;
}

/**
 * GET /api/tally/connector/jobs?limit=N
 *
 * Returns array of job objects:
 *   { id, type, params, idempotencyKey, kind, connectorConfig }
 */
export async function fetchJobs({ baseUrl, token, instanceId = "connector", limit = 10 }) {
  const res = await erpRequest({
    baseUrl, token, method: "GET",
    path: `/api/tally/connector/jobs?limit=${limit}&instanceId=${encodeURIComponent(instanceId)}`,
  });
  if (res.status !== 200) {
    throw Object.assign(
      new Error(`ERP job poll returned HTTP ${res.status}`),
      { code: "ERP_JOBS_ERROR", status: res.status, body: res.body }
    );
  }
  // Accept { jobs: [...] } or bare array
  const jobs = Array.isArray(res.body) ? res.body : (res.body?.jobs ?? []);
  return jobs;
}

/**
 * POST /api/tally/connector/jobs/:id/complete
 *
 * Exact contract: body = { result }
 * result is the handler return value (serialisable plain object).
 * Voucher payloads are NOT included here — they go via importToErp separately.
 */
export async function completeJob({ baseUrl, token, instanceId = "connector", jobId, result }) {
  const res = await erpRequest({
    baseUrl, token, method: "POST",
    path: `/api/tally/connector/jobs/${encodeURIComponent(jobId)}/complete?instanceId=${encodeURIComponent(instanceId)}`,
    body: { result },
  });
  if (res.status >= 400) {
    logger.warn(`[erp-client] completeJob ${jobId} returned HTTP ${res.status}`);
  }
  return res;
}

/**
 * POST /api/tally/connector/import
 *
 * Sends Tally-extracted vouchers to the ERP for upsert.
 * Body: { jobId, vouchers }
 *
 * @param {object} opts
 * @param {string} opts.baseUrl
 * @param {string} opts.token
 * @param {string} opts.jobId      — server job ID for correlation
 * @param {object[]} opts.vouchers — normalised voucher array
 * @returns {Promise<{ status: number, body: any }>}
 */
export async function importToErp({ baseUrl, token, jobId, vouchers }) {
  // Log only counts — never log voucher payload contents (may contain party names, amounts)
  logger.debug(`[erp-client] import: jobId=${jobId} vouchers=${vouchers.length}`);

  const res = await erpRequest({
    baseUrl, token, method: "POST",
    path: "/api/tally/connector/import",
    body: { jobId, vouchers },
  });
  if (res.status >= 400) {
    logger.warn(`[erp-client] import returned HTTP ${res.status} for jobId=${jobId}`);
  }
  return res;
}
