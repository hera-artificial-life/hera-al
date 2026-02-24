# Hera Artificial Life

**Autonomous AI agent gateway built on Claude Agent SDK.**

Hera connects Claude to multiple communication channels (Telegram, WhatsApp, WebChat, Responses API) and gives it real autonomy: memory that persists across sessions, scheduled tasks, proactive actions, self-evolving skills, and distributed execution on remote nodes.

## Quick Start (Docker)

### Prerequisites

Suggested server configuration: 

- RAM 8GB
- 100GB Spazio su Disco
- Docker >= 28.2.x
- Macchina Unix (Ubuntu Server or similar or OSX Darwin strongly suggested, also tested on Raspberrt PI >4 with limited capacity about memory)

- Tailscale or similar installed, configured and working (not strictly required but mandatory for you security)
- Docker + Docker Compose
- [Claude Code](https://claude.ai/download) authenticated inside the container (see step 3)
- OpenAI API Key optional for STT (whisper-1)
- OpenRouter API KEY (or similar) for access to multimodel alternative su Claude Code via internal PicoAgent

### Security is important

The imperative idea with Hera è che ti installi una soluzione come tailscale e ti attivi una rete virtuale, cifrata e privata nelle quale inserisci il tuo server e i tuoi nodi esterni (per esempio il tuo mac o altri nodi). Solo tu potrai accedere a queste rete e i servizi di Hera saranno tutti esposti in modo protetto e sicuro usando https e wss.

### 3 steps

```bash
# 1. Clone and configure
git clone https://github.com/hera-artificial-life/hera-al.git
cd hera-al/core
cp .env.example .env
# Edit .env (se devi inserire le chiavi oPENAI_API_KEY o OPENROUTER_API_KEY oppure modificare le porte 3001, 3002 su cui Hera si mette in ascolto di default)

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

## Recommended Setup

These instructions target a **minimal but fully-featured** configuration. Only the Anthropic API key is strictly required — everything else is optional and unlocks additional capabilities.

### Embedding Model (recommended)

Hera's memory system uses semantic search to recall relevant context from past conversations. This requires an embedding model.

**[Ollama](https://ollama.com/) + Embedding Gemma** is the recommended choice: it delivers excellent retrieval quality with minimal hardware requirements (runs comfortably on 2GB RAM, no GPU needed). Install Ollama on the host machine (or any reachable server), then:

```bash
ollama pull gemma3:1b   # ~815MB download, runs on CPU
```

Point Hera to it in `config.yaml`:
```yaml
memory:
  search:
    enabled: true
    modelRef: "Embedding Gemma"    # references the model registry entry
    embeddingModel: "gemma3:1b"
    embeddingDimensions: 1536

models:
  - id: embeddinggemma
    name: Embedding Gemma
    types: [external]
    baseURL: http://host.docker.internal:11434/api   # Ollama endpoint (from inside Docker)
```

Any OpenAI-compatible embedding API works too (OpenAI `text-embedding-3-small`, Cohere, etc.) — just point `baseURL` and `apiKey` accordingly.

> **Without an embedding model**, Hera still works but memory search is disabled — the agent relies only on session context and daily markdown logs.

### OpenAI API Key (optional)

Used for:
- **Speech-to-text** (Whisper) — transcribe voice messages from Telegram/WhatsApp
- **Text-to-speech** — generate voice responses

```env
OPENAI_API_KEY=sk-...
```

### OpenRouter API Key (optional)

Enables access to multiple LLM providers (GPT, Gemini, Grok, etc.) through a single API. Used for:
- **LLM Council** — multi-model parallel reasoning with peer review
- **Pico Agents** — lightweight subagents on non-Claude models
- **Fallback models** — alternative models when Claude is unavailable

```env
OPENROUTER_API_KEY=sk-or-...
```

Sign up at [openrouter.ai](https://openrouter.ai/) — many models have free tiers.

### Claude Code

Hera requires [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) to be installed and authenticated inside the Docker container. The `hera-claude.sh` script opens Claude Code for interactive authentication.

Claude Code is used exclusively through the official [Claude Agent SDK](https://github.com/anthropics/anthropic-sdk-typescript) — the published, documented API provided by Anthropic. Hera does not access, bypass, or reverse-engineer any proprietary authentication mechanisms, internal APIs, or undocumented endpoints. All interaction with Anthropic services complies fully with [Anthropic's Terms of Service](https://www.anthropic.com/terms) and the Claude Code license agreement. Users are responsible for their own API key and Claude Code subscription.

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
