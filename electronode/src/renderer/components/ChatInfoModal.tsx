/**
 * ChatInfoModal — Shows full chatId with copy-to-clipboard
 */

import React, { useState, useCallback, useEffect } from "react";

interface Props {
  chatId: string;
  onClose: () => void;
}

function ClipboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M2 10V2.5A.5.5 0 0 1 2.5 2H10" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5L6.5 12L13 4" />
    </svg>
  );
}

export default function ChatInfoModal({ chatId, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(chatId).then(() => {
      setCopied(true);
    });
  }, [chatId]);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>Chat Info</span>
          <button className="modal-close-btn" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M2 2L12 12M12 2L2 12" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <label className="modal-label">Chat ID</label>
          <div className="chat-id-field">
            <code className="chat-id-value">{chatId}</code>
            <button
              className={`chat-id-copy ${copied ? "copied" : ""}`}
              onClick={handleCopy}
              title="Copy to clipboard"
            >
              {copied ? <CheckIcon /> : <ClipboardIcon />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
