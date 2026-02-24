# ElectroNode

Cross-platform desktop node for Hera, built with Electron + React + A2UI.

Connects to a running Hera server via WebSocket and provides:
- **Dynamic UI** rendering (HTML/CSS/JS surfaces)
- **A2UI** rendering (Google A2UI v0.8 components)
- **Shell execution** on the local machine
- **Browser automation** via CDP

## Installation

### Pre-built binaries

Download from [Releases](https://github.com/hera-artificial-life/hera-al/releases) (coming soon).

### Build from source

```bash
cd electronode
npm install
npm run build
npm run dist          # Package for current platform
npm run dist:mac      # macOS DMG (arm64)
npm run dist:win      # Windows installer (x64)
```

Requires Node.js 18+ and npm.

## Configuration

On first launch, ElectroNode asks for:
- **Server URL**: your Hera server WebSocket endpoint (e.g. `ws://your-server:3001`)
- **Node name**: a display name for this node

Config is stored in:
- macOS: `~/Library/Application Support/ElectroNode/config.yaml`
- Windows: `%APPDATA%/ElectroNode/config.yaml`
- Linux: `~/.config/ElectroNode/config.yaml`

## npm package

```bash
npm install @hera-al/electronode  # coming soon
```
