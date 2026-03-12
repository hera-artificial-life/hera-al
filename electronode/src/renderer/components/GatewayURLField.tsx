/**
 * GatewayURLField — URL input with history dropdown.
 *
 * Manages a list of previously used gateway URLs in localStorage.
 * Inspired by OSXNode's gateway URL management.
 */

import React, { useState, useRef, useEffect, useCallback } from "react";

const STORAGE_KEY = "electronode_gateway_history";
const MAX_HISTORY = 20;

interface GatewayURLFieldProps {
  value: string;
  onChange: (url: string) => void;
}

function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(history: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

/** Add a URL to history (MRU order, deduped) */
export function addToHistory(url: string): void {
  if (!url.trim()) return;
  const history = loadHistory().filter(u => u !== url);
  history.unshift(url);
  saveHistory(history);
}

/** Get the last used URL, or null */
export function getLastUsedUrl(): string | null {
  const history = loadHistory();
  return history.length > 0 ? history[0] : null;
}

export default function GatewayURLField({ value, onChange }: GatewayURLFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<string[]>(loadHistory);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [isOpen]);

  const handleSelect = useCallback((url: string) => {
    onChange(url);
    setIsOpen(false);
  }, [onChange]);

  const handleRemove = useCallback((url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = history.filter(u => u !== url);
    setHistory(updated);
    saveHistory(updated);
  }, [history]);

  const toggleDropdown = useCallback(() => {
    setHistory(loadHistory()); // Refresh
    setIsOpen(prev => !prev);
  }, []);

  return (
    <div className="gateway-url-field" ref={containerRef}>
      <div className="gateway-url-input-row">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="ws://hostname:3112/ws/nodes"
        />
        {history.length > 0 && (
          <button
            className="gateway-history-btn"
            onClick={toggleDropdown}
            title="Recent gateways"
            type="button"
          >
            ⏱
          </button>
        )}
      </div>
      {isOpen && history.length > 0 && (
        <div className="gateway-history-dropdown">
          {history.map(url => (
            <div
              key={url}
              className={`gateway-history-item ${url === value ? "active" : ""}`}
              onClick={() => handleSelect(url)}
            >
              <span className="gateway-history-url">
                {url === value && <span className="gateway-check">✓ </span>}
                {url}
              </span>
              <button
                className="gateway-history-remove"
                onClick={(e) => handleRemove(url, e)}
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
