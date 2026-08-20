/**
 * index.js — Tally Connector main entry point.
 *
 * Responsibilities:
 *  1. Load and validate config (env / connector-config.json).
 *  2. Send periodic heartbeats to ERP including Tally health status.
 *  3. Poll ERP for connector jobs on a single-instance loop.
 *  4. Build a per-job runtime config from job.connectorConfig (ERP-controlled
 *     tallyHost/tallyPort/company) merged over the frozen base config.
 *  5. Dispatch each job to the appropriate Tally XML handler.
 *  6. For Tally→ERP export jobs: POST vouchers to /api/tally/connector/import
 *     BEFORE marking the job complete; mark failed if import fails.
 *  7. Report job results back to ERP with idempotency (server job IDs).
 *  8. Graceful shutdown on SIGINT / SIGTERM.
 *
 * This process NEVER opens a listening socket.
 * It ONLY makes outbound calls: ERP (HTTPS) and Tally (localhost HTTP).
 * The Bearer token is never written to logs.
 */

// ─── Bootstrap: load .env before anything else ───────────────────────────────

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname }         from "node:path";
import { fileURLToPath }            from "node:url";
import { hostname as getHostname }  from "node:os";

const __dir = dirname(fileURLToPath(import.meta.url));

const dotenvPath = resolve(__dir, "..", ".env");
if (existsSync(dotenvPath)) {
  const lines = readFileSync(dotenvPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

// ─── Imports ──────────────────────────────────────────────────────────────────

import { config, makeTallyConfig }              from "./config.js";
import { initLogger, logger }                   from "./logger.js";
import { probeTally }                           from "./tally-client.js";
import { buildCompanyDiscoveryXml }             from "./xml-builder.js";
import { parseCompanyDiscovery }                from "./xml-parser.js";
import {
  sendHeartbeat,
  fetchJobs,
  completeJob,
  importToErp,
}                                               from "./erp-client.js";
import { dispatchJob, EXPORT_JOB_TYPES }        from "./job-handlers.js";

// ─── Init ─────────────────────────────────────────────────────────────────────

initLogger(config.log.level);

// Stable connector identifier: hostname + tally port (no secrets)
const connectorId = config.connectorId
  || `${getHostname()}-tally-${config.tally.port}`;

// Safe startup log — never log the token
logger.info(`[connector] Starting Tally Connector v${config.version}`);
logger.info(`[connector] Connector ID : ${connectorId}`);
logger.info(`[connector] ERP          : ${config.erp.baseUrl}`);
logger.info(`[connector] Tally default: ${config.tally.baseUrl}`);
logger.info(`[connector] Tally company: ${config.tally.company ?? "(first active)"}`);
logger.info(`[connector] Poll interval: ${config.poll.intervalMs}ms`);
logger.info(`[connector] Heartbeat    : ${config.heartbeat.intervalMs}ms`);

// ─── Graceful Shutdown ────────────────────────────────────────────────────────

const shutdownController = new AbortController();
const { signal: shutdownSignal } = shutdownController;

let isShuttingDown = false;

function shutdown(reason) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info(`[connector] Shutting down (${reason})…`);
  shutdownController.abort();
  // Give in-flight ops 5 s to drain, then force-exit
  setTimeout(() => {
    logger.info("[connector] Exit.");
    process.exit(0);
  }, 5000).unref();
}

process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (err) => {
  logger.error("[connector] Uncaught exception:", err.message);
  shutdown("uncaughtException");
});
process.on("unhandledRejection", (reason) => {
  // Log the message only — reason may contain partial payloads
  const msg = (reason instanceof Error) ? reason.message : String(reason);
  logger.error("[connector] Unhandled rejection:", msg);
  // Don't exit — log and let the poll loop continue
});

// ─── Tally Health State ───────────────────────────────────────────────────────
// Shared between heartbeat and poll loop (read-only after each probe).

let tallyHealth = {
  status:    "unknown",  // "ok" | "offline" | "error" | "unknown"
  error:     null,       // string or null
  companies: [],         // array from last successful probe
};
let heartbeatConnectorConfig = null;

/**
 * Probe Tally with a strict 5-second timeout (no retry/backoff).
 * Updates tallyHealth in-place.  Never throws.
 */
