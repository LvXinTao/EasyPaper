'use client';

import { useState } from 'react';

interface CommentPopoverProps {
  position: { top: number; left: number };
  selectedText: string;
  initialComment?: string;
  onSave: (comment: string) => void;
  onCancel: () => void;
}

const MAX_COMMENT_LENGTH = 2000;

export function CommentPopover({ position, selectedText, initialComment = '', onSave, onCancel }: CommentPopoverProps) {
  const [comment, setComment] = useState(initialComment);

  const truncatedText = selectedText.length > 60 ? selectedText.slice(0, 60) + '...' : selectedText;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onCancel} />
      <div
        className="absolute z-50 w-64 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          transform: 'translateX(-50%)',
        }}
      >
        <div className="flex items-center justify-between px-3 py-2 bg-amber-50 border-b border-amber-200">
          <span className="text-xs font-semibold text-amber-800">Add Comment</span>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
        </div>
        <div className="p-3">
          <div className="text-xs text-slate-500 italic mb-2 truncate">&ldquo;{truncatedText}&rdquo;</div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
            className="w-full h-16 text-xs border border-slate-200 rounded-md p-2 resize-none outline-none focus:border-blue-400 transition-colors"
            placeholder="Your comment..."
            autoFocus
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px] text-slate-400">{comment.length}/{MAX_COMMENT_LENGTH}</span>
            <div className="flex gap-1.5">
              <button
                onClick={onCancel}
                className="text-xs px-3 py-1 rounded border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => onSave(comment)}
                className="text-xs px-3 py-1 rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
