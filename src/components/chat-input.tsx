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
    <div className="flex gap-2 border-t pt-3">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
        placeholder="Ask a question about this paper..."
        disabled={disabled}
        className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={!message.trim() || disabled}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
      >
        {disabled ? 'Sending...' : 'Send'}
      </button>
    </div>
  );
}
