# Hera Artificial Life

**Autonomous AI agent gateway built on Claude Agent SDK.**

Hera connects Claude to multiple communication channels (Telegram, WhatsApp, WebChat, Responses API) and gives it real autonomy: persistent memory across sessions, scheduled tasks, proactive actions, self-evolving skills, and distributed execution on remote nodes.

---

## Quick Start (Docker)

### Server Requirements

- **RAM**: 8 GB minimum
- **Disk**: 100 GB
- **OS**: Unix-based — Ubuntu Server or macOS recommended. Also tested on Raspberry Pi 4+ (with reduced memory capacity)
- **Docker**: >= 28.2.x with Docker Compose

### API Keys

- [Claude Code](https://claude.ai/download) subscription — authenticated inside the container (see step 3)
- **OpenAI API key** (optional) — enables speech-to-text via Whisper
- **OpenRouter API key** (optional) — enables multi-model access (GPT, Gemini, Grok, etc.) via the internal Pico Agent system

### Security

Hera exposes HTTP and WebSocket services for its admin panel and remote nodes. We strongly recommend installing [Tailscale](https://tailscale.com/) (or a similar solution) to create an encrypted private network between your server and external nodes (e.g. your Mac, other machines). This way, all Hera services are only accessible within your private mesh — no ports exposed to the public internet.

### Installation

```bash
# 1. Clone and configure
git clone https://github.com/hera-artificial-life/hera-al.git
cd hera-al/core
cp .env.example .env
# Edit .env — add OPENAI_API_KEY or OPENROUTER_API_KEY if needed,
# or change the default ports (5001, 5002)

# 2. Start the container
sh hera-start.sh

# 3. Run the interactive setup, then authenticate Claude Code
sh hera-setup.sh
sh hera-claude.sh

# 4. Restart to apply
sh hera-start.sh
```

Once running, open the **Nostromo** admin panel at `http://localhost:5001/nostromo`.

---

## Architecture

```
 Telegram / WhatsApp / WebChat / Responses API
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

---

## Key Features

- **Multi-channel** — Telegram, WhatsApp, WebChat, Responses API: same agent, unified context
- **Persistent memory** — 3-tier system: session context, daily logs, semantic search with concept graph
- **Autonomous scheduling** — cron jobs, heartbeats, nightly memory consolidation ("dreaming")
- **Skills** — self-contained capabilities (Google Workspace, weather, SSH, and more)
- **Remote nodes** — execute commands on macOS, Windows, Linux via WebSocket
- **Admin panel (Nostromo)** — real-time monitoring, configuration, session management
- **MCP support** — connect external MCP servers for additional tools
- **Voice** — TTS (OpenAI, Edge, ElevenLabs) and STT (Whisper)

---

## What's Inside

### Core (`core/`)

The server runs inside Docker. All packages are installed from npm at build time:

| Package | Description |
|---------|-------------|
| [`@hera-al/server`](https://www.npmjs.com/package/@hera-al/server) | Gateway server — channels, agent, memory, cron, admin panel |
| [`@hera-al/browser-server`](https://www.npmjs.com/package/@hera-al/browser-server) | WebChat UI component |
| [`@hera-al/standardnode`](https://www.npmjs.com/package/@hera-al/standardnode) | Remote execution node (shell, browser automation) |
| [`@hera-al/atn-proxy`](https://www.npmjs.com/package/@hera-al/atn-proxy) | Anthropic Tool Name proxy for OpenRouter compatibility |

### ElectroNode (`electronode/`)

Cross-platform desktop node built with Electron + React. Renders Dynamic UI and A2UI surfaces, executes shell commands locally. See [electronode/README.md](electronode/README.md).

### OSXNode (`osxnode/`)

Native macOS menu-bar app built with Swift. AppleScript integration, native notifications, shell execution. See [osxnode/README.md](osxnode/README.md).

---

## Recommended Setup

The quick start above covers a **minimal** installation. The following optional components unlock additional capabilities.

### Embedding Model (recommended)

Hera's memory includes a semantic search layer that recalls relevant context from past conversations. To enable it, you need an embedding model.

The recommended choice is **[Ollama](https://ollama.com/) + Gemma 3 1B**: excellent retrieval quality with minimal hardware requirements — runs comfortably on 2 GB of RAM, no GPU needed. Install Ollama on the host (or any reachable machine), then pull the model:

```bash
ollama pull gemma3:1b   # ~815 MB, runs on CPU
```

Then point Hera to it in `config.yaml`:

```yaml
memory:
  search:
    enabled: true
    modelRef: "Embedding Gemma"
    embeddingModel: "gemma3:1b"
    embeddingDimensions: 1536

models:
  - id: embeddinggemma
    name: Embedding Gemma
    types: [external]
    baseURL: http://host.docker.internal:11434/api   # Ollama from inside Docker
```

Any OpenAI-compatible embedding endpoint works as well (e.g. OpenAI `text-embedding-3-small`, Cohere) — adjust `baseURL` and `apiKey` accordingly.

> **Without an embedding model** Hera still works, but memory search is disabled. The agent relies on session context and daily markdown logs only.

### OpenAI API Key (optional)

Enables voice features:
- **Speech-to-text** (Whisper) — transcribe voice messages from Telegram/WhatsApp
- **Text-to-speech** — generate spoken responses

```env
OPENAI_API_KEY=sk-...
```

### OpenRouter API Key (optional)

Provides access to multiple LLM providers (GPT, Gemini, Grok, etc.) through a single API:
- **LLM Council** — multi-model parallel reasoning with peer review
- **Pico Agents** — lightweight subagents running on non-Claude models
- **Fallback models** — alternatives when Claude is unavailable

```env
OPENROUTER_API_KEY=sk-or-...
```

Sign up at [openrouter.ai](https://openrouter.ai/) — many models offer free tiers.

---

## Claude Code

Hera requires [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) installed and authenticated inside the Docker container. The `hera-claude.sh` script opens an interactive session for authentication.

All interaction with Anthropic services happens exclusively through the official [Claude Agent SDK](https://github.com/anthropics/anthropic-sdk-typescript) — the published, documented API. Hera does not access, bypass, or reverse-engineer any proprietary authentication mechanism, internal API, or undocumented endpoint. Usage complies fully with [Anthropic's Terms of Service](https://www.anthropic.com/terms) and the Claude Code license agreement. Users are responsible for their own API key and subscription.

---

## Configuration

After running `hera-setup.sh`, fine-tune `data/config.yaml`:

- **Channels** — enable/disable Telegram, WhatsApp, WebChat, etc.
- **Models** — model registry (Claude, OpenRouter, local models)
- **Memory** — semantic search, embedding model, search parameters
- **Agent** — permission mode, session TTL, queue behavior, allowed tools
- **Cron** — heartbeat interval, dreaming schedule, custom jobs
- **TTS/STT** — provider, voice, model

See the full [config.example.yaml](https://www.npmjs.com/package/@hera-al/server) in the npm package for all available options.

---

## Helper Scripts

All scripts are in the `core/` directory:

| Script | Description |
|--------|-------------|
| `hera-start.sh` | Build and start the container |
| `hera-stop.sh` | Stop the container |
| `hera-setup.sh` | Run the interactive installer |
| `hera-claude.sh` | Open Claude Code for authentication |
| `hera-logs.sh` | Follow container logs |

---

## npm Packages

You can also install individual components without Docker:

```bash
# Server
npm install -g @hera-al/server
heraserver          # Start the server
hera-install        # Interactive setup wizard
hera                # Management CLI

# StandardNode (connect any machine to Hera)
npm install -g @hera-al/standardnode
hera-stdnode        # Start the node
```

---

## License

MIT — see [LICENSE](LICENSE).

## Links

- **npm**: [@hera-al](https://www.npmjs.com/org/hera-al)
- **GitHub**: [hera-artificial-life](https://github.com/hera-artificial-life)
- **Email**: heralife.dev@gmail.com
