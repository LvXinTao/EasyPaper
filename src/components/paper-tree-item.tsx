'use client';

import type { PaperListItem, PaperStatus } from '@/types';
import { formatRelativeTime } from '@/lib/format';

interface PaperTreeItemProps {
  paper: PaperListItem;
  isSelected: boolean;
  isChecked: boolean;
  depth: number;
  onClick: () => void;
  onDoubleClick?: () => void;
  onCheckboxToggle: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onToggleStar?: () => void;
}

const statusConfig: Record<PaperStatus, { label: string; bg: string; color: string }> = {
  analyzed: { label: 'Analyzed', bg: 'var(--green-subtle)', color: 'var(--green)' },
  pending: { label: 'Pending', bg: 'var(--amber-subtle)', color: 'var(--amber)' },
  queued: { label: 'Queued', bg: 'var(--amber-subtle)', color: 'var(--amber)' },
  parsing: { label: 'Parsing', bg: 'var(--blue-subtle)', color: 'var(--blue)' },
  analyzing: { label: 'Analyzing', bg: 'var(--blue-subtle)', color: 'var(--blue)' },
  error: { label: 'Error', bg: 'var(--rose-subtle)', color: 'var(--rose)' },
};

export function PaperTreeItem({
  paper,
  isSelected,
  isChecked,
  depth,
  onClick,
  onDoubleClick,
  onCheckboxToggle,
  onContextMenu,
  onToggleStar,
}: PaperTreeItemProps) {
  const status = statusConfig[paper.status] || statusConfig.pending;
  const isStarred = paper.starred === true;

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleStar?.();
  };

  return (
    <div
      style={{
        padding: '10px 10px 10px ' + `${12 + depth * 16}px`,
        marginBottom: '2px',
        background: isChecked ? 'var(--accent-subtle)' : isSelected ? 'rgba(255,255,255,0.04)' : isStarred ? 'rgba(251, 191, 36, 0.08)' : 'transparent',
        border: isChecked || isSelected ? '1px solid rgba(157,157,181,0.12)' : '1px solid transparent',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'background 0.15s ease, border 0.15s ease',
      }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => { e.stopPropagation(); onCheckboxToggle(); }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '15px',
            height: '15px',
            accentColor: 'var(--accent)',
            cursor: 'pointer',
            flexShrink: 0,
            marginTop: '2px',
          }}
        />

        {/* Star */}
        <button
          onClick={handleStarClick}
          style={{
            fontSize: '15px',
            color: isStarred ? 'var(--amber)' : 'var(--text-tertiary)',
            opacity: isStarred ? 1 : 0.4,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
            marginTop: '1px',
          }}
          title={isStarred ? 'Remove star' : 'Add star'}
        >
          {isStarred ? '★' : '☆'}
        </button>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.35,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {paper.title}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
            {formatRelativeTime(paper.createdAt)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '10px',
              padding: '1px 6px',
              borderRadius: '4px',
              background: status.bg,
              color: status.color,
            }}>
              {status.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}