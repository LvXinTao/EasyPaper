'use client';

import { useState } from 'react';
import type { PdfMetadata } from '@/types';

interface MetadataCardProps {
  pdfMetadata: PdfMetadata | undefined;
  pages: number;
  onReParse: () => Promise<void>;
  onUpdate: (fields: Partial<PdfMetadata>) => Promise<void>;
}

export function MetadataCard({ pdfMetadata, pages, onReParse, onUpdate }: MetadataCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<PdfMetadata>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isReParsing, setIsReParsing] = useState(false);

  if (!pdfMetadata) {
    return (
      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Paper Info</h3>
          <button
            onClick={onReParse}
            disabled={isReParsing}
            className="px-2 py-1 text-xs rounded transition-colors hover:opacity-80"
            style={{ color: 'var(--accent)' }}
          >
            {isReParsing ? 'Parsing...' : 'Parse'}
          </button>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Not parsed</p>
      </div>
    );
  }

  const sourceLabel = (field: string) => {
    const source = pdfMetadata.fieldSources?.[field];
    if (source === 'manual') return 'Manual';
    if (source === 'text-extraction') return 'Text extract';
    return 'PDF properties';
  };

  const startEdit = () => {
    setEditForm({
      title: pdfMetadata.title ?? '',
      authors: pdfMetadata.authors ?? [],
      date: pdfMetadata.date ?? '',
      subject: pdfMetadata.subject ?? '',
      keywords: pdfMetadata.keywords ?? [],
    });
    setIsEditing(true);
  };

  const saveEdit = async () => {
    setIsSaving(true);
    try {
      await onUpdate(editForm);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReParse = async () => {
    setIsReParsing(true);
    try {
      await onReParse();
    } finally {
      setIsReParsing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium">Paper Info (Editing)</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Title</label>
            <input
              type="text"
              value={editForm.title ?? ''}
              onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-2 py-1 text-sm rounded border"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Authors (comma-separated)</label>
            <input
              type="text"
              value={(editForm.authors ?? []).join(', ')}
              onChange={e => setEditForm(prev => ({ ...prev, authors: e.target.value.split(',').map(a => a.trim()).filter(Boolean) }))}
              className="w-full px-2 py-1 text-sm rounded border"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Date</label>
            <input
              type="text"
              value={editForm.date ?? ''}
              onChange={e => setEditForm(prev => ({ ...prev, date: e.target.value }))}
              className="w-full px-2 py-1 text-sm rounded border"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Subject</label>
            <input
              type="text"
              value={editForm.subject ?? ''}
              onChange={e => setEditForm(prev => ({ ...prev, subject: e.target.value }))}
              className="w-full px-2 py-1 text-sm rounded border"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Keywords (comma-separated)</label>
            <input
              type="text"
              value={(editForm.keywords ?? []).join(', ')}
              onChange={e => setEditForm(prev => ({ ...prev, keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean) }))}
              className="w-full px-2 py-1 text-sm rounded border"
              style={{ background: 'var(--bg-input)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              onClick={saveEdit}
              disabled={isSaving}
              className="px-3 py-1 text-sm rounded transition-colors hover:opacity-80"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1 text-sm rounded transition-colors hover:opacity-80"
              style={{ color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', background: 'var(--bg-elevated)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Paper Info</h3>
        <div className="flex gap-2">
          <button
            onClick={handleReParse}
            disabled={isReParsing}
            className="px-2 py-1 text-xs rounded transition-colors hover:opacity-80"
            style={{ color: 'var(--accent)' }}
          >
            {isReParsing ? 'Re-parsing...' : 'Re-parse'}
          </button>
          <button
            onClick={startEdit}
            className="px-2 py-1 text-xs rounded transition-colors hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}
          >
            Edit
          </button>
        </div>
      </div>
      <div className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-muted)' }}>Title</span>
          <span>{pdfMetadata.title || <em style={{ color: 'var(--text-muted)' }}>Not detected</em>}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-muted)' }}>Authors</span>
          <span>{pdfMetadata.authors?.join('; ') || <em style={{ color: 'var(--text-muted)' }}>Not detected</em>}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-muted)' }}>Date</span>
          <span>{pdfMetadata.date || <em style={{ color: 'var(--text-muted)' }}>Not detected</em>}</span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: 'var(--text-muted)' }}>Pages</span>
          <span>{pages}</span>
        </div>
        {pdfMetadata.subject && (
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Subject</span>
            <span>{pdfMetadata.subject}</span>
          </div>
        )}
        {pdfMetadata.keywords && pdfMetadata.keywords.length > 0 && (
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Keywords</span>
            <span>{pdfMetadata.keywords.join(', ')}</span>
          </div>
        )}
      </div>
      <div className="mt-2 pt-2 border-t text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
        Source: {sourceLabel('title')}
      </div>
    </div>
  );
}
