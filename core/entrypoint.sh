#!/bin/bash
set -e

cd /app/hera

# Create data structure if missing
mkdir -p "$GMAB_PATH/data" "$GMAB_PATH/logs" "$WORKSPACE_PATH"

# Set permissions for hera user
chown -R hera:hera "$GMAB_PATH" "$WORKSPACE_PATH" /app/hera

# Refresh bundled files from installed package (survives volume persistence)
HERA_PKG=$(npm root -g)/@hera-al/server
if [ -d "$HERA_PKG/installationPkg" ]; then
    cp -r "$HERA_PKG/installationPkg" /app/hera/installationPkg
fi
if [ -d "$HERA_PKG/bundled" ]; then
    cp -r "$HERA_PKG/bundled" /app/hera/bundled
fi

# Start ATN-Proxy in background
echo "[hera] Starting atn-proxy (target: ${TARGET_FAST_PROXY}, port: ${ATN_PROXY_PORT})..."
atn-proxy --target "${TARGET_FAST_PROXY}" --port "${ATN_PROXY_PORT}" --logs /app/hera/gmab/logs &

# If config.yaml exists → server is configured, start it
if [ -f /app/hera/config.yaml ]; then
    echo "[hera] config.yaml found, starting heraserver as user hera..."
    exec gosu hera heraserver
fi

# First boot: no config.yaml → wait for manual setup
echo "============================================"
echo "  HERA — First boot"
echo "============================================"
echo ""
echo "  The server is not configured yet."
echo "  Run the setup script from the host:"
echo ""
echo "    sh hera-setup.sh"
echo ""
echo "  After setup, restart the container:"
echo ""
echo "    sh hera-start.sh"
echo ""
echo "  Waiting for configuration..."
echo "============================================"

# Stay alive for docker exec
exec tail -f /dev/null
