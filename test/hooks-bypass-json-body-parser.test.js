import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("hooks bypass global json body parser", () => {
  const src = fs.readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
  assert.match(src, /if \(req\.path\.startsWith\("\/hooks"\)\) return next\(\);/);
  assert.match(src, /const jsonBodyParser = express\.json\(\{ limit: "1mb" \}\);/);
  assert.match(src, /app\.use\(\(req, res, next\) => \{/);
});
