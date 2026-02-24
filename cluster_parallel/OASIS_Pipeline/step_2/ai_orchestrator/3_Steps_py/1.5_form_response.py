from __future__ import annotations

STEP_ID = "1.5"
STEP_NAME = "1.5_form_response"
LOGIC_VERSION = "0.0.1"

from datetime import datetime, timezone
import sys
from typing import Any, Dict, List, Optional

from shared_tool_connector import run_connector  # pyright: ignore[reportMissingImports]
from shared_runtime import get_path, p, resolve_cluster_relative, write_json, read_json


def _safe_float(value: Any, default: float) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value))
    except (TypeError, ValueError):
        return default


def main(argv: Optional[List[str]] = None) -> int:
    bundle = run_connector(step_id=STEP_ID, cli_panel=None, argv=sys.argv)
    _ = argv

    panel = bundle.get("panel_resolved") or {}
    paths = bundle.get("paths") or {}

    p(STEP_ID, f"▶ START {STEP_NAME}")
    p(STEP_ID, "▶ PHASE compose_advisory")

    response_cfg = panel.get("response") if isinstance(panel, dict) else {}
    if not isinstance(response_cfg, dict):
        response_cfg = {}

    overlay_path = str(response_cfg.get("input_ai_overlay_file", "")).strip() or "3_Runtime/ai_orchestrator/steps/1_4/data/ai_overlay.json"
    context_path = str(response_cfg.get("input_context_file", "")).strip() or "3_Runtime/ai_orchestrator/steps/1_2/data/context_payload.json"
    rpc_path = str(response_cfg.get("input_rpc_snapshot_file", "")).strip() or "3_Runtime/ai_orchestrator/steps/1_3/data/rpc_snapshot.json"

    fallback = response_cfg.get("fallback", {})
    if not isinstance(fallback, dict):
        fallback = {}

    overlay_doc = read_json(resolve_cluster_relative(STEP_ID, overlay_path))
    overlay = overlay_doc.get("overlay", {})
    if not isinstance(overlay, dict):
        overlay = {}
    context_payload = read_json(resolve_cluster_relative(STEP_ID, context_path))
    rpc_snapshot = read_json(resolve_cluster_relative(STEP_ID, rpc_path))

    message_text = str(overlay.get("message_text", "")).strip() or str(
        fallback.get("message_text", "No fresh signal available; providing safe fallback advisory.")
    )
    reasoning_summary = str(overlay.get("reasoning_summary", "")).strip() or str(
        fallback.get("reasoning_summary", "Fallback path used because AI overlay was missing or invalid.")
    )
    ui_reaction = str(overlay.get("ui_reaction", "")).strip() or str(
        fallback.get("ui_reaction", "pulse_neutral")
    )
    voice_style = str(overlay.get("voice_style", "")).strip() or str(
        fallback.get("voice_style", "neutral")
    )
    confidence_score = _safe_float(
        overlay.get("confidence_score", fallback.get("confidence_score", 0.55)),
        0.55,
    )
    confidence_score = max(0.0, min(1.0, confidence_score))

    related_entities = overlay.get("related_entities", {})
    if not isinstance(related_entities, dict):
        related_entities = {}

    advisory_message = {
        "message_text": message_text,
        "reasoning_summary": reasoning_summary,
        "related_entities": {
            **related_entities,
            "event_count": context_payload.get("event_count"),
            "program_ids": context_payload.get("program_ids"),
            "rpc_method": rpc_snapshot.get("rpc_method"),
        },
        "ui_reaction": ui_reaction,
        "voice_style": voice_style,
        "confidence_score": confidence_score,
    }

    step_run_root = get_path(paths, STEP_ID, "step_run_root")
    advisory_path = step_run_root / "data" / "advisory_message.json"
    result_path = step_run_root / "meta" / "result.json"

    write_json(advisory_path, advisory_message)
    write_json(
        result_path,
        {
            "step_id": STEP_ID,
            "step_name": STEP_NAME,
            "advisory_message_path": str(advisory_path),
            "confidence_score": confidence_score,
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
        },
    )

    p(STEP_ID, "▶ DECISIONS")
    p(STEP_ID, f"  ui_reaction: {ui_reaction}")
    p(STEP_ID, f"  voice_style: {voice_style}")
    p(STEP_ID, f"  confidence_score: {confidence_score:.3f}")
    p(STEP_ID, f"▶ ARTIFACT {advisory_path}")
    p(STEP_ID, f"▶ ARTIFACT {result_path}")
    p(STEP_ID, "▶ DONE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
