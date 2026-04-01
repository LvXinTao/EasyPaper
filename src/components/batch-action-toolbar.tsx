'use client';

interface BatchActionToolbarProps {
  selectedCount: number;
  onDelete: () => void;
  onMove: () => void;
  onStar: () => void;
  onClear: () => void;
}

export function BatchActionToolbar({
  selectedCount,
  onDelete,
  onMove,
  onStar,
  onClear,
}: BatchActionToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div style={{ padding: '10px 12px', background: 'var(--glass)', border: '1px solid var(--accent)', borderRadius: '8px', marginTop: '8px' }}>
      <div style={{ fontSize: '11px', color: 'var(--accent)', marginBottom: '8px', fontWeight: 500 }}>{selectedCount} selected</div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={onDelete} style={{ fontSize: '12px', padding: '5px 10px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--rose)', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>🗑️ Delete</button>
        <button onClick={onMove} style={{ fontSize: '12px', padding: '5px 10px', background: 'var(--glass)', color: 'var(--text-secondary)', borderRadius: '4px', border: '1px solid var(--glass-border)', cursor: 'pointer' }}>📁 Move</button>
        <button onClick={onStar} style={{ fontSize: '12px', padding: '5px 10px', background: 'var(--glass)', color: 'var(--text-secondary)', borderRadius: '4px', border: '1px solid var(--glass-border)', cursor: 'pointer' }}>★ Star</button>
        <button onClick={onClear} style={{ fontSize: '12px', padding: '5px 10px', background: 'transparent', color: 'var(--text-tertiary)', borderRadius: '4px', border: '1px solid var(--glass-border)', cursor: 'pointer', marginLeft: 'auto' }}>Clear</button>
      </div>
    </div>
  );
}