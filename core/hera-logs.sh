#!/bin/bash
# Follow Hera container logs
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPT_DIR/.env" 2>/dev/null || true
docker compose -f "$SCRIPT_DIR/docker-compose.yml" logs -f
