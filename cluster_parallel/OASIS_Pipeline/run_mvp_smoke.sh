#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLUSTER_ROOT_DEFAULT="$(cd "${SCRIPT_DIR}/../../../.." && pwd)"
CLUSTER_ROOT="${CLUSTER_ROOT:-${CLUSTER_ROOT_DEFAULT}}"
PORT="${PORT:-4173}"

NODE_TS_FLAGS=(--experimental-strip-types --experimental-transform-types)

log() {
  printf '[SMOKE] %s\n' "$1"
}

run_step() {
  local title="$1"
  shift
  log "▶ ${title}"
  "$@"
  log "✓ ${title}"
}

ensure_active_job() {
  local active_job_path="${CLUSTER_ROOT}/3_Media_Bank/0_local_runtime/active_job/active_job.json"
  if [[ ! -f "${active_job_path}" ]]; then
    mkdir -p "$(dirname "${active_job_path}")"
    cat > "${active_job_path}" <<'JSON'
{
  "job_id": "oasis_smoke_local",
  "created_at_utc": "1970-01-01T00:00:00Z",
  "note": "autocreated by run_mvp_smoke.sh"
}
JSON
    log "▶ ACTIVE_JOB autocreated at ${active_job_path}"
  else
    log "▶ ACTIVE_JOB present: ${active_job_path}"
  fi
}

SERVER_PID=""
cleanup() {
  if [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
    wait "${SERVER_PID}" 2>/dev/null || true
    log "▶ web_portal server stopped"
  fi
}
trap cleanup EXIT

log "▶ START OASIS MVP smoke"
log "▶ CLUSTER_ROOT=${CLUSTER_ROOT}"

ensure_active_job

SOLANA_TS_ROOT="${SCRIPT_DIR}/step_1/solana_listener/3_Steps_ts"
AI_PY_ROOT="${SCRIPT_DIR}/step_2/ai_orchestrator/3_Steps_py"
PORTAL_TS_ROOT="${SCRIPT_DIR}/step_3/portal_frontend_3d/3_Steps_ts"
PORTAL_WEB_ROOT="${SCRIPT_DIR}/step_3/portal_frontend_3d/web_portal"

run_step "solana_listener 1.1_connect_rpc_ws" \
  env CLUSTER_ROOT="${CLUSTER_ROOT}" node "${NODE_TS_FLAGS[@]}" "${SOLANA_TS_ROOT}/1.1_connect_rpc_ws.ts"
run_step "solana_listener 1.2_subscribe_program_logs" \
  env CLUSTER_ROOT="${CLUSTER_ROOT}" node "${NODE_TS_FLAGS[@]}" "${SOLANA_TS_ROOT}/1.2_subscribe_program_logs.ts"

run_step "ai_orchestrator 1.1_consume_events" \
  env CLUSTER_ROOT="${CLUSTER_ROOT}" python3 "${AI_PY_ROOT}/1.1_consume_events.py"
run_step "ai_orchestrator 1.2_load_context" \
  env CLUSTER_ROOT="${CLUSTER_ROOT}" python3 "${AI_PY_ROOT}/1.2_load_context.py"
run_step "ai_orchestrator 1.3_optional_readonly_rpc" \
  env CLUSTER_ROOT="${CLUSTER_ROOT}" python3 "${AI_PY_ROOT}/1.3_optional_readonly_rpc.py"
run_step "ai_orchestrator 1.4_call_ai" \
  env CLUSTER_ROOT="${CLUSTER_ROOT}" python3 "${AI_PY_ROOT}/1.4_call_ai.py"
run_step "ai_orchestrator 1.5_form_response" \
  env CLUSTER_ROOT="${CLUSTER_ROOT}" python3 "${AI_PY_ROOT}/1.5_form_response.py"
run_step "ai_orchestrator 1.6_emit_ui_signal" \
  env CLUSTER_ROOT="${CLUSTER_ROOT}" python3 "${AI_PY_ROOT}/1.6_emit_ui_signal.py"

run_step "portal_frontend_3d 1.1_voice_capture" \
  env CLUSTER_ROOT="${CLUSTER_ROOT}" node "${NODE_TS_FLAGS[@]}" "${PORTAL_TS_ROOT}/1.1_voice_capture.ts"
run_step "portal_frontend_3d 1.2_send_turn" \
  env CLUSTER_ROOT="${CLUSTER_ROOT}" node "${NODE_TS_FLAGS[@]}" "${PORTAL_TS_ROOT}/1.2_send_turn.ts"
run_step "portal_frontend_3d 1.3_render_reply" \
  env CLUSTER_ROOT="${CLUSTER_ROOT}" node "${NODE_TS_FLAGS[@]}" "${PORTAL_TS_ROOT}/1.3_render_reply.ts"
run_step "portal_frontend_3d 1.4_avatar_react" \
  env CLUSTER_ROOT="${CLUSTER_ROOT}" node "${NODE_TS_FLAGS[@]}" "${PORTAL_TS_ROOT}/1.4_avatar_react.ts"

log "▶ START web_portal server for API smoke"
env CLUSTER_ROOT="${CLUSTER_ROOT}" PORT="${PORT}" node "${PORTAL_WEB_ROOT}/server.js" >/tmp/oasis_portal_server.log 2>&1 &
SERVER_PID="$!"
sleep 1

run_step "web_portal GET /api/ui-signal" curl -fsS "http://localhost:${PORT}/api/ui-signal"
run_step "web_portal GET /api/advisory-message" curl -fsS "http://localhost:${PORT}/api/advisory-message"
run_step "web_portal GET /" sh -c "curl -fsS \"http://localhost:${PORT}/\" | head -n 1"

log "✓ OASIS MVP smoke completed"
