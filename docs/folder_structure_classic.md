# Classic Folder Structure

Ниже финальная структура "по-старинке" для `Classic_Version`.

```text
Classic_Version/
├── backend/
│   ├── listener/            # Node service: Solana event ingestion
│   └── orchestrator/        # Python FastAPI: context + advisory
├── frontend/
│   └── portal/              # Node web server + portal UI
├── shared/
│   └── contracts/           # JSON schemas (chain_event / voice_turn / advisory_message)
├── infra/
│   └── postgres/            # DB init and infra assets
├── scripts/                 # smoke and helper scripts
├── docs/                    # architecture, runbook, guides
├── docker-compose.yml
├── Makefile
├── .env.example
└── cluster_parallel/
    └── OASIS_Pipeline/      # parallel mirror of cluster-style implementation
```

## Mapping from cluster-style to classic-style
- `step_1/solana_listener` -> `backend/listener`
- `step_2/ai_orchestrator` -> `backend/orchestrator`
- `step_3/portal_frontend_3d` -> `frontend/portal`
- `shared_contracts` -> `shared/contracts`

## Why keep `cluster_parallel`
- Позволяет запускать и сравнивать оригинальный cluster-пайплайн параллельно.
- Удобно для команды: часть работает в classic-layout, часть — в cluster-layout.
