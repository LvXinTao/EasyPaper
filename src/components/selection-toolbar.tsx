'use client';

interface SelectionToolbarProps {
  position: { x: number; y: number };
  onNoteCreate: () => void;
  onAskAI: () => void;
}

export function SelectionToolbar({ position, onNoteCreate, onAskAI }: SelectionToolbarProps) {
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
      <div style={{ display: 'flex', gap: '8px' }}>
        {/* 添加笔记按钮 */}
        <button
          onClick={onNoteCreate}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border-strong)',
            color: 'var(--text-primary)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)';
          }}
          aria-label="Add note to selected text"
        >
          <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>添加笔记</span>
        </button>
        {/* 向AI提问按钮 */}
        <button
          onClick={onAskAI}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
          style={{
            background: 'rgba(96, 165, 250, 0.15)',
            border: '1px solid var(--accent)',
            color: 'var(--accent)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(96, 165, 250, 0.25)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(96, 165, 250, 0.15)';
          }}
          aria-label="Ask AI about selected text"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.545-2.01 3H9V9h3.228z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-3-3v6" />
          </svg>
          <span>向AI提问</span>
        </button>
      </div>
    </div>
  );
}
