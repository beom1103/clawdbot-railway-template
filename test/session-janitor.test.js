import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  archiveSupersededDiscussionSessions,
  collapseDiscussionSessionIndex,
  listArchivedSessionFiles,
} from "../src/session-janitor.js";

test("collapseDiscussionSessionIndex keeps only newest discussion session per agent+channel", () => {
  const input = {
    "agent:build:discord:channel:1475864247526232267": {
      sessionId: "old-build",
      updatedAt: 100,
    },
    "agent:build:discord:channel:1475864247526232267:autoloop-v2": {
      sessionId: "mid-build",
      updatedAt: 200,
    },
    "agent:build:discord:channel:1475864247526232267:autoloop-v3": {
      sessionId: "new-build",
      updatedAt: 300,
    },
    "agent:quant-trader:discord:channel:1475864247526232267": {
      sessionId: "old-quant",
      updatedAt: 100,
    },
    "agent:quant-trader:discord:channel:1475864247526232267:autoloop-v3": {
      sessionId: "new-quant",
      updatedAt: 200,
    },
    "agent:build:cron:abc": {
      sessionId: "cron-build",
      updatedAt: 50,
    },
  };

  const { nextIndex, pruned } = collapseDiscussionSessionIndex(input);

  assert.deepEqual(Object.keys(nextIndex).sort(), [
    "agent:build:cron:abc",
    "agent:build:discord:channel:1475864247526232267:autoloop-v3",
    "agent:quant-trader:discord:channel:1475864247526232267:autoloop-v3",
  ]);
  assert.deepEqual(
    pruned.map((entry) => entry.sessionId).sort(),
    ["mid-build", "old-build", "old-quant"],
  );
});

test("archiveSupersededDiscussionSessions renames removed session files and checkpoints", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-janitor-"));
  const sessionsDir = path.join(tmpDir, "sessions");
  fs.mkdirSync(sessionsDir, { recursive: true });

  fs.writeFileSync(path.join(sessionsDir, "old-build.jsonl"), "old\n", "utf8");
  fs.writeFileSync(
    path.join(sessionsDir, "old-build.checkpoint.123.jsonl"),
    "checkpoint\n",
    "utf8",
  );
  fs.writeFileSync(path.join(sessionsDir, "new-build.jsonl"), "new\n", "utf8");

  const archived = archiveSupersededDiscussionSessions({
    sessionsDir,
    prunedEntries: [{ sessionId: "old-build" }],
    now: new Date("2026-04-14T01:00:00Z"),
  });

  assert.equal(fs.existsSync(path.join(sessionsDir, "old-build.jsonl")), false);
  assert.equal(
    fs.existsSync(path.join(sessionsDir, "old-build.checkpoint.123.jsonl")),
    false,
  );
  assert.equal(fs.existsSync(path.join(sessionsDir, "new-build.jsonl")), true);
  assert.equal(archived.length, 2);
  assert.equal(listArchivedSessionFiles(sessionsDir).length, 2);
});
