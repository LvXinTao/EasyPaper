'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { formatRelativeTime } from '@/lib/format';
import type { Bookmark } from '@/types';

interface BookmarksPanelProps {
  paperId: string;
  currentPage: number;
  onPageChange: (page: number) => void;
  onBookmarksChange?: () => void;
}

export function BookmarksPanel({
  paperId,
  currentPage,
  onPageChange,
  onBookmarksChange,
}: BookmarksPanelProps) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchBookmarks = useCallback(async () => {
    try {
      const res = await fetch(`/api/paper/${paperId}/bookmarks`);
      if (!res.ok) throw new Error('Failed to fetch bookmarks');
      const data: Bookmark[] = await res.json();
      setBookmarks(data.sort((a, b) => a.page - b.page));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookmarks');
    } finally {
      setLoaded(true);
    }
  }, [paperId]);

  useEffect(() => {
    if (!loaded) fetchBookmarks();
  }, [loaded, fetchBookmarks]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleAddBookmark = async () => {
    try {
      const res = await fetch(`/api/paper/${paperId}/bookmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: currentPage }),
      });
      if (!res.ok) throw new Error('Failed to create bookmark');
      const created: Bookmark = await res.json();
      setBookmarks((prev) => [...prev, created].sort((a, b) => a.page - b.page));
      onBookmarksChange?.();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add bookmark');
    }
  };

  const handleDelete = async (e: React.MouseEvent, bookmarkId: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/paper/${paperId}/bookmarks?bookmarkId=${bookmarkId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete bookmark');
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId));
      onBookmarksChange?.();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete bookmark');
    }
  };

  const handleStartEdit = (bookmark: Bookmark) => {
    setEditingId(bookmark.id);
    setEditValue(bookmark.label || '');
  };

  const handleSaveEdit = async (bookmarkId: string) => {
    try {
      const res = await fetch(`/api/paper/${paperId}/bookmarks`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bookmarkId, label: editValue || null }),
      });
      if (!res.ok) throw new Error('Failed to update bookmark');
      const updated: Bookmark = await res.json();
      setBookmarks((prev) =>
        prev.map((b) => (b.id === updated.id ? updated : b))
      );
      setEditingId(null);
      setEditValue('');
      onBookmarksChange?.();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update bookmark');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, bookmarkId: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(bookmarkId);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const currentPageHasBookmark = bookmarks.some((b) => b.page === currentPage);

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
      <div className="flex-1 overflow-y-auto">
        {bookmarks.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center h-full text-sm"
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg
              className="w-12 h-12 mb-3 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
              />
            </svg>
            <p>No bookmarks yet</p>
            <p className="text-xs mt-1 opacity-70">Add bookmarks to navigate quickly</p>
          </div>
        ) : (
          <ul className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {bookmarks.map((bookmark) => (
              <li
                key={bookmark.id}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/50"
                style={{
                  backgroundColor: bookmark.page === currentPage ? 'var(--amber-subtle)' : undefined,
                }}
                onClick={() => onPageChange(bookmark.page)}
                onDoubleClick={() => handleStartEdit(bookmark)}
              >
                <span
                  className="flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded"
                  style={{
                    backgroundColor: 'var(--amber)',
                    color: 'var(--bg-primary)',
                  }}
                >
                  p.{bookmark.page}
                </span>
                <div className="flex-1 min-w-0">
                  {editingId === bookmark.id ? (
                    <input
                      ref={inputRef}
                      type="text"
                      className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1"
                      style={{
                        borderColor: 'var(--border)',
                        backgroundColor: 'var(--bg-primary)',
                        color: 'var(--text-primary)',
                      }}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, bookmark.id)}
                      onBlur={() => handleSaveEdit(bookmark.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <p
                        className="text-sm truncate"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {bookmark.label || <span style={{ color: 'var(--text-secondary)' }}>No label</span>}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {formatRelativeTime(bookmark.createdAt)}
                      </p>
                    </>
                  )}
                </div>
                <button
                  className="flex-shrink-0 p-1.5 rounded transition-colors hover:bg-rose-100 dark:hover:bg-rose-900/30"
                  style={{ color: 'var(--text-secondary)' }}
                  onClick={(e) => handleDelete(e, bookmark.id)}
                  title="Delete bookmark"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!currentPageHasBookmark && loaded && (
        <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            className="w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            style={{
              backgroundColor: 'var(--amber)',
              color: 'var(--bg-primary)',
            }}
            onClick={handleAddBookmark}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Bookmark for Page {currentPage}
          </button>
        </div>
      )}
    </div>
  );
}