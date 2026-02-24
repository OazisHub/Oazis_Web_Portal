import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseCliPanel,
  p,
  loadPanel,
  resolvePanelPath,
  resolvePathFromPanel,
  resolveClusterRelative,
  writeJson,
} from "./shared_portal_runtime.ts";

const STEP_ID = "1.4";
const STEP_NAME = "1.4_avatar_react";

function readJson(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function main(): Promise<void> {
  p(STEP_ID, "▶ START " + STEP_NAME);
  const cliPanel = parseCliPanel(process.argv);
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const { panelPath } = resolvePanelPath(STEP_ID, scriptDir, cliPanel);
  const panel = loadPanel(STEP_ID, panelPath);

  const uiSignalFile = String((panel as any).avatar?.ui_signal_input_file ?? "3_Runtime/ai_orchestrator/steps/1_6/data/ui_signal.json");
  const uiSignalPath = resolveClusterRelative(STEP_ID, uiSignalFile);
  const signal = readJson(uiSignalPath);

  const avatarState = {
    reaction: String(signal.reaction ?? "pulse_neutral"),
    voice_style: String(signal.voice_style ?? "neutral"),
    intensity: Number(signal.intensity ?? 0.5),
    source_step_id: String(signal.source_step_id ?? "1.6"),
    created_at_utc: new Date().toISOString(),
  };

  const stepRunRoot = resolvePathFromPanel(STEP_ID, panel, "step_run_root");
  const avatarStatePath = resolve(stepRunRoot, "data", "avatar_state.json");
  const resultPath = resolve(stepRunRoot, "meta", "result.json");

  writeJson(avatarStatePath, avatarState);
  writeJson(resultPath, {
    step_id: STEP_ID,
    step_name: STEP_NAME,
    ui_signal_input_path: uiSignalPath,
    avatar_state_path: avatarStatePath,
    created_at_utc: new Date().toISOString(),
  });

  const externalPath = String((panel as any).avatar?.avatar_state_output_file ?? "");
  if (externalPath) {
    writeJson(resolveClusterRelative(STEP_ID, externalPath), avatarState);
  }

  p(STEP_ID, "▶ ARTIFACT " + avatarStatePath);
  p(STEP_ID, "▶ ARTIFACT " + resultPath);
  p(STEP_ID, "▶ DONE");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[" + STEP_ID + "] ❌ ERROR " + msg);
  process.exit(1);
});
