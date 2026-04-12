import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const HOOK_TOKEN_PLACEHOLDER = "${OPENCLAW_HOOK_TOKEN}";

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
  const hookToken = env.OPENCLAW_HOOK_TOKEN?.trim();
  const currentHookToken = cfg?.hooks?.token;
  const needsHookRewrite =
    cfg?.hooks?.enabled === true &&
    hookToken &&
    (currentHookToken === HOOK_TOKEN_PLACEHOLDER || currentHookToken === "");

  if (!needsHookRewrite) return source;

  const next = structuredClone(cfg);
  next.hooks.token = hookToken;

  fs.mkdirSync(path.dirname(runtime), { recursive: true });
  fs.writeFileSync(runtime, JSON.stringify(next, null, 2) + "\n", {
    encoding: "utf8",
    mode: 0o600,
  });
  return runtime;
}
