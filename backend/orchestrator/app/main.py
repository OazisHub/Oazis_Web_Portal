import os
from datetime import datetime, timezone
from typing import Any

import requests
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="oasis-ai-orchestrator-classic", version="0.1.0")

LISTENER_URL = os.getenv("LISTENER_BASE_URL", "http://solana-listener:8101")
SOLANA_RPC_URL = os.getenv("SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
MOCK_MODE = os.getenv("AI_MOCK_MODE", "true").lower() == "true"


class VoiceTurn(BaseModel):
    session_id: str
    wallet_pubkey: str | None = None
    utterance_text: str
    detected_intent: str | None = None
    context_scope: str = "portal"


@app.get("/health")
def health() -> dict[str, Any]:
    return {"service": "ai-orchestrator", "ok": True, "mock_mode": MOCK_MODE}


@app.get("/advisory/latest")
def advisory_latest() -> dict[str, Any]:
    event_count = 0
    program_id = "unknown"

    try:
      event = requests.get(f"{LISTENER_URL}/events/latest", timeout=3).json()
      event_count = 1
      program_id = event.get("program_id", "unknown")
    except Exception:
      pass

    epoch = None
    if MOCK_MODE:
      epoch = 622
    else:
      try:
        payload = {"jsonrpc": "2.0", "id": 1, "method": "getEpochInfo"}
        rpc_res = requests.post(SOLANA_RPC_URL, json=payload, timeout=5).json()
        epoch = rpc_res.get("result", {}).get("epoch")
      except Exception:
        epoch = None

    return {
      "message_text": f"Observed {event_count} event(s). Program: {program_id}. Current epoch: {epoch}.",
      "reasoning_summary": "Classic orchestrator response with listener + optional RPC context.",
      "related_entities": {"program_id": program_id, "event_count": event_count, "epoch": epoch},
      "ui_reaction": "pulse_soft_blue",
      "voice_style": "calm",
      "confidence_score": 0.72,
      "created_at_utc": datetime.now(timezone.utc).isoformat()
    }


@app.post("/voice/turn")
def voice_turn(turn: VoiceTurn) -> dict[str, Any]:
    advisory = advisory_latest()
    advisory["message_text"] = f"{advisory['message_text']} You said: {turn.utterance_text}"
    return advisory


@app.get("/ui-signal")
def ui_signal() -> dict[str, Any]:
    return {
      "reaction": "pulse_soft_blue",
      "voice_style": "calm",
      "intensity": 0.72,
      "source": "ai-orchestrator"
    }
