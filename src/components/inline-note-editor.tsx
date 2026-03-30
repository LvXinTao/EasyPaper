'use client';

import { useState, useEffect, useRef } from 'react';
import type { Note, NoteTag, TextSelection } from '@/types';

const TAG_OPTIONS: { key: NoteTag; label: string; activeBg: string; activeText: string }[] = [
  { key: 'important', label: '重要', activeBg: 'rgba(239,68,68,0.2)', activeText: 'rgb(248,113,113)' },
  { key: 'question', label: '疑问', activeBg: 'rgba(245,158,11,0.2)', activeText: 'rgb(251,191,36)' },
  { key: 'todo', label: '待办', activeBg: 'rgba(59,130,246,0.2)', activeText: 'rgb(96,165,250)' },
  { key: 'idea', label: '灵感', activeBg: 'rgba(16,185,129,0.2)', activeText: 'rgb(52,211,153)' },
  { key: 'summary', label: '总结', activeBg: 'rgba(139,92,246,0.2)', activeText: 'rgb(167,139,250)' },
];

const EDITOR_WIDTH = 320;
const EDITOR_HEIGHT = 280;

function calculateEditorPosition(triggerX: number, triggerY: number): { x: number; y: number } {
  const viewport = { width: window.innerWidth, height: window.innerHeight };

  let x = triggerX - EDITOR_WIDTH / 2;
  let y = triggerY + 8;

  if (x + EDITOR_WIDTH > viewport.width - 16) {
    x = viewport.width - EDITOR_WIDTH - 16;
  }
  if (x < 16) {
    x = 16;
  }
  if (y + EDITOR_HEIGHT > viewport.height - 16) {
    y = triggerY - EDITOR_HEIGHT - 8;
  }

  return { x, y };
}

interface InlineNoteEditorProps {
  mode: 'create' | 'edit';
  note?: Note;
  selection?: TextSelection;
  triggerPosition: { x: number; y: number };
  onSave: (data: { title: string; content: string; tags: NoteTag[]; selection?: TextSelection }) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

export function InlineNoteEditor({
  mode,
  note,
  selection,
  triggerPosition,
  onSave,
  onDelete,
  onClose,
}: InlineNoteEditorProps) {
  const [title, setTitle] = useState(note?.title || selection?.text?.slice(0, 50) || '');
  const [content, setContent] = useState(note?.content || '');
  const [tags, setTags] = useState<NoteTag[]>(note?.tags || []);
  const [pageStr, setPageStr] = useState(String(note?.selection?.page ?? note?.page ?? selection?.page ?? 1));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const position = calculateEditorPosition(triggerPosition.x, triggerPosition.y);

  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  const toggleTag = (tag: NoteTag) => {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const page = parseInt(pageStr, 10);
      const noteSelection = selection ? { ...selection, page: page && !isNaN(page) ? page : selection.page } : note?.selection;
      await onSave({ title, content, tags, selection: noteSelection });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setLoading(true);
    setError(null);
    try {
      await onDelete();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed z-50 rounded-lg shadow-xl border overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        width: EDITOR_WIDTH,
        background: 'var(--bg)',
        borderColor: 'var(--border-strong)',
      }}
      role="dialog"
      aria-label="Edit note"
    >
      {/* Error banner */}
      {error && (
        <div
          className="px-3 py-2 text-xs"
          style={{
            background: 'var(--rose-subtle)',
            color: 'var(--rose)',
            borderBottom: '1px solid var(--rose)',
          }}
        >
          {error}
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div
          className="px-3 py-2 flex items-center justify-between"
          style={{
            background: 'var(--rose-subtle)',
            borderBottom: '1px solid var(--rose)',
          }}
        >
          <span className="text-xs" style={{ color: 'var(--rose)' }}>Delete this note?</span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-2 py-0.5 text-xs rounded transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-2 py-0.5 text-xs text-white rounded transition-colors disabled:opacity-50"
              style={{ background: 'var(--rose)' }}
            >
              {loading ? 'Deleting...' : 'Confirm'}
            </button>
          </div>
        </div>
      )}

      {/* Form content */}
      <div className="p-3 flex flex-col gap-2">
        {/* Title */}
        <input
          ref={titleInputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          className="w-full px-2 py-1.5 rounded text-sm font-medium focus:outline-none"
          style={{
            background: 'var(--surface-hover)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
          onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--accent)'; }}
          onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border)'; }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && !e.shiftKey) handleSave();
          }}
        />

        {/* Page + Tags row */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Page:</span>
            <input
              type="number"
              value={pageStr}
              onChange={(e) => setPageStr(e.target.value)}
              min={1}
              className="w-12 px-1.5 py-1 rounded text-xs text-center focus:outline-none"
              style={{
                background: 'var(--surface-hover)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
              onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--accent)'; }}
              onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--border)'; }}
            />
          </div>
          <div className="flex gap-1 flex-wrap flex-1">
            {TAG_OPTIONS.map((opt) => {
              const active = tags.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  onClick={() => toggleTag(opt.key)}
                  className="px-1.5 py-0.5 rounded-full text-[10px] border transition-colors"
                  style={{
                    background: active ? opt.activeBg : 'transparent',
                    borderColor: active ? opt.activeText : 'var(--border)',
                    color: active ? opt.activeText : 'var(--text-tertiary)',
                  }}
                >
                  {active ? '✓' : ''}{opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content textarea */}
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write notes..."
          className="w-full px-2 py-1.5 rounded text-xs font-mono resize-none focus:outline-none"
          style={{
            background: 'var(--surface-hover)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            minHeight: '80px',
          }}
          onFocus={(e) => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--accent)'; }}
          onBlur={(e) => { (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--border)'; }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
          }}
        />

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          {mode === 'edit' && onDelete && !showDeleteConfirm && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-2 py-1 text-xs rounded transition-colors"
              style={{ color: 'var(--rose)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--rose-subtle)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              Delete
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-2 py-1 text-xs rounded transition-colors"
              style={{
                color: 'var(--text-tertiary)',
                background: 'var(--surface-hover)',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !title.trim()}
              className="px-3 py-1 text-xs rounded transition-colors disabled:opacity-50"
              style={{
                background: 'var(--accent)',
                color: 'var(--bg)',
              }}
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}