'use client';

import type { PaperListItem } from '@/types';
import { formatRelativeTime } from '@/lib/format';

interface PaperRowProps {
  paper: PaperListItem;
  isActive: boolean;
  onClick: () => void;
  onDoubleClick?: () => void;
  onToggleStar?: () => void;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  analyzed: { label: '✓ Analyzed', className: 'analyzed' },
  pending: { label: 'Pending', className: 'pending' },
  parsing: { label: 'Parsing...', className: 'parsing' },
  analyzing: { label: 'Analyzing...', className: 'analyzing' },
  error: { label: 'Error', className: 'error' },
};

export function PaperRow({ paper, isActive, onClick, onDoubleClick, onToggleStar }: PaperRowProps) {
  const status = statusConfig[paper.status] || statusConfig.pending;
  const isStarred = paper.starred === true;

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleStar?.();
  };

  return (
    <div
      data-paper-id={paper.id}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      className="cursor-pointer rounded-lg transition-colors"
      style={{
        padding: '10px',
        marginBottom: '2px',
        background: isActive ? 'var(--accent-subtle)' : isStarred ? 'rgba(251, 191, 36, 0.08)' : 'transparent',
        border: isActive ? '1px solid rgba(157,157,181,0.08)' : '1px solid transparent',
      }}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={handleStarClick}
          className="flex-shrink-0 mt-0.5 cursor-pointer"
          style={{ fontSize: '15px', color: isStarred ? 'var(--amber)' : 'var(--text-tertiary)', opacity: isStarred ? 1 : 0.4 }}
          title={isStarred ? 'Remove from starred' : 'Add to starred'}
        >
          {isStarred ? '★' : '☆'}
        </button>
        <div className="flex-1 min-w-0">
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
            {paper.title}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
            {formatRelativeTime(paper.createdAt)}
          </div>
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            <span
              className="rounded"
              style={{
                fontSize: '10px',
                padding: '1px 6px',
                background: status.className === 'analyzed' ? 'var(--green-subtle)' :
                            status.className === 'error' ? 'var(--rose-subtle)' :
                            status.className === 'parsing' || status.className === 'analyzing' ? 'var(--blue-subtle)' :
                            'var(--amber-subtle)',
                color: status.className === 'analyzed' ? 'var(--green)' :
                       status.className === 'error' ? 'var(--rose)' :
                       status.className === 'parsing' || status.className === 'analyzing' ? 'var(--blue)' :
                       'var(--amber)',
              }}
            >
              {status.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}