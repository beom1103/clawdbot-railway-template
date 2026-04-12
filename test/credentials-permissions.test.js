import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("wrapper hardens credentials dir permissions", () => {
  const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  assert.match(src, /fs\.mkdirSync\(path\.join\(STATE_DIR, "credentials"\), \{ recursive: true \}\)/);
  assert.match(src, /fs\.chmodSync\(path\.join\(STATE_DIR, "credentials"\), 0o700\)/);
});
