from __future__ import annotations

STEP_ID = "1.6"
STEP_NAME = "1.6_emit_ui_signal"
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
    p(STEP_ID, "▶ PHASE emit_ui_signal")

    ui_cfg = panel.get("ui_signal") if isinstance(panel, dict) else {}
    if not isinstance(ui_cfg, dict):
        ui_cfg = {}

    advisory_file = str(ui_cfg.get("input_advisory_message_file", "")).strip() or "3_Runtime/ai_orchestrator/steps/1_5/data/advisory_message.json"
    default_reaction = str(ui_cfg.get("default_reaction", "pulse_neutral"))
    default_voice_style = str(ui_cfg.get("default_voice_style", "neutral"))
    default_intensity = _safe_float(ui_cfg.get("default_intensity", 0.5), 0.5)

    advisory_message = read_json(resolve_cluster_relative(STEP_ID, advisory_file))

    ui_reaction = str(advisory_message.get("ui_reaction", "")).strip() or default_reaction
    voice_style = str(advisory_message.get("voice_style", "")).strip() or default_voice_style
    confidence = _safe_float(advisory_message.get("confidence_score", default_intensity), default_intensity)
    confidence = max(0.0, min(1.0, confidence))

    ui_signal = {
        "reaction": ui_reaction,
        "voice_style": voice_style,
        "intensity": confidence,
        "source_step_id": "1.5",
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
    }

    step_run_root = get_path(paths, STEP_ID, "step_run_root")
    ui_signal_path = step_run_root / "data" / "ui_signal.json"
    result_path = step_run_root / "meta" / "result.json"

    write_json(ui_signal_path, ui_signal)
    write_json(
        result_path,
        {
            "step_id": STEP_ID,
            "step_name": STEP_NAME,
            "ui_signal_path": str(ui_signal_path),
            "reaction": ui_reaction,
            "intensity": confidence,
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
        },
    )

    p(STEP_ID, "▶ DECISIONS")
    p(STEP_ID, f"  reaction: {ui_reaction}")
    p(STEP_ID, f"  voice_style: {voice_style}")
    p(STEP_ID, f"  intensity: {confidence:.3f}")
    p(STEP_ID, f"▶ ARTIFACT {ui_signal_path}")
    p(STEP_ID, f"▶ ARTIFACT {result_path}")
    p(STEP_ID, "▶ DONE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
