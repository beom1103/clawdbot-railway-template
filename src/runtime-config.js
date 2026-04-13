import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOOK_TOKEN_PLACEHOLDER = "${OPENCLAW_HOOK_TOKEN}";
const LEGACY_GATEKEEPER_AGENT_ID = "gh-railway";
const DISCUSSION_AGENT_IDS = [
  "quant-trader",
  "market-strategy",
  "risk-execution",
  "build",
];
const MANAGED_AGENT_IDS = new Set([
  "router-core",
  "market-strategy",
  "risk-execution",
  "quant-trader",
  "build",
  "quality",
  "memory",
]);

function unique(items) {
  return Array.from(
    new Set(
      (Array.isArray(items) ? items : [])
        .map((item) => String(item || "").trim())
        .filter(Boolean),
    ),
  );
}

function toPosixPath(value) {
  return String(value || "").replaceAll("\\", "/");
}

function managedAgentWorkspace(workspaceDir, agentId) {
  return path.posix.join(toPosixPath(workspaceDir), "agents", agentId);
}

function normalizeManagedConfig(config, { workspaceDir }) {
  const next = structuredClone(config || {});
  let changed = false;

  const desiredWorkspaceDir =
    toPosixPath(workspaceDir) ||
    toPosixPath(path.join(os.homedir(), ".openclaw", "workspace"));

  next.agents ||= {};
  next.agents.defaults ||= {};
  if (next.agents.defaults.workspace !== desiredWorkspaceDir) {
    next.agents.defaults.workspace = desiredWorkspaceDir;
    changed = true;
  }

  if (Array.isArray(next.agents.list)) {
    const normalizedAgents = [];

    for (const rawAgent of next.agents.list) {
      const agent = structuredClone(rawAgent || {});
      const agentId = String(agent.id || "").trim();
      if (!agentId) {
        normalizedAgents.push(agent);
        continue;
      }
      if (agentId === LEGACY_GATEKEEPER_AGENT_ID) {
        changed = true;
        continue;
      }

      if (agentId === "main") {
        const currentAllowAgents = unique(agent.subagents?.allowAgents || []);
        const nextAllowAgents = unique(
          currentAllowAgents
            .map((value) => (value === LEGACY_GATEKEEPER_AGENT_ID ? "build" : value))
            .concat("build"),
        );
        if (
          JSON.stringify(nextAllowAgents) !== JSON.stringify(currentAllowAgents)
        ) {
          agent.subagents ||= {};
          agent.subagents.allowAgents = nextAllowAgents;
          changed = true;
        }
      }

      if (MANAGED_AGENT_IDS.has(agentId)) {
        const desiredAgentWorkspace = managedAgentWorkspace(
          desiredWorkspaceDir,
          agentId,
        );
        if (agent.workspace !== desiredAgentWorkspace) {
          agent.workspace = desiredAgentWorkspace;
          changed = true;
        }
      }

      if (agentId === "build") {
        const currentAllow = unique(agent.tools?.allow || []);
        const nextAllow = unique([...currentAllow, "message", "sessions_send"]);
        if (JSON.stringify(nextAllow) !== JSON.stringify(currentAllow)) {
          agent.tools ||= {};
          agent.tools.allow = nextAllow;
          changed = true;
        }

        const currentSubagents = unique(agent.subagents?.allowAgents || []);
        const nextSubagents = unique(["build", ...DISCUSSION_AGENT_IDS]);
        if (JSON.stringify(nextSubagents) !== JSON.stringify(currentSubagents)) {
          agent.subagents ||= {};
          agent.subagents.allowAgents = nextSubagents;
          changed = true;
        }
      }

      normalizedAgents.push(agent);
    }

    if (
      JSON.stringify(normalizedAgents.map((agent) => agent.id)) !==
      JSON.stringify((next.agents.list || []).map((agent) => agent?.id))
    ) {
      changed = true;
    }
    next.agents.list = normalizedAgents;
  }

  next.channels ||= {};
  next.channels.discord ||= {};
  next.channels.discord.execApprovals ||= {};
  const currentApprovals = unique(next.channels.discord.execApprovals.agentFilter || []);
  const nextApprovals = unique(
    currentApprovals
      .filter((agentId) => agentId !== LEGACY_GATEKEEPER_AGENT_ID)
      .concat("build"),
  );
  if (JSON.stringify(nextApprovals) !== JSON.stringify(currentApprovals)) {
    next.channels.discord.execApprovals.agentFilter = nextApprovals;
    changed = true;
  }

  next.hooks ||= {};
  if (next.hooks.allowRequestSessionKey !== true) {
    next.hooks.allowRequestSessionKey = true;
    changed = true;
  }
  const currentAllowedAgents = unique(next.hooks.allowedAgentIds || []);
  const nextAllowedAgents = unique(["router-core", ...DISCUSSION_AGENT_IDS, ...currentAllowedAgents]);
  if (JSON.stringify(nextAllowedAgents) !== JSON.stringify(currentAllowedAgents)) {
    next.hooks.allowedAgentIds = nextAllowedAgents;
    changed = true;
  }
  const currentPrefixes = unique(next.hooks.allowedSessionKeyPrefixes || []);
  const nextPrefixes = unique([
    ...currentPrefixes,
    ...DISCUSSION_AGENT_IDS.map((agentId) => `agent:${agentId}:discord:channel:`),
  ]);
  if (JSON.stringify(nextPrefixes) !== JSON.stringify(currentPrefixes)) {
    next.hooks.allowedSessionKeyPrefixes = nextPrefixes;
    changed = true;
  }

  return { config: next, changed };
}

