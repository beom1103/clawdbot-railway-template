import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ensureWorkspaceScaffold } from "../src/workspace-scaffold.js";

test("ensureWorkspaceScaffold seeds premarket agent persona files", () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-workspace-"));

  ensureWorkspaceScaffold({
    workspaceDir,
    now: new Date("2026-04-13T00:30:00Z"),
  });

  const riskSoul = fs.readFileSync(
    path.join(workspaceDir, "agents", "risk-execution", "SOUL.md"),
    "utf8",
  );
  const gatekeeperTools = fs.readFileSync(
    path.join(workspaceDir, "agents", "build", "TOOLS.md"),
    "utf8",
  );

  assert.match(riskSoul, /JSON/);
  assert.match(riskSoul, /position_size_pct/);
  assert.match(gatekeeperTools, /approve/);
  assert.equal(
    fs.existsSync(path.join(workspaceDir, "agents", "market-strategy", "SOUL.md")),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(workspaceDir, "agents", "quant-trader", "SOUL.md")),
    true,
  );
});

test("ensureWorkspaceScaffold refreshes bundled persona files on rerun", () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-workspace-"));
  const riskSoulPath = path.join(workspaceDir, "agents", "risk-execution", "SOUL.md");
  fs.mkdirSync(path.dirname(riskSoulPath), { recursive: true });
  fs.writeFileSync(riskSoulPath, "stale\n", "utf8");

  ensureWorkspaceScaffold({
    workspaceDir,
    now: new Date("2026-04-13T00:30:00Z"),
  });

  const riskSoul = fs.readFileSync(riskSoulPath, "utf8");
  assert.notEqual(riskSoul, "stale\n");
  assert.match(riskSoul, /risk-execution/);
});
