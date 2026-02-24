# OSXNode

Native macOS menu-bar node for Hera, built with Swift + SwiftUI.

Connects to a running Hera server via WebSocket and provides:
- **Shell execution** on the Mac
- **AppleScript** integration (Apple Notes, Reminders, Finder, etc.)
- **Native notifications** via macOS Notification Center
- Lives in the **menu bar** (no Dock icon)

## Installation

### Pre-built DMG

Download from [Releases](https://github.com/hera-artificial-life/hera-al/releases) (coming soon).

### Build from source

Requires macOS 14+ (Sonoma), Xcode Command Line Tools, Swift 5.10+.

```bash
cd osxnode
swift build -c release
./Scripts/build-dmg.sh    # Produces dist/OSXNode.dmg
```

The DMG is ad-hoc signed (no Apple Developer Account required for personal use).

## Configuration

Config file: `~/Library/Application Support/OSXNode/config.yaml`

```yaml
serverUrl: "ws://your-server:3001"
nodeName: "my-mac"
```

## First launch

1. Open the DMG, drag **OSXNode** to Applications
2. macOS will block it ("unidentified developer") — go to **System Settings > Privacy & Security > Open Anyway**
3. The node appears in your menu bar and connects to Hera automatically
