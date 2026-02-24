# OASIS Architecture (Classic)

## 1. Overview
Система работает в двух режимах:
- Event-driven: blockchain events -> listener -> orchestrator -> advisory
- Request-driven: user voice/UI request -> orchestrator -> optional read-only RPC -> advisory

## 2. Core Principles
- Blockchain authoritative and deterministic
- AI advisory only
- No private keys in backend services
- Any state-changing transaction requires explicit wallet signature

## 3. Service Topology
1. `solana-listener` (TypeScript)
- Subscribe to logs/account changes
- Normalize raw events into `chain_event`
- Push to queue + persist raw/normalized data

2. `ai-orchestrator` (Python)
- Consume `chain_event` and `voice_turn`
- Load context from storage/indexer
- Execute optional read-only RPC
- Produce `advisory_message` and UI signal

3. `portal-frontend-3d` (TypeScript/WebGL)
- Wallet connect
- Voice capture (STT trigger)
- Send turns to orchestrator
- Render message and avatar reaction

4. `storage/infrastructure`
- PostgreSQL (history/context)
- Redis (cache/session)
- Queue (event transport)
- Optional indexer for chain analytics

## 4. High-level Flow
1. Program emits event/log
2. Listener normalizes event
3. Queue delivers event to orchestrator
4. Orchestrator enriches context (+ optional read-only RPC)
5. AI generates advisory response
6. Portal renders text/voice + avatar reaction

## 5. Scaling Model (100k target)
- Stateless orchestrator workers
- Queue-based backpressure
- Event normalization contract boundary
- Cache for read-heavy queries
- Optional move to Yellowstone gRPC and dedicated indexing
