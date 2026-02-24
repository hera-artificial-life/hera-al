FROM node:22-bookworm

# --- System dependencies ---
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv \
    wget curl ffmpeg git build-essential gosu \
    && rm -rf /var/lib/apt/lists/*

# --- Non-root user for Claude Code ---
RUN groupadd -r hera && useradd -r -g hera -m -s /bin/bash hera

# --- Claude Code CLI (for user hera) ---
RUN gosu hera bash -c 'curl -fsSL https://claude.ai/install.sh | bash'
ENV PATH="/home/hera/.local/bin:/root/.local/bin:${PATH}"

# --- Main directory ---
RUN mkdir -p /app/hera/workspace /app/hera/gmab
WORKDIR /app/hera

# --- npm packages (all from registry) ---
ARG CACHE_BUST=1
RUN npm install -g @hera-al/browser-server @hera-al/standardnode @hera-al/atn-proxy @hera-al/server

# --- Copy installationPkg and bundled from installed package ---
RUN HERA_PKG=$(npm root -g)/@hera-al/server && \
    cp -r "$HERA_PKG/installationPkg" /app/hera/installationPkg && \
    cp -r "$HERA_PKG/bundled" /app/hera/bundled

# --- Env defaults ---
ENV GMAB_PATH=/app/hera/gmab
ENV WORKSPACE_PATH=/app/hera/workspace
ENV TARGET_FAST_PROXY=https://openrouter.ai
ENV ATN_PROXY_PORT=4181

# --- Permissions ---
RUN chown -R hera:hera /app/hera

# --- Entrypoint ---
COPY entrypoint.sh /app/hera/entrypoint.sh
RUN chmod +x /app/hera/entrypoint.sh

EXPOSE 3001 3002 4181

ENTRYPOINT ["/app/hera/entrypoint.sh"]
