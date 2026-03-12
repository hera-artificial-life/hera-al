/**
 * TabBar — Multi-tab chat navigation with tag editing
 */

import React, { useState, useRef, useCallback, useEffect } from "react";

export interface TabInfo {
  id: string;
  index: number;
  tag: string | null;
}

interface Props {
  tabs: TabInfo[];
  activeTabId: string;
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onCreate: () => void;
  onClear: () => void;
  onTagChange: (tabId: string, tag: string | null) => void;
  onInfo: (tabId: string) => void;
  onScrollToBottom: () => void;
  newestFirst: boolean;
  onToggleNewestFirst: () => void;
  maxTabs: number;
}

function InfoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="7" />
      <path d="M8 7v4M8 5.5V5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 2L8 8M8 2L2 8" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M7 2v10M2 7h10" />
    </svg>
  );
}

function TagRemoveIcon() {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M1.5 1.5L6.5 6.5M6.5 1.5L1.5 6.5" />
    </svg>
  );
}

export default function TabBar({ tabs, activeTabId, onSelect, onClose, onCreate, onClear, onTagChange, onInfo, onScrollToBottom, newestFirst, onToggleNewestFirst, maxTabs }: Props) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  const startEdit = useCallback((tabId: string, currentTag: string | null) => {
    setEditingTabId(tabId);
    setEditValue(currentTag || "");
  }, []);

  const commitEdit = useCallback(() => {
    if (editingTabId) {
      const trimmed = editValue.trim();
      onTagChange(editingTabId, trimmed || null);
      setEditingTabId(null);
    }
  }, [editingTabId, editValue, onTagChange]);

  const cancelEdit = useCallback(() => {
    setEditingTabId(null);
  }, []);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    }
  }, [commitEdit, cancelEdit]);

  return (
    <div className="tab-bar">
      <div className="tab-bar-scroll">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isEditing = tab.id === editingTabId;
          const label = `Chat ${tab.index}`;

          return (
            <div
              key={tab.id}
              className={`tab ${isActive ? "active" : ""}`}
              onClick={() => onSelect(tab.id)}
            >
              {isEditing ? (
                <input
                  ref={inputRef}
                  className="tab-name-input"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={handleEditKeyDown}
                  onBlur={commitEdit}
                  onClick={(e) => e.stopPropagation()}
                  maxLength={20}
                  placeholder="tag name"
                />
              ) : (
                <span
                  className="tab-label"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    startEdit(tab.id, tab.tag);
                  }}
                  title="Double-click to set tag"
                >
                  {label}
                </span>
              )}

              {tab.tag && !isEditing && (
                <span className="tab-tag">
                  {tab.tag}
                  <button
                    className="tab-tag-remove"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTagChange(tab.id, null);
                    }}
                    title="Remove tag"
                  >
                    <TagRemoveIcon />
                  </button>
                </span>
              )}

              <button
                className="tab-info-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onInfo(tab.id);
                }}
                title="Chat info"
              >
                <InfoIcon />
              </button>

              {tabs.length > 1 && (
                <button
                  className="tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(tab.id);
                  }}
                  title="Close tab"
                >
                  <CloseIcon />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button
        className={`tab-add-btn ${newestFirst ? "tab-pin-active" : ""}`}
        onClick={onToggleNewestFirst}
        title={newestFirst ? "Newest first (on)" : "Newest first (off)"}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill={newestFirst ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5.5 2.5L10.5 2.5L11 6L9.5 7.5L8 7.5L8 13L8 13L8 7.5L6.5 7.5L5 6Z" />
          <path d="M5 7.5L11 7.5" />
        </svg>
      </button>
      <button
        className="tab-add-btn"
        onClick={onScrollToBottom}
        title="Scroll to bottom"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 1.5v8" />
          <path d="M3.5 6.5L7 10l3.5-3.5" />
          <path d="M3 12.5h8" />
        </svg>
      </button>
      <button
        className="tab-add-btn"
        onClick={onCreate}
        disabled={tabs.length >= maxTabs}
        title={tabs.length >= maxTabs ? `Maximum ${maxTabs} tabs` : "New tab"}
      >
        <PlusIcon />
      </button>
      <button
        className="tab-add-btn"
        onClick={onClear}
        title="Clear messages"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 4h10M5 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1M3 4l.7 8a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L11 4" />
        </svg>
      </button>
    </div>
  );
}
