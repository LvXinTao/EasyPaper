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
    <div style={{ padding: '8px 10px', background: 'var(--glass)', border: '1px solid var(--accent)', borderRadius: '8px', marginTop: '8px' }}>
      <div style={{ fontSize: '10px', color: 'var(--accent)', marginBottom: '6px' }}>已选中 {selectedCount} 项</div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={onDelete} style={{ fontSize: '11px', padding: '4px 8px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--rose)', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>🗑️ 删除</button>
        <button onClick={onMove} style={{ fontSize: '11px', padding: '4px 8px', background: 'var(--glass)', color: 'var(--text-secondary)', borderRadius: '4px', border: '1px solid var(--glass-border)', cursor: 'pointer' }}>📁 移动</button>
        <button onClick={onStar} style={{ fontSize: '11px', padding: '4px 8px', background: 'var(--glass)', color: 'var(--text-secondary)', borderRadius: '4px', border: '1px solid var(--glass-border)', cursor: 'pointer' }}>★ 星标</button>
        <button onClick={onClear} style={{ fontSize: '11px', padding: '4px 8px', background: 'transparent', color: 'var(--text-tertiary)', borderRadius: '4px', border: '1px solid var(--glass-border)', cursor: 'pointer', marginLeft: 'auto' }}>取消</button>
      </div>
    </div>
  );
}