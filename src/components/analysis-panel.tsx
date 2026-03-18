'use client';

import { useState, useRef, useEffect } from 'react';
import type { PaperAnalysis } from '@/types';
import { SectionTabs } from './section-tabs';
import { MarkdownContent } from './markdown-content';
import { formatRelativeTime } from '@/lib/format';

export { formatRelativeTime } from '@/lib/format';

interface AnalysisPanelProps {
  analysis: PaperAnalysis | null;
  isAnalyzing?: boolean;
  analysisStep?: string | null;
  analysisMessage?: string | null;
  visionStreamContent?: string;
  visionProgress?: { batch: number; totalBatches: number; pages: string; elapsed: number } | null;
  onReAnalyze?: () => void;
}

function SectionContent({
  analysis,
  section,
}: {
  analysis: PaperAnalysis;
  section: string;
}) {
  const sectionData = analysis[section as keyof PaperAnalysis];
  if (!sectionData || typeof sectionData === 'string') return null;

  if (section === 'contributions' && 'items' in sectionData) {
    const markdown = sectionData.items.map((item) => `- ${item}`).join('\n');
    return <MarkdownContent content={markdown} />;
  }

  if ('content' in sectionData) {
    return <MarkdownContent content={sectionData.content} />;
  }

  return null;
}

const ANALYSIS_STEPS = [
  { key: 'parsing', label: 'Parsing PDF', icon: '1' },
  { key: 'analyzing', label: 'AI Analysis', icon: '2' },
  { key: 'saving', label: 'Saving Results', icon: '3' },
];

function AnalysisProgress({ step, message }: { step: string | null; message: string | null }) {
  const currentIdx = ANALYSIS_STEPS.findIndex((s) => s.key === step);

  return (
    <div className="flex flex-col items-center justify-center h-full px-8">
      <div className="w-full max-w-sm">
        <div className="space-y-4">
          {ANALYSIS_STEPS.map((s, i) => {
            const isActive = s.key === step;
            const isDone = currentIdx > i;

            return (
              <div key={s.key} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all"
                  style={
                    isDone
                      ? { background: 'var(--green)', color: 'var(--bg)' }
                      : isActive
                        ? { background: 'var(--accent)', color: 'var(--bg)', boxShadow: '0 0 0 4px color-mix(in srgb, var(--accent) 20%, transparent)' }
                        : { background: 'var(--glass)', color: 'var(--text-tertiary)', border: '1px solid var(--glass-border)' }
                  }
                >
                  {isDone ? '✓' : s.icon}
                </div>
                <div className="flex-1">
                  <div
                    className="text-sm font-medium"
                    style={
                      isDone
                        ? { color: 'var(--green)' }
                        : isActive
                          ? { color: 'var(--accent)' }
                          : { color: 'var(--text-tertiary)' }
                    }
                  >
                    {s.label}
                  </div>
                  {isActive && (
                    <div className="text-xs mt-0.5" style={{ color: 'var(--accent)' }}>{message || 'Processing...'}</div>
                  )}
                </div>
                {isActive && (
                  <div
                    className="animate-spin w-4 h-4 border-2 border-t-transparent rounded-full"
                    style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function VisionStreamBox({
  content,
  progress,
}: {
  content: string;
  progress: { batch: number; totalBatches: number; pages: string; elapsed: number } | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content]);

  const tokens = Math.ceil(content.length / 4);

  return (
    <div className="mx-4 mb-3 rounded-lg overflow-hidden" style={{ border: '1px solid var(--glass-border)' }}>
      {progress && (
        <div className="px-3 py-1.5 flex items-center gap-2 text-xs" style={{ background: 'var(--glass)', borderBottom: '1px solid var(--glass-border)' }}>
          <div
            className="animate-spin w-3 h-3 border-2 border-t-transparent rounded-full"
            style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
          />
          <span style={{ color: 'var(--accent)' }}>
            Batch {progress.batch}/{progress.totalBatches}
          </span>
          <span style={{ color: 'var(--text-tertiary)' }}>
            Pages {progress.pages}
          </span>
          {progress.elapsed > 0 && (
            <span style={{ color: 'var(--text-tertiary)' }}>
              {progress.elapsed.toFixed(1)}s
            </span>
          )}
        </div>
      )}
      <div
        ref={scrollRef}
        className="overflow-y-auto font-mono text-xs leading-relaxed"
        style={{
          height: '200px',
          padding: '8px 12px',
          background: 'var(--bg)',
          color: 'var(--text-secondary)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {content || 'Waiting for Vision Model output...'}
        <span className="inline-block w-1.5 h-3.5 ml-0.5 animate-pulse" style={{ background: 'var(--accent)' }} />
      </div>
      <div className="px-3 py-1 flex justify-between text-xs" style={{ background: 'var(--glass)', borderTop: '1px solid var(--glass-border)', color: 'var(--text-tertiary)' }}>
        <span>~{tokens.toLocaleString()} tokens</span>
        {progress && progress.elapsed > 0 && <span>{progress.elapsed.toFixed(1)}s</span>}
      </div>
    </div>
  );
}

export function AnalysisPanel({
  analysis,
  isAnalyzing,
  analysisStep,
  analysisMessage,
  visionStreamContent,
  visionProgress,
  onReAnalyze,
}: AnalysisPanelProps) {
  const [activeSection, setActiveSection] = useState('summary');
  const [confirmingReAnalyze, setConfirmingReAnalyze] = useState(false);

  if (isAnalyzing) {
    return (
      <div className="flex flex-col h-full">
        <SectionTabs activeSection={activeSection} onSectionChange={setActiveSection} />
        <AnalysisProgress step={analysisStep || null} message={analysisMessage || null} />
        {analysisStep === 'parsing' && visionStreamContent !== undefined && visionStreamContent.length > 0 && (
          <VisionStreamBox content={visionStreamContent} progress={visionProgress || null} />
        )}
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ color: 'var(--text-tertiary)' }}>
        <svg className="w-12 h-12 mb-3" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>No analysis yet. Click &quot;Analyze&quot; to start.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <SectionTabs activeSection={activeSection} onSectionChange={setActiveSection} />

      {onReAnalyze && (
        <div
          className="px-4 py-2 flex items-center justify-between"
          style={{ background: 'var(--glass)', borderBottom: '1px solid var(--glass-border)' }}
        >
          {confirmingReAnalyze ? (
            <>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Re-analyzing will replace the current analysis. Continue?
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmingReAnalyze(false)}
                  className="px-3 py-1 text-xs transition-colors"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setConfirmingReAnalyze(false);
                    onReAnalyze();
                  }}
                  className="px-3 py-1 text-xs font-medium rounded-md transition-colors"
                  style={{ color: 'var(--bg)', background: 'var(--accent)' }}
                >
                  Continue
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {(() => {
                  const rel = analysis.generatedAt ? formatRelativeTime(analysis.generatedAt) : null;
                  return rel ? `Analyzed ${rel}` : null;
                })()}
              </span>
              <button
                onClick={() => setConfirmingReAnalyze(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md transition-colors"
                style={{ color: 'var(--accent)', background: 'var(--glass)', border: '1px solid var(--glass-border)' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M1 4v6h6" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                Re-analyze
              </button>
            </>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto p-4">
        <SectionContent
          analysis={analysis}
          section={activeSection}
        />
      </div>
    </div>
  );
}
