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
        className="text-base font-semibold text-slate-800 bg-white border-2 border-indigo-500 rounded-md px-2 py-1 outline-none w-full ring-2 ring-indigo-100 disabled:opacity-50"
      />
    );
  }

  return (
    <h1
      onClick={() => setIsEditing(true)}
      className="text-base font-semibold text-slate-800 truncate cursor-pointer hover:border-b hover:border-dashed hover:border-slate-400 transition-colors"
      title="Click to rename"
    >
      {value}
    </h1>
  );
}
