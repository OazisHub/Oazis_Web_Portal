# Oazis Web Portal

Классическая структура проекта для внешней команды
.

## Stack
- Solana (event source)
- Python FastAPI (`ai-orchestrator`)
- Node.js (`solana-listener`, `portal-frontend-3d`)
- PostgreSQL + Redis
- Docker Compose

## Repository Layout
- `backend/listener` — ingest/normalize chain events
- `backend/orchestrator` — context + advisory API
- `frontend/portal` — web portal + proxy API
- `shared/contracts` — JSON schemas for inter-service payloads
- `infra` — infra bootstrap (postgres init)
- `docs` — architecture, plan, runbook, dev guide

## Quick Start
1. `cd <repo_root>`
2. `make setup`
3. Adjust `.env` if needed
4. `make up`
5. `make smoke`

Portal URL after startup:
- `http://localhost:8103`

Project docs:
- `docs/folder_structure_classic.md`
- `TEAM_ONBOARDING.md` (team access + environment setup)

## CI
- Workflow: `.github/workflows/ci.yml`
- Checks:
  - `docker compose config`
  - Python/Node syntax checks
  - Full docker-compose smoke (`make smoke`)

## Notes
- Default mode is mock-friendly for fast onboarding.
- Security model preserved: AI advisory-only, no private keys in backend, write actions require wallet signature.
