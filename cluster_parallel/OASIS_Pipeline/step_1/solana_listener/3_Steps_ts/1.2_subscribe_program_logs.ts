import { appendFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  p,
  fatal,
  resolvePanelPath,
  loadPanel,
  resolvePanelPathKey,
  writeJson,
  getBool,
  getString,
  getStringArray,
  type AnyRecord,
} from "./shared_runtime.ts";

const STEP_ID = "1.2";
const STEP_NAME = "1.2_subscribe_program_logs";

function parseCliPanel(argv: string[]): string | undefined {
  const idx = argv.findIndex((x) => x === "--panel");
  if (idx >= 0 && idx + 1 < argv.length) {
    return argv[idx + 1];
  }
  return undefined;
}

function writeJsonl(filePath: string, records: unknown[]): void {
  mkdirSync(dirname(filePath), { recursive: true });
  for (const rec of records) {
    appendFileSync(filePath, JSON.stringify(rec) + "\n", "utf-8");
  }
}

function buildMockEvents(programIds: string[], count: number): AnyRecord[] {
  const out: AnyRecord[] = [];
  for (let i = 0; i < count; i += 1) {
    out.push({
      event_id: "mock_" + String(i + 1),
      chain: "solana",
      program_id: programIds[i % Math.max(programIds.length, 1)] ?? "mock_program",
      slot: 100000 + i,
      signature: "mock_sig_" + String(i + 1),
      event_type: "ProgramLog",
      subjects: [],
      payload: {
        source: "mock",
        message: "Mock event for listener scaffold",
      },
      observed_at_utc: new Date().toISOString(),
    });
  }
  return out;
}

async function subscribeLive(
  stepId: string,
  wsUrl: string,
  programId: string,
  timeoutMs: number,
): Promise<AnyRecord[]> {
  const WsCtor = (globalThis as unknown as AnyRecord).WebSocket;
  if (typeof WsCtor !== "function") {
    throw new Error("WebSocket API is unavailable in runtime.");
  }

  return await new Promise<AnyRecord[]>((resolvePromise, rejectPromise) => {
    let subscriptionId: number | null = null;
    const captured: AnyRecord[] = [];
    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {
        // ignore close errors in timeout path
      }
      resolvePromise(captured);
    }, timeoutMs);

    let ws: WebSocket;
    try {
      ws = new (WsCtor as new (url: string) => WebSocket)(wsUrl);
    } catch (err: unknown) {
      clearTimeout(timer);
      rejectPromise(err);
      return;
    }

    ws.onopen = () => {
      p(stepId, "▶ WS_CONNECTED " + wsUrl);
      const req = {
        jsonrpc: "2.0",
        id: 1,
        method: "logsSubscribe",
        params: [{ mentions: [programId] }, { commitment: "confirmed" }],
      };
      ws.send(JSON.stringify(req));
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(String(evt.data)) as AnyRecord;
        if (typeof msg.id === "number" && msg.id === 1) {
          const result = (msg.result ?? null) as number | null;
          subscriptionId = typeof result === "number" ? result : null;
          p(stepId, "▶ SUBSCRIBED subscription_id=" + String(subscriptionId));
          return;
        }
        const params = (msg.params ?? {}) as AnyRecord;
        const value = ((params.result as AnyRecord)?.value ?? {}) as AnyRecord;
        const sig = String(value.signature ?? "");
        const slot = Number((params.result as AnyRecord)?.context?.slot ?? 0);
        captured.push({
          event_id: "live_" + sig,
          chain: "solana",
          program_id: programId,
          slot,
          signature: sig,
          event_type: "ProgramLog",
          subjects: [],
          payload: value,
          observed_at_utc: new Date().toISOString(),
        });
      } catch {
        // ignore malformed ws message in scaffold
      }
    };

    ws.onerror = () => {
      clearTimeout(timer);
      rejectPromise(new Error("WebSocket subscription error"));
    };

    ws.onclose = () => {
      clearTimeout(timer);
      resolvePromise(captured);
    };
  });
}

async function main(): Promise<void> {
  p(STEP_ID, "▶ START " + STEP_NAME);

  const cliPanel = parseCliPanel(process.argv);
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const { panelPath, registryPath } = resolvePanelPath(STEP_ID, scriptDir, cliPanel);
  const panel = loadPanel(STEP_ID, panelPath);

  p(STEP_ID, "▶ INPUTS");
  p(STEP_ID, "  panel_path: " + panelPath);
  p(STEP_ID, "  registry:   " + registryPath);

  const wsUrl = getString(panel, "network.solana.ws_url");
  const programIds = getStringArray(panel, "listener.program_ids");
  const timeoutMs = Number(getString(panel, "listener.subscription_timeout_ms", "7000"));
  const mockMode = getBool(panel, "network.mock_mode", true);
  const fallbackToMock = getBool(panel, "listener.fallback_to_mock_on_error", true);
  const mockCount = Number(getString(panel, "listener.mock_event_count", "3"));

  if (!wsUrl) {
    fatal(STEP_ID, "network.solana.ws_url is required in panel.");
  }
  if (programIds.length === 0) {
    fatal(STEP_ID, "listener.program_ids must contain at least one program id.");
  }

  p(STEP_ID, "▶ PHASE subscribe");
  p(STEP_ID, "▶ DECISIONS");
  p(STEP_ID, "  mock_mode: " + String(mockMode));
  p(STEP_ID, "  fallback_to_mock_on_error: " + String(fallbackToMock));
  p(STEP_ID, "  program_ids_count: " + String(programIds.length));

  let modeUsed = "mock";
  let events: AnyRecord[] = [];
  let liveError = "";

  if (!mockMode) {
    try {
      events = await subscribeLive(STEP_ID, wsUrl, programIds[0], timeoutMs);
      modeUsed = "live";
    } catch (err: unknown) {
      liveError = err instanceof Error ? err.message : String(err);
      p(STEP_ID, "⚠ LIVE_SUBSCRIBE_FAILED " + liveError);
      if (!fallbackToMock) {
        throw err;
      }
      events = buildMockEvents(programIds, Math.max(mockCount, 1));
      modeUsed = "mock_fallback";
    }
  } else {
    events = buildMockEvents(programIds, Math.max(mockCount, 1));
    modeUsed = "mock";
  }

  const stepRunRoot = resolvePanelPathKey(STEP_ID, panel, "step_run_root");
  const eventsPath = resolve(stepRunRoot, "log", "events.jsonl");
  const resultPath = resolve(stepRunRoot, "meta", "result.json");

  writeJsonl(eventsPath, events);
  writeJson(resultPath, {
    step_id: STEP_ID,
    step_name: STEP_NAME,
    mode_used: modeUsed,
    events_captured: events.length,
    program_ids: programIds,
    ws_url: wsUrl,
    live_error: liveError || null,
    created_at_utc: new Date().toISOString(),
  });

  p(STEP_ID, "▶ EVENTS_CAPTURED " + String(events.length));
  p(STEP_ID, "▶ ARTIFACT " + eventsPath);
  p(STEP_ID, "▶ ARTIFACT " + resultPath);
  p(STEP_ID, "▶ DONE");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[" + STEP_ID + "] ❌ ERROR " + message);
  process.exit(1);
});
