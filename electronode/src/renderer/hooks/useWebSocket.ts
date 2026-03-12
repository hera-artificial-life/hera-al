/**
 * WebSocket hook for connecting to Hera gateway via Nostromo WS.
 *
 * Handles:
 * - Connection/reconnection with exponential backoff
 * - Hello handshake (nodeId, displayName, capabilities)
 * - Pairing flow
 * - Message routing (chat, a2ui_surface, typing_indicator)
 * - Command dispatch (dynamic_ui.query → evaluate JS in iframe → command_result)
 *
 * Multi-tab: chatId is passed per-call, not per-hook.
 * All incoming messages are routed via a single onMessage callback.
 */

import { useState, useEffect, useRef, useCallback } from "react";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "paired";

export interface ChatAttachment {
  type: string;       // "image" | "audio" | "document"
  mimeType: string;
  fileName: string;
  data: string;       // base64
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  timestamp: number;
  attachments?: ChatAttachment[];
}

export interface A2UISurfaceData {
  messages: unknown[];
  jsonl: string;
}

/** Union of all incoming message types routed to the app */
export type IncomingMessage =
  | { type: "chat_response"; chatId: string; text: string }
  | { type: "chat_message"; chatId: string; text: string }
  | { type: "a2ui_surface"; chatId: string; messages: unknown[]; jsonl: string }
  | { type: "dynamic_ui"; chatId: string; channel?: string; html: string; css?: string; js?: string; activities: unknown[] }
  | { type: "dynamic_ui_update"; chatId: string; channel?: string; js: string }
  | { type: "dynamic_ui_clear" }
  | { type: "typing_indicator"; chatId: string; typing: boolean };

interface UseWebSocketOptions {
  url: string;
  nodeId: string;
  displayName: string;
  signature: string;
  capabilities?: string[];
  onMessage?: (msg: IncomingMessage) => void;
  onPairingStatus?: (status: string) => void;
}

export function useWebSocket(options: UseWebSocketOptions) {
  const { url, nodeId, displayName, signature, capabilities, onMessage, onPairingStatus } = options;
  const [state, setState] = useState<ConnectionState>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | undefined>(undefined);
  const retriesRef = useRef(0);

  const connect = useCallback(() => {
    if (!url) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setState("connecting");

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      retriesRef.current = 0;
      ws.send(JSON.stringify({
        type: "hello",
        nodeId,
        displayName,
        platform: (window as any).electronAPI?.platform || navigator.platform || "unknown",
        arch: (window as any).electronAPI?.arch || "unknown",
        hostname: "ElectroNode",
        signature,
        capabilities: capabilities ?? ["plasma"],
        commands: ["dynamic_ui.query", "dynamic_ui.screenshot"],
      }));
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === "pairing_status") {
          if (msg.status === "approved") {
            setState("paired");
          } else if (msg.status === "pending") {
            setState("connecting");
            console.log("Node awaiting approval in Nostromo admin panel...");
          } else if (msg.status === "revoked") {
            console.warn("Node signature revoked — disconnecting");
            ws.close();
          }
          onPairingStatus?.(msg.status);
        } else if (msg.type === "command") {
          handleCommand(ws, msg);
        } else if (msg.type === "chat_response") {
          onMessage?.({
            type: "chat_response",
            chatId: msg.chatId || "",
            text: msg.text || "",
          });
        } else if (msg.type === "chat_message") {
          onMessage?.({
            type: "chat_message",
            chatId: msg.chatId || "",
            text: msg.text || "",
          });
        } else if (msg.type === "a2ui_surface") {
          onMessage?.({
            type: "a2ui_surface",
            chatId: msg.chatId || "",
            messages: msg.messages || [],
            jsonl: msg.jsonl || "",
          });
        } else if (msg.type === "dynamic_ui") {
          onMessage?.({
            type: "dynamic_ui",
            chatId: msg.chatId || "",
            channel: msg.channel || undefined,
            html: msg.html || "",
            css: msg.css || "",
            js: msg.js || "",
            activities: msg.activities || [],
          });
        } else if (msg.type === "dynamic_ui_update") {
          onMessage?.({
            type: "dynamic_ui_update",
            chatId: msg.chatId || "",
            channel: msg.channel || undefined,
            js: msg.js || "",
          });
        } else if (msg.type === "dynamic_ui_clear") {
          onMessage?.({ type: "dynamic_ui_clear" });
        } else if (msg.type === "typing_indicator") {
          onMessage?.({
            type: "typing_indicator",
            chatId: msg.chatId || "",
            typing: msg.typing ?? false,
          });
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setState("disconnected");
      wsRef.current = null;
      const delay = Math.min(1000 * 2 ** retriesRef.current, 30000);
      retriesRef.current++;
      reconnectRef.current = window.setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [url, nodeId, displayName, signature, capabilities, onMessage, onPairingStatus]);

  useEffect(() => {
    connect();
    return () => {
      window.clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendChat = useCallback((chatId: string, text: string, attachments?: ChatAttachment[]) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const msg: Record<string, unknown> = { type: "chat", chatId };
    if (text) msg.text = text;
    if (attachments?.length) msg.attachments = attachments;
    ws.send(JSON.stringify(msg));
  }, []);

  const sendA2UIAction = useCallback((chatId: string, userAction: {
    id: string;
    name: string;
    surfaceId: string;
    sourceComponentId: string;
    timestamp: string;
    context?: Record<string, unknown>;
  }) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: "a2ui_action", userAction, chatId }));
  }, []);

  const sendDynamicUIAction = useCallback((chatId: string, action: any, channel?: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const msg: Record<string, unknown> = { type: "dynamic_ui_action", action, chatId };
    if (channel) msg.channel = channel;
    ws.send(JSON.stringify(msg));
  }, []);

  return { state, sendChat, sendA2UIAction, sendDynamicUIAction };
}

