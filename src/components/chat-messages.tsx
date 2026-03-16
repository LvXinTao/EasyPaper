'use client';

import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@/types';
import { useTypewriter } from '@/hooks/use-typewriter';
import { MarkdownContent } from './markdown-content';

interface ChatMessagesProps {
  messages: ChatMessage[];
  streamingContent?: string;
  isStreaming?: boolean;
}

export function ChatMessages({ messages, streamingContent, isStreaming }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { displayedText, isTyping } = useTypewriter(streamingContent || '', {
    isStreaming,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, displayedText]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12" style={{ color: 'var(--text-tertiary)' }}>
        <svg className="w-10 h-10 mb-3" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p className="text-sm">Ask a question about this paper</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'rounded-br-md'
                : 'rounded-bl-md'
            }`}
            style={
              msg.role === 'user'
                ? { background: 'var(--accent-subtle)', color: 'var(--text-primary)' }
                : { background: 'var(--glass)', color: 'var(--text-secondary)' }
            }
          >
            {msg.role === 'assistant' ? (
              <MarkdownContent content={msg.content} />
            ) : (
              <div className="whitespace-pre-wrap">{msg.content}</div>
            )}
          </div>
        </div>
      ))}
      {isStreaming && !displayedText && (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed" style={{ background: 'var(--glass)', color: 'var(--text-secondary)' }}>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
      {(isTyping || isStreaming) && displayedText && (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed" style={{ background: 'var(--glass)', color: 'var(--text-secondary)' }}>
            <MarkdownContent content={displayedText} />
            <span className="inline-block w-1.5 h-4 animate-pulse ml-0.5 rounded-sm" style={{ background: 'var(--accent)' }} />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
