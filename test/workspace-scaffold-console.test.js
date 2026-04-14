import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("debug console allowlist includes workspace scaffold sync and session janitor", () => {
  const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

  assert.match(src, /"workspace\.scaffold\.sync"/);
  assert.match(src, /"sessions\.janitor\.run"/);
});
