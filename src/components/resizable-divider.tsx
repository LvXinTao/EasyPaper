'use client';

import { useCallback, useEffect, useRef } from 'react';

interface ResizableDividerProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
  barStyle?: React.CSSProperties;
}

export function ResizableDivider({ direction, onResize, onResizeEnd, barStyle }: ResizableDividerProps) {
  const isDragging = useRef(false);
  const lastPos = useRef(0);
  const dividerRef = useRef<HTMLDivElement>(null);

  // Use refs for callbacks to avoid re-registering event listeners on every render
  const onResizeRef = useRef(onResize);
  const onResizeEndRef = useRef(onResizeEnd);
  useEffect(() => { onResizeRef.current = onResize; }, [onResize]);
  useEffect(() => { onResizeEndRef.current = onResizeEnd; }, [onResizeEnd]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    lastPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPos - lastPos.current;
      lastPos.current = currentPos;
      onResizeRef.current(delta);
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      onResizeEndRef.current?.();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [direction]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = 20;
    if (direction === 'horizontal') {
      if (e.key === 'ArrowLeft') { onResizeRef.current(-step); onResizeEndRef.current?.(); }
      if (e.key === 'ArrowRight') { onResizeRef.current(step); onResizeEndRef.current?.(); }
    } else {
      if (e.key === 'ArrowUp') { onResizeRef.current(-step); onResizeEndRef.current?.(); }
      if (e.key === 'ArrowDown') { onResizeRef.current(step); onResizeEndRef.current?.(); }
    }
  }, [direction]);

  const isHorizontal = direction === 'horizontal';

  return (
    <div
      ref={dividerRef}
      role="separator"
      tabIndex={0}
      aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      className="group flex items-center justify-center flex-shrink-0"
      style={{
        width: isHorizontal ? '6px' : '100%',
        height: isHorizontal ? '100%' : '6px',
        cursor: isHorizontal ? 'col-resize' : 'row-resize',
      }}
    >
      <div
        className="rounded-full transition-colors"
        style={{
          width: isHorizontal ? '3px' : '32px',
          height: isHorizontal ? '32px' : '3px',
          background: 'var(--border)',
          ...barStyle,
        }}
      />
    </div>
  );
}
