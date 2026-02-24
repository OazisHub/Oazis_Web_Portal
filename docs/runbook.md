# Runbook (Classic)

## 1. Prerequisites
- Node.js 25+
- Python 3.10+

## 2. One-click smoke

```bash
cd <repo_root>
make setup
make up
make smoke
```

## 3. What smoke validates
- Listener steps execute and produce normalized event artifacts
- Orchestrator consumes/enriches and emits advisory/ui signal
- Portal renders reply/avatar state
- Web API returns:
  - `/api/ui-signal`
  - `/api/advisory-message`

## 4. Minimum production checklist
- Configure real RPC/WS endpoints
- Add queue + retry + dead-letter
- Add schema validation on boundaries
- Add auth/rate limits for API
- Add observability dashboard + alerting
