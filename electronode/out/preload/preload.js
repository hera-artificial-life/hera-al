"use strict";
const electron = require("electron");
const node_fs = require("node:fs");
const node_path = require("node:path");
const node_crypto = require("node:crypto");
const userDataPath = electron.ipcRenderer.sendSync("get-user-data-path");
const chatsDir = node_path.join(userDataPath, "chats");
node_fs.mkdirSync(chatsDir, { recursive: true });
const keyFile = node_path.join(userDataPath, "history-key");
let keyHex;
if (node_fs.existsSync(keyFile)) {
  keyHex = node_fs.readFileSync(keyFile, "utf-8").trim();
} else {
  keyHex = node_crypto.randomBytes(32).toString("hex");
  node_fs.writeFileSync(keyFile, keyHex, "utf-8");
}
const KEY = Buffer.from(keyHex, "hex");
function encrypt(plaintext) {
  const iv = node_crypto.randomBytes(16);
  const cipher = node_crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}
function decrypt(data) {
  const iv = data.subarray(0, 16);
  const tag = data.subarray(16, 32);
  const ciphertext = data.subarray(32);
  const decipher = node_crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}
function saveHistory(chatId, jsonString) {
  try {
    const filePath = node_path.join(chatsDir, `${chatId}.enc`);
    const encrypted = encrypt(jsonString);
    node_fs.writeFileSync(filePath, encrypted);
  } catch (err) {
    console.error("[Preload] saveHistory failed:", err);
  }
}
function loadHistory(chatId) {
  try {
    const filePath = node_path.join(chatsDir, `${chatId}.enc`);
    if (!node_fs.existsSync(filePath)) return null;
    const data = node_fs.readFileSync(filePath);
    return decrypt(data);
  } catch (err) {
    console.error("[Preload] loadHistory failed:", err);
    return null;
  }
}
function deleteHistory(chatId) {
  try {
    const filePath = node_path.join(chatsDir, `${chatId}.enc`);
    if (node_fs.existsSync(filePath)) node_fs.unlinkSync(filePath);
  } catch (err) {
    console.error("[Preload] deleteHistory failed:", err);
  }
}
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // Node info
  getNodeInfo: () => electron.ipcRenderer.invoke("get-node-info"),
  // Window controls
  minimize: () => electron.ipcRenderer.invoke("window-minimize"),
  maximize: () => electron.ipcRenderer.invoke("window-maximize"),
  close: () => electron.ipcRenderer.invoke("window-close"),
  // Chat history (encrypted, direct fs — no IPC)
  saveHistory: (chatId, jsonString) => {
    saveHistory(chatId, jsonString);
    return Promise.resolve();
  },
  loadHistory: (chatId) => {
    return Promise.resolve(loadHistory(chatId));
  },
  deleteHistory: (chatId) => {
    deleteHistory(chatId);
    return Promise.resolve();
  },
  // Screenshot capture
  captureScreenshot: (rect) => electron.ipcRenderer.invoke("capture-screenshot", rect),
  // Platform info
  platform: process.platform,
  arch: process.arch
});
