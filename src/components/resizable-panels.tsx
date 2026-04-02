'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface ResizablePanelsProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
}

export function ResizablePanels({
  leftPanel,
  rightPanel,
  defaultLeftWidth = 280,
  minLeftWidth = 200,
  maxLeftWidth = 500,
}: ResizablePanelsProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const newLeftWidth = e.clientX - containerRect.left;
    setLeftWidth(Math.min(Math.max(newLeftWidth, minLeftWidth), maxLeftWidth));
  }, [isDragging, minLeftWidth, maxLeftWidth]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div ref={containerRef} style={{ display: 'flex', height: '100%', width: '100%' }}>
      {/* Left Panel */}
      <div
        style={{
          width: leftWidth,
          minWidth: minLeftWidth,
          maxWidth: maxLeftWidth,
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {leftPanel}
      </div>

      {/* Resizer */}
      <div
        onMouseDown={handleMouseDown}
        style={{
          width: '1px',
          background: isDragging ? 'var(--accent)' : 'var(--border)',
          cursor: 'col-resize',
          flexShrink: 0,
          transition: isDragging ? 'none' : 'background 0.2s ease',
          position: 'relative',
        }}
      >
        {/* Visible drag handle area */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '-4px',
            right: '-4px',
            zIndex: 10,
          }}
        />
      </div>

      {/* Right Panel */}
      <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
        {rightPanel}
      </div>
    </div>
  );
}