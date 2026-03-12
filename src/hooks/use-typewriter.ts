'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseTypewriterOptions {
  speed?: number;
  isStreaming?: boolean;
}

export function useTypewriter(
  text: string,
  options: UseTypewriterOptions = {}
): { displayedText: string; isTyping: boolean } {
  const { speed = 1, isStreaming = true } = options;
  const [displayedText, setDisplayedText] = useState('');
  const bufferRef = useRef('');
  const displayedLenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const prevTextRef = useRef('');

  // When text grows, add new characters to buffer
  useEffect(() => {
    if (text.length > prevTextRef.current.length) {
      bufferRef.current += text.slice(prevTextRef.current.length);
    }
    prevTextRef.current = text;
  }, [text]);

  // When streaming stops, flush remaining buffer immediately
  useEffect(() => {
    if (!isStreaming && bufferRef.current.length > 0) {
      const flushed = text.slice(0, displayedLenRef.current) + bufferRef.current;
      bufferRef.current = '';
      displayedLenRef.current = flushed.length;
      setDisplayedText(flushed);
    }
  }, [isStreaming, text]);

  // RAF loop to consume buffer character by character
  const tick = useCallback(() => {
    if (bufferRef.current.length > 0) {
      const backlog = bufferRef.current.length;
      const charsToTake = backlog > 20
        ? Math.min(Math.ceil(backlog / 10), 8)
        : speed;

      const chunk = bufferRef.current.slice(0, charsToTake);
      bufferRef.current = bufferRef.current.slice(charsToTake);
      displayedLenRef.current += chunk.length;

      setDisplayedText((prev) => prev + chunk);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [speed]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [tick]);

  // Reset when text is cleared (new conversation turn)
  useEffect(() => {
    if (text === '') {
      bufferRef.current = '';
      displayedLenRef.current = 0;
      prevTextRef.current = '';
      setDisplayedText('');
    }
  }, [text]);

  const isTyping = bufferRef.current.length > 0 || (isStreaming && text.length > 0);

  return { displayedText, isTyping };
}
