/**
 * tally-client.js — Outbound HTTP client for the local Tally Prime endpoint.
 *
 * The connector only makes OUTBOUND requests to Tally.
 * It NEVER listens on Tally's port or any port.
 *
 * Includes exponential backoff for when Tally is offline and a lightweight
 * probe function used by heartbeat (strict single-attempt timeout, no backoff).
 */

import http from "node:http";
import { logger } from "./logger.js";

/**
 * Send an XML request to the Tally Prime HTTP server.
 * Returns the full response body as a string.
 *
 * @param {object} opts
 * @param {string} opts.host       — Tally hostname (from config)
 * @param {number} opts.port       — Tally port (from config)
 * @param {string} opts.xmlBody    — complete XML string to POST
 * @param {number} [opts.timeoutMs=15000] — socket timeout
 * @returns {Promise<string>}
 */
export function sendToTally({ host, port, xmlBody, timeoutMs = 15000 }) {
  return new Promise((resolve, reject) => {
    const bodyBuf = Buffer.from(xmlBody, "utf8");

    const options = {
      hostname: host,
      port:     port,
      path:     "/",
      method:   "POST",
      headers: {
        "Content-Type":   "text/xml;charset=utf-8",
        "Content-Length": bodyBuf.byteLength,
        // Tally Prime requires this header
        "Accept":         "text/xml, application/xml",
      },
    };

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => {
        const body = Buffer.concat(chunks).toString("utf8");
        if (res.statusCode !== 200) {
          return reject(
            Object.assign(new Error(`Tally HTTP ${res.statusCode}`), {
              code: "TALLY_HTTP_ERROR",
              statusCode: res.statusCode,
              body,
            })
          );
        }
        resolve(body);
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(
        Object.assign(new Error("Tally request timeout"), { code: "TALLY_TIMEOUT" })
      );
    });

    req.on("error", err => {
      // Attach a recognisable code so callers can detect offline Tally
      if (!err.code) err.code = "TALLY_CONNECT_ERROR";
      reject(err);
    });

    req.write(bodyBuf);
    req.end();
  });
}

/**
 * Lightweight single-attempt Tally health probe used by the heartbeat.
 * Uses a short timeout and does NOT retry — returns a status object so the
 * heartbeat loop never blocks.
 *
 * @param {object} opts
 * @param {string} opts.host
 * @param {number} opts.port
 * @param {string} opts.xmlBody   — company discovery XML built by caller
 * @param {number} [opts.timeoutMs=5000]
 * @returns {Promise<{ ok: boolean, raw?: string, error?: string }>}
 */
export async function probeTally({ host, port, xmlBody, timeoutMs = 5000 }) {
  try {
    const raw = await sendToTally({ host, port, xmlBody, timeoutMs });
    return { ok: true, raw };
  } catch (err) {
    return { ok: false, error: err.message ?? String(err) };
  }
}

/**
 * Returns true if the error looks like Tally is simply not running / unreachable.
 * Used to decide whether to apply exponential back-off.
 */
export function isTallyOfflineError(err) {
  return (
    err.code === "ECONNREFUSED"       ||
    err.code === "ECONNRESET"         ||
    err.code === "ETIMEDOUT"          ||
    err.code === "TALLY_TIMEOUT"      ||
    err.code === "ENOTFOUND"          ||
    err.code === "TALLY_CONNECT_ERROR"
  );
}

/**
 * Exponential-backoff helper.
 * Calls fn() repeatedly, backing off on failures that pass isTransient().
 *
 * @param {object} opts
 * @param {() => Promise<T>} opts.fn
 * @param {(err: Error) => boolean} opts.isTransient
 * @param {number} opts.initialMs
 * @param {number} opts.maxMs
 * @param {AbortSignal} [opts.signal]
 * @param {string} [opts.label]
 * @returns {Promise<T>}
 */
export async function withBackoff({ fn, isTransient, initialMs, maxMs, signal, label = "operation" }) {
  let delay = initialMs;
  let attempt = 0;

  while (true) {
    if (signal?.aborted) throw new Error("Aborted");
    attempt++;
    try {
      return await fn();
    } catch (err) {
      if (!isTransient(err)) throw err;
      logger.warn(`[backoff] ${label} failed (attempt ${attempt}): ${err.message}. Retrying in ${delay}ms.`);
      await sleep(delay, signal);
      delay = Math.min(delay * 2, maxMs);
    }
  }
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("Aborted"));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("Aborted"));
    }, { once: true });
  });
}
