'use client';

import type { Folder } from '@/types';

interface FolderPickerModalProps {
  isOpen: boolean;
  folders: Folder[];
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  onCancel: () => void;
}

export function FolderPickerModal({
  isOpen,
  folders,
  selectedFolderId,
  onSelect,
  onCancel,
}: FolderPickerModalProps) {
  if (!isOpen) return null;

  const rootFolders = folders.filter(f => !f.parentId);

  const renderFolderOption = (folder: Folder, depth: number): React.ReactNode => {
    const children = folders.filter(f => f.parentId === folder.id);
    return (
      <div key={folder.id}>
        <button
          onClick={() => onSelect(folder.id)}
          style={{
            width: '100%',
            textAlign: 'left',
            padding: '8px 12px',
            paddingLeft: `${12 + depth * 16}px`,
            fontSize: '12px',
            color: selectedFolderId === folder.id ? 'var(--accent)' : 'var(--text-secondary)',
            background: selectedFolderId === folder.id ? 'var(--accent-subtle)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          📁 {folder.name}
        </button>
        {children.map(c => renderFolderOption(c, depth + 1))}
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onCancel}>
      <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '16px', minWidth: '280px', border: '1px solid var(--glass-border)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, margin: '0 0 12px' }}>Move to Folder</h3>
        <div style={{ maxHeight: '300px', overflow: 'auto' }}>
          <button
            onClick={() => onSelect(null)}
            style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: selectedFolderId === null ? 'var(--accent)' : 'var(--text-secondary)', background: selectedFolderId === null ? 'var(--accent-subtle)' : 'transparent', border: 'none', cursor: 'pointer' }}
          >
            📁 Root (No folder)
          </button>
          {rootFolders.map(f => renderFolderOption(f, 0))}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--glass)', color: 'var(--text-secondary)', borderRadius: '6px', border: '1px solid var(--glass-border)', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSelect(selectedFolderId)} style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--accent)', color: 'var(--bg)', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>Move</button>
        </div>
      </div>
    </div>
  );
}