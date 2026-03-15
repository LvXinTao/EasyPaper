'use client';

import { useState, useEffect } from 'react';
import { SettingsForm } from './settings-form';

export function Navbar() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (isSettingsOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isSettingsOpen]);

  return (
    <>
      <nav className="bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg">
        <div className="px-4 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-xl font-bold text-white tracking-tight">
            <span className="bg-white/20 rounded-lg px-2 py-0.5 text-lg">EP</span>
            EasyPaper
          </a>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="text-sm text-indigo-100 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
        </div>
      </nav>

      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          style={{ animation: 'fadeIn 150ms ease-out' }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-xl w-full mx-4 p-6"
            style={{ animation: 'fadeIn 150ms ease-out, scaleIn 150ms ease-out' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-slate-800">API Settings</h2>
                <p className="text-sm text-slate-400 mt-0.5">
                  Configure your AI provider to enable paper analysis.
                </p>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 -mr-1 cursor-pointer"
                aria-label="Close settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <SettingsForm />
            <p className="mt-4 text-xs text-slate-400 text-center">
              Your API key is encrypted and stored locally. It never leaves your machine.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
