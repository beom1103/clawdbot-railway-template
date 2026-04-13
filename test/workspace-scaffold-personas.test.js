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
  const buildSoul = fs.readFileSync(
    path.join(workspaceDir, "agents", "build", "SOUL.md"),
    "utf8",
  );
  const marketSoul = fs.readFileSync(
    path.join(workspaceDir, "agents", "market-strategy", "SOUL.md"),
    "utf8",
  );
  const quantSoul = fs.readFileSync(
    path.join(workspaceDir, "agents", "quant-trader", "SOUL.md"),
    "utf8",
  );
  const gatekeeperTools = fs.readFileSync(
    path.join(workspaceDir, "agents", "build", "TOOLS.md"),
    "utf8",
  );

  assert.match(riskSoul, /JSON/);
  assert.match(riskSoul, /position_size_pct/);
  assert.match(buildSoul, /rb-runtime-policy-propose/);
  assert.match(buildSoul, /approve/);
  assert.match(buildSoul, /현재 Discord 채널/);
  assert.match(buildSoul, /공개 발언들을 읽은 뒤 마지막에 synthesis만 남긴다/);
  assert.match(buildSoul, /handoff 실패/);
  assert.match(riskSoul, /OPENCLAW_INTRADAY_SUMMARY/);
  assert.match(riskSoul, /compact JSON/);
  assert.match(riskSoul, /standalone JSON fragment/);
  assert.match(marketSoul, /OPENCLAW_INTRADAY_SUMMARY/);
  assert.match(marketSoul, /모든 outward message는 한국어/);
  assert.match(quantSoul, /OPENCLAW_INTRADAY_SUMMARY/);
  assert.match(quantSoul, /모든 outward message는 한국어/);
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

test("ensureWorkspaceScaffold removes legacy gh-railway workspace if present", () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-workspace-"));
  const legacyDir = path.join(workspaceDir, "agents", "gh-railway");
  fs.mkdirSync(legacyDir, { recursive: true });
  fs.writeFileSync(path.join(legacyDir, "SOUL.md"), "legacy\n", "utf8");

  ensureWorkspaceScaffold({
    workspaceDir,
    now: new Date("2026-04-13T00:30:00Z"),
  });

  assert.equal(fs.existsSync(legacyDir), false);
  assert.equal(fs.existsSync(path.join(workspaceDir, "agents", "build", "SOUL.md")), true);
});
