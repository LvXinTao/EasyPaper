'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface ResizablePanelsProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  centerPanel?: React.ReactNode;
  defaultLeftWidth?: number;
  defaultRightWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  minRightWidth?: number;
  maxRightWidth?: number;
}

export function ResizablePanels({
  leftPanel, rightPanel, centerPanel,
  defaultLeftWidth = 280, defaultRightWidth = 280,
  minLeftWidth = 200, maxLeftWidth = 500,
  minRightWidth = 240, maxRightWidth = 400,
}: ResizablePanelsProps) {
  const isThreeColumn = !!centerPanel;

  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [rightWidth, setRightWidth] = useState(defaultRightWidth);
  const [isDragging, setIsDragging] = useState<number | null>(null); // null, 0=left, 1=right
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((dividerIndex: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(dividerIndex);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging === null || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;

    if (isDragging === 0) {
      setLeftWidth(Math.min(Math.max(mouseX, minLeftWidth), maxLeftWidth));
    } else {
      const rightEdge = containerRect.width - mouseX;
      setRightWidth(Math.min(Math.max(rightEdge, minRightWidth), maxRightWidth));
    }
  }, [isDragging, minLeftWidth, maxLeftWidth, minRightWidth, maxRightWidth]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  useEffect(() => {
    if (isDragging !== null) {
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

  const Divider = ({ dividerIndex }: { dividerIndex: number }) => (
    <div
      onMouseDown={handleMouseDown(dividerIndex)}
      style={{
        width: '1px',
        background: isDragging === dividerIndex ? 'var(--accent)' : 'var(--border)',
        cursor: 'col-resize',
        flexShrink: 0,
        transition: isDragging === dividerIndex ? 'none' : 'background 0.2s ease',
        position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '-4px', right: '-4px', zIndex: 10 }} />
    </div>
  );

  // Two-column mode (legacy)
  if (!isThreeColumn) {
    return (
      <div ref={containerRef} style={{ display: 'flex', height: '100%', width: '100%' }}>
        <div style={{ width: leftWidth, minWidth: minLeftWidth, maxWidth: maxLeftWidth, flexShrink: 0, overflow: 'hidden' }}>
          {leftPanel}
        </div>
        <div
          onMouseDown={handleMouseDown(0)}
          style={{
            width: '1px',
            background: isDragging === 0 ? 'var(--accent)' : 'var(--border)',
            cursor: 'col-resize',
            flexShrink: 0,
            transition: isDragging === 0 ? 'none' : 'background 0.2s ease',
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '-4px', right: '-4px', zIndex: 10 }} />
        </div>
        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
          {rightPanel}
        </div>
      </div>
    );
  }

  // Three-column mode
  return (
    <div ref={containerRef} style={{ display: 'flex', height: '100%', width: '100%' }}>
      <div style={{ width: leftWidth, minWidth: minLeftWidth, maxWidth: maxLeftWidth, flexShrink: 0, overflow: 'hidden' }}>
        {leftPanel}
      </div>
      <Divider dividerIndex={0} />
      <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
        {centerPanel}
      </div>
      <Divider dividerIndex={1} />
      <div style={{ width: rightWidth, minWidth: minRightWidth, maxWidth: maxRightWidth, flexShrink: 0, overflow: 'hidden' }}>
        {rightPanel}
      </div>
    </div>
  );
}
