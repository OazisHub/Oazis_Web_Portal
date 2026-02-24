import { parseCliPanel, p, loadPanel, resolvePanelPath, resolvePathFromPanel, writeJson } from "./shared_portal_runtime.ts";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const STEP_ID = "1.1";
const STEP_NAME = "1.1_voice_capture";

async function main(): Promise<void> {
  p(STEP_ID, "▶ START " + STEP_NAME);
  const cliPanel = parseCliPanel(process.argv);
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const { panelPath } = resolvePanelPath(STEP_ID, scriptDir, cliPanel);
  const panel = loadPanel(STEP_ID, panelPath);

  const stepRunRoot = resolvePathFromPanel(STEP_ID, panel, "step_run_root");
  const resultPath = resolve(stepRunRoot, "meta", "result.json");

  writeJson(resultPath, {
    step_id: STEP_ID,
    step_name: STEP_NAME,
    stt_enabled: Boolean((panel as Record<string, unknown>).voice && (panel as any).voice.stt_enabled),
    provider: (panel as any).voice?.provider ?? "browser",
    created_at_utc: new Date().toISOString(),
  });

  p(STEP_ID, "▶ ARTIFACT " + resultPath);
  p(STEP_ID, "▶ DONE");
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[" + STEP_ID + "] ❌ ERROR " + msg);
  process.exit(1);
});
