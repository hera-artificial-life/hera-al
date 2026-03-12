/**
 * A2UIHost — React wrapper for HeraA2UIHost Lit element
 *
 * This component:
 * 1. Imports and registers the hera-a2ui-host custom element
 * 2. Feeds incoming A2UI messages via globalThis.heraA2UI.applyMessages()
 * 3. Listens for user actions and routes them back via WebSocket
 */

import React, { useEffect } from "react";
import type { A2UISurfaceData } from "../hooks/useWebSocket";

// Import Lit element (registers <hera-a2ui-host> globally)
import "../a2ui/HeraA2UIHost.js";

interface A2UIHostProps {
  data: A2UISurfaceData | null;
  onAction: (userAction: {
    id: string;
    name: string;
    surfaceId: string;
    sourceComponentId: string;
    timestamp: string;
    context?: Record<string, unknown>;
  }) => void;
}

export default function A2UIHost({ data, onAction }: A2UIHostProps) {
  // Apply messages when data changes
  useEffect(() => {
    if (!data?.jsonl) return;

    try {
      // Parse JSONL into messages
      const lines = data.jsonl.split("\n").filter((l: string) => l.trim());
      const messages = lines.map((l: string) => JSON.parse(l));

      console.log("[A2UI] Received JSONL:", data.jsonl);
      console.log("[A2UI] Parsed messages:", messages);

      // Debug: Log each component
      const surfaceUpdate = messages.find((m: any) => m.surfaceUpdate);
      if (surfaceUpdate?.surfaceUpdate?.components) {
        surfaceUpdate.surfaceUpdate.components.forEach((comp: any, idx: number) => {
          const componentType = comp.component ? Object.keys(comp.component)[0] : 'unknown';
          console.log(`[A2UI] Component ${idx}: ${comp.id} (${componentType})`, comp.component);
        });
      }

      // Call Lit element API
      const api = (window as any).heraA2UI;
      if (api && typeof api.applyMessages === "function") {
        const result = api.applyMessages(messages);
        if (!result.ok) {
          console.error("A2UI applyMessages failed");
        }
      } else {
        console.warn("heraA2UI API not available yet, retrying...");
        // Retry after a short delay (element may still be initializing)
        setTimeout(() => {
          const retryApi = (window as any).heraA2UI;
          if (retryApi && typeof retryApi.applyMessages === "function") {
            retryApi.applyMessages(messages);
          }
        }, 100);
      }
    } catch (err) {
      console.error("Failed to process A2UI data:", err);
    }
  }, [data]);

  // Listen for user actions from Lit element
  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent;
      const userAction = customEvent.detail;
      if (userAction) {
        onAction(userAction);
      }
    };

    window.addEventListener("hera:a2ui-action", handler);
    return () => window.removeEventListener("hera:a2ui-action", handler);
  }, [onAction]);

  return (
    <div className="a2ui-host" style={{ width: "100%", height: "100%" }}>
      <hera-a2ui-host />
    </div>
  );
}

// TypeScript declarations for custom element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "hera-a2ui-host": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}
