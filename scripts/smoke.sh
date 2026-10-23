#!/usr/bin/env bash
set -euo pipefail

: "${NEURALBUS_BASE_URL:=https://neuralbus.norug.es}"
: "${NEURALBUS_API_KEY:?Set NEURALBUS_API_KEY privately to an nb_... account key}"

if [[ "$NEURALBUS_BASE_URL" != https://* ]]; then
  echo "FAIL: smoke only accepts https URLs" >&2
  exit 1
fi
base="${NEURALBUS_BASE_URL%/}"

check() {
  local label="$1" path="$2" status
  status="$(curl --silent --show-error --location --max-time 15 --output /dev/null --write-out '%{http_code}' \
    --header "X-API-Key: ${NEURALBUS_API_KEY}" \
    --header 'Accept: application/json' "${base}${path}")"
  printf '%s: HTTP %s\n' "$label" "$status"
  [[ "$status" == '200' ]]
}

check 'Credential identity' '/api/v1/product/me'
check 'Blockchain catalog' '/api/v1/chains'
echo 'PASS: Read-only REST connectivity (no live analysis was created).'
