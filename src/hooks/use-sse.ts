'use client';

import { useState, useCallback, useRef } from 'react';

interface UseSSEOptions {
  onMessage?: (data: Record<string, unknown>) => void;
  onError?: (error: Error) => void;
  onDone?: () => void;
}

export function useSSE(url: string, options: UseSSEOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const start = useCallback(
    async (body: Record<string, unknown>) => {
      setIsStreaming(true);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Request failed');
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.done) {
                optionsRef.current.onDone?.();
              } else if (data.error) {
                optionsRef.current.onError?.(new Error(data.error));
              } else {
                optionsRef.current.onMessage?.(data);
              }
            } catch {
              // Skip malformed lines
            }
          }
        }
      } catch (error) {
        optionsRef.current.onError?.(
          error instanceof Error ? error : new Error('Stream failed')
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [url]
  );

  return { isStreaming, start };
}
