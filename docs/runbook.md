# Runbook (Classic)

## 1. Prerequisites
- Node.js 25+
- Python 3.10+
- `CLUSTER_ROOT` set to project root

## 2. One-click smoke (classic layout)

```bash
cd /Users/mg/Documents/S.Polonium/OAZIS/Classic_Version
make setup
make up
make smoke
```

## 3. One-click smoke (cluster-parallel from Classic_Version)

```bash
cd /Users/mg/Documents/S.Polonium/OAZIS/Classic_Version
make cluster-smoke
```

## 4. What smoke validates
- Listener steps execute and produce normalized event artifacts
- Orchestrator consumes/enriches and emits advisory/ui signal
- Portal steps render reply/avatar state
- Web API returns:
  - `/api/ui-signal`
  - `/api/advisory-message`

## 5. Minimum production checklist
- Configure real RPC/WS endpoints
- Add queue + retry + dead-letter
- Add schema validation on boundaries
- Add auth/rate limits for API
- Add observability dashboard + alerting
