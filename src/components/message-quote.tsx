'use client';

import type { TextSelection } from '@/types';

interface MessageQuoteProps {
  quote: TextSelection;
  onJumpToQuote?: (quote: TextSelection) => void;
}

export function MessageQuote({ quote, onJumpToQuote }: MessageQuoteProps) {
  const handleClick = () => {
    if (onJumpToQuote) {
      onJumpToQuote(quote);
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        background: 'rgba(96, 165, 250, 0.1)',
        borderLeft: '3px solid var(--accent)',
        padding: '8px 12px',
        marginBottom: '8px',
        borderRadius: '0 6px 6px 0',
        cursor: onJumpToQuote ? 'pointer' : 'default',
      }}
      role={onJumpToQuote ? 'button' : undefined}
      aria-label={`Jump to quote on page ${quote.page}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
        <svg style={{ width: '10px', height: '10px', color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
        </svg>
        <span style={{ color: 'var(--accent)', fontSize: '10px' }}>P.{quote.page}</span>
      </div>
      <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', margin: 0, fontStyle: 'italic', fontFamily: 'serif' }}>
        "{quote.text}"
      </p>
    </div>
  );
}
