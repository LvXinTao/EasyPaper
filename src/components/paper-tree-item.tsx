'use client';

import type { PaperListItem, PaperStatus } from '@/types';

interface PaperTreeItemProps {
  paper: PaperListItem;
  isSelected: boolean;
  isChecked: boolean;
  depth: number;
  onClick: () => void;
  onCheckboxToggle: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const statusConfig: Record<PaperStatus, { icon: string; color: string }> = {
  analyzed: { icon: '✓', color: 'var(--green)' },
  pending: { icon: '⋯', color: 'var(--amber)' },
  queued: { icon: '⋯', color: 'var(--amber)' },
  parsing: { icon: '⋯', color: 'var(--amber)' },
  analyzing: { icon: '⋯', color: 'var(--amber)' },
  error: { icon: '✗', color: 'var(--rose)' },
};

export function PaperTreeItem({
  paper,
  isSelected,
  isChecked,
  depth,
  onClick,
  onCheckboxToggle,
  onContextMenu,
}: PaperTreeItemProps) {
  const status = statusConfig[paper.status] || statusConfig.pending;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '3px 6px',
        paddingLeft: `${10 + depth * 14}px`,
        background: isSelected ? 'var(--accent-subtle)' : 'transparent',
        border: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
        borderRadius: '4px',
        cursor: 'pointer',
        gap: '4px',
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={(e) => { e.stopPropagation(); onCheckboxToggle(); }}
        onClick={(e) => e.stopPropagation()}
        style={{ width: '14px', height: '14px', accentColor: 'var(--accent)', cursor: 'pointer' }}
      />
      <span style={{ fontSize: '11px', opacity: 0.6 }}>📄</span>
      <span style={{ flex: 1, fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={paper.title}>
        {paper.title}
      </span>
      <span style={{ fontSize: '10px', color: status.color }}>{status.icon}</span>
    </div>
  );
}