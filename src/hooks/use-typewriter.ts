'use client';

import { useState, useEffect, useRef } from 'react';

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
  const [isTyping, setIsTyping] = useState(false);
  const bufferRef = useRef('');
  const displayedLenRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const prevTextRef = useRef('');

  // When text grows, add new characters to buffer
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (text.length > prevTextRef.current.length) {
      bufferRef.current += text.slice(prevTextRef.current.length);
      setIsTyping(true);
    }
    prevTextRef.current = text;
  }, [text]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // When streaming stops, flush remaining buffer immediately
  useEffect(() => {
    if (!isStreaming && bufferRef.current.length > 0) {
      const flushed = text.slice(0, displayedLenRef.current) + bufferRef.current;
      bufferRef.current = '';
      displayedLenRef.current = flushed.length;
      setDisplayedText(flushed);
      setIsTyping(false);
    }
  }, [isStreaming, text]);

  // RAF loop to consume buffer character by character
  useEffect(() => {
    function tick() {
      if (bufferRef.current.length > 0) {
        const backlog = bufferRef.current.length;
        const charsToTake = backlog > 20
          ? Math.min(Math.ceil(backlog / 10), 8)
          : speed;

        const chunk = bufferRef.current.slice(0, charsToTake);
        bufferRef.current = bufferRef.current.slice(charsToTake);
        displayedLenRef.current += chunk.length;

        setDisplayedText((prev) => prev + chunk);
      } else if (!isStreaming) {
        setIsTyping(false);
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [speed, isStreaming]);

  // Reset when text is cleared (new conversation turn)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (text === '') {
      bufferRef.current = '';
      displayedLenRef.current = 0;
      prevTextRef.current = '';
      setDisplayedText('');
      setIsTyping(false);
    }
  }, [text]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { displayedText, isTyping };
}