from __future__ import annotations

STEP_ID = "1.2"
STEP_NAME = "1.2_load_context"
LOGIC_VERSION = "0.0.1"

from datetime import datetime, timezone
import sys
from typing import Any, Dict, List, Optional

from shared_tool_connector import run_connector  # pyright: ignore[reportMissingImports]
from shared_runtime import get_path, p, resolve_cluster_relative, write_json, read_jsonl


def _extract_unique(records: List[Dict[str, Any]], key: str) -> List[str]:
    vals = set()
    for rec in records:
        raw = rec.get(key)
        if isinstance(raw, str) and raw.strip():
            vals.add(raw.strip())
    return sorted(vals)


def main(argv: Optional[List[str]] = None) -> int:
    bundle = run_connector(step_id=STEP_ID, cli_panel=None, argv=sys.argv)
    _ = argv

    panel = bundle.get("panel_resolved") or {}
    paths = bundle.get("paths") or {}

    p(STEP_ID, f"▶ START {STEP_NAME}")
    p(STEP_ID, "▶ PHASE load_context")

    context_cfg = panel.get("context") if isinstance(panel, dict) else {}
    if not isinstance(context_cfg, dict):
        context_cfg = {}

    consumed_events_file = str(context_cfg.get("consumed_events_file", "")).strip()
    if not consumed_events_file:
        consumed_events_file = "3_Runtime/ai_orchestrator/steps/1_1/data/consumed_events.jsonl"

    consumed_path = resolve_cluster_relative(STEP_ID, consumed_events_file)
    events = read_jsonl(consumed_path)

    program_ids = _extract_unique(events, "program_id")
    signatures = _extract_unique(events, "signature")
    event_types = _extract_unique(events, "event_type")

    slots: List[int] = []
    for rec in events:
        raw_slot = rec.get("slot")
        if isinstance(raw_slot, int):
            slots.append(raw_slot)
        elif isinstance(raw_slot, float):
            slots.append(int(raw_slot))

    slot_min = min(slots) if slots else None
    slot_max = max(slots) if slots else None

    context_payload = {
        "event_count": len(events),
        "program_ids": program_ids,
        "signatures_count": len(signatures),
        "event_types": event_types,
        "slot_range": {"min": slot_min, "max": slot_max},
        "context_scope_default": context_cfg.get("default_scope", "portal"),
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
    }

    step_run_root = get_path(paths, STEP_ID, "step_run_root")
    context_path = step_run_root / "data" / "context_payload.json"
    result_path = step_run_root / "meta" / "result.json"

    write_json(context_path, context_payload)
    write_json(
        result_path,
        {
            "step_id": STEP_ID,
            "step_name": STEP_NAME,
            "input_events_path": str(consumed_path),
            "output_context_path": str(context_path),
            "event_count": len(events),
            "program_ids_count": len(program_ids),
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
        },
    )

    p(STEP_ID, "▶ DECISIONS")
    p(STEP_ID, f"  event_count: {len(events)}")
    p(STEP_ID, f"  program_ids_count: {len(program_ids)}")
    p(STEP_ID, f"▶ ARTIFACT {context_path}")
    p(STEP_ID, f"▶ ARTIFACT {result_path}")
    p(STEP_ID, "▶ DONE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
