import fs from "node:fs";
import path from "node:path";

const DISCUSSION_SESSION_PATTERN =
  /^agent:([^:]+):discord:channel:([^:]+)(?::(.+))?$/;

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function timestampSlug(now = new Date()) {
  return now.toISOString().replaceAll(":", "-");
}

export function collapseDiscussionSessionIndex(index) {
  const source = isObject(index) ? index : {};
  const grouped = new Map();
  const nextIndex = {};
  const pruned = [];

  for (const [sessionKey, entry] of Object.entries(source)) {
    const match = DISCUSSION_SESSION_PATTERN.exec(sessionKey);
    if (!match) {
      nextIndex[sessionKey] = entry;
      continue;
    }
    const [_, agentId, channelId] = match;
    const baseKey = `agent:${agentId}:discord:channel:${channelId}`;
    const bucket = grouped.get(baseKey) || [];
    bucket.push([sessionKey, entry]);
    grouped.set(baseKey, bucket);
  }

  for (const entries of grouped.values()) {
    const sorted = [...entries].sort((left, right) => {
      const leftUpdated = Number(left[1]?.updatedAt || 0);
      const rightUpdated = Number(right[1]?.updatedAt || 0);
      return rightUpdated - leftUpdated;
    });
    const [winnerKey, winnerEntry] = sorted.shift();
    nextIndex[winnerKey] = winnerEntry;
    for (const [sessionKey, entry] of sorted) {
      pruned.push({
        sessionKey,
        sessionId: String(entry?.sessionId || "").trim(),
        updatedAt: Number(entry?.updatedAt || 0),
      });
    }
  }

  return { nextIndex, pruned };
}

export function archiveSupersededDiscussionSessions({
  sessionsDir,
  prunedEntries,
  now = new Date(),
}) {
  const archived = [];
  const stamp = timestampSlug(now);
  for (const entry of Array.isArray(prunedEntries) ? prunedEntries : []) {
    const sessionId = String(entry?.sessionId || "").trim();
    if (!sessionId) continue;
    const candidates = fs.existsSync(sessionsDir)
      ? fs.readdirSync(sessionsDir)
      : [];
    for (const name of candidates) {
      if (
        name === `${sessionId}.jsonl` ||
        name.startsWith(`${sessionId}.checkpoint.`)
      ) {
        const from = path.join(sessionsDir, name);
        const to = path.join(sessionsDir, `${name}.deleted.${stamp}`);
        if (!fs.existsSync(from)) continue;
        fs.renameSync(from, to);
        archived.push(to);
      }
    }
  }
  return archived;
}

export function listArchivedSessionFiles(sessionsDir) {
  if (!fs.existsSync(sessionsDir)) return [];
  return fs
    .readdirSync(sessionsDir)
    .filter((name) => name.includes(".deleted."))
    .map((name) => path.join(sessionsDir, name));
}

export function runSessionJanitor({
  stateDir,
  agents = ["build", "quant-trader", "market-strategy", "risk-execution"],
  now = new Date(),
}) {
  const summary = {
    scannedAgents: 0,
    prunedKeys: 0,
    archivedFiles: 0,
  };
  const root = String(stateDir || "").trim();
  if (!root) return summary;

  for (const agentId of agents) {
    const sessionsDir = path.join(root, "agents", agentId, "sessions");
    const indexPath = path.join(sessionsDir, "sessions.json");
    if (!fs.existsSync(indexPath)) continue;

    summary.scannedAgents += 1;
    const currentIndex = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    const { nextIndex, pruned } = collapseDiscussionSessionIndex(currentIndex);
    if (!pruned.length) continue;

    const archived = archiveSupersededDiscussionSessions({
      sessionsDir,
      prunedEntries: pruned,
      now,
    });
    fs.writeFileSync(indexPath, JSON.stringify(nextIndex, null, 2) + "\n", "utf8");

    summary.prunedKeys += pruned.length;
    summary.archivedFiles += archived.length;
  }

  return summary;
}
