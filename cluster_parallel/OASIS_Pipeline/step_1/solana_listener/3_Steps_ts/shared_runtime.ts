import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, isAbsolute } from "node:path";
import { spawnSync } from "node:child_process";

export type AnyRecord = Record<string, unknown>;

export function p(stepId: string, message: string): void {
  console.log("[" + stepId + "] " + message);
}

export function fatal(stepId: string, message: string): never {
  throw new Error("[" + stepId + "] ❌ FATAL: " + message);
}

function pyLoadYaml(path: string): AnyRecord {
  const py = spawnSync(
    "python3",
    [
      "-c",
      [
        "import json,sys,yaml",
        "with open(sys.argv[1],'r',encoding='utf-8') as f:",
        "  data=yaml.safe_load(f)",
        "print(json.dumps(data))",
      ].join("\n"),
      path,
    ],
    { encoding: "utf-8" },
  );

  if (py.status !== 0) {
    throw new Error(
      "cannot parse yaml via python3: " + (py.stderr || py.stdout || "unknown error"),
    );
  }

  const raw = py.stdout.trim();
  if (!raw) {
    throw new Error("empty yaml parse output");
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("yaml root is not a mapping");
  }
  return parsed as AnyRecord;
}

export function resolvePanelPath(
  stepId: string,
  scriptDir: string,
  cliPanel?: string,
): { panelPath: string; registryPath: string } {
  const clusterRoot = process.env.CLUSTER_ROOT;
  if (!clusterRoot || !isAbsolute(clusterRoot)) {
    fatal(stepId, "CLUSTER_ROOT must be set and absolute for TS runtime.");
  }

  if (cliPanel && cliPanel.trim()) {
    const pth = cliPanel.trim();
    return {
      panelPath: isAbsolute(pth) ? resolve(pth) : resolve(clusterRoot, pth),
      registryPath: resolve(scriptDir, "..", "PATHS", "module_paths_registry.yaml"),
    };
  }

  const registryPath = resolve(scriptDir, "..", "PATHS", "module_paths_registry.yaml");
  const registry = pyLoadYaml(registryPath);
  const steps = (registry.steps ?? {}) as AnyRecord;
  const stepRec = (steps[stepId] ?? {}) as AnyRecord;
  const panelRel = String(stepRec.panel ?? "").trim();
  if (!panelRel) {
    fatal(stepId, "panel path not found in module_paths_registry for step_id=" + stepId);
  }

  const moduleRoot = resolve(scriptDir, "..");
  return {
    panelPath: resolve(moduleRoot, panelRel),
    registryPath,
  };
}

export function loadPanel(stepId: string, panelPath: string): AnyRecord {
  try {
    return pyLoadYaml(panelPath);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    fatal(stepId, "cannot load panel " + panelPath + " (" + msg + ")");
  }
}

function getPathNode(panel: AnyRecord, key: string): AnyRecord {
  const paths = (panel.paths ?? {}) as AnyRecord;
  const node = (paths[key] ?? {}) as unknown;
  if (!node || typeof node !== "object" || Array.isArray(node)) {
    throw new Error("missing paths." + key);
  }
  return node as AnyRecord;
}

export function resolvePanelPathKey(stepId: string, panel: AnyRecord, key: string): string {
  const clusterRoot = process.env.CLUSTER_ROOT;
  if (!clusterRoot || !isAbsolute(clusterRoot)) {
    fatal(stepId, "CLUSTER_ROOT must be set and absolute.");
  }

  const node = getPathNode(panel, key);
  const raw = String(node.path ?? "").trim();
  if (!raw) {
    fatal(stepId, "missing paths." + key + ".path");
  }
  return isAbsolute(raw) ? resolve(raw) : resolve(clusterRoot, raw);
}

export function ensureParentDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

export function writeJson(filePath: string, payload: unknown): void {
  ensureParentDir(filePath);
  writeFileSync(filePath, JSON.stringify(payload, null, 2) + "\n", "utf-8");
}

export function getBool(panel: AnyRecord, path: string, fallback = false): boolean {
  const parts = path.split(".");
  let cur: unknown = panel;
  for (const part of parts) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) {
      return fallback;
    }
    cur = (cur as AnyRecord)[part];
  }
  return typeof cur === "boolean" ? cur : fallback;
}

export function getString(panel: AnyRecord, path: string, fallback = ""): string {
  const parts = path.split(".");
  let cur: unknown = panel;
  for (const part of parts) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) {
      return fallback;
    }
    cur = (cur as AnyRecord)[part];
  }
  return typeof cur === "string" && cur.trim() ? cur.trim() : fallback;
}

export function getStringArray(panel: AnyRecord, path: string): string[] {
  const parts = path.split(".");
  let cur: unknown = panel;
  for (const part of parts) {
    if (!cur || typeof cur !== "object" || Array.isArray(cur)) {
      return [];
    }
    cur = (cur as AnyRecord)[part];
  }
  if (!Array.isArray(cur)) {
    return [];
  }
  return cur
    .filter((x) => typeof x === "string")
    .map((x) => (x as string).trim())
    .filter((x) => x.length > 0);
}
