"use strict";
const electron = require("electron");
const node_path = require("node:path");
const node_crypto = require("node:crypto");
const node_fs = require("node:fs");
function getOrCreatePersistent(fileName, generator) {
  const configDir = electron.app.getPath("userData");
  const filePath = node_path.join(configDir, fileName);
  try {
    const existing = node_fs.readFileSync(filePath, "utf-8").trim();
    if (existing) return existing;
  } catch {
  }
  const value = generator();
  try {
    node_fs.mkdirSync(configDir, { recursive: true });
    node_fs.writeFileSync(filePath, value, "utf-8");
  } catch {
  }
  return value;
}
function getOrCreateNodeId() {
  return getOrCreatePersistent("node-id", () => node_crypto.randomUUID().slice(0, 8));
}
function getOrCreateSignature() {
  return getOrCreatePersistent("node-signature", () => {
    const bytes = Array.from(
      { length: 64 },
      () => Math.floor(Math.random() * 256)
    );
    return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  });
}
let NODE_ID;
let NODE_SIGNATURE;
const DISPLAY_NAME = `ElectroNode-${process.platform}`;
let mainWindow = null;
function createWindow() {
  const isDev = !electron.app.isPackaged;
  const resourcesPath = isDev ? node_path.join(__dirname, "../../resources") : node_path.join(process.resourcesPath, "resources");
  if (process.platform === "darwin") {
    const dockIconPath = isDev ? node_path.join(resourcesPath, "AppIcon-512.png") : node_path.join(resourcesPath, "AppIcon.icns");
    if (require("fs").existsSync(dockIconPath)) {
      electron.app.dock?.setIcon(dockIconPath);
    }
  }
  let windowIconPath;
  if (process.platform === "win32") {
    const icoPath = node_path.join(resourcesPath, "AppIcon.ico");
    if (require("fs").existsSync(icoPath)) {
      windowIconPath = icoPath;
    }
  } else if (process.platform === "linux") {
    const pngPath = node_path.join(resourcesPath, "AppIcon-512.png");
    if (require("fs").existsSync(pngPath)) {
      windowIconPath = pngPath;
    }
  }
  mainWindow = new electron.BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "Hera ElectroNode",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    frame: process.platform !== "darwin",
    ...windowIconPath && { icon: windowIconPath },
    webPreferences: {
      preload: node_path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(node_path.join(__dirname, "../renderer/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
electron.ipcMain.on("get-user-data-path", (event) => {
  event.returnValue = electron.app.getPath("userData");
});
electron.ipcMain.handle("get-node-info", () => ({
  nodeId: NODE_ID,
  displayName: DISPLAY_NAME,
  platform: process.platform,
  signature: NODE_SIGNATURE
}));
electron.ipcMain.handle("capture-screenshot", async (_, rect) => {
  if (!mainWindow) throw new Error("No window available");
  const image = rect ? await mainWindow.webContents.capturePage(rect) : await mainWindow.webContents.capturePage();
  return image.toPNG().toString("base64");
});
electron.ipcMain.handle("window-minimize", () => {
  mainWindow?.minimize();
});
electron.ipcMain.handle("window-maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
electron.ipcMain.handle("window-close", () => {
  if (mainWindow) mainWindow.close();
});
const menuTemplate = [
  {
    label: "ElectroNode",
    submenu: [
      { role: "about" },
      { type: "separator" },
      { role: "quit" }
    ]
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
      { role: "selectAll" }
    ]
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
      { role: "togglefullscreen" }
    ]
  }
];
let forceQuit = false;
electron.app.whenReady().then(() => {
  NODE_ID = getOrCreateNodeId();
  NODE_SIGNATURE = getOrCreateSignature();
  electron.Menu.setApplicationMenu(electron.Menu.buildFromTemplate(menuTemplate));
  createWindow();
  mainWindow?.on("close", (e) => {
    if (forceQuit || !mainWindow) return;
    e.preventDefault();
    electron.dialog.showMessageBox(mainWindow, {
      type: "question",
      buttons: ["Cancel", "Quit"],
      defaultId: 1,
      cancelId: 0,
      message: "Are you sure you want to quit?"
    }).then(({ response }) => {
      if (response === 1) {
        forceQuit = true;
        electron.app.quit();
      }
    });
  });
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  electron.app.quit();
});
