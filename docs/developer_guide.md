# Developer Guide (Classic)

## 1. Quick start
1. `cd <repo_root>`
2. `make setup`
3. Fill `.env` (at minimum `OPENAI_API_KEY` if non-mock)
4. `make up`
5. `make smoke`

## 2. Service endpoints
- Listener: `http://localhost:8101`
- Orchestrator: `http://localhost:8102`
- Portal: `http://localhost:8103`

## 3. Contracts location
- `shared/contracts/chain_event.json`
- `shared/contracts/voice_turn.json`
- `shared/contracts/advisory_message.json`

## 4. Recommended workflow for external dev teams
- Start in mock mode (`LISTENER_MOCK_MODE=true`, `AI_MOCK_MODE=true`)
- Stabilize API contracts first
- Replace mock internals with real integrations incrementally
- Keep external API stable while swapping internals

## 5. Security baseline
- No private keys in backend
- Read-only blockchain calls from backend
- All write transactions only via client wallet signature
