'use client';

import { useState, useEffect, useCallback } from 'react';
import { NotesList } from './notes-list';
import { NoteEditor } from './note-editor';
import type { Note, NoteTag } from '@/types';

interface NotesPanelProps {
  paperId: string;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export function NotesPanel({ paperId, currentPage, onPageChange }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/paper/${paperId}/notes`);
      if (!res.ok) throw new Error('Failed to fetch notes');
      const data: Note[] = await res.json();
      setNotes(data.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes');
    } finally {
      setLoaded(true);
    }
  }, [paperId]);

  useEffect(() => {
    if (!loaded) fetchNotes();
  }, [loaded, fetchNotes]);

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
      if (editingNote) {
        const res = await fetch(`/api/paper/${paperId}/notes`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingNote.id, ...data }),
        });
        if (!res.ok) throw new Error('Failed to update note');
        const updated: Note = await res.json();
        setNotes((prev) =>
          prev.map((n) => (n.id === updated.id ? updated : n))
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        );
      } else {
        const res = await fetch(`/api/paper/${paperId}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Failed to create note');
        const created: Note = await res.json();
        setNotes((prev) => [created, ...prev]);
      }
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
      const res = await fetch(`/api/paper/${paperId}/notes?noteId=${editingNote.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete note');
      setNotes((prev) => prev.filter((n) => n.id !== editingNote.id));
      setView('list');
      setEditingNote(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div
          className="animate-spin w-5 h-5 border-2 border-t-transparent rounded-full"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
        />
      </div>
    );
  }

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
