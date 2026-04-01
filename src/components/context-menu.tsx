'use client';

import { useEffect, useRef } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  selectedCount: number;
  onClose: () => void;
  onDelete: () => void;
  onMove: () => void;
  onStar: () => void;
  onUnstar: () => void;
  onClear: () => void;
}

export function ContextMenu({
  x, y, selectedCount, onClose, onDelete, onMove, onStar, onUnstar, onClear,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        background: 'var(--bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        padding: '4px 0',
        minWidth: '160px',
        zIndex: 100,
      }}
    >
      <button onClick={() => { onDelete(); onClose(); }} style={menuItemStyle('var(--rose)')}>
        删除选中项 ({selectedCount})
      </button>
      <button onClick={() => { onMove(); onClose(); }} style={menuItemStyle()}>
        移动到文件夹...
      </button>
      <button onClick={() => { onStar(); onClose(); }} style={menuItemStyle()}>
        添加星标
      </button>
      <button onClick={() => { onUnstar(); onClose(); }} style={menuItemStyle()}>
        移除星标
      </button>
      <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
      <button onClick={() => { onClear(); onClose(); }} style={menuItemStyle('var(--text-tertiary)')}>
        取消选择
      </button>
    </div>
  );
}

const menuItemStyle = (color = 'var(--text-secondary)'): React.CSSProperties => ({
  width: '100%',
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: '12px',
  color,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
});
