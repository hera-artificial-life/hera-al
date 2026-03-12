/**
 * HeraA2UIHost — Lit Custom Element for A2UI Rendering
 *
 * Based on OpenClaw bootstrap.js, adapted for Hera ElectroNode.
 *
 * This component:
 * 1. Creates an A2UI message processor (from @a2ui/lit)
 * 2. Feeds incoming JSONL messages to it via applyMessages()
 * 3. Renders surfaces using <a2ui-surface> web components
 * 4. Captures user actions and routes them back via custom events
 * 5. Provides toast feedback and error handling
 *
 * Exposes global API: globalThis.heraA2UI.applyMessages(messages)
 */

import { LitElement, html, css, unsafeCSS } from "lit";
import { customElement, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { ContextProvider } from "@lit/context";
import { v0_8 } from "@a2ui/lit";
import "@a2ui/lit/ui";
import { themeContext, heraTheme } from "./theme.js";

interface ToastState {
  text: string;
  kind: "ok" | "error";
  expiresAt: number;
}

interface PendingAction {
  id: string;
  name: string;
  phase: "sending" | "sent" | "error";
  startedAt: number;
  sentAt?: number;
  error?: string;
}

/**
 * Hera A2UI Host Element
 *
 * Usage:
 *   <hera-a2ui-host></hera-a2ui-host>
 *
 * API:
 *   window.heraA2UI.applyMessages(messages: any[])
 *   window.heraA2UI.reset()
 *   window.heraA2UI.getSurfaces(): string[]
 */
@customElement("hera-a2ui-host")
export class HeraA2UIHost extends LitElement {
  static properties = {
    surfaces: { state: true },
    pendingAction: { state: true },
    toast: { state: true },
  };

  surfaces: Array<[string, any]> = [];
  pendingAction: PendingAction | null = null;
  toast: ToastState | null = null;

  private processor = v0_8.Data.createSignalA2uiMessageProcessor();
  private themeProvider = new ContextProvider(this, {
    context: themeContext,
    initialValue: heraTheme,
  });

  static styles = css`
    :host {
      display: block;
      height: 100%;
      width: 100%;
      position: relative;
      box-sizing: border-box;
      padding: 16px;
      overflow: auto;
      background: var(--background, #0a0e14);

      /* A2UI global styles */
      --a2ui-background: #0a0e14;
      --a2ui-text-primary: #e6eaf0;
      --a2ui-text-secondary: #8892a6;
      --a2ui-accent: #e91e8c;
      --a2ui-border: rgba(255, 255, 255, 0.08);
    }

    /* Force visibility for A2UI components */
    :host ::slotted(*),
    a2ui-surface,
    a2ui-surface * {
      color: var(--a2ui-text-primary, #e6eaf0) !important;
    }

    /* A2UI Text components */
    a2ui-surface h1,
    a2ui-surface h2,
    a2ui-surface h3,
    a2ui-surface h4,
    a2ui-surface h5 {
      color: var(--a2ui-text-primary, #e6eaf0) !important;
      margin: 0 0 12px 0 !important;
    }

    a2ui-surface p,
    a2ui-surface div {
      color: var(--a2ui-text-primary, #e6eaf0) !important;
    }

    /* A2UI TextField */
    a2ui-surface input,
    a2ui-surface textarea {
      background: rgba(255, 255, 255, 0.05) !important;
      border: 1px solid var(--a2ui-border, rgba(255, 255, 255, 0.08)) !important;
      border-radius: 8px !important;
      padding: 10px 12px !important;
      color: var(--a2ui-text-primary, #e6eaf0) !important;
      font-size: 14px !important;
    }

    a2ui-surface label {
      color: var(--a2ui-text-secondary, #8892a6) !important;
      font-size: 13px !important;
      font-weight: 500 !important;
      margin-bottom: 6px !important;
      display: block !important;
    }

    /* A2UI Button */
    a2ui-surface button {
      background: linear-gradient(135deg, #e91e8c, #c71873) !important;
      border: 0 !important;
      border-radius: 10px !important;
      padding: 10px 16px !important;
      color: #ffffff !important;
      font-weight: 600 !important;
      font-size: 14px !important;
      cursor: pointer !important;
      box-shadow: 0 4px 12px rgba(233, 30, 140, 0.25) !important;
    }

    a2ui-surface button:hover {
      background: linear-gradient(135deg, #ff2ba0, #e91e8c) !important;
      box-shadow: 0 6px 16px rgba(233, 30, 140, 0.35) !important;
    }

    #surfaces {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
      height: 100%;
      padding-bottom: 60px; /* Space for toast */
    }

    a2ui-surface {
      display: block;
    }

    .empty {
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      opacity: 0.5;
      color: var(--text-secondary, #8892a6);
    }

    .empty-title {
      font-weight: 700;
      font-size: 18px;
      margin-bottom: 8px;
      color: var(--accent, #e91e8c);
    }

    .empty-subtitle {
      font-size: 14px;
    }

    .status {
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      top: 24px;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 12px;
      background: rgba(0, 0, 0, 0.75);
      border: 1px solid rgba(233, 30, 140, 0.3);
      color: rgba(255, 255, 255, 0.95);
      font: 13px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      pointer-events: none;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      z-index: 1000;
    }

    .toast {
      position: fixed;
      left: 50%;
      transform: translateX(-50%);
      bottom: 24px;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 12px;
      background: rgba(0, 0, 0, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: rgba(255, 255, 255, 0.95);
      font: 13px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      pointer-events: none;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      z-index: 1000;
      animation: slideUp 0.2s ease-out;
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }

    .toast.error {
      border-color: rgba(255, 90, 90, 0.4);
      background: rgba(40, 10, 10, 0.85);
    }

    .spinner {
      width: 14px;
      height: 14px;
      border-radius: 999px;
      border: 2px solid rgba(255, 255, 255, 0.2);
      border-top-color: var(--accent, #e91e8c);
      animation: spin 0.75s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();

    // Inject global A2UI styles (penetrate shadow DOM)
    if (!document.getElementById("hera-a2ui-styles")) {
      const styleEl = document.createElement("style");
      styleEl.id = "hera-a2ui-styles";
      styleEl.textContent = `
        /* A2UI Global Styles - Hera Theme */
        a2ui-surface {
          color: #e6eaf0 !important;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        }

        a2ui-surface h1,
        a2ui-surface h2,
        a2ui-surface h3,
        a2ui-surface h4,
        a2ui-surface h5 {
          color: #e6eaf0 !important;
          margin: 0 0 12px 0 !important;
        }

        a2ui-surface h1 { font-size: 24px !important; font-weight: 700 !important; }
        a2ui-surface h2 { font-size: 20px !important; font-weight: 700 !important; }
        a2ui-surface h3 { font-size: 17px !important; font-weight: 600 !important; }

        a2ui-surface p,
        a2ui-surface div,
        a2ui-surface span {
          color: #e6eaf0 !important;
        }

        a2ui-surface label {
          color: #8892a6 !important;
          font-size: 13px !important;
          font-weight: 500 !important;
          margin-bottom: 6px !important;
          display: block !important;
        }

        /* TextField, DateTimeInput - text inputs */
        a2ui-surface input[type="text"],
        a2ui-surface input[type="email"],
        a2ui-surface input[type="number"],
        a2ui-surface input[type="date"],
        a2ui-surface input[type="datetime-local"],
        a2ui-surface input[type="time"],
        a2ui-surface textarea {
          background: rgba(255, 255, 255, 0.05) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          border-radius: 8px !important;
          padding: 10px 12px !important;
          color: #e6eaf0 !important;
          font-size: 14px !important;
          width: 100% !important;
          box-sizing: border-box !important;
        }

        a2ui-surface input[type="text"]:focus,
        a2ui-surface input[type="email"]:focus,
        a2ui-surface input[type="number"]:focus,
        a2ui-surface input[type="date"]:focus,
        a2ui-surface input[type="datetime-local"]:focus,
        a2ui-surface input[type="time"]:focus,
        a2ui-surface textarea:focus {
          outline: none !important;
          border-color: rgba(233, 30, 140, 0.5) !important;
          box-shadow: 0 0 0 3px rgba(233, 30, 140, 0.1) !important;
        }

        /* Slider (range input) */
        a2ui-surface input[type="range"] {
          -webkit-appearance: none !important;
          appearance: none !important;
          width: 100% !important;
          height: 6px !important;
          border-radius: 3px !important;
          background: rgba(255, 255, 255, 0.1) !important;
          outline: none !important;
        }

        a2ui-surface input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none !important;
          appearance: none !important;
          width: 18px !important;
          height: 18px !important;
          border-radius: 50% !important;
          background: #e91e8c !important;
          cursor: pointer !important;
          box-shadow: 0 2px 6px rgba(233, 30, 140, 0.4) !important;
        }

        a2ui-surface input[type="range"]::-moz-range-thumb {
          width: 18px !important;
          height: 18px !important;
          border-radius: 50% !important;
          background: #e91e8c !important;
          cursor: pointer !important;
          border: none !important;
          box-shadow: 0 2px 6px rgba(233, 30, 140, 0.4) !important;
        }

        /* Checkbox */
        a2ui-surface input[type="checkbox"] {
          width: 18px !important;
          height: 18px !important;
          border: 2px solid rgba(255, 255, 255, 0.2) !important;
          border-radius: 4px !important;
          background: rgba(255, 255, 255, 0.05) !important;
          cursor: pointer !important;
          -webkit-appearance: none !important;
          appearance: none !important;
          position: relative !important;
        }

        a2ui-surface input[type="checkbox"]:checked {
          background: #e91e8c !important;
          border-color: #e91e8c !important;
        }

        a2ui-surface input[type="checkbox"]:checked::after {
          content: "✓" !important;
          position: absolute !important;
          color: white !important;
          font-size: 14px !important;
          font-weight: bold !important;
          left: 2px !important;
          top: -2px !important;
        }

        /* Button */
        a2ui-surface button {
          background: linear-gradient(135deg, #e91e8c, #c71873) !important;
          border: 0 !important;
          border-radius: 10px !important;
          padding: 10px 16px !important;
          color: #ffffff !important;
          font-weight: 600 !important;
          font-size: 14px !important;
          cursor: pointer !important;
          box-shadow: 0 4px 12px rgba(233, 30, 140, 0.25) !important;
          transition: all 0.15s ease !important;
        }

        a2ui-surface button:hover {
          background: linear-gradient(135deg, #ff2ba0, #e91e8c) !important;
          box-shadow: 0 6px 16px rgba(233, 30, 140, 0.35) !important;
          transform: translateY(-1px) !important;
        }

        a2ui-surface button:active {
          transform: translateY(0) !important;
          box-shadow: 0 2px 8px rgba(233, 30, 140, 0.3) !important;
        }

        /* Card - elevated container */
        a2ui-card {
          background: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03)) !important;
          border: 1px solid rgba(255,255,255,.09) !important;
          border-radius: 14px !important;
          padding: 14px !important;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3) !important;
          display: block !important;
          margin-bottom: 12px !important;
        }

        /* Row - horizontal layout */
        a2ui-row {
          display: flex !important;
          flex-direction: row !important;
          gap: 10px !important;
          align-items: center !important;
        }

        /* Column - vertical layout */
        a2ui-column {
          display: flex !important;
          flex-direction: column !important;
          gap: 10px !important;
        }

        /* Divider - horizontal line */
        a2ui-divider {
          display: block !important;
          height: 1px !important;
          background: rgba(255, 255, 255, 0.08) !important;
          opacity: 0.25 !important;
          margin: 8px 0 !important;
        }

        /* MultipleChoice - radio buttons / select */
        a2ui-surface select {
          background: rgba(255, 255, 255, 0.05) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          border-radius: 8px !important;
          padding: 10px 12px !important;
          color: #e6eaf0 !important;
          font-size: 14px !important;
          width: 100% !important;
          cursor: pointer !important;
        }

        a2ui-surface select:focus {
          outline: none !important;
          border-color: rgba(233, 30, 140, 0.5) !important;
          box-shadow: 0 0 0 3px rgba(233, 30, 140, 0.1) !important;
        }

        a2ui-surface input[type="radio"] {
          width: 18px !important;
          height: 18px !important;
          border: 2px solid rgba(255, 255, 255, 0.2) !important;
          border-radius: 50% !important;
          background: rgba(255, 255, 255, 0.05) !important;
          cursor: pointer !important;
          -webkit-appearance: none !important;
          appearance: none !important;
          position: relative !important;
          margin-right: 8px !important;
        }

        a2ui-surface input[type="radio"]:checked {
          border-color: #e91e8c !important;
        }

        a2ui-surface input[type="radio"]:checked::after {
          content: "" !important;
          position: absolute !important;
          width: 10px !important;
          height: 10px !important;
          border-radius: 50% !important;
          background: #e91e8c !important;
          left: 2px !important;
          top: 2px !important;
        }

        /* Image */
        a2ui-surface img {
          border-radius: 12px !important;
          max-width: 100% !important;
          height: auto !important;
        }

        /* List */
        a2ui-list {
          display: flex !important;
          flex-direction: column !important;
          gap: 8px !important;
        }

        /* Tabs */
        a2ui-tabs {
          display: block !important;
        }

        a2ui-tabs [role="tablist"] {
          display: flex !important;
          gap: 8px !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
          margin-bottom: 16px !important;
        }

        a2ui-tabs [role="tab"] {
          background: transparent !important;
          border: none !important;
          border-bottom: 2px solid transparent !important;
          padding: 10px 16px !important;
          color: #8892a6 !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
        }

        a2ui-tabs [role="tab"][aria-selected="true"] {
          color: #e91e8c !important;
          border-bottom-color: #e91e8c !important;
        }

        a2ui-tabs [role="tab"]:hover {
          color: #e6eaf0 !important;
        }

        /* Modal */
        a2ui-modal dialog {
          background: rgba(12, 16, 24, 0.92) !important;
          border: 1px solid rgba(255,255,255,.12) !important;
          border-radius: 16px !important;
          padding: 16px !important;
          box-shadow: 0 30px 80px rgba(0,0,0,.6) !important;
          width: min(520px, calc(100vw - 48px)) !important;
          backdrop-filter: blur(12px) !important;
          -webkit-backdrop-filter: blur(12px) !important;
        }

        a2ui-modal dialog::backdrop {
          background: rgba(5, 8, 16, 0.65) !important;
          backdrop-filter: blur(6px) !important;
        }

        /* Audio/Video */
        a2ui-surface audio,
        a2ui-surface video {
          width: 100% !important;
          border-radius: 12px !important;
          background: rgba(0, 0, 0, 0.3) !important;
        }

        /* Icon */
        a2ui-icon {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          color: #e6eaf0 !important;
        }
      `;
      document.head.appendChild(styleEl);
    }

    // Expose global API
    const api = {
      applyMessages: (messages: any[]) => this.applyMessages(messages),
      reset: () => this.reset(),
      getSurfaces: () => Array.from(this.processor.getSurfaces().keys()),
      // Debug helpers
      inspect: () => this.inspect(),
      getProcessor: () => this.processor,
    };
    (globalThis as any).heraA2UI = api;

    // Debug logging
    console.log("[A2UI] HeraA2UIHost connected. Use heraA2UI.inspect() for debug info.");

    // Listen for action status events (from React)
    const statusListener = (evt: Event) => this.handleActionStatus(evt as CustomEvent);
    globalThis.addEventListener("hera:a2ui-action-status", statusListener);

    // Store listener for cleanup
    (this as any)._statusListener = statusListener;

    this.syncSurfaces();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if ((this as any)._statusListener) {
      globalThis.removeEventListener("hera:a2ui-action-status", (this as any)._statusListener);
    }
  }

  /**
   * Apply A2UI messages to the processor and update surfaces.
   * Called from React via globalThis.heraA2UI.applyMessages()
   */
  applyMessages(messages: any[]): { ok: boolean; surfaces?: string[] } {
    if (!Array.isArray(messages)) {
      this.showToast("Invalid messages: expected array", "error");
      return { ok: false };
    }

    try {
      this.processor.processMessages(messages);
      this.syncSurfaces();

      // Debug: inspect data model
      const surfaces = this.processor.getSurfaces();
      for (const [surfaceId, surface] of surfaces.entries()) {
        const dataModel = (surface as any).dataModel;
        console.log(`[A2UI] Data model for surface "${surfaceId}":`, dataModel);
      }

      // Clear pending action if surface updated successfully
      if (this.pendingAction?.phase === "sent") {
        this.showToast(`Updated: ${this.pendingAction.name}`, "ok", 1000);
        this.pendingAction = null;
      }

      this.requestUpdate();
      return {
        ok: true,
        surfaces: this.surfaces.map(([id]) => id),
      };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[A2UI] applyMessages error:", err);
      this.showToast(`Render error: ${errMsg}`, "error", 4000);
      return { ok: false };
    }
  }

  /**
   * Reset all surfaces (clear canvas).
   */
  reset(): { ok: boolean } {
    try {
      this.processor.clearSurfaces();
      this.syncSurfaces();
      this.pendingAction = null;
      this.requestUpdate();
      return { ok: true };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.showToast(`Reset error: ${errMsg}`, "error");
      return { ok: false };
    }
  }

  /**
   * Sync surfaces array from processor.
   */
  private syncSurfaces() {
    this.surfaces = Array.from(this.processor.getSurfaces().entries());
  }

  /**
   * Handle a2uiaction events from @a2ui/lit components.
   */
  private handleA2UIAction(evt: CustomEvent) {
    const payload = evt?.detail ?? null;
    if (!payload || payload.eventType !== "a2ui.action") {
      return;
    }

    const action = payload.action;

    // Action structure from A2UI v0.8: { name: string, context: [] }
    const name = action?.name ?? null;
    if (!name) {
      return;
    }

    const sourceComponentId = payload.sourceComponentId ?? "";
    const surfaces = this.processor.getSurfaces();

    // Find which surface contains the source component
    let surfaceId: string | null = null;
    let sourceNode: any = null;
    for (const [sid, surface] of surfaces.entries()) {
      const node = (surface as any)?.components?.get?.(sourceComponentId) ?? null;
      if (node) {
        surfaceId = sid;
        sourceNode = node;
        break;
      }
    }

    // Resolve context from data model (like OpenClaw)
    const context: Record<string, any> = {};
    const ctxItems = Array.isArray(action?.context) ? action.context : [];
    for (const item of ctxItems) {
      const key = item?.key;
      const value = item?.value ?? null;
      if (!key || !value) continue;

      // Resolve path from data model
      if (typeof value.path === "string") {
        const resolved = sourceNode
          ? this.processor.getData(sourceNode, value.path, surfaceId ?? undefined)
          : null;
        context[key] = resolved;
        continue;
      }

      // Literal values
      if (Object.prototype.hasOwnProperty.call(value, "literalString")) {
        context[key] = value.literalString ?? "";
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(value, "literalNumber")) {
        context[key] = value.literalNumber ?? 0;
        continue;
      }
      if (Object.prototype.hasOwnProperty.call(value, "literalBoolean")) {
        context[key] = value.literalBoolean ?? false;
        continue;
      }
    }

    // Create user action
    const actionId = crypto.randomUUID();
    const userAction = {
      id: actionId,
      name,
      surfaceId: surfaceId ?? "main",
      sourceComponentId,
      timestamp: new Date().toISOString(),
      ...(Object.keys(context).length > 0 ? { context } : {}),
    };

    // Update UI state
    this.pendingAction = {
      id: actionId,
      name,
      phase: "sending",
      startedAt: Date.now(),
    };
    this.requestUpdate();

    // Dispatch to React (which sends via WebSocket)
    const customEvent = new CustomEvent("hera:a2ui-action", {
      detail: userAction,
      bubbles: true,
      composed: true,
    });
    globalThis.dispatchEvent(customEvent);
  }

  /**
   * Handle action status updates from React.
   */
  private handleActionStatus(evt: CustomEvent) {
    const detail = evt?.detail ?? null;
    if (!detail || typeof detail.id !== "string") return;
    if (!this.pendingAction || this.pendingAction.id !== detail.id) return;

    if (detail.ok) {
      this.pendingAction = {
        ...this.pendingAction,
        phase: "sent",
        sentAt: Date.now(),
      };
    } else {
      const msg = typeof detail.error === "string" && detail.error ? detail.error : "send failed";
      this.pendingAction = {
        ...this.pendingAction,
        phase: "error",
        error: msg,
      };
      this.showToast(`Failed: ${msg}`, "error", 4000);
    }
    this.requestUpdate();
  }

  /**
   * Debug helper: inspect current state.
   */
  private inspect(): any {
    const surfaces = this.processor.getSurfaces();
    const surfaceInfo = Array.from(surfaces.entries()).map(([id, surface]) => ({
      id,
      components: (surface as any).components
        ? Array.from((surface as any).components.keys())
        : [],
      dataModel: (surface as any).dataModel ?? null,
    }));

    const info = {
      surfaceCount: surfaces.size,
      surfaces: surfaceInfo,
      pendingAction: this.pendingAction,
      toast: this.toast,
    };

    console.log("[A2UI Debug]", info);
    return info;
  }

  /**
   * Show toast notification.
   */
  private showToast(text: string, kind: "ok" | "error" = "ok", timeoutMs = 2000) {
    const toast: ToastState = {
      text,
      kind,
      expiresAt: Date.now() + timeoutMs,
    };
    this.toast = toast;
    this.requestUpdate();

    setTimeout(() => {
      if (this.toast === toast) {
        this.toast = null;
        this.requestUpdate();
      }
    }, timeoutMs + 50);
  }

  render() {
    if (this.surfaces.length === 0) {
      return html`
        <div class="empty">
          <div class="empty-title">A2UI Canvas</div>
          <div class="empty-subtitle">No surfaces to display</div>
        </div>
      `;
    }

    const statusText =
      this.pendingAction?.phase === "sent"
        ? `Working: ${this.pendingAction.name}`
        : this.pendingAction?.phase === "sending"
          ? `Sending: ${this.pendingAction.name}`
          : this.pendingAction?.phase === "error"
            ? `Failed: ${this.pendingAction.name}`
            : "";

    return html`
      ${this.pendingAction && this.pendingAction.phase !== "error"
        ? html`
            <div class="status">
              <div class="spinner"></div>
              <div>${statusText}</div>
            </div>
          `
        : ""}
      ${this.toast
        ? html`<div class="toast ${this.toast.kind === "error" ? "error" : ""}">${this.toast.text}</div>`
        : ""}
      <section id="surfaces">
        ${repeat(
          this.surfaces,
          ([surfaceId]) => surfaceId,
          ([surfaceId, surface]) => html`
            <a2ui-surface
              .surfaceId=${surfaceId}
              .surface=${surface}
              .processor=${this.processor}
              @a2uiaction=${(evt: CustomEvent) => this.handleA2UIAction(evt)}
            ></a2ui-surface>
          `
        )}
      </section>
    `;
  }
}

// Export for type safety
declare global {
  interface HTMLElementTagNameMap {
    "hera-a2ui-host": HeraA2UIHost;
  }

  interface Window {
    heraA2UI: {
      applyMessages: (messages: any[]) => { ok: boolean; surfaces?: string[] };
      reset: () => { ok: boolean };
      getSurfaces: () => string[];
      inspect: () => any;
      getProcessor: () => any;
    };
  }
}
