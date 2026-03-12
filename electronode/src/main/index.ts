/**
 * ElectroNode — Main Process
 *
 * Cross-platform Hera node client with A2UI support.
 * Connects to Hera gateway via Nostromo WebSocket.
 */

import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from "node:fs";

/**
 * Read or create a persistent value in app userData.
 * Used for both nodeId and signature so they survive restarts.
 */
function getOrCreatePersistent(fileName: string, generator: () => string): string {
  const configDir = app.getPath("userData");
  const filePath = join(configDir, fileName);
  try {
    const existing = readFileSync(filePath, "utf-8").trim();
    if (existing) return existing;
  } catch {
    // File doesn't exist yet
  }
  const value = generator();
  try {
    mkdirSync(configDir, { recursive: true });
    writeFileSync(filePath, value, "utf-8");
  } catch {
    // Fallback: use ephemeral
  }
  return value;
}

function getOrCreateNodeId(): string {
  return getOrCreatePersistent("node-id", () => randomUUID().slice(0, 8));
}

function getOrCreateSignature(): string {
  return getOrCreatePersistent("node-signature", () => {
    // 64-byte hex string, same format as StandardNode
    const bytes = Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 256)
    );
    return bytes.map(b => b.toString(16).padStart(2, "0")).join("");
  });
}

let NODE_ID: string;
let NODE_SIGNATURE: string;
const DISPLAY_NAME = `ElectroNode-${process.platform}`;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  // Get resources path - works in both dev and production
  const isDev = !app.isPackaged;
  const resourcesPath = isDev
    ? join(__dirname, "../../resources")
    : join(process.resourcesPath, "resources");

  // Set dock icon (macOS only) - use PNG in dev, icns in production
  if (process.platform === "darwin") {
    const dockIconPath = isDev
      ? join(resourcesPath, "AppIcon-512.png")
      : join(resourcesPath, "AppIcon.icns");
    if (require("fs").existsSync(dockIconPath)) {
      app.dock?.setIcon(dockIconPath);
    }
  }

  // Set window icon (Windows/Linux only - macOS doesn't show window icons)
  let windowIconPath: string | undefined;
  if (process.platform === "win32") {
    const icoPath = join(resourcesPath, "AppIcon.ico");
    if (require("fs").existsSync(icoPath)) {
      windowIconPath = icoPath;
    }
  } else if (process.platform === "linux") {
    const pngPath = join(resourcesPath, "AppIcon-512.png");
    if (require("fs").existsSync(pngPath)) {
      windowIconPath = pngPath;
    }
  }

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "Hera ElectroNode",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    frame: process.platform !== "darwin",
    ...(windowIconPath && { icon: windowIconPath }),
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Load renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }

  // DevTools can be toggled via View menu or Cmd+Option+I / F12
  // Removed auto-open to avoid clutter on startup

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Sync IPC: provide userData path to preload (called once at startup)
ipcMain.on("get-user-data-path", (event) => {
  event.returnValue = app.getPath("userData");
});

// IPC handlers
ipcMain.handle("get-node-info", () => ({
  nodeId: NODE_ID,
  displayName: DISPLAY_NAME,
  platform: process.platform,
  signature: NODE_SIGNATURE,
}));

// Screenshot capture (used by dynamic_ui.screenshot command)
ipcMain.handle("capture-screenshot", async (_, rect?) => {
  if (!mainWindow) throw new Error("No window available");
  const image = rect
    ? await mainWindow.webContents.capturePage(rect)
    : await mainWindow.webContents.capturePage();
  return image.toPNG().toString("base64");
});

// Window controls
ipcMain.handle("window-minimize", () => {
  mainWindow?.minimize();
});

ipcMain.handle("window-maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle("window-close", () => {
  if (mainWindow) mainWindow.close();
});

// Note: chat history save/load/delete is handled directly in the preload
// script via node:fs + node:crypto (no IPC needed).

// Menu
const menuTemplate: Electron.MenuItemConstructorOptions[] = [
  {
    label: "ElectroNode",
    submenu: [
      { role: "about" },
      { type: "separator" },
      { role: "quit" },
    ],
  },
  {
    label: "Edit",
    submenu: [
      { role: "undo" },
      { role: "redo" },
      { type: "separator" },
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { role: "selectAll" },
    ],
  },
  {
    label: "View",
    submenu: [
      { role: "reload" },
      { role: "forceReload" },
      { role: "toggleDevTools" },
      { type: "separator" },
      { role: "resetZoom" },
      { role: "zoomIn" },
      { role: "zoomOut" },
      { type: "separator" },
      { role: "togglefullscreen" },
    ],
  },
];

let forceQuit = false;

app.whenReady().then(() => {
  NODE_ID = getOrCreateNodeId();
  NODE_SIGNATURE = getOrCreateSignature();
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));
  createWindow();

  // Intercept Cmd+Q / menu Quit with confirmation dialog
  mainWindow?.on("close", (e) => {
    if (forceQuit || !mainWindow) return;
    e.preventDefault();
    dialog.showMessageBox(mainWindow, {
      type: "question",
      buttons: ["Cancel", "Quit"],
      defaultId: 1,
      cancelId: 0,
      message: "Are you sure you want to quit?",
    }).then(({ response }) => {
      if (response === 1) {
        forceQuit = true;
        app.quit();
      }
    });
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
