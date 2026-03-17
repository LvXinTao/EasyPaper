'use client';

import { useState, useRef, useEffect } from 'react';
import type { ChatSessionMeta } from '@/types';

interface ChatSessionBarProps {
  sessions: ChatSessionMeta[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function ChatSessionBar({ sessions, activeSessionId, onSelectSession, onDeleteSession }: ChatSessionBarProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on click outside
  useEffect(() => {
    if (!confirmDeleteId) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setConfirmDeleteId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [confirmDeleteId]);

  if (sessions.length === 0) return null;

  return (
    <div
      className="flex gap-1 overflow-x-auto"
      style={{
        padding: '4px 8px',
        borderBottom: '1px solid var(--border)',
        scrollbarWidth: 'none',
      }}
    >
      {sessions.map((session) => (
        <div key={session.id} className="relative flex-shrink-0">
          <button
            onClick={() => onSelectSession(session.id)}
            className="flex items-center gap-1 rounded-md transition-colors"
            style={{
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: session.id === activeSessionId ? 500 : 400,
              background: session.id === activeSessionId
                ? 'var(--accent-subtle)'
                : 'var(--glass)',
              border: session.id === activeSessionId
                ? '1px solid var(--accent)'
                : '1px solid var(--glass-border)',
              color: session.id === activeSessionId
                ? 'var(--text-primary)'
                : 'var(--text-tertiary)',
              maxWidth: '160px',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {session.title}
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDeleteId(session.id);
              }}
              className="ml-1 rounded hover:bg-[rgba(255,255,255,0.1)] transition-colors"
              style={{
                fontSize: '10px',
                color: 'var(--text-tertiary)',
                padding: '0 2px',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ×
            </span>
          </button>

          {/* Delete confirmation popover */}
          {confirmDeleteId === session.id && (
            <div
              ref={popoverRef}
              className="absolute z-50 rounded-lg shadow-lg"
              style={{
                top: 'calc(100% + 4px)',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '10px 14px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                minWidth: '180px',
              }}
            >
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                删除此会话？此操作不可撤销
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-2.5 py-1 text-xs rounded-md transition-colors"
                  style={{
                    background: 'var(--glass)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    onDeleteSession(session.id);
                    setConfirmDeleteId(null);
                  }}
                  className="px-2.5 py-1 text-xs rounded-md transition-colors"
                  style={{
                    background: 'var(--rose-subtle)',
                    border: '1px solid var(--rose)',
                    color: 'var(--rose)',
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
