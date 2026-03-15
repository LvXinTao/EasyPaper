'use client';

import { forwardRef, useRef, useEffect, useCallback } from 'react';

interface ChatButtonProps {
  isOpen: boolean;
  onClick: () => void;
  position: { bottom: number; right: number };
  onPositionChange: (pos: { bottom: number; right: number }) => void;
}

export const ChatButton = forwardRef<HTMLButtonElement, ChatButtonProps>(
  function ChatButton({ isOpen, onClick, position, onPositionChange }, ref) {
    const isDragging = useRef(false);
    const hasDragged = useRef(false);
    const startMouse = useRef({ x: 0, y: 0 });
    const startPos = useRef({ bottom: 0, right: 0 });

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      isDragging.current = true;
      hasDragged.current = false;
      startMouse.current = { x: e.clientX, y: e.clientY };
      startPos.current = { bottom: position.bottom, right: position.right };
      document.body.classList.add('select-none');
    }, [position]);

    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging.current) return;

        const dx = e.clientX - startMouse.current.x;
        const dy = e.clientY - startMouse.current.y;

        if (!hasDragged.current && Math.sqrt(dx * dx + dy * dy) > 5) {
          hasDragged.current = true;
        }

        if (hasDragged.current) {
          const newRight = Math.max(0, Math.min(startPos.current.right - dx, window.innerWidth - 80));
          const newBottom = Math.max(0, Math.min(startPos.current.bottom - dy, window.innerHeight - 48));
          onPositionChange({ bottom: newBottom, right: newRight });
        }
      };

      const handleMouseUp = () => {
        if (!isDragging.current) return;
        isDragging.current = false;
        document.body.classList.remove('select-none');

        if (!hasDragged.current) {
          onClick();
        }
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }, [onPositionChange, onClick]);

    return (
      <button
        ref={ref}
        onMouseDown={handleMouseDown}
        style={{
          bottom: position.bottom,
          right: position.right,
          position: 'fixed',
        }}
        className={`z-50 h-10 px-4 flex items-center gap-2 bg-indigo-500 text-white text-sm font-medium rounded-[20px] shadow-[0_4px_16px_rgba(99,102,241,0.4)] hover:bg-indigo-600 transition-colors ${
          isDragging.current ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
      {isOpen ? (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          Ask AI
        </>
      )}
      </button>
    );
  }
);
