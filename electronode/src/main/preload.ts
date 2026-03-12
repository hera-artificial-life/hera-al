/**
 * ElectroNode — Preload Script
 *
 * Exposes safe APIs to renderer process.
 * History save/load uses node:fs + node:crypto directly (no IPC).
 */

import { contextBridge, ipcRenderer } from "electron";
import { readFileSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// --- Encrypted history on disk ---

// Get userData path from main process (sync, runs once at preload time)
const userDataPath = ipcRenderer.sendSync("get-user-data-path") as string;
const chatsDir = join(userDataPath, "chats");
mkdirSync(chatsDir, { recursive: true });

// Derive a stable AES-256 key from a local secret file
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

contextBridge.exposeInMainWorld("electronAPI", {
  // Node info
  getNodeInfo: () => ipcRenderer.invoke("get-node-info"),

  // Window controls
  minimize: () => ipcRenderer.invoke("window-minimize"),
  maximize: () => ipcRenderer.invoke("window-maximize"),
  close: () => ipcRenderer.invoke("window-close"),

  // Chat history — encrypted files, direct fs access
  saveHistory: (chatId: string, jsonString: string): Promise<void> => {
    try {
      const filePath = join(chatsDir, `${chatId}.enc`);
      writeFileSync(filePath, encrypt(jsonString));
    } catch (err) {
      console.error("[History] save failed:", err);
    }
    return Promise.resolve();
  },

  loadHistory: (chatId: string): Promise<string | null> => {
    try {
      const filePath = join(chatsDir, `${chatId}.enc`);
      if (!existsSync(filePath)) return Promise.resolve(null);
      return Promise.resolve(decrypt(readFileSync(filePath)));
    } catch (err) {
      console.error("[History] load failed:", err);
      return Promise.resolve(null);
    }
  },

  deleteHistory: (chatId: string): Promise<void> => {
    try {
      const filePath = join(chatsDir, `${chatId}.enc`);
      if (existsSync(filePath)) unlinkSync(filePath);
    } catch (err) {
      console.error("[History] delete failed:", err);
    }
    return Promise.resolve();
  },

  // Platform info
  platform: process.platform,
  arch: process.arch,
});
