'use client';

import { useState } from 'react';
import type { PaperAnalysis } from '@/types';
import { SectionTabs } from './section-tabs';

export function formatRelativeTime(dateStr: string): string | null {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return null;

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;

  return `on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

interface AnalysisPanelProps {
  analysis: PaperAnalysis | null;
  isAnalyzing?: boolean;
  analysisStep?: string | null;
  analysisMessage?: string | null;
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
    return (
      <ul className="list-disc pl-5 space-y-2">
        {sectionData.items.map((item, i) => (
          <li key={i} className="text-slate-700 leading-relaxed">{item}</li>
        ))}
      </ul>
    );
  }

  if ('content' in sectionData) {
    return (
      <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">{sectionData.content}</div>
    );
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
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    isDone
                      ? 'bg-emerald-500 text-white'
                      : isActive
                        ? 'bg-indigo-500 text-white ring-4 ring-indigo-100'
                        : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {isDone ? '\u2713' : s.icon}
                </div>
                <div className="flex-1">
                  <div
                    className={`text-sm font-medium ${
                      isDone ? 'text-emerald-600' : isActive ? 'text-indigo-700' : 'text-slate-400'
                    }`}
                  >
                    {s.label}
                  </div>
                  {isActive && (
                    <div className="text-xs text-indigo-400 mt-0.5">{message || 'Processing...'}</div>
                  )}
                </div>
                {isActive && (
                  <div className="animate-spin w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function AnalysisPanel({
  analysis,
  isAnalyzing,
  analysisStep,
  analysisMessage,
  onReAnalyze,
}: AnalysisPanelProps) {
  const [activeSection, setActiveSection] = useState('summary');
  const [confirmingReAnalyze, setConfirmingReAnalyze] = useState(false);

  if (isAnalyzing) {
    return (
      <div className="flex flex-col h-full">
        <SectionTabs activeSection={activeSection} onSectionChange={setActiveSection} />
        <AnalysisProgress step={analysisStep || null} message={analysisMessage || null} />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400">
        <svg className="w-12 h-12 mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <p className="text-sm">No analysis yet. Click &quot;Analyze&quot; to start.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <SectionTabs activeSection={activeSection} onSectionChange={setActiveSection} />

      {onReAnalyze && (
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          {confirmingReAnalyze ? (
            <>
              <span className="text-xs text-slate-500">
                Re-analyzing will replace the current analysis. Continue?
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmingReAnalyze(false)}
                  className="px-3 py-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setConfirmingReAnalyze(false);
                    onReAnalyze();
                  }}
                  className="px-3 py-1 text-xs font-medium text-white bg-indigo-500 rounded-md hover:bg-indigo-600 transition-colors"
                >
                  Continue
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="text-xs text-slate-400">
                {(() => {
                  const rel = analysis.generatedAt ? formatRelativeTime(analysis.generatedAt) : null;
                  return rel ? `Analyzed ${rel}` : null;
                })()}
              </span>
              <button
                onClick={() => setConfirmingReAnalyze(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50 transition-colors"
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
