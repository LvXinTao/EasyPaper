'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Note, NoteTag } from '@/types';

const TAG_OPTIONS: { key: NoteTag; label: string; activeBg: string; activeText: string }[] = [
  { key: 'important', label: '重要', activeBg: 'rgba(239,68,68,0.2)', activeText: 'rgb(248,113,113)' },
  { key: 'question', label: '疑问', activeBg: 'rgba(245,158,11,0.2)', activeText: 'rgb(251,191,36)' },
  { key: 'todo', label: '待办', activeBg: 'rgba(59,130,246,0.2)', activeText: 'rgb(96,165,250)' },
  { key: 'idea', label: '灵感', activeBg: 'rgba(16,185,129,0.2)', activeText: 'rgb(52,211,153)' },
  { key: 'summary', label: '总结', activeBg: 'rgba(139,92,246,0.2)', activeText: 'rgb(167,139,250)' },
];

interface NoteEditorProps {
  note?: Note;
  defaultPage: number;
  onSave: (data: { title: string; content: string; tags: NoteTag[]; page?: number }) => void;
  onDelete?: () => void;
  onBack: () => void;
}

export function NoteEditor({ note, defaultPage, onSave, onDelete, onBack }: NoteEditorProps) {
  const [title, setTitle] = useState(note?.title || '');
  const [content, setContent] = useState(note?.content || '');
  const [tags, setTags] = useState<NoteTag[]>(note?.tags || []);
  const [pageStr, setPageStr] = useState(String(note?.page ?? defaultPage));
  const [previewMode, setPreviewMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const toggleTag = (tag: NoteTag) => {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const handleSave = () => {
    const page = pageStr ? parseInt(pageStr, 10) : undefined;
    onSave({ title, content, tags, page: page && !isNaN(page) ? page : undefined });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <button
          onClick={onBack}
          className="text-xs transition-colors"
          style={{ color: 'var(--accent)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.7'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
        >
          ← Back to list
        </button>
        <div className="flex gap-2">
          {note && onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-2.5 py-1 text-xs rounded-md border transition-colors"
              style={{
                color: 'var(--rose)',
                borderColor: 'var(--rose)',
                background: 'transparent',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--rose-subtle)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }}
            >
              Delete
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-3 py-1 text-xs rounded-md transition-colors"
            style={{
              background: 'var(--text-primary)',
              color: 'var(--bg)',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
          >
            Save
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div
          className="px-4 py-2.5 border-b flex items-center justify-between"
          style={{ background: 'var(--rose-subtle)', borderColor: 'var(--rose)' }}
        >
          <span className="text-xs" style={{ color: 'var(--rose)' }}>Delete this note?</span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-2 py-0.5 text-xs transition-colors"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)'; }}
            >
              Cancel
            </button>
            <button
              onClick={() => { setShowDeleteConfirm(false); onDelete?.(); }}
              className="px-2 py-0.5 text-xs text-white rounded transition-colors"
              style={{ background: 'var(--rose)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {/* Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title..."
          className="w-full px-3 py-2 rounded-md text-sm font-semibold focus:outline-none"
          style={{
            background: 'var(--glass)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-primary)',
          }}
          onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--accent)'; }}
          onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--glass-border)'; }}
        />

        {/* Page + Tags row */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Page:</span>
            <input
              type="number"
              value={pageStr}
              onChange={(e) => setPageStr(e.target.value)}
              min={1}
              className="w-14 px-2 py-1 rounded text-xs text-center focus:outline-none"
              style={{
                background: 'var(--glass)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-primary)',
              }}
              onFocus={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--accent)'; }}
              onBlur={(e) => { (e.currentTarget as HTMLInputElement).style.borderColor = 'var(--glass-border)'; }}
            />
          </div>
          <div className="flex gap-1 flex-wrap flex-1">
            {TAG_OPTIONS.map((opt) => {
              const active = tags.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  onClick={() => toggleTag(opt.key)}
                  className="px-2 py-0.5 rounded-full text-[11px] border transition-colors"
                  style={{
                    background: active ? opt.activeBg : 'transparent',
                    borderColor: active ? opt.activeText : 'var(--border)',
                    color: active ? opt.activeText : 'var(--text-tertiary)',
                  }}
                >
                  {active ? '✓ ' : ''}{opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content editor with Edit/Preview toggle */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex" style={{ borderBottom: '1px solid var(--border)' }}>
            <button
              onClick={() => setPreviewMode(false)}
              className="px-3 py-1.5 text-xs font-medium transition-colors relative"
              style={{ color: !previewMode ? 'var(--accent)' : 'var(--text-tertiary)' }}
            >
              Edit
              {!previewMode && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: 'var(--accent)' }}
                />
              )}
            </button>
            <button
              onClick={() => setPreviewMode(true)}
              className="px-3 py-1.5 text-xs font-medium transition-colors relative"
              style={{ color: previewMode ? 'var(--accent)' : 'var(--text-tertiary)' }}
            >
              Preview
              {previewMode && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: 'var(--accent)' }}
                />
              )}
            </button>
          </div>

          {previewMode ? (
            <div
              className="flex-1 overflow-y-auto p-3 prose prose-sm max-w-none"
              style={{ color: 'var(--text-secondary)' }}
            >
              {content ? (
                <ReactMarkdown>{content}</ReactMarkdown>
              ) : (
                <p className="italic" style={{ color: 'var(--text-tertiary)' }}>Nothing to preview</p>
              )}
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your notes in Markdown..."
              className="flex-1 min-h-[200px] p-3 text-sm font-mono leading-relaxed resize-none border-0 focus:outline-none"
              style={{
                background: 'transparent',
                color: 'var(--text-primary)',
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
