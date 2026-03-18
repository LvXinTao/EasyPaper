'use client';

import { useState, useEffect } from 'react';
import { SettingsForm } from './settings-form';
import { UploadModal } from './upload-modal';

export function Navbar() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  useEffect(() => {
    if (isSettingsOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isSettingsOpen]);

  return (
    <>
      <nav
        className="flex items-center"
        style={{
          height: '44px',
          padding: '0 18px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <a
          href="/"
          style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.4px', textDecoration: 'none' }}
        >
          EasyPaper
        </a>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsUploadOpen(true)}
            className="cursor-pointer rounded-lg transition-colors"
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 500,
              background: 'var(--text-primary)',
              color: 'var(--bg)',
              border: 'none',
            }}
          >
            + Upload
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="cursor-pointer rounded-lg transition-colors flex items-center gap-1.5"
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 500,
              background: 'var(--glass)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-secondary)',
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
          <a
            href="/prompts"
            className="rounded-lg transition-colors flex items-center gap-1.5"
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 500,
              background: 'var(--glass)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Prompts
          </a>
        </div>
      </nav>

      {/* Settings modal */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', animation: 'fadeIn 150ms ease-out' }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsSettingsOpen(false); }}
        >
          <div
            className="max-w-xl w-full mx-4 rounded-2xl"
            style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', boxShadow: '0 16px 64px rgba(0,0,0,0.5)', padding: '24px', animation: 'fadeIn 150ms ease-out, scaleIn 150ms ease-out' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Settings</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Configure your AI provider and appearance.</p>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="cursor-pointer"
                style={{ color: 'var(--text-tertiary)', fontSize: '18px' }}
                aria-label="Close settings"
              >
                ×
              </button>
            </div>
            <SettingsForm />
            <p className="text-center" style={{ marginTop: '16px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
              Your API key is encrypted and stored locally.
            </p>
          </div>
        </div>
      )}

      {/* Upload modal */}
      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
    </>
  );
}
