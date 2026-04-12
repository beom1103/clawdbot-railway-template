import test from "node:test";
import assert from "node:assert/strict";

import { resolveOpenClawEntry } from "../src/openclaw-entry.js";

test("prefers explicit OPENCLAW_ENTRY from env", () => {
  const entry = resolveOpenClawEntry({
    env: { OPENCLAW_ENTRY: " /custom/openclaw-entry.js " },
    existsSync: () => false,
  });

  assert.equal(entry, "/custom/openclaw-entry.js");
});

test("prefers persisted runtime entry when env override is absent", () => {
  const entry = resolveOpenClawEntry({
    env: {},
    existsSync: (candidate) =>
      candidate === "/data/openclaw-runtime/node_modules/openclaw/dist/entry.js",
  });

  assert.equal(entry, "/data/openclaw-runtime/node_modules/openclaw/dist/entry.js");
});

test("falls back to bundled image entry when persisted runtime is absent", () => {
  const entry = resolveOpenClawEntry({
    env: {},
    existsSync: () => false,
  });

  assert.equal(entry, "/openclaw/dist/entry.js");
});
