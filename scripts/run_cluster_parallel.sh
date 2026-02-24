#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLASSIC_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
OASIS_ROOT="$(cd "${CLASSIC_ROOT}/.." && pwd)"
PIPELINE_SCRIPT="${CLASSIC_ROOT}/cluster_parallel/OASIS_Pipeline/run_mvp_smoke.sh"

if [[ ! -f "${PIPELINE_SCRIPT}" ]]; then
  echo "[classic] missing pipeline script: ${PIPELINE_SCRIPT}" >&2
  exit 1
fi

echo "[classic] running cluster-parallel smoke from Classic_Version"
echo "[classic] OASIS_ROOT=${OASIS_ROOT}"

CLUSTER_ROOT="${OASIS_ROOT}" "${PIPELINE_SCRIPT}"
