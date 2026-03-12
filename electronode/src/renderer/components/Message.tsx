/**
 * Message Component — Single chat message bubble
 * Assistant messages are rendered as markdown.
 */

import React, { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "../hooks/useWebSocket";

interface MessageProps {
  message: ChatMessage;
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M5 11H3.5A1.5 1.5 0 0 1 2 9.5v-7A1.5 1.5 0 0 1 3.5 1h7A1.5 1.5 0 0 1 12 2.5V5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5L6.5 12L13 4" />
    </svg>
  );
}

export default function Message({ message }: MessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [message.text]);

  const className = isUser ? "message-user" : isSystem ? "message-system" : "message-assistant";
  const avatarLabel = isUser ? "You" : isSystem ? "!" : "Me";
  const avatarClass = isUser ? "avatar-user" : isSystem ? "avatar-system" : "avatar-agent";

  return (
    <div className={`message ${className}`}>
      <div className={`message-avatar ${avatarClass}`}>{avatarLabel}</div>
      <div className="message-bubble">
        {message.attachments && message.attachments.length > 0 && (
          <div className="message-attachments">
            {message.attachments.map((att, i) =>
              att.type === "image" ? (
                <img
                  key={i}
                  src={`data:${att.mimeType};base64,${att.data}`}
                  alt={att.fileName}
                  className="message-media-img"
                />
              ) : (
                <div key={i} className="message-media-file">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5L9 1Z" />
                    <path d="M9 1v4h4" />
                  </svg>
                  <span>{att.fileName}</span>
                </div>
              )
            )}
          </div>
        )}
        {message.text && (
          <div className="message-text">
            {isUser ? message.text : <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>}

          </div>
        )}
        <div className="message-footer">
          <button className="copy-btn" onClick={handleCopy} title="Copy">
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
          <span className="message-time">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    </div>
  );
}
