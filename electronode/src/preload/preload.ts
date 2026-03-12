/**
 * ElectroNode — Preload Script
 *
 * Exposes safe APIs to renderer process.
 * History save/load uses node:fs + node:crypto directly (no IPC).
 */

import { contextBridge, ipcRenderer } from "electron";
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// --- Encrypted history on disk (no IPC needed) ---

// Resolve chats directory: userData is at ~/Library/Application Support/<app>/
// We get it once via synchronous IPC at preload time.
const userDataPath = ipcRenderer.sendSync("get-user-data-path") as string;
const chatsDir = join(userDataPath, "chats");
mkdirSync(chatsDir, { recursive: true });

// Derive a stable encryption key from a machine-local secret file
const keyFile = join(userDataPath, "history-key");
let keyHex: string;
if (existsSync(keyFile)) {
  keyHex = readFileSync(keyFile, "utf-8").trim();
} else {
  keyHex = randomBytes(32).toString("hex");
  writeFileSync(keyFile, keyHex, "utf-8");
}
const KEY = Buffer.from(keyHex, "hex");

function encrypt(plaintext: string): Buffer {
  const iv = randomBytes(16);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: [16 iv][16 tag][...ciphertext]
  return Buffer.concat([iv, tag, encrypted]);
}

function decrypt(data: Buffer): string {
  const iv = data.subarray(0, 16);
  const tag = data.subarray(16, 32);
  const ciphertext = data.subarray(32);
  const decipher = createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}

function saveHistory(chatId: string, jsonString: string): void {
  try {
    const filePath = join(chatsDir, `${chatId}.enc`);
    const encrypted = encrypt(jsonString);
    writeFileSync(filePath, encrypted);
  } catch (err) {
    console.error("[Preload] saveHistory failed:", err);
  }
}

function loadHistory(chatId: string): string | null {
  try {
    const filePath = join(chatsDir, `${chatId}.enc`);
    if (!existsSync(filePath)) return null;
    const data = readFileSync(filePath);
    return decrypt(data);
  } catch (err) {
    console.error("[Preload] loadHistory failed:", err);
    return null;
  }
}

function deleteHistory(chatId: string): void {
  try {
    const filePath = join(chatsDir, `${chatId}.enc`);
    if (existsSync(filePath)) unlinkSync(filePath);
  } catch (err) {
    console.error("[Preload] deleteHistory failed:", err);
  }
}

contextBridge.exposeInMainWorld("electronAPI", {
  // Node info
  getNodeInfo: () => ipcRenderer.invoke("get-node-info"),

  // Window controls
  minimize: () => ipcRenderer.invoke("window-minimize"),
  maximize: () => ipcRenderer.invoke("window-maximize"),
  close: () => ipcRenderer.invoke("window-close"),

  // Chat history (encrypted, direct fs — no IPC)
  saveHistory: (chatId: string, jsonString: string) => {
    saveHistory(chatId, jsonString);
    return Promise.resolve();
  },
  loadHistory: (chatId: string): Promise<string | null> => {
    return Promise.resolve(loadHistory(chatId));
  },
  deleteHistory: (chatId: string) => {
    deleteHistory(chatId);
    return Promise.resolve();
  },

  // Screenshot capture
  captureScreenshot: (rect?: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke("capture-screenshot", rect) as Promise<string>,

  // Platform info
  platform: process.platform,
  arch: process.arch,
});
