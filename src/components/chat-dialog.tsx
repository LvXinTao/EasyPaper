'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@/types';
import { ChatMessages } from '@/components/chat-messages';
import { ChatInput } from '@/components/chat-input';

interface ChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  messages: ChatMessage[];
  streamingContent: string;
  isStreaming: boolean;
  onSend: (message: string) => void;
}

export function ChatDialog({
  isOpen,
  onClose,
  buttonRef,
  messages,
  streamingContent,
  isStreaming,
  onSend,
}: ChatDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimate(true);
        });
      });
    } else {
      setAnimate(false);
      const timer = setTimeout(() => {
        setVisible(false);
        buttonRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && animate) {
      const input = dialogRef.current?.querySelector('input');
      input?.focus();
    }
  }, [isOpen, animate]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!visible) return null;

  return (
    <div
      ref={dialogRef}
      style={{
        opacity: animate ? 1 : 0,
        transform: animate ? 'translateY(0)' : 'translateY(12px)',
        transition: animate
          ? 'opacity 200ms ease-out, transform 200ms ease-out'
          : 'opacity 150ms ease-in, transform 150ms ease-in',
      }}
      className="fixed bottom-16 right-5 z-50 w-[380px] h-[480px] max-h-[calc(100vh-100px)] max-w-[calc(100vw-40px)] bg-white rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden"
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-2 pb-1">
        <div className="w-9 h-1 bg-slate-300 rounded-full" />
      </div>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pb-3">
        <div className="w-7 h-7 bg-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-slate-800">Ask AI</div>
          <div className="text-[10px] text-slate-400">About this paper</div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close chat"
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto px-4">
        <ChatMessages
          messages={messages}
          streamingContent={streamingContent}
          isStreaming={isStreaming}
        />
      </div>

      {/* Input */}
      <div className="px-4 pb-3 pt-2">
        <ChatInput onSend={onSend} disabled={isStreaming} />
      </div>
    </div>
  );
}
