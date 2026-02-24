#!/bin/bash
# Start or restart the Hera container
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ ! -f "$SCRIPT_DIR/.env" ]; then
    echo "Error: .env not found. Copy from .env.example and configure."
    exit 1
fi
. "$SCRIPT_DIR/.env" 2>/dev/null || true
export CACHE_BUST=$(date +%s)
docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d --build
echo "Hera '${HERA_INSTANCE:-hera}' started. Nostromo UI: http://localhost:${NOSTROMO_PORT:-3001}/nostromo"
