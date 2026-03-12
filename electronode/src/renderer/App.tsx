/**
 * ElectroNode — Main App Component
 *
 * Multi-tab chat layout:
 * - Header: connection status + window controls
 * - Tab bar: chat tabs with tag editing
 * - Content: Chat UI + A2UI/DynamicUI panels (shared across tabs)
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useWebSocket, type ChatMessage, type ChatAttachment, type A2UISurfaceData, type IncomingMessage } from "./hooks/useWebSocket";
import Chat from "./components/Chat";
import A2UIHost from "./components/A2UIHost";
import DynamicUIHost from "./components/DynamicUIHost";
import ConnectionStatus from "./components/ConnectionStatus";
import GatewayURLField, { addToHistory, getLastUsedUrl } from "./components/GatewayURLField";
import TabBar, { type TabInfo } from "./components/TabBar";
import ChatInfoModal from "./components/ChatInfoModal";
import type { DynamicUIPayload } from "./types/dynamic-ui";

const DEFAULT_URL = "ws://localhost:3112/ws/nodes";
const MAX_TABS = 20;
const DEFAULT_MAX_MESSAGES = 250;
const TAB_STATE_KEY = "electronode_tab_state";
const SETTINGS_KEY = "electronode_settings";
interface TabData {
  id: string;
  index: number;
  tag: string | null;
  messages: ChatMessage[];
  isTyping: boolean;
  draft: string;
  newestFirst: boolean;
}

interface TabPersist {
  tabs: { id: string; index: number; tag: string | null }[];
  activeTabId: string;
}

interface Settings {
  historyEnabled: boolean;
  capA2ui: boolean;
  capPlasma: boolean;
  maxMessages: number;
}

/**
 * Derive a deterministic 8-char hex prefix from the nodeId.
 */
