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

const STEP_ID = "1.3";
const STEP_NAME = "1.3_render_reply";

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

  const advisoryFile = String((panel as any).render?.advisory_input_file ?? "3_Runtime/ai_orchestrator/steps/1_5/data/advisory_message.json");
  const advisoryPath = resolveClusterRelative(STEP_ID, advisoryFile);
  const advisory = readJson(advisoryPath);

  const replyState = {
    message_text: String(advisory.message_text ?? "No advisory yet."),
    reasoning_summary: String(advisory.reasoning_summary ?? "Awaiting advisory pipeline output."),
    voice_style: String(advisory.voice_style ?? "neutral"),
    confidence_score: Number(advisory.confidence_score ?? 0.0),
    created_at_utc: new Date().toISOString(),
  };

  const stepRunRoot = resolvePathFromPanel(STEP_ID, panel, "step_run_root");
  const replyStatePath = resolve(stepRunRoot, "data", "reply_state.json");
  const resultPath = resolve(stepRunRoot, "meta", "result.json");

  writeJson(replyStatePath, replyState);
  writeJson(resultPath, {
    step_id: STEP_ID,
    step_name: STEP_NAME,
    advisory_input_path: advisoryPath,
    reply_state_path: replyStatePath,
    created_at_utc: new Date().toISOString(),
  });

  const externalPath = String((panel as any).render?.portal_state_output_file ?? "");
  if (externalPath) {
    writeJson(resolveClusterRelative(STEP_ID, externalPath), replyState);
  }

  p(STEP_ID, "▶ ARTIFACT " + replyStatePath);
  p(STEP_ID, "▶ ARTIFACT " + resultPath);
  p(STEP_ID, "▶ DONE");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[" + STEP_ID + "] ❌ ERROR " + msg);
  process.exit(1);
});
