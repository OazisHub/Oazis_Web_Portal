# Data Contracts (Classic)

## chain_event
Producer: `solana-listener`
Consumer: `ai-orchestrator`

```json
{
  "event_id": "string",
  "chain": "solana",
  "program_id": "string",
  "slot": 0,
  "signature": "string",
  "event_type": "string",
  "subjects": ["string"],
  "payload": {}
}
```

## voice_turn
Producer: `portal-frontend-3d`
Consumer: `ai-orchestrator`

```json
{
  "session_id": "string",
  "wallet_pubkey": "string|null",
  "utterance_text": "string",
  "detected_intent": "string|null",
  "context_scope": "portal|session|dao"
}
```

## advisory_message
Producer: `ai-orchestrator`
Consumer: `portal-frontend-3d`

```json
{
  "message_text": "string",
  "reasoning_summary": "string",
  "related_entities": {},
  "ui_reaction": "string",
  "voice_style": "calm|neutral|other",
  "confidence_score": 0.0
}
```

## Security Contract
- AI cannot sign transactions
- Backend has no user private keys
- State changes only after user wallet signature