async function probeTallyHealth(runtimeConfig = config) {
  if (shutdownSignal.aborted) return;
  try {
    const xml = buildCompanyDiscoveryXml();
    const probe = await probeTally({
      host:      runtimeConfig.tally.host,
      port:      runtimeConfig.tally.port,
      xmlBody:   xml,
      timeoutMs: 5000,
    });

    if (probe.ok) {
      let companies = [];
      try { companies = parseCompanyDiscovery(probe.raw); } catch { /* ignore parse errors */ }
      tallyHealth = { status: "ok", error: null, companies };
      logger.debug(`[health] Tally OK — ${companies.length} company(ies)`);
    } else {
      tallyHealth = { status: "offline", error: probe.error ?? "unreachable", companies: [] };
      logger.warn(`[health] Tally offline: ${probe.error}`);
    }
  } catch (err) {
    tallyHealth = { status: "error", error: err.message, companies: [] };
    logger.warn(`[health] Tally probe error: ${err.message}`);
  }
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

async function doHeartbeat() {
  if (shutdownSignal.aborted) return;
  const runtimeConfig = makeTallyConfig(config, heartbeatConnectorConfig);

  // Probe Tally health (strict timeout, never blocks the loop)
  await probeTallyHealth(runtimeConfig);

  try {
    const response = await sendHeartbeat({
      baseUrl:      config.erp.baseUrl,
      token:        config.erp.token,   // never logged
      connectorId,
      tallyHost:    runtimeConfig.tally.host,
      tallyPort:    runtimeConfig.tally.port,
      tallyCompany: runtimeConfig.tally.company ?? null,
      tallyStatus:  tallyHealth.status,
      tallyError:   tallyHealth.error,
      companies:    tallyHealth.companies,
      version:      config.version,
    });
    const remoteConfig = response.body?.config;
    if (remoteConfig) {
      heartbeatConnectorConfig = {
        tallyHost: remoteConfig.tallyHost,
        tallyPort: remoteConfig.tallyPort,
        company: remoteConfig.companyName,
      };
    }
    logger.debug("[heartbeat] sent");
  } catch (err) {
    logger.warn(`[heartbeat] ERP send failed: ${err.message}`);
  }
}

// ─── Per-job runtime config ───────────────────────────────────────────────────

/**
 * Build a non-frozen runtime config for a single job.
 * ERP's job.connectorConfig may specify { tallyHost, tallyPort, company }
 * to route the job to a specific Tally instance; falls back to base config.
 * The frozen base config is never mutated.
 */
function jobRuntimeConfig(job) {
  return makeTallyConfig(config, job.connectorConfig ?? null);
}

// ─── Export job orchestration ─────────────────────────────────────────────────

/**
 * After a Tally-export handler returns vouchers, POST them to ERP import
 * then return a lean summary result suitable for /complete.
 *
 * If ERP import fails the job is marked failed so the ERP can re-queue.
 * Voucher array is never included in the /complete payload.
 *
 * @param {object} opts
 * @param {string} opts.jobId
 * @param {object} opts.handlerResult   — raw handler return (contains _vouchers)
 * @returns {{ result: object, vouchers: object[] }}
 */
async function orchestrateExport({ jobId, handlerResult }) {
  const vouchers = handlerResult._vouchers ?? [];

  // Strip internal _vouchers from the completion result
  const { _vouchers: _removed, ...publicResult } = handlerResult;

  if (vouchers.length === 0) {
    // Nothing to import — mark complete immediately
    return { result: { ...publicResult, importStatus: "skipped", imported: 0 }, vouchers };
  }

  logger.info(`[export] jobId=${jobId}: sending ${vouchers.length} voucher(s) to ERP import...`);

  let importRes;
  try {
    importRes = await importToErp({
      baseUrl:  config.erp.baseUrl,
      token:    config.erp.token,
      jobId,
      vouchers,
    });
  } catch (err) {
    logger.error(`[export] jobId=${jobId}: ERP import call failed: ${err.message}`);
    return {
      result: {
        ...publicResult,
        ok:           false,
        importStatus: "failed",
        importError:  err.message,
        imported:     0,
      },
      vouchers,
    };
  }

  if (importRes.status >= 400) {
    const errDetail = (typeof importRes.body === "object"
      ? (importRes.body?.message ?? importRes.body?.error ?? JSON.stringify(importRes.body))
      : String(importRes.body ?? "")).slice(0, 200); // truncate — body may be large

    logger.error(`[export] jobId=${jobId}: ERP import HTTP ${importRes.status}: ${errDetail}`);
    return {
      result: {
        ...publicResult,
        ok:           false,
        importStatus: "failed",
        importError:  `HTTP ${importRes.status}: ${errDetail}`,
        imported:     0,
      },
      vouchers,
    };
  }

  const rejected = Number(importRes.body?.rejected || 0);
  if (importRes.body?.ok === false || rejected > 0) {
    const reasons = Array.isArray(importRes.body?.results)
      ? importRes.body.results
          .filter(r => r.status === "rejected" || r.status === "error")
          .map(r => r.reason)
          .filter(Boolean)
          .slice(0, 3)
          .join("; ")
      : "";
    return {
      result: {
        ...publicResult,
        ok: false,
        importStatus: "failed",
        importError: reasons || `${rejected} voucher(s) rejected by ERP`,
        imported: Number(importRes.body?.accepted || 0),
      },
      vouchers,
    };
  }

  const imported = importRes.body?.accepted ?? importRes.body?.imported ?? importRes.body?.count ?? vouchers.length;
  logger.info(`[export] jobId=${jobId}: ERP import accepted, imported=${imported}`);

  return {
    result: {
      ...publicResult,
      ok:           true,
      importStatus: "ok",
      imported,
    },
    vouchers,
  };
}

// ─── Single-instance poll lock ────────────────────────────────────────────────

let pollRunning = false;

// ─── Job Poll Loop ────────────────────────────────────────────────────────────

async function pollJobs() {
  if (shutdownSignal.aborted || pollRunning) return;
  pollRunning = true;

  try {
    const jobs = await fetchJobs({
      baseUrl: config.erp.baseUrl,
      token:   config.erp.token,
      instanceId: connectorId,
      limit:   config.poll.jobLimit,
    });

    if (jobs.length === 0) {
      logger.debug("[poll] No pending jobs.");
      return;
    }

    logger.info(`[poll] Received ${jobs.length} job(s).`);

    for (const job of jobs) {
      if (shutdownSignal.aborted) break;

      const { id: jobId, type: jobType, idempotencyKey } = job;
      logger.info(
        `[job] Processing id=${jobId} type=${jobType}` +
        ` idempotency=${idempotencyKey ?? "n/a"}`
      );

      // Build per-job runtime config — ERP controls tallyHost/tallyPort/company
      const runtimeConfig = jobRuntimeConfig(job);
      if (
        runtimeConfig.tally.host !== config.tally.host ||
        runtimeConfig.tally.port !== config.tally.port ||
        runtimeConfig.tally.company !== config.tally.company
      ) {
        logger.info(
          `[job] Per-job Tally override: ` +
          `${runtimeConfig.tally.host}:${runtimeConfig.tally.port}` +
          ` company="${runtimeConfig.tally.company ?? "(first active)"}"`
        );
      }

      let result;
      try {
        const handlerResult = await dispatchJob(job, runtimeConfig, shutdownSignal);

        if (EXPORT_JOB_TYPES.has(job.type) && handlerResult.ok) {
          // Tally→ERP direction: send vouchers to ERP, then build completion result
          const orchestrated = await orchestrateExport({ jobId, handlerResult });
          result = orchestrated.result;
        } else {
          // ERP→Tally or informational: result goes directly to /complete
          result = handlerResult;
        }
      } catch (err) {
        logger.error(`[job] Job ${jobId} threw an unhandled error: ${err.message}`);
        result = { ok: false, error: err.message };
      }

      // Report back to ERP — body is { result } per contract
      // result never contains _vouchers (stripped in orchestrateExport) or the token
      try {
        result = { ...result, kind: job.kind || "sync_job" };
        await completeJob({
          baseUrl: config.erp.baseUrl,
          token:   config.erp.token,
          instanceId: connectorId,
          jobId,
          result,
        });
        logger.info(`[job] Job ${jobId} complete: ok=${result.ok}`);
      } catch (err) {
        logger.error(`[job] Failed to report completion for job ${jobId}: ${err.message}`);
        // ERP will re-queue the job if completion isn't received — safe to continue
      }
    }
  } catch (err) {
    if (err.code === "ERP_JOBS_ERROR" && err.status === 401) {
      logger.error("[poll] ERP returned 401 Unauthorized. Check ERP_CONNECTOR_TOKEN.");
      // Back off 60 s on auth failure to avoid hammering the server
      await new Promise(r => setTimeout(r, 60_000));
    } else {
      logger.warn("[poll] Poll cycle error:", err.message);
    }
  } finally {
    pollRunning = false;
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

// Immediate startup: probe Tally then send first heartbeat
doHeartbeat();

// Heartbeat on schedule
const heartbeatTimer = setInterval(() => {
  doHeartbeat().catch(err => logger.warn("[heartbeat] timer error:", err.message));
}, config.heartbeat.intervalMs);
heartbeatTimer.unref();

// Poll immediately then on schedule
pollJobs();
const pollTimer = setInterval(() => {
  pollJobs().catch(err => logger.warn("[poll] timer error:", err.message));
}, config.poll.intervalMs);
pollTimer.unref();

// Keep the event loop alive until shutdown signal
const keepAliveTimer = setInterval(() => {}, 2_147_483_647);

shutdownSignal.addEventListener("abort", () => {
  clearInterval(heartbeatTimer);
  clearInterval(pollTimer);
  clearInterval(keepAliveTimer);
});
