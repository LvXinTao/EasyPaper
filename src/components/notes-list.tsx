'use client';

import type { Note, NoteTag } from '@/types';

const TAG_CONFIG: Record<NoteTag, { label: string; bg: string; text: string }> = {
  important: { label: '重要', bg: 'rgba(239,68,68,0.15)', text: 'rgb(248,113,113)' },
  question: { label: '疑问', bg: 'rgba(245,158,11,0.15)', text: 'rgb(251,191,36)' },
  todo: { label: '待办', bg: 'rgba(59,130,246,0.15)', text: 'rgb(96,165,250)' },
  idea: { label: '灵感', bg: 'rgba(16,185,129,0.15)', text: 'rgb(52,211,153)' },
  summary: { label: '总结', bg: 'rgba(139,92,246,0.15)', text: 'rgb(167,139,250)' },
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
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          {notes.length} notes
        </span>
        <button
          onClick={onNew}
          className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
          style={{
            background: 'var(--accent)',
            color: 'var(--bg)',
          }}
        >
          + New Note
        </button>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {notes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12" style={{ color: 'var(--text-tertiary)' }}>
            <svg className="w-10 h-10 mb-3" style={{ color: 'var(--text-tertiary)', opacity: 0.5 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <p className="text-sm">No notes yet</p>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              onClick={() => onSelect(note)}
              className="rounded-lg p-3 cursor-pointer transition-colors"
              style={{
                background: 'var(--glass)',
                border: '1px solid var(--glass-border)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--glass-border)';
              }}
            >
              <div className="flex items-start justify-between mb-1">
                <h3
                  className="text-sm font-semibold truncate flex-1 mr-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {note.title || 'Untitled'}
                </h3>
                {note.page != null && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onPageClick(note.page!); }}
                    className="text-xs flex-shrink-0 transition-colors"
                    style={{ color: 'var(--text-tertiary)' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)';
                    }}
                  >
                    p.{note.page}
                  </button>
                )}
              </div>
              {note.content && (
                <p
                  className="text-xs line-clamp-2 mb-2 leading-relaxed"
                  style={{ color: 'var(--text-secondary)' }}
                >
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
                        className="px-2 py-0.5 rounded-full text-[11px]"
                        style={{ background: config.bg, color: config.text }}
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
