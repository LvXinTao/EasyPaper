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
      className="inline-flex items-center text-xs text-blue-500 hover:text-blue-700 hover:underline ml-1"
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
            <li key={i} className="text-gray-700">{item}</li>
          ))}
        </ul>
        {sectionData.references.length > 0 && (
          <div className="mt-4 text-xs text-gray-400">
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
        <div className="text-gray-700 whitespace-pre-wrap">{sectionData.content}</div>
        {sectionData.references.length > 0 && (
          <div className="mt-4 text-xs text-gray-400">
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

export function AnalysisPanel({
  paperId,
  analysis,
  initialChatMessages = [],
  isAnalyzing,
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
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <div className="text-gray-500">Analyzing paper...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No analysis yet. Click &quot;Analyze&quot; to start.
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
