/**
 * DynamicUIHost — Secure sandbox for LLM-generated HTML/CSS/JS
 *
 * Renders arbitrary UI in iframe with:
 * - CSP restrictions
 * - PostMessage communication
 * - Activity event routing (with dataProvider support)
 * - JS query evaluation for dynamic_ui.query commands
 */

import React, { useEffect, useRef, useCallback } from "react";
import type { DynamicUIPayload, DynamicUIAction, DynamicUIMessage } from "../types/dynamic-ui";

interface DynamicUIHostProps {
  payload: DynamicUIPayload | null;
  onAction: (action: DynamicUIAction) => void;
}

export default function DynamicUIHost({ payload, onAction }: DynamicUIHostProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /** Pending query callbacks, keyed by queryId. */
  const pendingQueriesRef = useRef<Map<string, {
    resolve: (value: unknown) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>>(new Map());

  // Notify iframe when container resizes (e.g., fullscreen toggle)
  useEffect(() => {
    if (!containerRef.current || !iframeRef.current?.contentWindow) return;

    const resizeObserver = new ResizeObserver(() => {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({ type: 'resize' }, '*');
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent<DynamicUIMessage>) => {
      // Security: verify origin (same-origin for iframe srcdoc)
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const msg = event.data;

      if (msg.type === "action" && msg.action) {
        console.log("[DynamicUI] Action received:", msg.action);
        onAction(msg.action);
      } else if (msg.type === "ready") {
        console.log("[DynamicUI] Iframe ready");
      } else if (msg.type === "error") {
        console.error("[DynamicUI] Iframe error:", msg.error);
      } else if (msg.type === "query_result" && msg.queryId) {
        // Resolve pending query promise
        const pending = pendingQueriesRef.current.get(msg.queryId);
        if (pending) {
          clearTimeout(pending.timer);
          pendingQueriesRef.current.delete(msg.queryId);
          if (msg.error) {
            pending.reject(new Error(msg.error));
          } else {
            pending.resolve(msg.result);
          }
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onAction]);

  // Send render/update message when payload changes
  useEffect(() => {
    if (!payload || !iframeRef.current?.contentWindow) {
      return;
    }

    console.log("[DynamicUI] Sending render message:", payload);

    const renderMessage: DynamicUIMessage = {
      type: "render",
      payload,
    };

    // Wait for iframe to be ready
    const iframe = iframeRef.current;
    const sendWhenReady = () => {
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage(renderMessage, "*");
      }
    };

    // Send immediately if already loaded, or wait for load event
    if (iframe.contentDocument?.readyState === "complete") {
      sendWhenReady();
    } else {
      iframe.addEventListener("load", sendWhenReady, { once: true });
    }
  }, [payload]);

  // Handle incremental updates (JS-only, no reload)
  const handleUpdate = useCallback((updateJs: string) => {
    if (!iframeRef.current?.contentWindow) return;

    console.log("[DynamicUI] Sending update:", updateJs);

    iframeRef.current.contentWindow.postMessage({
      type: "update",
      js: updateJs,
    }, "*");
  }, []);

  /**
   * Execute a JS expression in the iframe and return the result.
   * Used by the dynamic_ui.query command handler in useWebSocket.
   *
   * Sends a "query" postMessage to the iframe with a unique queryId.
   * The iframe evaluates the expression and posts back a "query_result".
   * Returns a Promise that resolves/rejects when the result arrives (10s timeout).
   */
  const handleQuery = useCallback((jsExpr: string): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      if (!iframeRef.current?.contentWindow) {
        reject(new Error("No active Plasma surface"));
        return;
      }

      const queryId = `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const timer = setTimeout(() => {
        pendingQueriesRef.current.delete(queryId);
        reject(new Error("Query timed out after 10s"));
      }, 10000);

      pendingQueriesRef.current.set(queryId, { resolve, reject, timer });

      iframeRef.current.contentWindow.postMessage({
        type: "query",
        queryId,
        js: jsExpr,
      }, "*");
    });
  }, []);

  /**
   * Capture a screenshot of the iframe's visible area.
   * Gets the iframe bounding rect, adjusts for devicePixelRatio (HiDPI),
   * and calls the Electron main process to capture that region.
   */
  const handleScreenshot = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!iframeRef.current) {
        reject(new Error("No active Plasma surface"));
        return;
      }

      const electronAPI = (window as any).electronAPI;
      if (!electronAPI?.captureScreenshot) {
        reject(new Error("Screenshot API not available"));
        return;
      }

      const rect = iframeRef.current.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;

      electronAPI
        .captureScreenshot({
          x: Math.round(rect.x * dpr),
          y: Math.round(rect.y * dpr),
          width: Math.round(rect.width * dpr),
          height: Math.round(rect.height * dpr),
        })
        .then((b64: string) => resolve(b64))
        .catch((err: Error) => reject(err));
    });
  }, []);

  // Expose update, query, and screenshot functions for parent components / command handler
  useEffect(() => {
    (window as any).__dynamicUIUpdate = handleUpdate;
    (window as any).__dynamicUIQuery = handleQuery;
    (window as any).__dynamicUIScreenshot = handleScreenshot;

    return () => {
      // Only clean up if they still point to our functions
      if ((window as any).__dynamicUIUpdate === handleUpdate) {
        delete (window as any).__dynamicUIUpdate;
      }
      if ((window as any).__dynamicUIQuery === handleQuery) {
        delete (window as any).__dynamicUIQuery;
      }
      if ((window as any).__dynamicUIScreenshot === handleScreenshot) {
        delete (window as any).__dynamicUIScreenshot;
      }
    };
  }, [handleUpdate, handleQuery, handleScreenshot]);

  // Clean up pending queries on unmount
  useEffect(() => {
    return () => {
      for (const [, pending] of pendingQueriesRef.current) {
        clearTimeout(pending.timer);
        pending.reject(new Error("DynamicUI surface was closed"));
      }
      pendingQueriesRef.current.clear();
    };
  }, []);

  if (!payload) {
    return (
      <div className="dynamic-ui-empty">
        <p>No Dynamic UI to display</p>
      </div>
    );
  }

  // Generate iframe srcdoc with injected activity listeners
  const srcdoc = generateIframeSrcdoc(payload);

  return (
    <div ref={containerRef} className="dynamic-ui-container">
      <iframe
        ref={iframeRef}
        className="dynamic-ui-iframe"
        sandbox="allow-scripts allow-same-origin"
        srcDoc={srcdoc}
        title="Dynamic UI"
      />
    </div>
  );
}

/**
 * Generate iframe srcdoc with:
 * - User HTML
 * - User CSS
 * - User JS
 * - Injected activity event listeners (with dataProvider support)
 * - Query evaluation handler (for dynamic_ui.query)
 */
function generateIframeSrcdoc(payload: DynamicUIPayload): string {
  const { html, css = "", js = "", activities } = payload;

  // Generate activity listener injection code
  const activitiesJSON = JSON.stringify(activities, null, 2);
  const injectedJS = `
    (function() {
      // Activities metadata
      window.__dynamicUIActivities = ${activitiesJSON};

      // Global action sender — defined early so inline handlers can use it
      window.sendAction = function(activityId, type, data) {
        console.log('[DynamicUI] Sending action:', activityId, type, data);
        parent.postMessage({
          type: 'action',
          action: {
            activityId: activityId,
            type: type,
            data: data,
            context: data?.context
          }
        }, '*');
      };

      // Auto-inject event listeners for activities
      function setupActivities() {
        console.log('[DynamicUI] Setting up activity listeners:', window.__dynamicUIActivities);

        window.__dynamicUIActivities.forEach(function(activity) {
          var el = document.getElementById(activity.id);
          if (!el) {
            console.warn('[DynamicUI] Activity element not found:', activity.id);
            return;
          }

          console.log('[DynamicUI] Attaching listener to:', activity.id, activity.type);

          // Handle different activity types
          if (activity.type === 'button') {
            el.addEventListener('click', function(e) {
              e.preventDefault();
              var provided = undefined;
              if (activity.dataProvider) {
                try { provided = eval('(' + activity.dataProvider + ')'); } catch(err) {
                  console.error('[DynamicUI] dataProvider error:', err);
                }
              }
              sendAction(activity.id, 'click', {
                context: activity.context,
                provided: provided
              });
            });
          } else if (activity.type === 'input') {
            el.addEventListener('change', function(e) {
              var provided = undefined;
              if (activity.dataProvider) {
                try { provided = eval('(' + activity.dataProvider + ')'); } catch(err) {
                  console.error('[DynamicUI] dataProvider error:', err);
                }
              }
              sendAction(activity.id, 'change', {
                value: e.target.value,
                context: activity.context,
                provided: provided
              });
            });
          } else if (activity.type === 'canvas' || activity.type === 'custom') {
            // Custom events dispatched via window.sendAction()
            el.dataset.activityId = activity.id;
            el.dataset.activityContext = JSON.stringify(activity.context || {});
          }
        });

        // Signal ready
        parent.postMessage({ type: 'ready' }, '*');
      }

      // Handle both cases: DOM still loading or already loaded
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupActivities);
      } else {
        setupActivities();
      }

      // Listen for incremental updates, resize events, and queries from parent
      window.addEventListener('message', function(event) {
        if (event.data.type === 'update' && event.data.js) {
          console.log('[DynamicUI] Executing update:', event.data.js);
          try {
            eval(event.data.js);
          } catch (err) {
            console.error('[DynamicUI] Update execution error:', err);
            parent.postMessage({ type: 'error', error: err.message }, '*');
          }
        } else if (event.data.type === 'query' && event.data.queryId && event.data.js) {
          // Evaluate a JS expression and return the result to the parent
          var queryId = event.data.queryId;
          try {
            var result = eval(event.data.js);
            parent.postMessage({ type: 'query_result', queryId: queryId, result: result }, '*');
          } catch (err) {
            parent.postMessage({ type: 'query_result', queryId: queryId, error: err.message }, '*');
          }
        } else if (event.data.type === 'resize') {
          console.log('[DynamicUI] Resize event received');
          // Call global resize handler if defined
          if (typeof window.__handleResize === 'function') {
            window.__handleResize();
          }
          // Also trigger window resize for libraries that listen to it
          window.dispatchEvent(new Event('resize'));
        }
      });

      // User JS
      ${js}
    })();
  `;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #0f0f0f;
            color: #e5e5e5;
            padding: 16px;
          }
          ${css}
        </style>
      </head>
      <body>
        ${html}
        <script>${injectedJS}</script>
      </body>
    </html>
  `;
}
