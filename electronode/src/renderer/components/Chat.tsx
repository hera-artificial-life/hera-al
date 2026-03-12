/**
 * Chat Component — Message list + input field + drag-and-drop attachments
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage, ChatAttachment } from "../hooks/useWebSocket";
import Message from "./Message";

const MIME_MAP: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
  gif: "image/gif", webp: "image/webp", heic: "image/heic",
  svg: "image/svg+xml", bmp: "image/bmp", tiff: "image/tiff", tif: "image/tiff", ico: "image/x-icon",
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav",
  ogg: "audio/ogg", aac: "audio/aac", flac: "audio/flac",
  pdf: "application/pdf",
};

function classifyFile(fileName: string, fileMime: string): { type: string; mimeType: string } {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const mimeType = MIME_MAP[ext] || fileMime || "application/octet-stream";
  if (mimeType.startsWith("image/")) return { type: "image", mimeType };
  if (mimeType.startsWith("audio/")) return { type: "audio", mimeType };
  return { type: "document", mimeType };
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

interface ChatProps {
  messages: ChatMessage[];
  onSend: (text: string, attachments?: ChatAttachment[]) => void;
  isTyping: boolean;
  newestFirst: boolean;
  disabled: boolean;
  draft: string;
  onDraftChange: (draft: string) => void;
}

export default function Chat({ messages, onSend, isTyping, newestFirst, disabled, draft, onDraftChange }: ChatProps) {
  const input = draft;
  const [pendingAttachments, setPendingAttachments] = useState<ChatAttachment[]>([]);
  const [isDropTargeted, setIsDropTargeted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const prevCountRef = useRef(messages.length);
  const newestFirstRef = useRef(newestFirst);
  newestFirstRef.current = newestFirst;

  useEffect(() => {
    const added = messages.length > prevCountRef.current;
    const lastMsg = messages[messages.length - 1];
    prevCountRef.current = messages.length;
    if (!added) return;

    if (newestFirstRef.current) {
      if (lastMsg?.role === "user") {
        requestAnimationFrame(() => {
          const el = document.getElementById(`msg-${lastMsg.id}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!newestFirst && isTyping) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [isTyping, newestFirst]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [disabled]);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const newAttachments: ChatAttachment[] = [];
    for (const file of Array.from(files)) {
      const buffer = await file.arrayBuffer();
      const { type, mimeType } = classifyFile(file.name, file.type);
      newAttachments.push({
        type,
        mimeType,
        fileName: file.name,
        data: arrayBufferToBase64(buffer),
      });
    }
    setPendingAttachments(prev => [...prev, ...newAttachments]);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDropTargeted(false);
    if (e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDropTargeted(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDropTargeted(false);
  }, []);

  const removeAttachment = useCallback((index: number) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && pendingAttachments.length === 0) || disabled) return;
    onSend(trimmed, pendingAttachments.length > 0 ? pendingAttachments : undefined);
    onDraftChange("");
    setPendingAttachments([]);
    if (inputRef.current) inputRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className={`chat-container ${isDropTargeted ? "drop-active" : ""}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className={`messages-list ${newestFirst ? "newest-first" : ""}`}>
        {messages.length === 0 && (
          <div className="empty-state">
            <p>Connected to Hera. Start typing...</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} id={`msg-${msg.id}`}>
            <Message message={msg} />
          </div>
        ))}
        {isTyping && (
          <div className="typing-indicator">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        )}
        <div ref={messagesEndRef} id="messages-end" />
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        {pendingAttachments.length > 0 && (
          <div className="attachments-strip">
            {pendingAttachments.map((att, i) => (
              <div key={i} className="attachment-pill">
                {att.type === "image" ? (
                  <img
                    src={`data:${att.mimeType};base64,${att.data}`}
                    alt={att.fileName}
                    className="attachment-thumb"
                  />
                ) : (
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5L9 1Z" />
                    <path d="M9 1v4h4" />
                  </svg>
                )}
                <span className="attachment-name">{att.fileName}</span>
                <button type="button" className="attachment-remove" onClick={() => removeAttachment(i)}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 2L8 8M8 2L2 8" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="chat-input-row">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={e => {
              onDraftChange(e.target.value);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = Math.min(el.scrollHeight, 96) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "Connecting..." : "Type a message or drop files..."}
            disabled={disabled}
            rows={1}
          />
          <button
            type="submit"
            className="send-btn"
            disabled={disabled || (!input.trim() && pendingAttachments.length === 0)}
          >
            ↵
          </button>
        </div>
      </form>

      {isDropTargeted && (
        <div className="drop-overlay">
          <span>Drop files here</span>
        </div>
      )}
    </div>
  );
}
