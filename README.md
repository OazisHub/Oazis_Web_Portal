# OASIS (Classic Version)

Классическая версия структуры проекта для внешней команды (без кластерно-канонической терминологии).

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
- `cluster_parallel/OASIS_Pipeline` — cluster-style mirror kept in parallel

## Quick Start
1. `cd /Users/mg/Documents/S.Polonium/OAZIS/Classic_Version`
2. `make setup`
3. Adjust `.env` if needed
4. `make up`
5. `make smoke`

Portal URL after startup:
- `http://localhost:8103`

Classic tree overview:
- `docs/folder_structure_classic.md`

## CI
- Workflow: `.github/workflows/classic-version-ci.yml`
- Checks:
  - `docker compose config`
  - Python/Node syntax checks
  - Full docker-compose smoke (`make smoke`)

## Notes
- Default mode is mock-friendly for fast onboarding.
- Security model preserved: AI advisory-only, no private keys in backend, write actions require wallet signature.
- Parallel cluster mirror can be run from here with `make cluster-smoke`.
