'use client';

import type { HighlightColor } from '@/types';
import { HIGHLIGHT_COLORS } from '@/lib/pdf-annotations';

interface HighlightToolbarProps {
  position: { top: number; left: number };
  onColorSelect: (color: HighlightColor) => void;
  onCommentClick: () => void;
  onClose: () => void;
}

const COLOR_ORDER: HighlightColor[] = ['yellow', 'green', 'blue', 'pink'];

export function HighlightToolbar({ position, onColorSelect, onCommentClick, onClose }: HighlightToolbarProps) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="absolute z-50 flex items-center gap-1 px-2 py-1.5 rounded-lg shadow-lg"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          backgroundColor: '#1e293b',
          transform: 'translateX(-50%)',
        }}
      >
        {COLOR_ORDER.map((color) => (
          <button
            key={color}
            onClick={() => onColorSelect(color)}
            className="w-5 h-5 rounded-full border-2 border-transparent hover:border-white/50 transition-colors"
            style={{ backgroundColor: HIGHLIGHT_COLORS[color].solid }}
            title={color}
          />
        ))}
        <div className="w-px h-4 bg-slate-600 mx-1" />
        <button
          onClick={onCommentClick}
          className="text-slate-300 hover:text-white px-1 text-sm transition-colors"
          title="Add comment"
        >
          💬
        </button>
      </div>
    </>
  );
}
