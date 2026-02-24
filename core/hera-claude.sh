#!/bin/bash
# Open Claude Code inside the Hera container
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPT_DIR/.env" 2>/dev/null || true
CN="${HERA_INSTANCE:-hera}"
docker exec -it "$CN" claude "$@"
