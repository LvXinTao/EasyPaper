'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { Note, NoteTag } from '@/types';

const TAG_OPTIONS: { key: NoteTag; label: string; bg: string; activeBg: string; text: string }[] = [
  { key: 'important', label: '重要', bg: 'border-slate-300', activeBg: 'bg-red-500/20 border-red-500/40', text: 'text-red-400' },
  { key: 'question', label: '疑问', bg: 'border-slate-300', activeBg: 'bg-amber-500/20 border-amber-500/40', text: 'text-amber-400' },
  { key: 'todo', label: '待办', bg: 'border-slate-300', activeBg: 'bg-blue-500/20 border-blue-500/40', text: 'text-blue-400' },
  { key: 'idea', label: '灵感', bg: 'border-slate-300', activeBg: 'bg-emerald-500/20 border-emerald-500/40', text: 'text-emerald-400' },
  { key: 'summary', label: '总结', bg: 'border-slate-300', activeBg: 'bg-purple-500/20 border-purple-500/40', text: 'text-purple-400' },
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
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200">
        <button onClick={onBack} className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
          ← Back to list
        </button>
        <div className="flex gap-2">
          {note && onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-2.5 py-1 text-xs text-rose-500 border border-rose-300 rounded-md hover:bg-rose-50 transition-colors"
            >
              Delete
            </button>
          )}
          <button
            onClick={handleSave}
            className="px-3 py-1 text-xs bg-indigo-500 text-white rounded-md hover:bg-indigo-600 transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="px-4 py-2.5 bg-rose-50 border-b border-rose-200 flex items-center justify-between">
          <span className="text-xs text-rose-700">Delete this note?</span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-2 py-0.5 text-xs text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={() => { setShowDeleteConfirm(false); onDelete?.(); }}
              className="px-2 py-0.5 text-xs text-white bg-rose-500 rounded hover:bg-rose-600"
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
          className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
        />

        {/* Page + Tags row */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400">Page:</span>
            <input
              type="number"
              value={pageStr}
              onChange={(e) => setPageStr(e.target.value)}
              min={1}
              className="w-14 px-2 py-1 border border-slate-300 rounded text-xs text-center text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
          <div className="flex gap-1 flex-wrap flex-1">
            {TAG_OPTIONS.map((opt) => {
              const active = tags.includes(opt.key);
              return (
                <button
                  key={opt.key}
                  onClick={() => toggleTag(opt.key)}
                  className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                    active ? `${opt.activeBg} ${opt.text}` : `${opt.bg} text-slate-400`
                  }`}
                >
                  {active ? '✓ ' : ''}{opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content editor with Edit/Preview toggle */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setPreviewMode(false)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative ${
                !previewMode ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Edit
              {!previewMode && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
            </button>
            <button
              onClick={() => setPreviewMode(true)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors relative ${
                previewMode ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Preview
              {previewMode && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
            </button>
          </div>

          {previewMode ? (
            <div className="flex-1 overflow-y-auto p-3 prose prose-sm max-w-none text-slate-700">
              {content ? (
                <ReactMarkdown>{content}</ReactMarkdown>
              ) : (
                <p className="text-slate-400 italic">Nothing to preview</p>
              )}
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your notes in Markdown..."
              className="flex-1 min-h-[200px] p-3 text-sm text-slate-700 font-mono leading-relaxed resize-none border-0 focus:outline-none"
            />
          )}
        </div>
      </div>
    </div>
  );
}
