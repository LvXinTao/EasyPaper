'use client';

interface SelectionToolbarProps {
  position: { x: number; y: number };
  onClick: () => void;
}

export function SelectionToolbar({ position, onClick }: SelectionToolbarProps) {
  // Position at bottom-right of selection with offset
  const toolbarX = position.x + 8;
  const toolbarY = position.y + 8;

  return (
    <div
      className="fixed z-50 pointer-events-auto animate-in fade-in duration-150"
      style={{
        left: toolbarX,
        top: toolbarY,
      }}
    >
      <button
        onClick={onClick}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border-strong)',
          color: 'var(--text-primary)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(0, 0, 0, 0.12)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)';
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)';
        }}
        aria-label="Add note to selected text"
      >
        <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <span>添加笔记</span>
      </button>
    </div>
  );
}