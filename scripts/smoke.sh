#!/usr/bin/env bash
set -euo pipefail

echo "[smoke] checking services"

curl -fsS http://localhost:${LISTENER_PORT:-8101}/health >/dev/null
curl -fsS http://localhost:${ORCHESTRATOR_PORT:-8102}/health >/dev/null
curl -fsS http://localhost:${PORTAL_PORT:-8103}/health >/dev/null

echo "[smoke] listener latest event"
curl -fsS http://localhost:${LISTENER_PORT:-8101}/events/latest

echo "\n[smoke] orchestrator advisory"
curl -fsS http://localhost:${ORCHESTRATOR_PORT:-8102}/advisory/latest

echo "\n[smoke] portal advisory proxy"
curl -fsS http://localhost:${PORTAL_PORT:-8103}/api/advisory-message

echo "\n[smoke] portal ui signal proxy"
curl -fsS http://localhost:${PORTAL_PORT:-8103}/api/ui-signal

echo "\n[smoke] OK"
