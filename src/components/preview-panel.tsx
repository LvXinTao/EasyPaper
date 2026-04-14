'use client';

import { useState, useLayoutEffect, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { PaperListItem, PaperAnalysis, Note, PdfMetadata } from '@/types';
import { MarkdownContent } from '@/components/markdown-content';
import { MetadataCard } from '@/components/paper/metadata-card';
import { useAnalysisPolling } from '@/hooks/use-analysis-polling';

interface PreviewPanelProps {
  paper: PaperListItem | null;
  multiSelectCount?: number;
  onDelete?: (id: string) => void;
  onAnalyze?: (id: string) => void;
  onAnalysisComplete?: () => void;
  onMovePaper?: (paperId: string, folderId: string | null) => void;
  onRename?: (id: string, title: string) => Promise<void>;
  onToggleStar?: (id: string) => void;
  folders?: { id: string; name: string }[];
}

export function PreviewPanel({ paper, multiSelectCount, onDelete, onAnalyze, onAnalysisComplete, onMovePaper, onRename, onToggleStar, folders }: PreviewPanelProps) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<PaperAnalysis | null>(null);
  const [noteCount, setNoteCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);
  const [pages, setPages] = useState(0);
  const [pdfMetadata, setPdfMetadata] = useState<PdfMetadata | undefined>(undefined);
  const [menuOpen, setMenuOpen] = useState(false);
  const [folderSubmenuOpen, setFolderSubmenuOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');

  // Analysis polling for progress feedback
  const { isPolling, analysisStep, isStale, completedStatus } = useAnalysisPolling(
    paper?.id ?? '',
    paper?.status ?? null
  );

  useEffect(() => {
    if (completedStatus && onAnalysisComplete) {
      onAnalysisComplete();
    }
  }, [completedStatus, onAnalysisComplete]);

  // Reset state when paper changes - intentional cascading state reset
  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    if (!paper) return;
    setAnalysis(null);
    setNoteCount(0);
    setChatCount(0);
    setPages(0);
    setPdfMetadata(undefined);

    (async () => {
      try {
        const res = await fetch(`/api/paper/${paper.id}`);
        const data = await res.json();
        if (data.analysis) setAnalysis(data.analysis);
        setPages(data.metadata?.pages || 0);
        if (data.metadata?.pdfMetadata) setPdfMetadata(data.metadata.pdfMetadata);
        setChatCount(data.chatHistory?.messages?.filter((m: { role: string }) => m.role === 'user').length || 0);
      } catch { /* ignore */ }
      try {
        const sessionsRes = await fetch(`/api/paper/${paper.id}/chat-sessions`);
        const sessionsData = await sessionsRes.json();
        if (sessionsData.sessions) setChatCount(sessionsData.sessions.length);
      } catch { /* ignore */ }
      try {
        const res = await fetch(`/api/paper/${paper.id}/notes`);
        const notes: Note[] = await res.json();
        setNoteCount(notes.length);
      } catch { /* ignore */ }
    })();
  }, [paper]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /* eslint-disable react-hooks/set-state-in-effect */
  useLayoutEffect(() => {
    setIsRenaming(false);
  }, [paper]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Multi-select message - show when multiple papers are selected
  if (multiSelectCount && multiSelectCount > 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: 'var(--text-tertiary)' }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{multiSelectCount} papers selected</div>
        <div style={{ fontSize: '11px' }}>Use right-click menu or bottom toolbar for batch actions</div>
      </div>
    );
  }

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
        <div className="min-w-0 flex items-start gap-2">
          {onToggleStar && (
            <button
              onClick={() => onToggleStar(paper.id)}
              className="cursor-pointer flex-shrink-0 mt-0.5"
              style={{ background: 'none', border: 'none', padding: 0, fontSize: '18px', lineHeight: 1, color: paper.starred ? 'var(--amber)' : 'var(--text-tertiary)', opacity: paper.starred ? 1 : 0.4 }}
              title={paper.starred ? 'Unstar' : 'Star'}
            >
              {paper.starred ? '★' : '☆'}
            </button>
          )}
          <div className="min-w-0">
            {isRenaming ? (
              <input
                autoFocus
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={async () => {
                  const trimmed = renameValue.trim();
                  if (trimmed && trimmed !== paper.title && onRename) {
                    await onRename(paper.id, trimmed);
                  }
                  setIsRenaming(false);
                }}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const trimmed = renameValue.trim();
                    if (trimmed && trimmed !== paper.title && onRename) {
                      await onRename(paper.id, trimmed);
                    }
                    setIsRenaming(false);
                  } else if (e.key === 'Escape') {
                    setIsRenaming(false);
                  }
                }}
                maxLength={200}
                className="w-full rounded-md px-2 py-1 outline-none"
                style={{
                  fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)',
                  background: 'var(--surface)', border: '2px solid var(--accent)',
                  boxShadow: '0 0 0 2px var(--accent-subtle)',
                }}
              />
            ) : (
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4, letterSpacing: '-0.2px' }}>{paper.title}</div>
            )}
            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
              Added {new Date(paper.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button onClick={() => router.push(`/paper/${paper.id}`)} className="cursor-pointer rounded-lg" style={{ padding: '5px 11px', fontSize: '11px', fontWeight: 500, background: 'var(--text-primary)', color: 'var(--bg)', border: 'none' }}>Open</button>
          {isPolling ? (
            <span className="rounded-lg" style={{ padding: '5px 11px', fontSize: '11px', fontWeight: 500, color: 'var(--text-tertiary)', background: 'var(--glass)', border: '1px solid var(--glass-border)' }}>
              {isStale ? 'Analysis stuck' : (analysisStep ? `${analysisStep.charAt(0).toUpperCase() + analysisStep.slice(1)}...` : 'Queued...')}
            </span>
          ) : (
            paper.status !== 'analyzed' && paper.status !== 'analyzing' && paper.status !== 'parsing' && paper.status !== 'queued' && onAnalyze && (
              <button onClick={() => onAnalyze(paper.id)} className="cursor-pointer rounded-lg" style={{ padding: '5px 11px', fontSize: '11px', fontWeight: 500, background: 'var(--glass)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)' }}>Analyze</button>
            )
          )}
          <div className="relative">
            <button onClick={() => { setMenuOpen(!menuOpen); if (menuOpen) setFolderSubmenuOpen(false); }} className="cursor-pointer rounded-lg" style={{ padding: '5px 8px', fontSize: '11px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>⋯</button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 rounded-lg z-10" style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: '140px' }}>
                {onRename && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setRenameValue(paper.title);
                      setIsRenaming(true);
                    }}
                    className="w-full text-left cursor-pointer block"
                    style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}
                  >
                    Rename
                  </button>
                )}
                {onMovePaper && folders && folders.length > 0 && (
                  <div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFolderSubmenuOpen(!folderSubmenuOpen); }}
                      className="w-full text-left cursor-pointer block"
                      style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}
                    >
                      Move to folder {folderSubmenuOpen ? '▾' : '▸'}
                    </button>
                    {folderSubmenuOpen && (
                      <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                        <button onClick={() => { setMenuOpen(false); setFolderSubmenuOpen(false); onMovePaper(paper.id, null); }} className="w-full text-left cursor-pointer block" style={{ padding: '6px 12px 6px 24px', fontSize: '11px', color: 'var(--text-secondary)' }}>No folder</button>
                        {folders.map(f => (
                          <button key={f.id} onClick={() => { setMenuOpen(false); setFolderSubmenuOpen(false); onMovePaper(paper.id, f.id); }} className="w-full text-left cursor-pointer block" style={{ padding: '6px 12px 6px 24px', fontSize: '11px', color: 'var(--text-secondary)' }}>{f.name}</button>
                        ))}
                      </div>
                    )}
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

      {/* Metadata Card */}
      <MetadataCard
        pdfMetadata={pdfMetadata}
        pages={pages}
        onReParse={async () => {
          const res = await fetch(`/api/paper/${paper.id}/metadata/extract`, { method: 'POST' });
          const data = await res.json();
          if (data.pdfMetadata) setPdfMetadata(data.pdfMetadata);
        }}
        onUpdate={async (fields: Partial<PdfMetadata>) => {
          const res = await fetch(`/api/paper/${paper.id}/metadata`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fields),
          });
          const data = await res.json();
          if (data.pdfMetadata) setPdfMetadata(data.pdfMetadata);
        }}
      />

      {/* Analysis sections */}
      {analysis && (
        <>
          <div>
            <div className="uppercase" style={{ fontSize: '10px', letterSpacing: '0.8px', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '6px' }}>Summary</div>
            <div className="rounded-lg" style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', padding: '13px' }}>
              <MarkdownContent content={analysis.summary?.content || 'No summary available'} />
            </div>
          </div>
          {analysis.contributions?.items?.length > 0 && (
            <div>
              <div className="uppercase" style={{ fontSize: '10px', letterSpacing: '0.8px', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '6px' }}>Key Contributions</div>
              <div className="rounded-lg" style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', padding: '13px' }}>
              <MarkdownContent content={analysis.contributions.items.map((item: string) => '- ' + item).join('\n')} />
            </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
