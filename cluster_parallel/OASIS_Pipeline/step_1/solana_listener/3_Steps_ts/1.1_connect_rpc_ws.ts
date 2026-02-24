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
  type AnyRecord,
} from "./shared_runtime.ts";

const STEP_ID = "1.1";
const STEP_NAME = "1.1_connect_rpc_ws";

function parseCliPanel(argv: string[]): string | undefined {
  const idx = argv.findIndex((x) => x === "--panel");
  if (idx >= 0 && idx + 1 < argv.length) {
    return argv[idx + 1];
  }
  return undefined;
}

async function checkRpc(stepId: string, rpcUrl: string, timeoutMs: number): Promise<boolean> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getHealth",
      }),
      signal: ac.signal,
    });
    p(stepId, "▶ RPC_STATUS code=" + String(res.status));
    return res.ok;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    p(stepId, "⚠ RPC_CHECK_FAILED " + msg);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function checkWs(stepId: string, wsUrl: string, timeoutMs: number): Promise<boolean> {
  const WsCtor = (globalThis as unknown as AnyRecord).WebSocket;
  if (typeof WsCtor !== "function") {
    p(stepId, "⚠ WS_CHECK_SKIPPED WebSocket not available in runtime");
    return false;
  }

  return await new Promise<boolean>((resolvePromise) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      p(stepId, "⚠ WS_TIMEOUT");
      resolvePromise(false);
    }, timeoutMs);

    try {
      const ws = new (WsCtor as new (url: string) => WebSocket)(wsUrl);
      ws.onopen = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        ws.close();
        p(stepId, "▶ WS_STATUS open");
        resolvePromise(true);
      };
      ws.onerror = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolvePromise(false);
      };
    } catch {
      if (!done) {
        done = true;
        clearTimeout(timer);
        resolvePromise(false);
      }
    }
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

  const rpcUrl = getString(panel, "network.solana.rpc_http_url");
  const wsUrl = getString(panel, "network.solana.ws_url");
  const timeoutMs = Number(getString(panel, "network.solana.connect_timeout_ms", "4000"));
  const mockMode = getBool(panel, "network.mock_mode", true);

  if (!rpcUrl || !wsUrl) {
    fatal(STEP_ID, "network.solana.rpc_http_url and network.solana.ws_url are required in panel.");
  }

  p(STEP_ID, "▶ PHASE connect");
  p(STEP_ID, "▶ DECISIONS");
  p(STEP_ID, "  mock_mode: " + String(mockMode));
  p(STEP_ID, "  rpc_url:   " + rpcUrl);
  p(STEP_ID, "  ws_url:    " + wsUrl);

  let modeUsed = "mock";
  let rpcOk = false;
  let wsOk = false;

  if (!mockMode) {
    rpcOk = await checkRpc(STEP_ID, rpcUrl, timeoutMs);
    wsOk = await checkWs(STEP_ID, wsUrl, timeoutMs);
    modeUsed = "live";
  } else {
    p(STEP_ID, "▶ MOCK_CONNECT using panel.network.mock_mode=true");
    rpcOk = true;
    wsOk = true;
  }

  const stepRunRoot = resolvePanelPathKey(STEP_ID, panel, "step_run_root");
  const resultPath = resolve(stepRunRoot, "meta", "result.json");
  const payload = {
    step_id: STEP_ID,
    step_name: STEP_NAME,
    mode_used: modeUsed,
    mock_mode: mockMode,
    rpc_url: rpcUrl,
    ws_url: wsUrl,
    rpc_ok: rpcOk,
    ws_ok: wsOk,
    connected: rpcOk && wsOk,
    created_at_utc: new Date().toISOString(),
  };
  writeJson(resultPath, payload);
  p(STEP_ID, "▶ ARTIFACT " + resultPath);
  p(STEP_ID, "▶ DONE");
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("[" + STEP_ID + "] ❌ ERROR " + message);
  process.exit(1);
});