function deriveHexPrefix(nodeId: string): string {
  let hash = 0;
  for (let i = 0; i < nodeId.length; i++) {
    hash = ((hash << 5) - hash + nodeId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, "0").slice(0, 8);
}

function makeChatId(hexPrefix: string, tabIndex: number): string {
  return `webchat-electro-${hexPrefix}-${tabIndex}`;
}

function loadTabState(): TabPersist | null {
  try {
    const raw = localStorage.getItem(TAB_STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

function saveTabState(state: TabPersist): void {
  localStorage.setItem(TAB_STATE_KEY, JSON.stringify(state));
}

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { historyEnabled: true, capA2ui: false, capPlasma: true, maxMessages: DEFAULT_MAX_MESSAGES };
}

function saveSettings(settings: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/** Keep only the last N messages */
function capMessages(msgs: ChatMessage[], max: number): ChatMessage[] {
  return msgs.length > max ? msgs.slice(-max) : msgs;
}

/** Extract local chatId from a potentially gateway-prefixed chatId */
function extractLocalChatId(fullChatId: string): string {
  const parts = fullChatId.split("/");
  return parts[parts.length - 1];
}

export default function App() {
  const [gatewayUrl, setGatewayUrl] = useState(() => getLastUsedUrl() || DEFAULT_URL);
  const [isConfiguring, setIsConfiguring] = useState(true);
  const [nodeInfo, setNodeInfo] = useState({ nodeId: "electr-" + Math.random().toString(36).slice(2, 8), displayName: "ElectroNode", signature: "" });
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [infoModalTabId, setInfoModalTabId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // A2UI / DynamicUI are node-wide (shared across all tabs)
  const [a2uiData, setA2UIData] = useState<A2UISurfaceData | null>(null);
  const [dynamicUIData, setDynamicUIData] = useState<DynamicUIPayload | null>(null);
  const [isA2UIMaximized, setIsA2UIMaximized] = useState(false);
  const [isDynamicUIMaximized, setIsDynamicUIMaximized] = useState(false);

  // Origin routing for Dynamic UI actions (from server wire message)
  const dynamicUIOriginRef = useRef<{ channel?: string; chatId?: string }>({});

  const hexPrefix = useMemo(() => deriveHexPrefix(nodeInfo.nodeId), [nodeInfo.nodeId]);

  // Tab state
  const [tabs, setTabs] = useState<TabData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");
  const uiTypingTimer = useRef<number | undefined>(undefined);
  const tabsInitialized = useRef(false);

  // Refs for stable handleMessage callback
  const activeTabIdRef = useRef(activeTabId);
  useEffect(() => {
    activeTabIdRef.current = activeTabId;
  }, [activeTabId]);

  const maxMessagesRef = useRef(settings.maxMessages);
  useEffect(() => {
    maxMessagesRef.current = settings.maxMessages;
  }, [settings.maxMessages]);

  // Initialize tabs from localStorage or defaults
  useEffect(() => {
    if (tabsInitialized.current) return;
    const saved = loadTabState();
    if (saved && saved.tabs.length > 0) {
      tabsInitialized.current = true;
      setTabs(saved.tabs.map(t => ({
        id: t.id,
        index: t.index,
        tag: t.tag,
        messages: [],
        isTyping: false,
        draft: "",
        newestFirst: false,
      })));
      setActiveTabId(saved.activeTabId);
    } else {
      const firstId = makeChatId(hexPrefix, 1);
      setTabs([{
        id: firstId,
        index: 1,
        tag: null,
        messages: [],
        isTyping: false,
        draft: "",
        newestFirst: false,
      }]);
      setActiveTabId(firstId);
    }
  }, [hexPrefix]);

  // Persist tab metadata on changes
  useEffect(() => {
    if (tabs.length === 0) return;
    saveTabState({
      tabs: tabs.map(t => ({ id: t.id, index: t.index, tag: t.tag })),
      activeTabId,
    });
  }, [tabs, activeTabId]);

  // Load history for active tab whenever it changes
  useEffect(() => {
    if (!activeTabId || !settings.historyEnabled) return;
    const api = (window as any).electronAPI;
    if (!api?.loadHistory) return;

    api.loadHistory(activeTabId).then((json: string | null) => {
      if (!json) return;
      try {
        const messages: ChatMessage[] = capMessages(JSON.parse(json), settings.maxMessages);
        if (messages.length === 0) return;
        setTabs(prev => prev.map(t =>
          t.id === activeTabId && t.messages.length === 0
            ? { ...t, messages }
            : t
        ));
      } catch { /* corrupt data */ }
    }).catch((err: unknown) => console.error("[History] load error:", err));
  }, [activeTabId, settings.historyEnabled]);

  // Save history whenever a tab's message count changes
  const prevMessageCounts = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!settings.historyEnabled) return;
    const api = (window as any).electronAPI;
    if (!api?.saveHistory) return;

    for (const tab of tabs) {
      const prevCount = prevMessageCounts.current[tab.id] ?? 0;
      if (tab.messages.length > 0 && tab.messages.length !== prevCount) {
        api.saveHistory(tab.id, JSON.stringify(tab.messages))
          .catch((err: unknown) => console.error("[History] save error:", err));
      }
      prevMessageCounts.current[tab.id] = tab.messages.length;
    }
  }, [tabs, settings.historyEnabled]);

  // Get node info from Electron main process
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (api?.getNodeInfo) {
      api.getNodeInfo().then((info: any) => {
        setNodeInfo({ nodeId: info.nodeId, displayName: info.displayName, signature: info.signature || "" });
      });
    }
  }, []);

  const activeTab = tabs.find(t => t.id === activeTabId) || null;

  // WebSocket message handler — routes per-chat messages to tabs,
  // node-wide messages (a2ui, dynamic_ui) to shared state
  const handleMessage = useCallback((msg: IncomingMessage) => {
    switch (msg.type) {
      // Node-wide: no chatId from server, shared across all tabs.
      // Start a 3s timer to clear typing — if a chat_response or typing:true
      // arrives before the timer fires, it gets cancelled. This handles the
      // case where the agent renders UI and then also sends a text response.
      case "a2ui_surface":
        setA2UIData({ messages: msg.messages, jsonl: msg.jsonl });
        clearTimeout(uiTypingTimer.current);
        uiTypingTimer.current = window.setTimeout(() => {
          setTabs(prev => prev.map(t =>
            t.id === activeTabIdRef.current ? { ...t, isTyping: false } : t
          ));
        }, 3000);
        break;

      case "dynamic_ui":
        // Store origin routing from server for action replies
        dynamicUIOriginRef.current = { channel: msg.channel, chatId: msg.chatId || undefined };
        setDynamicUIData({
          html: msg.html,
          css: msg.css,
          js: msg.js,
          activities: msg.activities as any[],
        });
        clearTimeout(uiTypingTimer.current);
        uiTypingTimer.current = window.setTimeout(() => {
          setTabs(prev => prev.map(t =>
            t.id === activeTabIdRef.current ? { ...t, isTyping: false } : t
          ));
        }, 3000);
        break;

      case "dynamic_ui_update": {
        // Update origin routing if provided
        if (msg.channel) dynamicUIOriginRef.current.channel = msg.channel;
        if (msg.chatId) dynamicUIOriginRef.current.chatId = msg.chatId;
        const updateFn = (window as any).__dynamicUIUpdate;
        if (updateFn) updateFn(msg.js);
        break;
      }

      case "dynamic_ui_clear":
        setDynamicUIData(null);
        setIsDynamicUIMaximized(false);
        dynamicUIOriginRef.current = {};
        break;

      // Per-chat: route by chatId, fallback to active tab.
      // Cancel the UI typing timer — a chat_response means the agent finished.
      case "chat_response": {
        clearTimeout(uiTypingTimer.current);
        const localChatId = msg.chatId ? extractLocalChatId(msg.chatId) : activeTabIdRef.current;
        const chatMsg: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: "assistant",
          text: msg.text,
          timestamp: Date.now(),
        };
        setTabs(prev => {
          const tabIdx = prev.findIndex(t => t.id === localChatId);
          if (tabIdx === -1) {
            const fallbackIdx = prev.findIndex(t => t.id === activeTabIdRef.current);
            if (fallbackIdx === -1) return prev;
            const updated = [...prev];
            const tab = { ...updated[fallbackIdx] };
            tab.messages = capMessages([...tab.messages, chatMsg], maxMessagesRef.current);
            tab.isTyping = false;
            updated[fallbackIdx] = tab;
            return updated;
          }
          const updated = [...prev];
          const tab = { ...updated[tabIdx] };
          tab.messages = capMessages([...tab.messages, chatMsg], maxMessagesRef.current);
          tab.isTyping = false;
          updated[tabIdx] = tab;
          return updated;
        });
        break;
      }

      // Per-chat: system/push notification — same routing, role=system
      case "chat_message": {
        const localChatId = msg.chatId ? extractLocalChatId(msg.chatId) : activeTabIdRef.current;
        const sysMsg: ChatMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: "system",
          text: msg.text,
          timestamp: Date.now(),
        };
        setTabs(prev => {
          const tabIdx = prev.findIndex(t => t.id === localChatId);
          if (tabIdx === -1) {
            const fallbackIdx = prev.findIndex(t => t.id === activeTabIdRef.current);
            if (fallbackIdx === -1) return prev;
            const updated = [...prev];
            const tab = { ...updated[fallbackIdx] };
            tab.messages = capMessages([...tab.messages, sysMsg], maxMessagesRef.current);
            updated[fallbackIdx] = tab;
            return updated;
          }
          const updated = [...prev];
          const tab = { ...updated[tabIdx] };
          tab.messages = capMessages([...tab.messages, sysMsg], maxMessagesRef.current);
          updated[tabIdx] = tab;
          return updated;
        });
        break;
      }

      case "typing_indicator": {
        // typing:true means agent is still working — cancel the UI timeout
        // typing:false means agent is done — also cancel (no longer needed)
        clearTimeout(uiTypingTimer.current);
        const localChatId = msg.chatId ? extractLocalChatId(msg.chatId) : activeTabIdRef.current;
        setTabs(prev => {
          const tabIdx = prev.findIndex(t => t.id === localChatId);
          const targetIdx = tabIdx !== -1 ? tabIdx : prev.findIndex(t => t.id === activeTabIdRef.current);
          if (targetIdx === -1) return prev;
          const updated = [...prev];
          updated[targetIdx] = { ...updated[targetIdx], isTyping: msg.typing };
          return updated;
        });
        break;
      }
    }
  }, []);

  const capabilities = useMemo(() => {
    const caps: string[] = [];
    if (settings.capA2ui) caps.push("a2ui");
    if (settings.capPlasma) caps.push("plasma");
    return caps;
  }, [settings.capA2ui, settings.capPlasma]);

  const { state, sendChat, sendA2UIAction, sendDynamicUIAction } = useWebSocket({
    url: isConfiguring || !nodeInfo.signature ? "" : gatewayUrl,
    nodeId: nodeInfo.nodeId,
    displayName: nodeInfo.displayName,
    signature: nodeInfo.signature,
    capabilities,
    onMessage: handleMessage,
  });

  const handleDraftChange = useCallback((draft: string) => {
    setTabs(prev => prev.map(t =>
      t.id === activeTabId ? { ...t, draft } : t
    ));
  }, [activeTabId]);

  const handleSendMessage = useCallback((text: string, attachments?: ChatAttachment[]) => {
    if (!activeTabId) return;
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      text,
      timestamp: Date.now(),
      attachments,
    };
    setTabs(prev => prev.map(t =>
      t.id === activeTabId
        ? { ...t, messages: capMessages([...t.messages, userMsg], settings.maxMessages), isTyping: true, draft: "" }
        : t
    ));
    sendChat(activeTabId, text, attachments);
  }, [activeTabId, sendChat]);

  const handleConnect = useCallback(() => {
    addToHistory(gatewayUrl);
    setIsConfiguring(false);
  }, [gatewayUrl]);

  const handleClose = useCallback(() => {
    const api = (window as any).electronAPI;
    if (api?.close) api.close();
  }, []);

  // Tab operations
  const handleCreateTab = useCallback(() => {
    if (tabs.length >= MAX_TABS) return;
    const usedIndices = new Set(tabs.map(t => t.index));
    let idx = 1;
    while (usedIndices.has(idx)) idx++;
    const id = makeChatId(hexPrefix, idx);
    const newTab: TabData = { id, index: idx, tag: null, messages: [], isTyping: false, draft: "", newestFirst: false };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(id);
  }, [tabs, hexPrefix]);

  const handleClearTab = useCallback(() => {
    if (!activeTabId) return;
    setShowClearConfirm(true);
  }, [activeTabId]);

  const handleClearConfirm = useCallback(() => {
    if (!activeTabId) return;
    setTabs(prev => prev.map(t =>
      t.id === activeTabId ? { ...t, messages: [] } : t
    ));
    const api = (window as any).electronAPI;
    if (api?.deleteHistory) api.deleteHistory(activeTabId);
    setShowClearConfirm(false);
  }, [activeTabId]);

  const handleCloseTab = useCallback((tabId: string) => {
    setTabs(prev => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex(t => t.id === tabId);
      if (idx === -1) return prev;
      const newTabs = prev.filter(t => t.id !== tabId);
      if (tabId === activeTabId) {
        const newActive = newTabs[Math.min(idx, newTabs.length - 1)];
        setActiveTabId(newActive.id);
      }
      return newTabs;
    });
  }, [activeTabId]);

  const handleSelectTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    setIsA2UIMaximized(false);
    setIsDynamicUIMaximized(false);
  }, []);

  const handleTagChange = useCallback((tabId: string, tag: string | null) => {
    setTabs(prev => prev.map(t =>
      t.id === tabId ? { ...t, tag } : t
    ));
  }, []);

  // A2UI/DynamicUI actions — use active tab's chatId for the wire message
  const handleA2UIAction = useCallback((userAction: any) => {
    if (activeTabId) sendA2UIAction(activeTabId, userAction);
  }, [activeTabId, sendA2UIAction]);

  const handleDynamicUIAction = useCallback((action: any) => {
    // Use origin channel/chatId from the wire message for precise routing
    const origin = dynamicUIOriginRef.current;
    const chatId = origin.chatId || activeTabId;
    if (chatId) sendDynamicUIAction(chatId, action, origin.channel);
  }, [activeTabId, sendDynamicUIAction]);

  const handleA2UIMaximize = useCallback(() => {
    setIsA2UIMaximized(prev => !prev);
  }, []);

  const handleA2UIClose = useCallback(() => {
    setA2UIData(null);
    setIsA2UIMaximized(false);
  }, []);

  const handleDynamicUIMaximize = useCallback(() => {
    setIsDynamicUIMaximized(prev => !prev);
  }, []);

  const handleDynamicUIClose = useCallback(() => {
    setDynamicUIData(null);
    setIsDynamicUIMaximized(false);
  }, []);

  // Settings
  const handleToggleHistory = useCallback(() => {
    setSettings(prev => {
      const next = { ...prev, historyEnabled: !prev.historyEnabled };
      saveSettings(next);
      return next;
    });
  }, []);

  const handleToggleA2UI = useCallback(() => {
    setSettings(prev => {
      const next = { ...prev, capA2ui: !prev.capA2ui };
      saveSettings(next);
      return next;
    });
  }, []);

  const handleTogglePlasma = useCallback(() => {
    setSettings(prev => {
      const next = { ...prev, capPlasma: !prev.capPlasma };
      saveSettings(next);
      return next;
    });
  }, []);

  const handleMaxMessagesChange = useCallback((value: number) => {
    setSettings(prev => {
      const next = { ...prev, maxMessages: value };
      saveSettings(next);
      return next;
    });
  }, []);

  const handleScrollToBottom = useCallback(() => {
    const anchor = document.getElementById("messages-end");
    if (anchor) {
      anchor.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, []);

  const handleToggleNewestFirst = useCallback(() => {
    if (!activeTabId) return;
    setTabs(prev => prev.map(t =>
      t.id === activeTabId ? { ...t, newestFirst: !t.newestFirst } : t
    ));
  }, [activeTabId]);

  const tabInfos: TabInfo[] = tabs.map(t => ({ id: t.id, index: t.index, tag: t.tag }));
  const infoModalChatId = infoModalTabId ? tabs.find(t => t.id === infoModalTabId)?.id : null;

  if (isConfiguring) {
    return (
      <div className="config-screen">
        <div className="config-card">
          <button className="config-close-btn" onClick={() => setIsConfiguring(false)} title="Close">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 2L10 10M10 2L2 10" />
            </svg>
          </button>
          <h1>Hera ElectroNode</h1>
          <p>Connect to a Hera gateway</p>
          <div className="config-field">
            <label>Gateway URL</label>
            <GatewayURLField value={gatewayUrl} onChange={setGatewayUrl} />
          </div>
          <div className="config-info">
            <span className="config-info-label">Node ID</span>
            <span className="config-info-value">{nodeInfo.nodeId}</span>
          </div>
          <div className="settings-section">
            <h3>Chat History</h3>
            <div className="settings-row">
              <span>Retain chat history</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.historyEnabled}
                  onChange={handleToggleHistory}
                />
                <span className="toggle-slider" />
              </label>
            </div>
            <div className="settings-row slider-row">
              <span>Max messages</span>
              <div className="slider-control">
                <input
                  type="range"
                  min={100}
                  max={1000}
                  step={50}
                  value={settings.maxMessages}
                  onChange={e => handleMaxMessagesChange(Number(e.target.value))}
                />
                <span className="slider-value">{settings.maxMessages}</span>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>Capabilities</h3>
            <div className="settings-row">
              <span>A2UI</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.capA2ui}
                  onChange={handleToggleA2UI}
                />
                <span className="toggle-slider" />
              </label>
            </div>
            <div className="settings-row">
              <span>Plasma</span>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.capPlasma}
                  onChange={handleTogglePlasma}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>

          <button className="connect-btn" onClick={handleConnect}>
            Connect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <div className="app-header">
        <ConnectionStatus state={state} serverUrl={gatewayUrl} />
        <div className="window-controls">
          <button className="settings-btn" onClick={() => setIsConfiguring(true)} title="Settings">
            <svg width="16" height="16" viewBox="0 0 100 100" fill="none">
              {/* Left lobe */}
              <polygon points="50,35 25,12 12,30" fill="#f06292"/>
              <polygon points="25,12 8,18 12,30" fill="#e91e90"/>
              <polygon points="8,18 5,35 12,30" fill="#d81b80"/>
              <polygon points="50,35 12,30 5,35" fill="#c2185b"/>
              {/* Right lobe */}
              <polygon points="50,35 75,12 88,30" fill="#f48fb1"/>
              <polygon points="75,12 92,18 88,30" fill="#ec407a"/>
              <polygon points="92,18 95,35 88,30" fill="#e91e63"/>
              <polygon points="50,35 88,30 95,35" fill="#d81b60"/>
              {/* Top highlights */}
              <polygon points="25,12 50,8 50,35" fill="#f8bbd0"/>
              <polygon points="75,12 50,8 50,35" fill="#fce4ec"/>
              {/* Body */}
              <polygon points="5,35 50,35 30,58" fill="#ad1457"/>
              <polygon points="95,35 50,35 70,58" fill="#c2185b"/>
              {/* Lower */}
              <polygon points="50,35 30,58 50,92" fill="#b71c1c"/>
              <polygon points="50,35 70,58 50,92" fill="#d32f2f"/>
              <polygon points="5,35 30,58 15,55" fill="#880e4f"/>
              <polygon points="15,55 30,58 50,92" fill="#7b1fa2"/>
              <polygon points="95,35 70,58 85,55" fill="#ad1457"/>
              <polygon points="85,55 70,58 50,92" fill="#9c27b0"/>
            </svg>
          </button>
          <button className="window-btn window-close" onClick={handleClose}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 2L10 10M10 2L2 10" />
            </svg>
          </button>
        </div>
      </div>

      <TabBar
        tabs={tabInfos}
        activeTabId={activeTabId}
        onSelect={handleSelectTab}
        onClose={handleCloseTab}
        onCreate={handleCreateTab}
        onTagChange={handleTagChange}
        onClear={handleClearTab}
        onInfo={(tabId) => setInfoModalTabId(tabId)}
        onScrollToBottom={handleScrollToBottom}
        newestFirst={activeTab?.newestFirst || false}
        onToggleNewestFirst={handleToggleNewestFirst}
        maxTabs={MAX_TABS}
      />

      <div className="app-content">
        <div className={`chat-panel ${(dynamicUIData && !isDynamicUIMaximized) || (a2uiData && !isA2UIMaximized && !dynamicUIData) ? "with-a2ui" : ""} ${isDynamicUIMaximized || isA2UIMaximized ? "hidden" : ""}`}>
          <Chat
            messages={activeTab?.messages || []}
            onSend={handleSendMessage}
            isTyping={activeTab?.isTyping || false}
            newestFirst={activeTab?.newestFirst || false}
            disabled={state !== "paired"}
            draft={activeTab?.draft || ""}
            onDraftChange={handleDraftChange}
          />
        </div>
        {dynamicUIData && (
          <div className={`a2ui-panel ${isDynamicUIMaximized ? "maximized" : ""}`}>
            <div className="a2ui-panel-header">
              <span>Plasma Dynamic Surface</span>
              <div className="a2ui-controls">
                <button onClick={handleDynamicUIMaximize} title={isDynamicUIMaximized ? "Restore" : "Fullscreen"}>
                  {isDynamicUIMaximized ? "\u25F1" : "\u25A1"}
                </button>
                <button className="close-btn" onClick={handleDynamicUIClose}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 2L8 8M8 2L2 8" />
                  </svg>
                </button>
              </div>
            </div>
            <DynamicUIHost
              payload={dynamicUIData}
              onAction={handleDynamicUIAction}
            />
          </div>
        )}
        {!dynamicUIData && a2uiData && (
          <div className={`a2ui-panel ${isA2UIMaximized ? "maximized" : ""}`}>
            <div className="a2ui-panel-header">
              <span>A2UI Surface</span>
              <div className="a2ui-controls">
                <button onClick={handleA2UIMaximize} title={isA2UIMaximized ? "Restore" : "Fullscreen"}>
                  {isA2UIMaximized ? "\u25F1" : "\u25A1"}
                </button>
                <button className="close-btn" onClick={handleA2UIClose}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 2L8 8M8 2L2 8" />
                  </svg>
                </button>
              </div>
            </div>
            <A2UIHost
              data={a2uiData}
              onAction={handleA2UIAction}
            />
          </div>
        )}
      </div>

      {infoModalChatId && (
        <ChatInfoModal
          chatId={infoModalChatId}
          onClose={() => setInfoModalTabId(null)}
        />
      )}

      {showClearConfirm && (
        <div className="modal-backdrop" onClick={() => setShowClearConfirm(false)}>
          <div className="quit-dialog" onClick={e => e.stopPropagation()}>
            <h3>Clear Chat</h3>
            <p>This will remove all messages from this chat locally. The conversation history on the server is not affected.</p>
            <div className="quit-dialog-buttons">
              <button className="quit-dialog-cancel" onClick={() => setShowClearConfirm(false)}>Cancel</button>
              <button className="quit-dialog-confirm" onClick={handleClearConfirm}>Clear</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
