'use client';

import { useState } from 'react';
import type { Note, NoteTag } from '@/types';

const TAG_COLORS: Record<NoteTag, string> = {
  important: 'rgb(239, 68, 68)',
  question: 'rgb(245, 158, 11)',
  todo: 'rgb(59, 130, 246)',
  idea: 'rgb(16, 185, 129)',
  summary: 'rgb(139, 92, 246)',
};

const TAG_LABELS: Record<NoteTag, string> = {
  important: '重要',
  question: '疑问',
  todo: '待办',
  idea: '灵感',
  summary: '总结',
};

const DEFAULT_COLOR = 'rgb(156, 163, 175)';

interface NoteIndicatorProps {
  note: Note;
  position: { x: number; y: number };
  onClick: () => void;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .trim();
}

export function NoteIndicator({ note, position, onClick }: NoteIndicatorProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  const dotColor = note.tags.length > 0 ? TAG_COLORS[note.tags[0]] : DEFAULT_COLOR;
  const firstTag = note.tags[0];
  const tagLabel = firstTag ? TAG_LABELS[firstTag] : null;
  const tagColor = firstTag ? TAG_COLORS[firstTag] : null;

  const strippedContent = stripMarkdown(note.content);
  const displayContent = strippedContent.length > 80
    ? strippedContent.slice(0, 80) + '...'
    : strippedContent;

  // Tooltip placement: left by default, right if dot is near left edge
  const isNearLeftEdge = position.x < 200;

  return (
    <div
      className="fixed z-40 pointer-events-auto"
      style={{ left: position.x, top: position.y }}
    >
      <div
        className="relative"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <button
          onClick={onClick}
          className="rounded-full transition-transform duration-150"
          style={{
            width: '14px',
            height: '14px',
            background: dotColor,
            border: 'none',
            padding: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.2)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
          }}
          tabIndex={0}
          role="button"
          aria-label="Edit note"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick();
            }
          }}
        />

        {/* Tooltip */}
        {showTooltip && (
          <div
            className="absolute px-3 py-2 rounded-lg text-xs z-50 overflow-hidden"
            style={{
              background: 'rgba(26, 26, 26, 0.95)',
              color: 'white',
              top: '50%',
              transform: 'translateY(-50%)',
              left: isNearLeftEdge ? '16px' : 'auto',
              right: isNearLeftEdge ? 'auto' : 'calc(100% + 12px)',
              width: '200px',
              aspectRatio: '2.5 / 1',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            }}
          >
            {tagLabel && tagColor && (
              <span
                className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mb-1"
                style={{ background: `${tagColor}33`, color: tagColor }}
              >
                {tagLabel}
              </span>
            )}
            {displayContent && (
              <div className="opacity-80 line-clamp-2" style={{ color: 'rgba(255,255,255,0.8)' }}>
                {displayContent}
              </div>
            )}
            {/* Tooltip arrow */}
            <div
              className="absolute top-1/2 -translate-y-1/2"
              style={{
                width: 0,
                height: 0,
                borderTop: '5px solid transparent',
                borderBottom: '5px solid transparent',
                left: isNearLeftEdge ? '-5px' : 'auto',
                right: isNearLeftEdge ? 'auto' : '-5px',
                borderLeft: isNearLeftEdge ? '5px solid rgba(26, 26, 26, 0.95)' : 'none',
                borderRight: isNearLeftEdge ? 'none' : '5px solid rgba(26, 26, 26, 0.95)',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
