'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { ChatMessage } from '@/types';
import { ChatMessages } from '@/components/chat-messages';
import { ChatInput } from '@/components/chat-input';

type ResizeDirection = 'top' | 'left' | 'top-left' | 'top-right' | 'bottom-left';

interface ChatDialogProps {
  isOpen: boolean;
  onClose: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  messages: ChatMessage[];
  streamingContent: string;
  isStreaming: boolean;
  onSend: (message: string) => void;
  buttonPosition: { bottom: number; right: number };
}

export function ChatDialog({
  isOpen,
  onClose,
  buttonRef,
  messages,
  streamingContent,
  isStreaming,
  onSend,
  buttonPosition,
}: ChatDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [animate, setAnimate] = useState(false);
  const [size, setSize] = useState({ width: 380, height: 480 });

  const isResizing = useRef(false);
  const resizeDir = useRef<ResizeDirection>('top');
  const resizeStartMouse = useRef({ x: 0, y: 0 });
  const resizeStartSize = useRef({ width: 380, height: 480 });

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

  const handleResizeMouseDown = useCallback((direction: ResizeDirection) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    resizeDir.current = direction;
    resizeStartMouse.current = { x: e.clientX, y: e.clientY };
    resizeStartSize.current = { ...size };
    document.body.style.userSelect = 'none';
  }, [size]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;

      const dx = e.clientX - resizeStartMouse.current.x;
      const dy = e.clientY - resizeStartMouse.current.y;
      const dir = resizeDir.current;
      const maxWidth = Math.min(600, window.innerWidth - 40);
      const maxHeight = Math.min(700, window.innerHeight - 100);

      let newWidth = resizeStartSize.current.width;
      let newHeight = resizeStartSize.current.height;

      // Left edge or corners with left component: moving mouse left increases width
      if (dir === 'left' || dir === 'top-left' || dir === 'bottom-left') {
        newWidth = resizeStartSize.current.width - dx;
      }
      // Top edge or corners with top component: moving mouse up increases height
      if (dir === 'top' || dir === 'top-left' || dir === 'top-right') {
        newHeight = resizeStartSize.current.height - dy;
      }

      newWidth = Math.max(300, Math.min(newWidth, maxWidth));
      newHeight = Math.max(300, Math.min(newHeight, maxHeight));

      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      if (!isResizing.current) return;
      isResizing.current = false;
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      ref={dialogRef}
      style={{
        bottom: buttonPosition.bottom + 48,
        right: buttonPosition.right,
        width: size.width,
        height: size.height,
        position: 'fixed',
        opacity: animate ? 1 : 0,
        transform: animate ? 'translateY(0)' : 'translateY(12px)',
        transition: animate
          ? 'opacity 200ms ease-out, transform 200ms ease-out'
          : 'opacity 150ms ease-in, transform 150ms ease-in',
      }}
      className="z-50"
    >
      {/* Resize handles */}
      {/* Top edge */}
      <div
        className="absolute -top-0.5 left-2 right-2 h-1 cursor-ns-resize z-10"
        onMouseDown={handleResizeMouseDown('top')}
      />
      {/* Left edge */}
      <div
        className="absolute -left-0.5 top-2 bottom-2 w-1 cursor-ew-resize z-10"
        onMouseDown={handleResizeMouseDown('left')}
      />
      {/* Top-left corner */}
      <div
        className="absolute -top-0.5 -left-0.5 w-2 h-2 cursor-nwse-resize z-20"
        onMouseDown={handleResizeMouseDown('top-left')}
      />
      {/* Top-right corner */}
      <div
        className="absolute -top-0.5 -right-0.5 w-2 h-2 cursor-nesw-resize z-20"
        onMouseDown={handleResizeMouseDown('top-right')}
      />
      {/* Bottom-left corner */}
      <div
        className="absolute -bottom-0.5 -left-0.5 w-2 h-2 cursor-nesw-resize z-20"
        onMouseDown={handleResizeMouseDown('bottom-left')}
      />

      {/* Content container */}
      <div className="w-full h-full bg-white rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden">
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
    </div>
  );
}
