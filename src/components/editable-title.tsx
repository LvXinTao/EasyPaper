'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface EditableTitleProps {
  value: string;
  onSave: (newTitle: string) => Promise<void>;
}

export function EditableTitle({ value, onSave }: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = useCallback(async () => {
    if (isSaving) return;
    const trimmed = editValue.trim();
    if (!trimmed || trimmed.length > 200 || trimmed === value) {
      setEditValue(value);
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(trimmed);
      setIsEditing(false);
    } catch {
      setEditValue(value);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }, [editValue, value, onSave, isSaving]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setEditValue(value);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        maxLength={200}
        className="text-base font-semibold rounded-md px-2 py-1 outline-none w-full disabled:opacity-50"
        style={{ color: 'var(--text-primary)', background: 'var(--surface)', border: '2px solid var(--accent)', boxShadow: '0 0 0 2px var(--accent-subtle)' }}
      />
    );
  }

  return (
    <h1
      onClick={() => setIsEditing(true)}
      className="text-base font-semibold truncate cursor-pointer transition-colors"
      style={{ color: 'var(--text-primary)' }}
      title="Click to rename"
    >
      {value}
    </h1>
  );
}