export function syncManagedPersistentConfig({
  sourcePath,
  workspaceDir,
}) {
  const source = String(sourcePath || "").trim();
  if (!source || !fs.existsSync(source)) return false;

  const cfg = JSON.parse(fs.readFileSync(source, "utf8"));
  const { config: normalized, changed } = normalizeManagedConfig(cfg, {
    workspaceDir,
  });
  if (!changed) return false;

  fs.writeFileSync(source, JSON.stringify(normalized, null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
  return true;
}

export function resolvePersistentConfigCandidates(env = process.env, stateDir) {
  const explicit = env.OPENCLAW_CONFIG_PATH?.trim();
  if (explicit) return [explicit];
  return [path.join(stateDir, "openclaw.json")];
}

export function resolvePersistentConfigPath(env = process.env, stateDir) {
  const candidates = resolvePersistentConfigCandidates(env, stateDir);
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }
  return candidates[0] || path.join(stateDir, "openclaw.json");
}

export function resolveRuntimeConfigPath(stateDir, env = process.env) {
  const explicit = env.OPENCLAW_RUNTIME_CONFIG_PATH?.trim();
  if (explicit) return explicit;
  const suffix = String(stateDir || "openclaw").replace(/[^A-Za-z0-9._-]+/g, "-");
  return path.join(os.tmpdir(), `openclaw-runtime-${suffix}.json`);
}

export function materializeRuntimeConfig({
  env = process.env,
  sourcePath,
  runtimePath,
}) {
  const source = String(sourcePath || "").trim();
  const runtime = String(runtimePath || "").trim();
  if (!source || !fs.existsSync(source)) return source;

  const cfg = JSON.parse(fs.readFileSync(source, "utf8"));
  const { config: normalizedConfig, changed: needsManagedNormalization } =
    normalizeManagedConfig(cfg, {
      workspaceDir:
        env.OPENCLAW_WORKSPACE_DIR?.trim() ||
        path.join(
          env.OPENCLAW_STATE_DIR?.trim() || path.join(os.homedir(), ".openclaw"),
          "workspace",
        ),
    });
  const hookToken = env.OPENCLAW_HOOK_TOKEN?.trim();
  const currentHookToken = normalizedConfig?.hooks?.token;
  const needsHookRewrite =
    normalizedConfig?.hooks?.enabled === true &&
    hookToken &&
    (currentHookToken === HOOK_TOKEN_PLACEHOLDER || currentHookToken === "");

  if (!needsHookRewrite && !needsManagedNormalization) return source;

  const next = structuredClone(normalizedConfig);
  if (needsHookRewrite) {
    next.hooks.token = hookToken;
  }

  fs.mkdirSync(path.dirname(runtime), { recursive: true });
  fs.writeFileSync(runtime, JSON.stringify(next, null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
  return runtime;
}
