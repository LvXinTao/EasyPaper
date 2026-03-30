'use client';

import { useState } from 'react';
import { NotesList } from './notes-list';
import { NoteEditor } from './note-editor';
import type { Note, NoteTag } from '@/types';

interface NotesPanelProps {
  paperId: string;
  currentPage: number;
  onPageChange: (page: number) => void;
  onNoteClick?: (note: Note) => void;
  // Notes are passed from parent to avoid duplicate fetching
  notes: Note[];
  // Callbacks for CRUD operations - parent handles API calls
  onNoteSave: (data: { id?: string; title: string; content: string; tags: NoteTag[]; page?: number }) => Promise<void>;
  onNoteDelete: (noteId: string) => Promise<void>;
}

export function NotesPanel({
  currentPage,
  onPageChange,
  onNoteClick,
  notes,
  onNoteSave,
  onNoteDelete,
}: NotesPanelProps) {
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleNew = () => {
    setEditingNote(null);
    setView('edit');
  };

  const handleSelect = (note: Note) => {
    setEditingNote(note);
    setView('edit');
  };

  const handleSave = async (data: { title: string; content: string; tags: NoteTag[]; page?: number }) => {
    try {
      await onNoteSave({
        id: editingNote?.id,
        ...data,
      });
      setView('list');
      setEditingNote(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    }
  };

  const handleDelete = async () => {
    if (!editingNote) return;
    try {
      await onNoteDelete(editingNote.id);
      setView('list');
      setEditingNote(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {error && (
        <div
          className="px-4 py-2 border-b text-xs"
          style={{
            background: 'var(--rose-subtle)',
            borderColor: 'var(--rose)',
            color: 'var(--rose)',
          }}
        >
          {error}
        </div>
      )}
      {view === 'list' ? (
        <NotesList
          notes={notes}
          onSelect={handleSelect}
          onNew={handleNew}
          onPageClick={onPageChange}
          onNoteClick={onNoteClick}
        />
      ) : (
        <NoteEditor
          note={editingNote || undefined}
          defaultPage={currentPage}
          onSave={handleSave}
          onDelete={editingNote ? handleDelete : undefined}
          onBack={() => { setView('list'); setEditingNote(null); }}
        />
      )}
    </div>
  );
}