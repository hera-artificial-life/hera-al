# Hera Artificial Life

![Logo](./imgs/HERA_logo.jpg)

**Autonomous AI agent gateway built on Claude Agent SDK.**

Hera connects Claude to multiple communication channels (Telegram, WhatsApp, WebChat, Responses API, etc.) and gives it real autonomy: persistent memory across sessions, scheduled tasks, proactive actions, self-evolving skills, and distributed execution on remote nodes.

---

## Server Requirements

- **RAM**: 4 GB minimum; 8 GB or more recommended
- **Disk**: 100 GB or more
- **OS**: Unix-based — Ubuntu Server or similar, macOS. Also runs on Raspberry Pi 4+
- **Docker**: >= 28.2.x with Docker Compose
- **[Ollama](https://ollama.com/)** installed on the host with the **EmbeddingGemma** model (see [Embedding Model](#embedding-model))
- **[Claude Code](https://claude.ai/download)** subscription (authenticated inside the container)

## Installation

```bash
# 1. Clone and configure
git clone https://github.com/hera-artificial-life/hera-al.git
cd hera-al/core
cp .env.example .env
# Edit .env — add OPENAI_API_KEY or OPENROUTER_API_KEY if needed,
# or change the default ports (5001, 5002)

# 2. Build and start the container (first time)
sh hera-update.sh

# 3. Run the interactive setup, then authenticate Claude Code
sh hera-setup.sh
sh hera-claude.sh

# 4. Restart to apply
sh hera-start.sh
```

> **Note on `hera-setup.sh`**: The installer runs inside the Docker container, so it will warn that Tailscale is not installed, this is expected and can be safely ignored (Tailscale should be installed on the **host**, not inside the container). When prompted, select **Docker configuration**, then press Enter repeatedly to accept the defaults and complete the setup.

> **Note on `hera-claude.sh`**: This launches Claude Code inside the container for the first time. You will be prompted to choose your authentication method (API key, OAuth, etc.). Once authentication is complete, type `/exit` to quit Claude Code and return to the command line.

---

## Security

Hera exposes HTTP and WebSocket services for its admin panel and remote nodes. We strongly recommend installing [Tailscale](https://tailscale.com/) (or a similar solution) to create an encrypted private network between your server and external nodes (e.g. your Mac, other machines). This way, all Hera services are only accessible within your private mesh with no ports exposed to the public internet.

Once Tailscale is installed and your server has joined the tailnet, expose Hera's services over HTTPS with `tailscale serve`:

```bash
# Expose Nostromo (admin panel + WebSocket) on https port 15001
sudo tailscale serve --bg --https=15001 5001

# Expose Responses API (WebChat) on https port 15002
sudo tailscale serve --bg --https=15002 5002

# Verify the configuration
tailscale serve status
```

Run `tailscale serve status` to see your machine's HTTPS URL — it will look like `https://<your-machine>.<tailnet>.ts.net:15001`. Remote nodes (ElectroNode, OSXNode, StandardNode) should use the `wss://` endpoint on port 15001 to connect securely.

---

## API Keys

Only the Claude Code subscription is strictly required. The following keys are optional and unlock additional capabilities.

### OpenAI API Key (optional)

Used for:
- **Speech-to-text** (Whisper) — transcribe voice messages from Telegram/WhatsApp
- **Embeddings** — alternative to EmbeddingGemma (using `text-embedding-3-small`)

```env
OPENAI_API_KEY=sk-...
```

### OpenRouter API Key (optional)

Provides access to multiple LLM providers (GPT, Gemini, Grok, etc.) through a single API:
- **LLM Council** — multi-model parallel reasoning with peer review
- **Pico Agents** — lightweight subagents running on non-Claude models (see [Pico Agents](#pico-agents))
- **Fallback models** — alternatives when Claude is unavailable

```env
OPENROUTER_API_KEY=sk-or-...
```

Sign up at [openrouter.ai](https://openrouter.ai/) — many models offer free tiers.

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
- **Admin panel ([Nostromo](#nostromo))** — real-time monitoring, configuration, session management
- **[Pico Agents](#pico-agents)** — multi-model subagents via OpenRouter (Gemini, GPT, Grok, and more)
- **[Plasma Dynamic UI](#dynamic-ui--plasma)** — AI-generated interactive applications on connected nodes
- **[A2UI](#a2ui)** — Google A2UI v0.8 structured component rendering
- **MCP support** — connect external MCP servers for additional tools
- **Voice** — TTS (OpenAI, Edge, ElevenLabs) and STT (Whisper)

---

## Nostromo

**Nostromo** is Hera's built-in admin panel, a web-based control center for monitoring and configuring every aspect of your agent.

Access it at `http://localhost:5001/nostromo` or, if using Tailscale, at `https://<your-machine>.<tailnet>.ts.net:15001/nostromo`.

> **First access**: On your first visit, click the **"Welcome! Press to continue"** button to enter the panel. Then go to **Settings** and copy the **Access Key**, save it somewhere safe, as this is the password you'll need for all future logins.

### What you can do from Nostromo

- **Sessions** — view active conversations across all channels, inspect message history
- **Configuration** — edit `config.yaml` live: channels, models, memory, agent behavior, cron, TTS/STT
- **Channels** — enable/disable Telegram, WhatsApp, WebChat, Responses API
- **Models** — manage the model registry (Claude, OpenRouter, local models)
- **Cron Jobs** — create, edit, enable/disable scheduled tasks
- **Remote Nodes** — monitor connected nodes (ElectroNode, OSXNode, StandardNode), health status
- **Memory** — inspect the agent's memory system, search history
- **Skills** — browse installed skills and their capabilities
- **Logs** — real-time server log streaming

All configuration changes made through Nostromo are applied immediately — no restart required.

---

## Pico Agents

Pico Agents let Hera's main Claude agent delegate tasks to **lightweight subagents running on different LLM providers**: Gemini, GPT, Grok, and any model available through [OpenRouter](https://openrouter.ai/).

This enables:

- **LLM Council** — ask multiple models the same question in parallel, then have them peer-review each other's answers for a synthesized, higher-quality response
- **Cost optimization** — route simple tasks to cheaper/faster models, reserve Claude for complex reasoning
- **Diverse perspectives** — different models have different strengths; combine them for better results
- **Tool forwarding** — subagents can optionally use the same tools as the main agent (MCP servers, memory, browser, etc.)

Pico Agents are configured in `config.yaml` under `agent.picoAgent` and require an **OpenRouter API key** (equivalent solutions to OpenRouter are also supported). Each model is defined as a reference string (e.g. `Gemini Flash:google/gemini-3.0-flash`) and becomes available to the agent as an invocable subagent.

---

## Plasma Dynamic UI

Hera can generate and render **interactive user interfaces** directly on connected desktop nodes (ElectroNode and Hera OSXNode). The agent writes HTML, CSS, and JavaScript, sends it to the node, and the interface appears instantly: forms, dashboards, visualizations, games, anything a browser can render.

### Dynamic UI

The base layer. The agent generates custom interfaces with full creative freedom:

- **Any web technology** — HTML/CSS/JS, Canvas 2D, WebGL, Three.js, D3.js, Chart.js, or any CDN-hosted library
- **Interactive elements** — buttons, inputs, canvases, and custom controls send actions back to the agent
- **Incremental updates** — modify the running interface without reloading (change colors, add elements, update data) while preserving all state
- **Runtime queries** — the agent can read values from the live UI (form fields, computed state, DOM)

### Plasma

**Plasma** is an **event-sourced application system** built on top of Dynamic UI. It turns ephemeral UI sessions into **persistent, versionable applications** — called **organisms**.

How it works:

1. **Create** — the agent builds an initial interface (HTML/CSS/JS + interactive elements) and saves it as an organism
2. **Mutate** — each change is saved as a numbered JavaScript mutation (`1_add_validation.code`, `2_change_theme.code`, ...) applied in sequence
3. **Snapshot** — every 20 mutations, an automatic snapshot is created for fast loading
4. **Load** — load any organism instantly on any connected node, with full mutation history applied

This means:
- **Persistent apps** — UI applications survive across sessions, reboots, and node reconnections
- **Complete history** — every change is tracked and replayable
- **Instant loading** — smart snapshots avoid replaying hundreds of mutations
- **Iterative development** — the agent can progressively improve an app over days or weeks

Use cases: CRM dashboards, data entry forms, monitoring panels, interactive tools, games — anything the agent builds once and uses repeatedly.

---

## A2UI

Hera supports [**A2UI (Agent-to-User Interface)**](https://github.com/nicholasgasior/a2ui-specification) v0.8 — a structured, schema-validated component system for building interactive surfaces.

Unlike Dynamic UI (freeform HTML/CSS/JS), A2UI uses a **declarative component model** defined as JSONL:

- **Layout** — Column, Row, Card, Divider, Tabs, Modal, List
- **Content** — Text, Image, Icon, AudioPlayer, Video
- **Input** — Button, TextField, CheckBox, MultipleChoice, Slider, DateTimeInput

A2UI surfaces are validated against the official JSON Schema before rendering, ensuring consistent and correct interfaces. User interactions (button clicks, form submissions) are routed back to the agent as structured events with typed payloads.

A2UI is ideal for **structured, form-like interfaces** where consistency and validation matter — booking forms, settings panels, data collection, step-by-step wizards. For freeform creative interfaces (visualizations, games, custom layouts), use Dynamic UI / Plasma instead.

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

Cross-platform desktop node built with Electron + React. Renders Dynamic UI, Plasma organisms, and A2UI surfaces. Executes shell commands locally. See [electronode/README.md](electronode/README.md).

### OSXNode (`osxnode/`)

Native macOS menu-bar app built with Swift. AppleScript integration, native notifications, shell execution. See [osxnode/README.md](osxnode/README.md).

---

## Claude Code

Hera requires [Claude Code](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/overview) installed and authenticated inside the Docker container. The `hera-claude.sh` script opens an interactive session for authentication.

All interaction with Anthropic services happens exclusively through the official [Claude Agent SDK](https://github.com/anthropics/anthropic-sdk-typescript) — the published, documented API. Hera does not access, bypass, or reverse-engineer any proprietary authentication mechanism, internal API, or undocumented endpoint. Usage complies fully with [Anthropic's Terms of Service](https://www.anthropic.com/terms) and the Claude Code license agreement. Users are responsible for their own API key and subscription.

---

## Configuration

After running `hera-setup.sh`, fine-tune your instance via the [Nostromo](#nostromo) admin panel or by editing `gmab/config.yaml` directly:

- **Channels** — enable/disable Telegram, WhatsApp, WebChat, etc.
- **Models** — model registry (Claude, OpenRouter, local models)
- **Memory** — semantic search, embedding model, search parameters
- **Agent** — permission mode, session TTL, queue behavior, allowed tools
- **Cron** — heartbeat interval, dreaming schedule, custom jobs
- **TTS/STT** — provider, voice, model

See the full [config.example.yaml](https://www.npmjs.com/package/@hera-al/server) in the npm package for all available options.

---

## Embedding Model

Hera's memory system uses semantic search to recall relevant context from past conversations. The default configuration assumes **[Ollama](https://ollama.com/) + [EmbeddingGemma](https://ai.google.dev/gemma/docs/embeddinggemma)** as the embedding model.

Install Ollama on the host machine, then pull the model:

```bash
ollama pull embeddinggemma    # ~622 MB (BF16), runs on CPU
```

> Alternatively, you can use OpenAI's `text-embedding-3-small` or any other OpenAI-compatible embedding endpoint by changing `embeddingModel`, `baseURL`, and `apiKey` in `config.yaml`. The default configuration, however, assumes EmbeddingGemma via Ollama.

### About EmbeddingGemma

[EmbeddingGemma](https://developers.googleblog.com/introducing-embeddinggemma/) is a 308M parameter open embedding model by Google, built on Gemma 3. It is the highest-ranking open multilingual embedding model under 500M parameters on the [MTEB benchmark](https://huggingface.co/spaces/mteb/leaderboard).

---

## Helper Scripts

All scripts are in the `core/` directory:

| Script | Description |
|--------|-------------|
| `hera-start.sh` | Start or restart the container (no rebuild) |
| `hera-stop.sh` | Stop the container |
| `hera-update.sh` | Rebuild the container (pulls latest npm packages). After updating, run `hera-claude.sh` to verify auth |
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
