'use client';

import { useState, useCallback } from 'react';
import type { TextSelection } from '@/types';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  pendingQuote?: TextSelection | null;
  onClearQuote?: () => void;
}

export function ChatInput({ onSend, disabled, pendingQuote, onClearQuote }: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = useCallback(() => {
    if (!message.trim() || disabled) return;
    onSend(message.trim());
    setMessage('');
  }, [message, disabled, onSend]);

  return (
    <div style={{ borderTop: '1px solid var(--glass-border)' }}>
      {pendingQuote && (
        <div style={{ margin: '0 0 12px 0', padding: '12px', background: 'rgba(96, 165, 250, 0.08)', border: '1px dashed var(--accent)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <span style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500' }}>引用上下文</span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>第 {pendingQuote.page} 页</span>
            <button onClick={onClearQuote} style={{ marginLeft: 'auto', padding: '2px 6px', border: '1px solid var(--border)', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>清除</button>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0, fontStyle: 'italic', fontFamily: 'serif' }}>"{pendingQuote.text}"</p>
        </div>
      )}
      <div className="flex gap-2 pt-3">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
        placeholder={pendingQuote ? "针对这段引用，你想问什么？" : "Ask a question about this paper..."}
        disabled={disabled}
        className="flex-1 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 disabled:opacity-50"
        style={{
          background: 'var(--glass)',
          border: '1px solid var(--glass-border)',
          color: 'var(--text-primary)',
          '--placeholder-color': 'var(--text-tertiary)',
        } as React.CSSProperties}
      />
      <button
        onClick={handleSend}
        disabled={!message.trim() || disabled}
        className="px-5 py-2.5 text-sm font-medium rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        style={{
          background: 'var(--text-primary)',
          color: 'var(--bg)',
        }}
      >
        {disabled ? 'Sending...' : 'Send'}
      </button>
      </div>
    </div>
  );
}
