'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { PaperListItem, PaperAnalysis, Note } from '@/types';

interface PreviewPanelProps {
  paper: PaperListItem | null;
  onDelete?: (id: string) => void;
  onAnalyze?: (id: string) => void;
  onMovePaper?: (paperId: string, folderId: string | null) => void;
  folders?: { id: string; name: string }[];
}

export function PreviewPanel({ paper, onDelete, onAnalyze, onMovePaper, folders }: PreviewPanelProps) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<PaperAnalysis | null>(null);
  const [noteCount, setNoteCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);
  const [pages, setPages] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!paper) return;
    setAnalysis(null);
    setNoteCount(0);
    setChatCount(0);
    setPages(0);

    (async () => {
      try {
        const res = await fetch(`/api/paper/${paper.id}`);
        const data = await res.json();
        if (data.analysis) setAnalysis(data.analysis);
        setPages(data.metadata?.pages || 0);
        setChatCount(data.chatHistory?.messages?.filter((m: { role: string }) => m.role === 'user').length || 0);
      } catch { /* ignore */ }
      try {
        const res = await fetch(`/api/paper/${paper.id}/notes`);
        const notes: Note[] = await res.json();
        setNoteCount(notes.length);
      } catch { /* ignore */ }
    })();
  }, [paper]);

  if (!paper) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: 'var(--text-tertiary)' }}>
        <div className="rounded-2xl flex items-center justify-center" style={{ width: '56px', height: '56px', background: 'var(--glass)', border: '1px solid var(--glass-border)' }}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </div>
        <span style={{ fontSize: '12px' }}>Select a paper to preview</span>
      </div>
    );
  }

  const sectionCount = analysis ? Object.keys(analysis).filter(k => k !== 'generatedAt').length : 0;

  return (
    <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto" style={{ padding: '20px' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4, letterSpacing: '-0.2px' }}>{paper.title}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Added {new Date(paper.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button onClick={() => router.push(`/paper/${paper.id}`)} className="cursor-pointer rounded-lg" style={{ padding: '5px 11px', fontSize: '11px', fontWeight: 500, background: 'var(--text-primary)', color: 'var(--bg)', border: 'none' }}>Open</button>
          {paper.status !== 'analyzed' && paper.status !== 'analyzing' && paper.status !== 'parsing' && onAnalyze && (
            <button onClick={() => onAnalyze(paper.id)} className="cursor-pointer rounded-lg" style={{ padding: '5px 11px', fontSize: '11px', fontWeight: 500, background: 'var(--glass)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)' }}>Analyze</button>
          )}
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="cursor-pointer rounded-lg" style={{ padding: '5px 8px', fontSize: '11px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>⋯</button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 rounded-lg overflow-hidden z-10" style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: '140px' }}>
                {onMovePaper && folders && folders.length > 0 && (
                  <div className="relative group">
                    <button className="w-full text-left cursor-pointer block" style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>Move to folder</button>
                    <div className="hidden group-hover:block absolute left-full top-0 rounded-lg overflow-hidden" style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: '120px' }}>
                      <button onClick={() => { setMenuOpen(false); onMovePaper(paper.id, null); }} className="w-full text-left cursor-pointer block" style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>No folder</button>
                      {folders.map(f => (
                        <button key={f.id} onClick={() => { setMenuOpen(false); onMovePaper(paper.id, f.id); }} className="w-full text-left cursor-pointer block" style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>{f.name}</button>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => { setMenuOpen(false); if (onDelete) onDelete(paper.id); }} className="w-full text-left cursor-pointer block" style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--rose)' }}>Delete</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { val: sectionCount, label: 'Sections' },
          { val: noteCount, label: 'Notes' },
          { val: chatCount, label: 'Chats' },
          { val: pages, label: 'Pages' },
        ].map(s => (
          <div key={s.label} className="text-center rounded-lg" style={{ padding: '10px', background: 'var(--glass)', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.val}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Analysis sections */}
      {analysis && (
        <>
          <div>
            <div className="uppercase" style={{ fontSize: '10px', letterSpacing: '0.8px', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '6px' }}>Summary</div>
            <div className="rounded-lg" style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.65, background: 'var(--glass)', border: '1px solid var(--glass-border)', padding: '13px' }}>
              {analysis.summary?.content || 'No summary available'}
            </div>
          </div>
          {analysis.contributions?.items?.length > 0 && (
            <div>
              <div className="uppercase" style={{ fontSize: '10px', letterSpacing: '0.8px', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '6px' }}>Key Contributions</div>
              <div className="rounded-lg" style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.65, background: 'var(--glass)', border: '1px solid var(--glass-border)', padding: '13px' }}>
                {analysis.contributions.items.map((item, i) => (
                  <div key={i}>• {item}</div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
