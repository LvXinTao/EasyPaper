'use client';

import type { ToastMessage } from '@/types';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const typeStyles: Record<ToastMessage['type'], { bg: string; color: string }> = {
  success: { bg: 'rgba(34, 197, 94, 0.15)', color: 'var(--green)' },
  warning: { bg: 'rgba(251, 191, 36, 0.15)', color: 'var(--amber)' },
  error: { bg: 'rgba(239, 68, 68, 0.15)', color: 'var(--rose)' },
  info: { bg: 'var(--glass)', color: 'var(--text-secondary)' },
};

export function Toast({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 200,
      }}
    >
      {toasts.map((toast) => {
        const styles = typeStyles[toast.type];
        return (
          <div
            key={toast.id}
            onClick={() => onDismiss(toast.id)}
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: styles.bg,
              color: styles.color,
              fontSize: '13px',
              cursor: 'pointer',
              border: `1px solid ${styles.color}`,
              maxWidth: '300px',
            }}
          >
            {toast.message}
          </div>
        );
      })}
    </div>
  );
}
