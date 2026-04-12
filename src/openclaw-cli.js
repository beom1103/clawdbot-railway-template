import childProcess from "node:child_process";
import os from "node:os";
import path from "node:path";

import {
  materializeRuntimeConfig,
  resolvePersistentConfigPath,
  resolveRuntimeConfigPath,
} from "./runtime-config.js";

const STATE_DIR =
  process.env.OPENCLAW_STATE_DIR?.trim() ||
  path.join(os.homedir(), ".openclaw");
const WORKSPACE_DIR =
  process.env.OPENCLAW_WORKSPACE_DIR?.trim() ||
  path.join(STATE_DIR, "workspace");
const OPENCLAW_ENTRY = process.env.OPENCLAW_ENTRY?.trim() || "/openclaw/dist/entry.js";

const persistentConfigPath = resolvePersistentConfigPath(process.env, STATE_DIR);
const runtimeConfigPath = resolveRuntimeConfigPath(STATE_DIR, process.env);
const resolvedConfigPath = materializeRuntimeConfig({
  env: process.env,
  sourcePath: persistentConfigPath,
  runtimePath: runtimeConfigPath,
});

const child = childProcess.spawn(
  "node",
  [OPENCLAW_ENTRY, ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      OPENCLAW_STATE_DIR: STATE_DIR,
      OPENCLAW_WORKSPACE_DIR: WORKSPACE_DIR,
      OPENCLAW_CONFIG_PATH: resolvedConfigPath || persistentConfigPath,
    },
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
