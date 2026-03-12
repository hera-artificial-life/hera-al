# ElectroNode

Cross-platform desktop node for Hera, built with Electron + React + A2UI.

Connects to a running Hera server via WebSocket and provides:
- **Dynamic UI** rendering (HTML/CSS/JS surfaces)
- **A2UI** rendering (Google A2UI v0.8 components)
- **Shell execution** on the local machine
- **Browser automation** via CDP

## Installation

### Pre-built binaries

Download from [Releases](https://github.com/hera-artificial-life/hera-al/releases/tag/electronode-v0.1.0):

| Platform | Download |
|----------|----------|
| macOS (Apple Silicon) | [ElectroNode-0.1.0-mac-arm64.dmg](https://github.com/hera-artificial-life/hera-al/releases/download/electronode-v0.1.0/ElectroNode-0.1.0-mac-arm64.dmg) |
| Windows (x64) | [ElectroNode-0.1.0-win-x64.exe](https://github.com/hera-artificial-life/hera-al/releases/download/electronode-v0.1.0/ElectroNode-0.1.0-win-x64.exe) |

The macOS build is signed and notarized by Apple (Developer ID: Lorenzo Toscano).

### Run directly

The `out/` directory contains pre-built bundles. To run without packaging:

```bash
cd electronode
npm install
npx electron .
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
