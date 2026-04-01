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
        padding: '6px 8px',
        paddingLeft: `${12 + depth * 16}px`,
        background: isChecked ? 'var(--accent-subtle)' : isSelected ? 'rgba(255,255,255,0.04)' : 'transparent',
        borderRadius: '6px',
        cursor: 'pointer',
        gap: '8px',
        margin: '2px 4px',
        transition: 'background 0.15s ease',
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={(e) => { e.stopPropagation(); onCheckboxToggle(); }}
        onClick={(e) => e.stopPropagation()}
        style={{ width: '16px', height: '16px', accentColor: 'var(--accent)', cursor: 'pointer', flexShrink: 0 }}
      />
      <span style={{ fontSize: '13px', opacity: 0.5, flexShrink: 0 }}>📄</span>
      <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={paper.title}>
        {paper.title}
      </span>
      <span style={{ fontSize: '11px', color: status.color, flexShrink: 0 }}>{status.icon}</span>
    </div>
  );
}