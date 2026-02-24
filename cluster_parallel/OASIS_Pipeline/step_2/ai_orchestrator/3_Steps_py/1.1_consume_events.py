from __future__ import annotations

STEP_ID = "1.1"
STEP_NAME = "1.1_consume_events"
LOGIC_VERSION = "0.0.1"

from datetime import datetime, timezone
import sys
from typing import Any, Dict, List, Optional

from shared_tool_connector import run_connector  # pyright: ignore[reportMissingImports]
from shared_runtime import get_path, p, resolve_cluster_relative, write_json, write_jsonl, read_jsonl


def _mock_events() -> List[Dict[str, Any]]:
    now = datetime.now(timezone.utc).isoformat()
    return [
        {
            "event_id": "orchestrator_mock_1",
            "chain": "solana",
            "program_id": "11111111111111111111111111111111",
            "slot": 123456,
            "signature": "mock_sig_1",
            "event_type": "ProgramLog",
            "subjects": [],
            "payload": {"source": "mock", "message": "consume_events fallback"},
            "observed_at_utc": now,
        }
    ]


def main(argv: Optional[List[str]] = None) -> int:
    bundle = run_connector(step_id=STEP_ID, cli_panel=None, argv=sys.argv)
    _ = argv

    panel = bundle.get("panel_resolved") or {}
    paths = bundle.get("paths") or {}

    p(STEP_ID, f"▶ START {STEP_NAME}")
    p(STEP_ID, "▶ PHASE consume")

    consumer = panel.get("consumer") if isinstance(panel, dict) else {}
    if not isinstance(consumer, dict):
        consumer = {}

    input_events_file = str(consumer.get("input_events_file", "")).strip()
    mock_on_missing = bool(consumer.get("mock_on_missing_input", True))
    max_events = int(consumer.get("max_events", 500))

    if not input_events_file:
        input_events_file = (
            "3_Runtime/solana_listener/steps/1_2/log/events.jsonl"
        )

    source_path = resolve_cluster_relative(STEP_ID, input_events_file)
    events = read_jsonl(source_path)
    mode_used = "live_file"

    if not events:
        if not mock_on_missing:
            raise RuntimeError(f"[{STEP_ID}] ❌ ERROR no input events at {source_path}")
        events = _mock_events()
        mode_used = "mock_fallback"

    events = events[: max(1, max_events)]

    step_run_root = get_path(paths, STEP_ID, "step_run_root")
    out_events = step_run_root / "data" / "consumed_events.jsonl"
    out_result = step_run_root / "meta" / "result.json"

    written = write_jsonl(out_events, events)
    write_json(
        out_result,
        {
            "step_id": STEP_ID,
            "step_name": STEP_NAME,
            "mode_used": mode_used,
            "source_events_path": str(source_path),
            "consumed_events_path": str(out_events),
            "events_count": written,
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
        },
    )

    p(STEP_ID, "▶ DECISIONS")
    p(STEP_ID, f"  mode_used: {mode_used}")
    p(STEP_ID, f"  events_count: {written}")
    p(STEP_ID, f"▶ ARTIFACT {out_events}")
    p(STEP_ID, f"▶ ARTIFACT {out_result}")
    p(STEP_ID, "▶ DONE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
