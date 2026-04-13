import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  materializeRuntimeConfig,
  syncManagedPersistentConfig,
} from "../src/runtime-config.js";

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
    env: {
      OPENCLAW_HOOK_TOKEN: "secret-hook-token",
      OPENCLAW_WORKSPACE_DIR: "/data/workspace",
    },
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
        agents: {
          defaults: {
            workspace: "/data/workspace",
          },
          list: [
            {
              id: "main",
              subagents: {
                allowAgents: ["main", "build"],
              },
            },
            {
              id: "build",
              workspace: "/data/workspace/agents/build",
              tools: {
                allow: ["read", "write", "edit", "exec", "process", "message", "sessions_send"],
              },
              subagents: {
                allowAgents: ["build", "quant-trader", "market-strategy", "risk-execution"],
              },
            },
          ],
        },
        channels: {
          discord: {
            execApprovals: {
              enabled: true,
              agentFilter: ["build"],
            },
          },
        },
        hooks: {
          enabled: true,
          token: "inline-token",
          path: "/hooks",
          allowRequestSessionKey: true,
          allowedAgentIds: [
            "router-core",
            "quant-trader",
            "market-strategy",
            "risk-execution",
            "build",
          ],
          allowedSessionKeyPrefixes: [
            "hook:",
            "agent:quant-trader:discord:channel:",
            "agent:market-strategy:discord:channel:",
            "agent:risk-execution:discord:channel:",
            "agent:build:discord:channel:",
          ],
        },
      },
      null,
      2,
    ),
  );

  const resolvedPath = materializeRuntimeConfig({
    env: {
      OPENCLAW_HOOK_TOKEN: "secret-hook-token",
      OPENCLAW_WORKSPACE_DIR: "/data/workspace",
    },
    sourcePath,
    runtimePath,
  });

  assert.equal(resolvedPath, sourcePath);
  assert.equal(fs.existsSync(runtimePath), false);
});

test("syncManagedPersistentConfig rewrites legacy workspaces and discussion hook allowlists", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-runtime-config-"));
  const sourcePath = path.join(tmpDir, "openclaw.json");

  fs.writeFileSync(
    sourcePath,
    JSON.stringify(
      {
        agents: {
          defaults: {
            workspace: "/root/.openclaw/workspace",
          },
          list: [
            {
              id: "main",
              subagents: {
                allowAgents: ["main", "gh-railway"],
              },
            },
            {
              id: "gh-railway",
              workspace: "/data/.clawdbot/workspace-gh-railway",
            },
            {
              id: "build",
              workspace: "/root/.openclaw/workspace/agents/build",
              tools: {
                allow: ["read", "write", "edit", "exec", "process"],
              },
            },
            {
              id: "quant-trader",
              workspace: "/root/.openclaw/workspace/agents/quant-trader",
            },
            {
              id: "market-strategy",
              workspace: "/root/.openclaw/workspace/agents/market-strategy",
            },
            {
              id: "risk-execution",
              workspace: "/root/.openclaw/workspace/agents/risk-execution",
            },
          ],
        },
        channels: {
          discord: {
            execApprovals: {
              enabled: true,
              agentFilter: ["gh-railway"],
            },
          },
        },
        hooks: {
          enabled: true,
          allowRequestSessionKey: false,
          allowedSessionKeyPrefixes: ["hook:"],
          allowedAgentIds: ["router-core", "build"],
        },
      },
      null,
      2,
    ),
  );

  const changed = syncManagedPersistentConfig({
    sourcePath,
    workspaceDir: "/data/workspace",
  });

  assert.equal(changed, true);

  const normalized = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
  assert.equal(normalized.agents.defaults.workspace, "/data/workspace");
  assert.deepEqual(
    normalized.agents.list.map((agent) => agent.id),
    ["main", "build", "quant-trader", "market-strategy", "risk-execution"],
  );
  assert.equal(
    normalized.agents.list.find((agent) => agent.id === "build").workspace,
    "/data/workspace/agents/build",
  );
  assert.deepEqual(
    normalized.agents.list.find((agent) => agent.id === "main").subagents.allowAgents,
    ["main", "build"],
  );
  assert.ok(
    normalized.agents.list
      .find((agent) => agent.id === "build")
      .tools.allow.includes("sessions_send"),
  );
  assert.ok(
    normalized.agents.list
      .find((agent) => agent.id === "build")
      .tools.allow.includes("message"),
  );
  assert.deepEqual(normalized.channels.discord.execApprovals.agentFilter, ["build"]);
  assert.equal(normalized.hooks.allowRequestSessionKey, true);
  assert.deepEqual(normalized.hooks.allowedAgentIds, [
    "router-core",
    "quant-trader",
    "market-strategy",
    "risk-execution",
    "build",
  ]);
  assert.deepEqual(normalized.hooks.allowedSessionKeyPrefixes, [
    "hook:",
    "agent:quant-trader:discord:channel:",
    "agent:market-strategy:discord:channel:",
    "agent:risk-execution:discord:channel:",
    "agent:build:discord:channel:",
  ]);
});
