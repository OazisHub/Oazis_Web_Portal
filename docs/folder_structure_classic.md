# Classic Folder Structure

Ниже финальная структура "по-старинке".

```text
<repo_root>/
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
└── .env.example
```
