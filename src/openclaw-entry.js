import fs from "node:fs";

const BUNDLED_OPENCLAW_ENTRY = "/openclaw/dist/entry.js";
const PERSISTED_OPENCLAW_ENTRY = "/data/openclaw-runtime/node_modules/openclaw/dist/entry.js";

export function resolveOpenClawEntry(options = {}) {
  const env = options.env ?? process.env;
  const existsSync = options.existsSync ?? fs.existsSync;

  const explicit = env.OPENCLAW_ENTRY?.trim();
  if (explicit) return explicit;

  if (existsSync(PERSISTED_OPENCLAW_ENTRY)) {
    return PERSISTED_OPENCLAW_ENTRY;
  }

  return BUNDLED_OPENCLAW_ENTRY;
}
