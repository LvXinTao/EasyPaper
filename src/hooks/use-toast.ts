'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ToastMessage } from '@/types';

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Cleanup timeouts on unmount
  useEffect(() => {
    const refs = timeoutRefs.current;
    return () => {
      refs.forEach((timeout) => clearTimeout(timeout));
      refs.clear();
    };
  }, []);

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = `toast-${++toastId}`;
    const newToast: ToastMessage = { id, message, type };
    setToasts((prev) => [...prev, newToast]);

    const timeout = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timeoutRefs.current.delete(id);
    }, 3000);
    timeoutRefs.current.set(id, timeout);
  }, []);

  const dismissToast = useCallback((id: string) => {
    // Clear the timeout if toast is dismissed manually
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, dismissToast };
}