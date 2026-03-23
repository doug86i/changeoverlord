#!/usr/bin/env sh
set -eu

if [ $# -ne 1 ]; then
  echo "Usage: ./scripts/preflight-beta.sh <public-base-url>"
  exit 1
fi

BASE_URL=$1
ORIGIN_HEADER=${2:-https://invalid-origin.example}

echo "Checking health endpoint"
curl -fsS "$BASE_URL/api/v1/health" >/dev/null
echo "OK: health endpoint reachable"

echo "Checking security headers"
HDR_FILE=$(mktemp)
trap 'rm -f "$HDR_FILE"' EXIT
curl -fsS -D "$HDR_FILE" -o /dev/null "$BASE_URL/"
if ! awk 'tolower($0) ~ /^strict-transport-security:/' "$HDR_FILE" >/dev/null; then
  echo "WARN: Strict-Transport-Security header not found"
else
  echo "OK: HSTS header present"
fi

echo "Checking CORS deny for unknown origin"
CORS_HDR_FILE=$(mktemp)
trap 'rm -f "$HDR_FILE" "$CORS_HDR_FILE"' EXIT
curl -fsS -D "$CORS_HDR_FILE" -o /dev/null -H "Origin: $ORIGIN_HEADER" "$BASE_URL/api/v1/health"
if awk 'tolower($0) ~ /^access-control-allow-origin:/' "$CORS_HDR_FILE" >/dev/null; then
  echo "WARN: CORS allow-origin header returned for unknown origin: $ORIGIN_HEADER"
else
  echo "OK: unknown origin not allowed"
fi

echo "Checking shared password enforcement state"
SETTINGS_JSON=$(curl -fsS "$BASE_URL/api/v1/settings")
if printf "%s" "$SETTINGS_JSON" | grep -Eq "\"hasPassword\"[[:space:]]*:[[:space:]]*true"; then
  echo "OK: shared password is configured"
else
  echo "WARN: shared password is not configured (open mode). Enable password before internet exposure."
fi

echo "Preflight complete (manual websocket/collab test still required)"
