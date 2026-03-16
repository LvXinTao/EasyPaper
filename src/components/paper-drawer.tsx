'use client';

import { useEffect, useRef, useCallback } from 'react';

interface PaperDrawerProps {
  open: boolean;
  onClose: () => void;
  currentPaperId: string;
}

export function PaperDrawer({ open, onClose, currentPaperId }: PaperDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 top-[52px] z-30 bg-black/30 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Paper navigation"
        className={`fixed top-[52px] left-0 bottom-0 w-80 z-30 bg-white shadow-xl transform transition-transform duration-200 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto p-4">
            <p className="text-sm text-slate-400">Loading papers...</p>
          </div>
        </div>
      </div>
    </>
  );
}
