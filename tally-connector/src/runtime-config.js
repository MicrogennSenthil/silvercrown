/**
 * runtime-config.js — Pure per-job config builder.
 *
 * Separated from config.js so it can be imported in tests without triggering
 * the startup validation (which calls process.exit when env vars are missing).
 *
 * Also re-exported from config.js for normal production use.
 */

/**
 * Build a per-job runtime config by merging ERP-supplied connectorConfig values
 * over the frozen base config.  Returns a plain (non-frozen) object.
 *
 * ERP may supply: { tallyHost, tallyPort, company }
 * All other fields come from the base config unchanged.
 * The frozen base config is NEVER mutated.
 *
 * @param {object} base       — frozen base config (from config.js)
 * @param {object|null} jobCC — job.connectorConfig from the ERP payload
 * @returns {object}          — merged runtime config (not frozen, safe to read)
 */
export function makeTallyConfig(base, jobCC) {
  // Normalise: only accept plain objects, reject arrays/primitives/null
  const cc = (jobCC && typeof jobCC === "object" && !Array.isArray(jobCC)) ? jobCC : {};

  const host = typeof cc.tallyHost === "string" && cc.tallyHost.trim()
    ? cc.tallyHost.trim()
    : base.tally.host;

  const port = (() => {
    if (typeof cc.tallyPort === "number" && Number.isInteger(cc.tallyPort) && cc.tallyPort > 0) {
      return cc.tallyPort;
    }
    if (typeof cc.tallyPort === "string" && /^\d+$/.test(cc.tallyPort.trim())) {
      const p = parseInt(cc.tallyPort.trim(), 10);
      return p > 0 ? p : base.tally.port;
    }
    return base.tally.port;
  })();

  const company = typeof cc.company === "string" && cc.company.trim()
    ? cc.company.trim()
    : base.tally.company;

  return {
    // Spread the full base so handlers always see erp/poll/backoff/log/etc.
    ...base,
    // Replace tally sub-object with merged values (plain object, not frozen)
    tally: {
      host,
      port,
      company,
      get baseUrl() {
        return `http://${this.host}:${this.port}`;
      },
    },
  };
}
