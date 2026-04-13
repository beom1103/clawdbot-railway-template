import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ensureWorkspaceScaffold } from "../src/workspace-scaffold.js";

test("ensureWorkspaceScaffold creates MEMORY.md and daily memory notes", () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-workspace-"));

  ensureWorkspaceScaffold({
    workspaceDir,
    now: new Date("2026-04-12T13:52:00Z"),
  });

  assert.equal(fs.existsSync(path.join(workspaceDir, "MEMORY.md")), true);
  assert.equal(fs.existsSync(path.join(workspaceDir, "memory", "2026-04-12.md")), true);
  assert.equal(fs.existsSync(path.join(workspaceDir, "memory", "2026-04-11.md")), true);
  assert.equal(
    fs.existsSync(
      path.join(workspaceDir, "agents", "build", "memory", "2026-04-12.md"),
    ),
    true,
  );
  assert.equal(
    fs.existsSync(
      path.join(
        workspaceDir,
        "agents",
        "risk-execution",
        "memory",
        "2026-04-11.md",
      ),
    ),
    true,
  );
});

test("ensureWorkspaceScaffold preserves existing memory files", () => {
  const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-workspace-"));
  const memoryDir = path.join(workspaceDir, "memory");
  fs.mkdirSync(memoryDir, { recursive: true });
  const target = path.join(memoryDir, "2026-04-12.md");
  fs.writeFileSync(target, "existing\n", "utf8");

  ensureWorkspaceScaffold({
    workspaceDir,
    now: new Date("2026-04-12T13:52:00Z"),
  });

  assert.equal(fs.readFileSync(target, "utf8"), "existing\n");
});
