# Hera Artificial Life

**Autonomous AI agent gateway built on Claude Agent SDK.**

Hera connects Claude to multiple communication channels (Telegram, WhatsApp, Discord, WebChat) and gives it real autonomy: memory that persists across sessions, scheduled tasks, proactive actions, self-evolving skills, and distributed execution on remote nodes.

## Quick Start (Docker)

### Prerequisites

- Docker + Docker Compose
- [Anthropic API key](https://console.anthropic.com/)

### 3 steps

```bash
# 1. Clone and configure
git clone https://github.com/hera-artificial-life/hera-al.git
cd hera-al/core
cp .env.example .env
# Edit .env — set ANTHROPIC_API_KEY (required), optionally add Telegram token

# 2. Start the container
sh hera-start.sh

# 3. Run the interactive setup
sh hera-setup.sh
# Then authenticate Claude Code:
sh hera-claude.sh
# Restart to apply:
sh hera-start.sh
```

Nostromo admin panel: `http://localhost:3001/nostromo`

## What's Inside

### Core (`core/`)

The Hera server runs inside Docker and installs everything from npm:

| Package | Description |
|---------|-------------|
| [`@hera-al/server`](https://www.npmjs.com/package/@hera-al/server) | Gateway server — channels, agent, memory, cron, admin panel |
| [`@hera-al/browser-server`](https://www.npmjs.com/package/@hera-al/browser-server) | WebChat UI component |
| [`@hera-al/standardnode`](https://www.npmjs.com/package/@hera-al/standardnode) | Remote execution node (shell, browser automation) |
| [`@hera-al/atn-proxy`](https://www.npmjs.com/package/@hera-al/atn-proxy) | Anthropic Tool Name proxy for OpenRouter compatibility |

### ElectroNode (`electronode/`)

Cross-platform desktop node (Electron + React). Renders Dynamic UI and A2UI surfaces, executes shell commands on the local machine. See [electronode/README.md](electronode/README.md).

### OSXNode (`osxnode/`)

Native macOS menu-bar app (Swift). AppleScript integration, native notifications, shell execution. See [osxnode/README.md](osxnode/README.md).

## Architecture

```
 Telegram / WhatsApp / Discord / WebChat
                    |
            ┌───────▼───────┐
            │  Hera Gateway  │  ← Claude Agent SDK
            │  (@hera-al/    │
            │   server)      │
            └──┬────┬────┬──┘
               │    │    │
          ┌────┘    │    └────┐
          ▼         ▼         ▼
       Skills    Cron     Remote Nodes
      (bundled   Jobs    (ElectroNode,
       + custom)          OSXNode,
                          StandardNode)
```

## Key Features

- **Multi-channel**: Telegram, WhatsApp, Discord, WebChat — same agent, unified context
- **Persistent memory**: 3-tier system (session → daily logs → semantic search with concept graph)
- **Autonomous scheduling**: Cron jobs, heartbeats, nightly memory consolidation ("dreaming")
- **Skills**: Self-contained capabilities the agent can invoke (Google Workspace, weather, SSH, etc.)
- **Remote nodes**: Execute commands on macOS, Windows, Linux machines via WebSocket
- **Admin panel (Nostromo)**: Real-time monitoring, configuration, session management
- **MCP support**: Connect external MCP servers for additional tools
- **Voice**: TTS (OpenAI, Edge, ElevenLabs) and STT (Whisper)

## Helper Scripts

| Script | What it does |
|--------|-------------|
| `hera-start.sh` | Build and start the container |
| `hera-stop.sh` | Stop the container |
| `hera-setup.sh` | Run the interactive installer inside the container |
| `hera-claude.sh` | Open Claude Code inside the container (for auth) |
| `hera-logs.sh` | Follow container logs |

## Configuration

After `hera-setup.sh`, edit `data/config.yaml` for fine-tuning:

- **Channels**: Enable/disable Telegram, WhatsApp, Discord, etc.
- **Models**: Configure model registry (Claude, OpenRouter, local models)
- **Memory**: Semantic search, embedding model, search parameters
- **Agent**: Permission mode, session TTL, queue behavior, allowed tools
- **Cron**: Heartbeat interval, dreaming schedule, custom jobs
- **TTS/STT**: Provider, voice, model

See the [config.example.yaml](https://www.npmjs.com/package/@hera-al/server) in the npm package for all options.

## npm Packages

Install individual components without Docker:

```bash
# Server (global install for CLI tools)
npm install -g @hera-al/server
heraserver          # Start the server
hera-install        # Interactive setup wizard
hera                # Management CLI

# StandardNode (run on any machine to connect to Hera)
npm install -g @hera-al/standardnode
hera-stdnode        # Start the node
```

## License

MIT — see [LICENSE](LICENSE).

## Links

- **npm**: [@hera-al](https://www.npmjs.com/org/hera-al)
- **GitHub**: [hera-artificial-life](https://github.com/hera-artificial-life)
- **Email**: heralife.dev@gmail.com
