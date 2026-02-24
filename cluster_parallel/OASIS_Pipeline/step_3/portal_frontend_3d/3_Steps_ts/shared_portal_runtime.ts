import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { spawnSync } from "node:child_process";

type AnyRecord = Record<string, unknown>;

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
    throw new Error(py.stderr || py.stdout || "cannot parse yaml");
  }
  const parsed = JSON.parse(py.stdout.trim()) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("yaml root is not mapping");
  }
  return parsed as AnyRecord;
}

export function resolvePanelPath(stepId: string, scriptDir: string, cliPanel?: string): { panelPath: string; registryPath: string } {
  const clusterRoot = process.env.CLUSTER_ROOT;
  if (!clusterRoot || !isAbsolute(clusterRoot)) {
    fatal(stepId, "CLUSTER_ROOT must be set and absolute.");
  }

  const registryPath = resolve(scriptDir, "..", "PATHS", "module_paths_registry.yaml");

  if (cliPanel && cliPanel.trim()) {
    const pth = cliPanel.trim();
    return {
      panelPath: isAbsolute(pth) ? resolve(pth) : resolve(clusterRoot, pth),
      registryPath,
    };
  }

  const reg = pyLoadYaml(registryPath);
  const steps = (reg.steps ?? {}) as AnyRecord;
  const rec = (steps[stepId] ?? {}) as AnyRecord;
  const panelRel = String(rec.panel ?? "").trim();
  if (!panelRel) {
    fatal(stepId, "panel path not found in module_paths_registry");
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

export function resolvePathFromPanel(stepId: string, panel: AnyRecord, key: string): string {
  const clusterRoot = process.env.CLUSTER_ROOT;
  if (!clusterRoot || !isAbsolute(clusterRoot)) {
    fatal(stepId, "CLUSTER_ROOT must be set and absolute.");
  }
  const paths = (panel.paths ?? {}) as AnyRecord;
  const node = (paths[key] ?? {}) as AnyRecord;
  const raw = String(node.path ?? "").trim();
  if (!raw) {
    fatal(stepId, "missing paths." + key + ".path");
  }
  return isAbsolute(raw) ? resolve(raw) : resolve(clusterRoot, raw);
}

export function resolveClusterRelative(stepId: string, pathLike: string): string {
  const clusterRoot = process.env.CLUSTER_ROOT;
  if (!clusterRoot || !isAbsolute(clusterRoot)) {
    fatal(stepId, "CLUSTER_ROOT must be set and absolute.");
  }
  return isAbsolute(pathLike) ? resolve(pathLike) : resolve(clusterRoot, pathLike);
}

export function writeJson(path: string, payload: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(payload, null, 2) + "\n", "utf-8");
}

export function parseCliPanel(argv: string[]): string | undefined {
  const i = argv.findIndex((x) => x === "--panel");
  if (i >= 0 && i + 1 < argv.length) return argv[i + 1];
  return undefined;
}
