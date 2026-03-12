/**
 * ConnectionStatus — Shows WS connection state
 */

import React from "react";
import type { ConnectionState } from "../hooks/useWebSocket";

interface Props {
  state: ConnectionState;
  serverUrl: string;
}

const stateLabels: Record<ConnectionState, { text: string; color: string }> = {
  disconnected: { text: "Disconnected", color: "#ef4444" },
  connecting: { text: "Connecting...", color: "#f59e0b" },
  connected: { text: "Connected", color: "#3b82f6" },
  paired: { text: "Paired", color: "#22c55e" },
};

export default function ConnectionStatus({ state, serverUrl }: Props) {
  const { text, color } = stateLabels[state];
  return (
    <div className="connection-status">
      <span className="app-name">Hera ElectroNode</span>
      <span className="status-separator">—</span>
      <span className="status-dot" style={{ backgroundColor: color }} />
      <span className="status-text">{text}</span>
    </div>
  );
}