// ── Command handling ─────────────────────────────────────────────────

/**
 * Handle an incoming "command" message from the server.
 *
 * Currently supports:
 *   - dynamic_ui.query: evaluate JS in the DynamicUI iframe and return the result
 *
 * Mirrors OSXNode's GatewayLink.handleCommand / handleDynamicUICommand.
 */
function handleCommand(ws: WebSocket, msg: Record<string, unknown>): void {
  const id = msg.id as string | undefined;
  const command = msg.command as string | undefined;
  const params = (msg.params as Record<string, unknown>) || {};

  if (!id || !command) return;

  if (command.startsWith("dynamic_ui.")) {
    handleDynamicUICommand(ws, id, command, params);
  } else {
    sendCommandResult(ws, id, false, undefined, `Unknown command: ${command}`);
  }
}

/**
 * Handle dynamic_ui.* commands.
 *
 * dynamic_ui.query: Evaluate a JS expression inside the DynamicUI iframe
 * and return the result to the server. This is how the PLASMA
 * `dynamic_ui_query` tool reads runtime state from the UI surface.
 */
function handleDynamicUICommand(
  ws: WebSocket,
  id: string,
  command: string,
  params: Record<string, unknown>,
): void {
  switch (command) {
    case "dynamic_ui.query": {
      const jsExpr = params.js as string | undefined;
      if (!jsExpr) {
        sendCommandResult(ws, id, false, undefined, "Missing 'js' parameter");
        return;
      }

      // Use the global query function exposed by DynamicUIHost
      const queryFn = (window as any).__dynamicUIQuery as
        | ((js: string) => Promise<unknown>)
        | undefined;

      if (!queryFn) {
        sendCommandResult(ws, id, false, undefined, "No active Plasma surface");
        return;
      }

      queryFn(jsExpr)
        .then((result) => {
          sendCommandResult(ws, id, true, result);
        })
        .catch((err: Error) => {
          sendCommandResult(ws, id, false, undefined, `JS evaluation error: ${err.message}`);
        });
      break;
    }

    case "dynamic_ui.screenshot": {
      const captureFn = (window as any).__dynamicUIScreenshot as
        | (() => Promise<string>)
        | undefined;

      if (!captureFn) {
        sendCommandResult(ws, id, false, undefined, "No active Plasma surface");
        return;
      }

      captureFn()
        .then((b64: string) => {
          sendCommandResult(ws, id, true, { image: b64, mimeType: "image/png" });
        })
        .catch((err: Error) => {
          sendCommandResult(ws, id, false, undefined, `Screenshot failed: ${err.message}`);
        });
      break;
    }

    default:
      sendCommandResult(ws, id, false, undefined, `Unknown dynamic_ui command: ${command}`);
  }
}

/** Send a command_result message back to the server. */
function sendCommandResult(
  ws: WebSocket,
  id: string,
  ok: boolean,
  result?: unknown,
  error?: string,
): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  const msg: Record<string, unknown> = { type: "command_result", id, ok };
  if (result !== undefined) msg.result = result;
  if (error) msg.error = error;
  ws.send(JSON.stringify(msg));
}
