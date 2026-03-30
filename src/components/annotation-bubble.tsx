'use client';

import { useState } from 'react';
import type { Note, NoteTag } from '@/types';

const TAG_COLORS: Record<NoteTag, { bg: string; text: string }> = {
  important: { bg: 'rgba(239,68,68,0.2)', text: 'rgb(248,113,113)' },
  question: { bg: 'rgba(245,158,11,0.2)', text: 'rgb(251,191,36)' },
  todo: { bg: 'rgba(59,130,246,0.2)', text: 'rgb(96,165,250)' },
  idea: { bg: 'rgba(16,185,129,0.2)', text: 'rgb(52,211,153)' },
  summary: { bg: 'rgba(139,92,246,0.2)', text: 'rgb(167,139,250)' },
};

interface AnnotationBubbleProps {
  note: Note;
  position: { x: number; y: number };
  onClick: () => void;
}

export function AnnotationBubble({ note, position, onClick }: AnnotationBubbleProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const displayTitle = note.title.length > 25 ? note.title.slice(0, 25) + '...' : note.title;

  return (
    <div
      className="fixed z-40 pointer-events-auto"
      style={{
        left: position.x + 8,
        top: position.y,
        maxWidth: '180px',
      }}
    >
      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <button
          onClick={onClick}
          className="flex flex-col gap-1 px-3 py-2 rounded-lg shadow-md border transition-colors"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            minWidth: '44px',
            minHeight: '44px',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hover)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface)';
          }}
          aria-label={`Note: ${note.title}`}
        >
          <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {displayTitle}
          </span>
          {note.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {note.tags.slice(0, 2).map((tag) => {
                const colors = TAG_COLORS[tag];
                return (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 rounded-full text-[10px]"
                    style={{
                      background: colors.bg,
                      color: colors.text,
                    }}
                  >
                    {tag}
                  </span>
                );
              })}
              {note.tags.length > 2 && (
                <span
                  className="px-1.5 py-0.5 rounded-full text-[10px]"
                  style={{
                    background: 'var(--surface-hover)',
                    color: 'var(--text-tertiary)',
                  }}
                >
                  +{note.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </button>

        {/* Tooltip for full title */}
        {showTooltip && note.title.length > 25 && (
          <div
            className="absolute bottom-full left-0 mb-2 px-2 py-1 rounded shadow-lg text-xs max-w-[200px] break-words"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-primary)',
              zIndex: 50,
            }}
          >
            {note.title}
          </div>
        )}
      </div>
    </div>
  );
}