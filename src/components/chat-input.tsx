'use client';

import { useState, useCallback } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = useCallback(() => {
    if (!message.trim() || disabled) return;
    onSend(message.trim());
    setMessage('');
  }, [message, disabled, onSend]);

  return (
    <div className="flex gap-2 pt-3" style={{ borderTop: '1px solid var(--glass-border)' }}>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
        placeholder="Ask a question about this paper..."
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
  );
}
