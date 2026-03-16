'use client';

import type { Note, NoteTag } from '@/types';

const TAG_CONFIG: Record<NoteTag, { label: string; bg: string; text: string }> = {
  important: { label: '重要', bg: 'bg-red-500/20', text: 'text-red-400' },
  question: { label: '疑问', bg: 'bg-amber-500/20', text: 'text-amber-400' },
  todo: { label: '待办', bg: 'bg-blue-500/20', text: 'text-blue-400' },
  idea: { label: '灵感', bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  summary: { label: '总结', bg: 'bg-purple-500/20', text: 'text-purple-400' },
};

interface NotesListProps {
  notes: Note[];
  onSelect: (note: Note) => void;
  onNew: () => void;
  onPageClick: (page: number) => void;
}

function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/\n/g, ' ')
    .trim();
}

export function NotesList({ notes, onSelect, onNew, onPageClick }: NotesListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200">
        <span className="text-sm text-slate-400">{notes.length} notes</span>
        <button
          onClick={onNew}
          className="px-3 py-1.5 bg-indigo-500 text-white text-xs font-medium rounded-md hover:bg-indigo-600 transition-colors"
        >
          + New Note
        </button>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
            <svg className="w-10 h-10 mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <p className="text-sm">No notes yet</p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              onClick={() => onSelect(note)}
              className="bg-slate-50 border border-slate-200 rounded-lg p-3 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-800 truncate flex-1 mr-2">
                  {note.title || 'Untitled'}
                </h3>
                {note.page != null && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onPageClick(note.page!); }}
                    className="text-xs text-slate-400 hover:text-indigo-500 flex-shrink-0 transition-colors"
                  >
                    p.{note.page}
                  </button>
                )}
              </div>
              {note.content && (
                <p className="text-xs text-slate-500 line-clamp-2 mb-2 leading-relaxed">
                  {stripMarkdown(note.content)}
                </p>
              )}
              {note.tags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {note.tags.map((tag) => {
                    const config = TAG_CONFIG[tag];
                    return (
                      <span
                        key={tag}
                        className={`${config.bg} ${config.text} px-2 py-0.5 rounded-full text-[11px]`}
                      >
                        {config.label}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
