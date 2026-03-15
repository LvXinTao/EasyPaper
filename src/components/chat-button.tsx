'use client';

import { forwardRef } from 'react';

interface ChatButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export const ChatButton = forwardRef<HTMLButtonElement, ChatButtonProps>(
  function ChatButton({ isOpen, onClick }, ref) {
    return (
      <button
        ref={ref}
        onClick={onClick}
        className="fixed bottom-5 right-5 z-50 h-10 px-4 flex items-center gap-2 bg-indigo-500 text-white text-sm font-medium rounded-[20px] shadow-[0_4px_16px_rgba(99,102,241,0.4)] hover:bg-indigo-600 transition-colors cursor-pointer"
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
