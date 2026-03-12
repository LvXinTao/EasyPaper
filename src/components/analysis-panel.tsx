'use client';

import { useState, useCallback } from 'react';
import type { PaperAnalysis, PageReference, ChatMessage } from '@/types';
import { SectionTabs } from './section-tabs';
import { ChatInput } from './chat-input';
import { ChatMessages } from './chat-messages';

interface AnalysisPanelProps {
  paperId: string;
  analysis: PaperAnalysis | null;
  initialChatMessages?: ChatMessage[];
  isAnalyzing?: boolean;
  analysisStep?: string | null;
  analysisMessage?: string | null;
  onReferenceClick?: (page: number) => void;
}

function ReferenceLink({
  reference,
  onClick,
}: {
  reference: PageReference;
  onClick?: (page: number) => void;
}) {
  return (
    <button
      onClick={() => onClick?.(reference.page)}
      className="inline-flex items-center text-xs text-indigo-500 hover:text-indigo-700 hover:underline ml-1 font-mono"
      title={reference.text}
    >
      [p.{reference.page}]
    </button>
  );
}

function SectionContent({
  analysis,
  section,
  onReferenceClick,
}: {
  analysis: PaperAnalysis;
  section: string;
  onReferenceClick?: (page: number) => void;
}) {
  const sectionData = analysis[section as keyof PaperAnalysis];
  if (!sectionData || typeof sectionData === 'string') return null;

  if (section === 'contributions' && 'items' in sectionData) {
    return (
      <div>
        <ul className="list-disc pl-5 space-y-2">
          {sectionData.items.map((item, i) => (
            <li key={i} className="text-slate-700 leading-relaxed">{item}</li>
          ))}
        </ul>
        {sectionData.references.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
            References:
            {sectionData.references.map((ref, i) => (
              <ReferenceLink key={i} reference={ref} onClick={onReferenceClick} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if ('content' in sectionData) {
    return (
      <div>
        <div className="text-slate-700 whitespace-pre-wrap leading-relaxed">{sectionData.content}</div>
        {sectionData.references.length > 0 && (
          <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
            References:
            {sectionData.references.map((ref, i) => (
              <ReferenceLink key={i} reference={ref} onClick={onReferenceClick} />
            ))}
          </div>
        )}
      </div>
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
  paperId,
  analysis,
  initialChatMessages = [],
  isAnalyzing,
  analysisStep,
  analysisMessage,
  onReferenceClick,
}: AnalysisPanelProps) {
  const [activeSection, setActiveSection] = useState('summary');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialChatMessages);
  const [streamingContent, setStreamingContent] = useState('');
  const [isChatStreaming, setIsChatStreaming] = useState(false);

  const handleSendMessage = useCallback(
    async (message: string) => {
      setChatMessages((prev) => [...prev, { role: 'user', content: message }]);
      setIsChatStreaming(true);
      setStreamingContent('');

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paperId, message }),
        });

        if (!response.ok) throw new Error('Failed to send message');

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullResponse = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.content) {
                fullResponse += data.content;
                setStreamingContent(fullResponse);
              }
              if (data.done) {
                setChatMessages((prev) => [
                  ...prev,
                  { role: 'assistant', content: fullResponse },
                ]);
                setStreamingContent('');
              }
            } catch {
              // Skip malformed lines
            }
          }
        }
      } catch (error) {
        console.error('Chat error:', error);
      } finally {
        setIsChatStreaming(false);
      }
    },
    [paperId]
  );

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
      <div className="flex-1 overflow-auto p-4">
        {activeSection === 'chat' ? (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-auto">
              <ChatMessages
                messages={chatMessages}
                streamingContent={streamingContent}
                isStreaming={isChatStreaming}
              />
            </div>
            <ChatInput
              onSend={handleSendMessage}
              disabled={isChatStreaming}
            />
          </div>
        ) : (
          <SectionContent
            analysis={analysis}
            section={activeSection}
            onReferenceClick={onReferenceClick}
          />
        )}
      </div>
    </div>
  );
}
