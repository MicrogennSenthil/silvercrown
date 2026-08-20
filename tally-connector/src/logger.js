/**
 * logger.js — Simple structured logger (no external dep).
 * Level comes from config; each line is a JSON object for easy log shipping.
 */

let _level = 2; // info default

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

export function initLogger(numericLevel) {
  _level = numericLevel;
}

function emit(levelName, levelNum, ...args) {
  if (levelNum > _level) return;
  const line = {
    ts: new Date().toISOString(),
    level: levelName,
    msg: args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" "),
  };
  const out = JSON.stringify(line);
  if (levelNum <= 1) process.stderr.write(out + "\n");
  else process.stdout.write(out + "\n");
}

export const logger = {
  error: (...a) => emit("error", 0, ...a),
  warn:  (...a) => emit("warn",  1, ...a),
  info:  (...a) => emit("info",  2, ...a),
  debug: (...a) => emit("debug", 3, ...a),
};
