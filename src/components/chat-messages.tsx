'use client';

import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@/types';

interface ChatMessagesProps {
  messages: ChatMessage[];
  streamingContent?: string;
  isStreaming?: boolean;
}

export function ChatMessages({ messages, streamingContent, isStreaming }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  return (
    <div className="space-y-4 pb-4">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-lg px-4 py-2 ${
              msg.role === 'user'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            <div className="whitespace-pre-wrap">{msg.content}</div>
          </div>
        </div>
      ))}
      {isStreaming && streamingContent && (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-100 text-gray-700">
            <div className="whitespace-pre-wrap">{streamingContent}</div>
            <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
