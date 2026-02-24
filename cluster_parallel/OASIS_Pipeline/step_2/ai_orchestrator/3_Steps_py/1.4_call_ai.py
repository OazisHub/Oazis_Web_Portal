from __future__ import annotations

STEP_ID = "1.4"
STEP_NAME = "1.4_call_ai"
LOGIC_VERSION = "0.0.1"

from datetime import datetime, timezone
import json
import os
import sys
from typing import Any, Dict, List, Optional
from urllib.error import URLError
from urllib.request import Request, urlopen

from shared_tool_connector import run_connector  # pyright: ignore[reportMissingImports]
from shared_runtime import get_path, p, resolve_cluster_relative, write_json, read_json


def _build_mock_overlay(context_payload: Dict[str, Any], rpc_snapshot: Dict[str, Any]) -> Dict[str, Any]:
    event_count = int(context_payload.get("event_count", 0))
    program_ids = context_payload.get("program_ids", [])
    if not isinstance(program_ids, list):
        program_ids = []

    epoch = None
    rpc_result = rpc_snapshot.get("rpc_result")
    if isinstance(rpc_result, dict):
        epoch = rpc_result.get("epoch")

    message = (
        f"Observed {event_count} event(s). "
        f"Programs: {', '.join(program_ids[:3]) if program_ids else 'n/a'}."
    )
    if epoch is not None:
        message += f" Current epoch: {epoch}."

    return {
        "message_text": message,
        "reasoning_summary": "Mock advisory generated from context and optional rpc snapshot.",
        "related_entities": {
            "program_ids": program_ids,
            "event_count": event_count,
            "epoch": epoch,
        },
        "ui_reaction": "pulse_soft_blue",
        "voice_style": "calm",
        "confidence_score": 0.72,
        "mode": "mock",
    }


def _call_openai_responses(
    api_key: str,
    model: str,
    system_prompt: str,
    user_payload: Dict[str, Any],
    timeout_sec: int,
) -> Dict[str, Any]:
    body = {
        "model": model,
        "input": [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    "Return strict JSON object with keys: "
                    "message_text, reasoning_summary, related_entities, "
                    "ui_reaction, voice_style, confidence_score.\n"
                    f"Context: {json.dumps(user_payload, ensure_ascii=False)}"
                ),
            },
        ],
        "text": {"format": {"type": "json_object"}},
    }
    req = Request(
        url="https://api.openai.com/v1/responses",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        },
        method="POST",
    )
    with urlopen(req, timeout=max(1, timeout_sec)) as resp:  # nosec - official API endpoint
        raw = resp.read().decode("utf-8")
    response = json.loads(raw)

    output_text = response.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        parsed = json.loads(output_text)
        if isinstance(parsed, dict):
            return parsed

    # Fallback parser if output_text is absent
    output = response.get("output", [])
    if isinstance(output, list):
        for item in output:
            if not isinstance(item, dict):
                continue
            content = item.get("content", [])
            if not isinstance(content, list):
                continue
            for part in content:
                if not isinstance(part, dict):
                    continue
                text = part.get("text")
                if isinstance(text, str) and text.strip():
                    parsed = json.loads(text)
                    if isinstance(parsed, dict):
                        return parsed
    raise RuntimeError("No JSON output returned by OpenAI Responses API.")


def main(argv: Optional[List[str]] = None) -> int:
    bundle = run_connector(step_id=STEP_ID, cli_panel=None, argv=sys.argv)
    _ = argv

    panel = bundle.get("panel_resolved") or {}
    paths = bundle.get("paths") or {}

    p(STEP_ID, f"▶ START {STEP_NAME}")
    p(STEP_ID, "▶ PHASE ai_call")

    ai_cfg = panel.get("ai") if isinstance(panel, dict) else {}
    if not isinstance(ai_cfg, dict):
        ai_cfg = {}
    ai_call_cfg = panel.get("ai_call") if isinstance(panel, dict) else {}
    if not isinstance(ai_call_cfg, dict):
        ai_call_cfg = {}

    ai_enabled = bool(ai_cfg.get("enabled", True))
    mock_mode = bool(ai_call_cfg.get("mock_mode", True))
    model = str(ai_cfg.get("model", "gpt-4.1-mini")).strip() or "gpt-4.1-mini"
    timeout_sec = int(ai_cfg.get("budget", {}).get("timeout_sec", 60)) if isinstance(ai_cfg.get("budget"), dict) else 60

    context_file = str(ai_call_cfg.get("input_context_file", "")).strip() or "3_Runtime/ai_orchestrator/steps/1_2/data/context_payload.json"
    rpc_file = str(ai_call_cfg.get("input_rpc_snapshot_file", "")).strip() or "3_Runtime/ai_orchestrator/steps/1_3/data/rpc_snapshot.json"
    system_prompt = str(ai_call_cfg.get("system_prompt", "")).strip() or "You are Oasis advisory assistant."

    context_payload = read_json(resolve_cluster_relative(STEP_ID, context_file))
    rpc_snapshot = read_json(resolve_cluster_relative(STEP_ID, rpc_file))

    p(STEP_ID, "▶ DECISIONS")
    p(STEP_ID, f"  ai_enabled: {ai_enabled}")
    p(STEP_ID, f"  mock_mode:  {mock_mode}")
    p(STEP_ID, f"  model:      {model}")

    mode_used = "disabled"
    overlay: Dict[str, Any] = {}
    ai_error: Optional[str] = None

    if ai_enabled:
        if mock_mode:
            mode_used = "mock"
            overlay = _build_mock_overlay(context_payload, rpc_snapshot)
        else:
            mode_used = "live"
            api_key = os.getenv("OPENAI_API_KEY", "").strip()
            if not api_key:
                ai_error = "OPENAI_API_KEY is missing; fallback to mock."
                p(STEP_ID, f"⚠ AI_LIVE_FAILED {ai_error}")
                mode_used = "mock_fallback"
                overlay = _build_mock_overlay(context_payload, rpc_snapshot)
            else:
                try:
                    overlay = _call_openai_responses(
                        api_key=api_key,
                        model=model,
                        system_prompt=system_prompt,
                        user_payload={
                            "context_payload": context_payload,
                            "rpc_snapshot": rpc_snapshot,
                        },
                        timeout_sec=timeout_sec,
                    )
                except (URLError, TimeoutError, RuntimeError, ValueError, json.JSONDecodeError) as err:
                    ai_error = str(err)
                    p(STEP_ID, f"⚠ AI_LIVE_FAILED {ai_error}")
                    mode_used = "mock_fallback"
                    overlay = _build_mock_overlay(context_payload, rpc_snapshot)

    step_run_root = get_path(paths, STEP_ID, "step_run_root")
    overlay_path = step_run_root / "data" / "ai_overlay.json"
    result_path = step_run_root / "meta" / "result.json"

    write_json(
        overlay_path,
        {
            "step_id": STEP_ID,
            "mode_used": mode_used,
            "overlay": overlay,
            "ai_error": ai_error,
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
        },
    )
    write_json(
        result_path,
        {
            "step_id": STEP_ID,
            "step_name": STEP_NAME,
            "mode_used": mode_used,
            "overlay_path": str(overlay_path),
            "ai_error": ai_error,
            "created_at_utc": datetime.now(timezone.utc).isoformat(),
        },
    )

    p(STEP_ID, f"▶ ARTIFACT {overlay_path}")
    p(STEP_ID, f"▶ ARTIFACT {result_path}")
    p(STEP_ID, "▶ DONE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
