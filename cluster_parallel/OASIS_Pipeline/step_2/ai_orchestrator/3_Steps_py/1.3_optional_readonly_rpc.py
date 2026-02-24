from __future__ import annotations

STEP_ID = "1.3"
STEP_NAME = "1.3_optional_readonly_rpc"
LOGIC_VERSION = "0.0.1"

from datetime import datetime, timezone
import json
import sys
from typing import Any, Dict, List, Optional
from urllib.error import URLError
from urllib.request import Request, urlopen

from shared_tool_connector import run_connector  # pyright: ignore[reportMissingImports]
from shared_runtime import get_path, p, write_json


def _rpc_call(url: str, method: str, params: List[Any], timeout_sec: int) -> Dict[str, Any]:
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params,
    }
    req = Request(
        url=url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(req, timeout=max(1, timeout_sec)) as resp:  # nosec - RPC endpoint from panel
        raw = resp.read().decode("utf-8")
    return json.loads(raw)


def main(argv: Optional[List[str]] = None) -> int:
    bundle = run_connector(step_id=STEP_ID, cli_panel=None, argv=sys.argv)
    _ = argv

    panel = bundle.get("panel_resolved") or {}
    paths = bundle.get("paths") or {}

    p(STEP_ID, f"▶ START {STEP_NAME}")
    p(STEP_ID, "▶ PHASE readonly_rpc")

    rpc_cfg = panel.get("rpc") if isinstance(panel, dict) else {}
    if not isinstance(rpc_cfg, dict):
        rpc_cfg = {}

    enabled = bool(rpc_cfg.get("enabled", True))
    mock_mode = bool(rpc_cfg.get("mock_mode", True))
    rpc_url = str(rpc_cfg.get("rpc_http_url", "")).strip()
    method = str(rpc_cfg.get("method", "getEpochInfo")).strip() or "getEpochInfo"
    params = rpc_cfg.get("params", [])
    timeout_sec = int(rpc_cfg.get("timeout_sec", 8))
    fallback_mock_response = rpc_cfg.get("fallback_mock_response", {})
    if not isinstance(params, list):
        params = []
    if not isinstance(fallback_mock_response, dict):
        fallback_mock_response = {}

    p(STEP_ID, "▶ DECISIONS")
    p(STEP_ID, f"  enabled: {enabled}")
    p(STEP_ID, f"  mock_mode: {mock_mode}")
    p(STEP_ID, f"  method: {method}")

    mode_used = "skipped"
    rpc_result: Dict[str, Any] = {}
    rpc_error: Optional[str] = None

    if enabled:
        if mock_mode:
            mode_used = "mock"
            rpc_result = fallback_mock_response
        else:
            mode_used = "live"
            if not rpc_url:
                raise RuntimeError(f"[{STEP_ID}] ❌ ERROR rpc.rpc_http_url is required in live mode")
            try:
                response = _rpc_call(rpc_url, method, params, timeout_sec)
                if "error" in response:
                    raise RuntimeError(str(response["error"]))
                rpc_result = response.get("result", {}) if isinstance(response, dict) else {}
                if not isinstance(rpc_result, dict):
                    rpc_result = {"value": rpc_result}
            except (URLError, TimeoutError, RuntimeError, ValueError) as err:
                rpc_error = str(err)
                p(STEP_ID, f"⚠ RPC_FAILED {rpc_error}")
                mode_used = "mock_fallback"
                rpc_result = fallback_mock_response

    step_run_root = get_path(paths, STEP_ID, "step_run_root")
    snapshot_path = step_run_root / "data" / "rpc_snapshot.json"
    result_path = step_run_root / "meta" / "result.json"

    write_json(
        snapshot_path,
        {
            "step_id": STEP_ID,
            "mode_used": mode_used,
            "rpc_method": method,
            "rpc_result": rpc_result,
            "rpc_error": rpc_error,
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
        },
    )
    write_json(
        result_path,
        {
            "step_id": STEP_ID,
            "step_name": STEP_NAME,
            "mode_used": mode_used,
            "snapshot_path": str(snapshot_path),
            "rpc_error": rpc_error,
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
        },
    )

    p(STEP_ID, f"▶ ARTIFACT {snapshot_path}")
    p(STEP_ID, f"▶ ARTIFACT {result_path}")
    p(STEP_ID, "▶ DONE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
