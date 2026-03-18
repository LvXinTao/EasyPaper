'use client';

import { PromptsForm } from '@/components/prompts-form';

export default function PromptsPage() {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <a href="/" className="text-sm" style={{ color: 'var(--text-tertiary)', textDecoration: 'none' }}>EasyPaper</a>
            <span style={{ color: 'var(--text-tertiary)' }}>/</span>
            <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Prompts</h1>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            Customize the AI prompts used for PDF parsing and chat.
          </p>
        </div>
        <PromptsForm />
      </div>
    </div>
  );
}
