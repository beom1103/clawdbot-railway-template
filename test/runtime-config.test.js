import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { materializeRuntimeConfig } from "../src/runtime-config.js";

test("materializeRuntimeConfig injects hook token into runtime copy only", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-runtime-config-"));
  const sourcePath = path.join(tmpDir, "openclaw.json");
  const runtimePath = path.join(tmpDir, "openclaw.runtime.json");

  fs.writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        hooks: {
          enabled: true,
          token: "${OPENCLAW_HOOK_TOKEN}",
          path: "/hooks",
        },
      },
      null,
      2,
    ),
  );

  const resolvedPath = materializeRuntimeConfig({
    env: { OPENCLAW_HOOK_TOKEN: "secret-hook-token" },
    sourcePath,
    runtimePath,
  });

  assert.equal(resolvedPath, runtimePath);
  const sourceConfig = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  const runtimeConfig = JSON.parse(fs.readFileSync(runtimePath, "utf8"));

  assert.equal(sourceConfig.hooks.token, "${OPENCLAW_HOOK_TOKEN}");
  assert.equal(runtimeConfig.hooks.token, "secret-hook-token");
});

test("materializeRuntimeConfig leaves base file path when no hook token rewrite is needed", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-runtime-config-"));
  const sourcePath = path.join(tmpDir, "openclaw.json");
  const runtimePath = path.join(tmpDir, "openclaw.runtime.json");

  fs.writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        hooks: {
          enabled: true,
          token: "inline-token",
          path: "/hooks",
        },
      },
      null,
      2,
    ),
  );

  const resolvedPath = materializeRuntimeConfig({
    env: { OPENCLAW_HOOK_TOKEN: "secret-hook-token" },
    sourcePath,
    runtimePath,
  });

  assert.equal(resolvedPath, sourcePath);
  assert.equal(fs.existsSync(runtimePath), false);
});
