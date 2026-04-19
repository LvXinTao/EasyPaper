'use client';

import { useState } from 'react';
import { AnalysisPanel } from './analysis-panel';
import { NotesList } from './notes-list';
import { NoteEditor } from './note-editor';
import { ChatMessages } from './chat-messages';
import { ChatInput } from './chat-input';
import { ChatSessionBar } from './chat-session-bar';
import { MarkdownContent } from './markdown-content';
import type { PaperAnalysis, ChatMessage, ChatSessionMeta, Note, NoteTag, TextSelection, PdfMetadata } from '@/types';

interface PaperTabsProps {
  paperId: string;
  analysis: PaperAnalysis | null;
  isAnalyzing: boolean;
  analysisStep: string | null;
  analysisMessage: string | null;
  parseBatchProgress: { done: number; total: number } | null;
  streamingParsedContent: string;
  avgBatchTime: number;
  onReAnalyze: () => void;
  notes: Note[];
  currentPage: number;
  onPageChange: (page: number) => void;
  onNoteClick: (note: Note) => void;
  onNoteSave: (data: { id?: string; title: string; content: string; tags: NoteTag[]; page?: number }) => Promise<void>;
  onNoteDelete: (noteId: string) => Promise<void>;
  chatMessages: ChatMessage[];
  streamingContent: string;
  isChatStreaming: boolean;
  sessions: ChatSessionMeta[];
  activeSessionId: string | null;
  pendingQuote: TextSelection | null;
  lowConfidence: boolean;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
  onDeleteSession: (sessionId: string) => void;
  onSendMessage: (message: string, expandContext?: boolean) => void;
  onClearQuote: () => void;
  onExpandContext: () => void;
  pdfMetadata?: PdfMetadata;
  pages: number;
  shortTitle?: string;
  editableTitle: string;
  onTitleChange: (title: string) => void;
}

export function PaperTabs({
  paperId, analysis, isAnalyzing, analysisStep, analysisMessage,
  parseBatchProgress, streamingParsedContent, avgBatchTime, onReAnalyze,
  notes, currentPage, onPageChange, onNoteClick, onNoteSave, onNoteDelete,
  chatMessages, streamingContent, isChatStreaming, sessions, activeSessionId,
  pendingQuote, lowConfidence, onSelectSession, onNewSession, onDeleteSession,
  onSendMessage, onClearQuote, onExpandContext,
  pdfMetadata, pages, shortTitle, editableTitle, onTitleChange,
}: PaperTabsProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'notes' | 'chat'>('info');
  const [noteView, setNoteView] = useState<'list' | 'edit'>('list');
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);

  const handleNewNote = () => { setEditingNote(null); setNoteView('edit'); };
  const handleSelectNote = (note: Note) => { setEditingNote(note); setNoteView('edit'); };
  const handleSaveNote = async (data: { title: string; content: string; tags: NoteTag[]; page?: number }) => {
    try {
      await onNoteSave({ id: editingNote?.id, ...data });
      setNoteView('list');
      setEditingNote(null);
      setNoteError(null);
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Failed to save note');
    }
  };
  const handleDeleteNote = async () => {
    if (!editingNote) return;
    try {
      await onNoteDelete(editingNote.id);
      setNoteView('list');
      setEditingNote(null);
      setNoteError(null);
    } catch (err) {
      setNoteError(err instanceof Error ? err.message : 'Failed to delete note');
    }
  };

  const sectionCount = analysis ? Object.keys(analysis).filter(k => k !== 'generatedAt').length : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center border-b flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        {[
          { key: 'info' as const, label: 'Info', count: sectionCount },
          { key: 'notes' as const, label: 'Notes', count: notes.length },
          { key: 'chat' as const, label: 'Chat', count: sessions.length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2.5 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            style={{
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-tertiary)',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
                background: activeTab === tab.key ? 'var(--accent-subtle)' : 'var(--glass)',
                color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-tertiary)',
              }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {/* Info Tab */}
        {activeTab === 'info' && (
          <AnalysisPanel
            analysis={analysis}
            isAnalyzing={isAnalyzing}
            analysisStep={analysisStep}
            analysisMessage={analysisMessage}
            parseBatchProgress={parseBatchProgress}
            streamingParsedContent={streamingParsedContent}
            avgBatchTime={avgBatchTime}
            onReAnalyze={onReAnalyze}
          />
        )}

        {/* Notes Tab */}
        {activeTab === 'notes' && (
          <div className="flex flex-col h-full overflow-hidden">
            {noteError && (
              <div className="px-4 py-2 text-xs border-b" style={{ background: 'var(--rose-subtle)', borderColor: 'var(--rose)', color: 'var(--rose)' }}>{noteError}</div>
            )}
            {noteView === 'list' ? (
              <NotesList
                notes={notes}
                onSelect={handleSelectNote}
                onNew={handleNewNote}
                onPageClick={onPageChange}
                onNoteClick={onNoteClick}
              />
            ) : (
              <NoteEditor
                note={editingNote || undefined}
                defaultPage={currentPage}
                onSave={handleSaveNote}
                onDelete={editingNote ? handleDeleteNote : undefined}
                onBack={() => { setNoteView('list'); setEditingNote(null); }}
              />
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-full overflow-hidden">
            {sessions.length > 0 && (
              <ChatSessionBar
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelectSession={onSelectSession}
                onDeleteSession={onDeleteSession}
              />
            )}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto px-4 py-2">
                {sessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center" style={{ color: 'var(--text-tertiary)' }}>
                    <div className="text-sm mb-2">No chat sessions yet</div>
                    <div className="text-xs">Start a conversation about this paper</div>
                  </div>
                ) : (
                  <ChatMessages
                    messages={chatMessages}
                    streamingContent={streamingContent}
                    isStreaming={isChatStreaming}
                    lowConfidence={lowConfidence}
                    onExpandContext={onExpandContext}
                  />
                )}
              </div>
              <ChatInput
                onSend={onSendMessage}
                disabled={isChatStreaming}
                pendingQuote={pendingQuote}
                onClearQuote={onClearQuote}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
