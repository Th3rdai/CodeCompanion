#!/usr/bin/env bash
#
# smoke-test-docker.sh — Docker Compose smoke test for Code Companion
#
# Spins up the full stack via docker compose, polls /api/health until
# it responds with HTTP 200 (max 60 seconds), then tears down.
#
# Usage: bash scripts/smoke-test-docker.sh
#        npm run smoke:docker

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"

echo "[smoke-test-docker] Starting Docker Compose stack..."

# Start services in detached mode
docker compose up -d

# Wait for services to be healthy
echo "[smoke-test-docker] Waiting for services to become healthy..."
MAX_WAIT=60
WAIT_INTERVAL=3
ELAPSED=0

while [ $ELAPSED -lt $MAX_WAIT ]; do
  # Check codecompanion health
  if curl -f -s http://localhost:8900/api/health > /dev/null 2>&1; then
    RESPONSE=$(curl -s http://localhost:8900/api/health)
    STATUS=$(echo "$RESPONSE" | grep -o '"status":"ok"' || echo "")

    if [ -n "$STATUS" ]; then
      echo "[smoke-test-docker] ✓ Health check passed after ${ELAPSED}s"
      echo "[smoke-test-docker] Response: $RESPONSE"

      # Tear down
      echo "[smoke-test-docker] Stopping Docker Compose stack..."
      docker compose down -v

      echo "[smoke-test-docker] PASS — Docker deployment verified"
      exit 0
    fi
  fi

  echo "[smoke-test-docker] Waiting... (${ELAPSED}s / ${MAX_WAIT}s)"
  sleep $WAIT_INTERVAL
  ELAPSED=$((ELAPSED + WAIT_INTERVAL))
done

# Timeout reached
echo "[smoke-test-docker] FAIL — Health check timeout after ${MAX_WAIT}s"
echo "[smoke-test-docker] Showing codecompanion logs:"
docker compose logs codecompanion --tail=50

echo "[smoke-test-docker] Stopping Docker Compose stack..."
docker compose down -v

exit 1
