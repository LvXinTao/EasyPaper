'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PdfViewer } from '@/components/pdf-viewer';
import { AnalysisPanel } from '@/components/analysis-panel';
import { NotesPanel } from '@/components/notes-panel';
import { ChatMessages } from '@/components/chat-messages';
import { ChatInput } from '@/components/chat-input';
import { EditableTitle } from '@/components/editable-title';
import { ResizableDivider } from '@/components/resizable-divider';
import { usePaper } from '@/hooks/use-paper';
import { useAnalysisPolling } from '@/hooks/use-analysis-polling';
import { ChatSessionBar } from '@/components/chat-session-bar';
import type { PaperAnalysis, ChatMessage, ChatSessionMeta } from '@/types';

export default function PaperDetailPage() {
  const params = useParams();
  const router = useRouter();
  const paperId = params.id as string;
  const { data, loading, error, refetch } = usePaper(paperId);
  const [currentPage, setCurrentPage] = useState(1);
  // SSE streaming state (active during first-trigger analyze)
  const [isSSEStreaming, setIsSSEStreaming] = useState(false);
  const [sseStep, setSSEStep] = useState<string | null>(null);
  const [sseMessage, setSSEMessage] = useState<string | null>(null);
  const [visionStreamContent, setVisionStreamContent] = useState('');
  const [visionProgress, setVisionProgress] = useState<{ batch: number; totalBatches: number; pages: string; elapsed: number } | null>(null);
  const [analysis, setAnalysis] = useState<PaperAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'analysis' | 'notes'>('analysis');

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const [modelName, setModelName] = useState<string>('');
  const [noteCount, setNoteCount] = useState(0);

  // Session state
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showSessionBar, setShowSessionBar] = useState(true);
  const activeSessionIdRef = useRef<string | null>(null);

  useEffect(() => { activeSessionIdRef.current = activeSessionId; }, [activeSessionId]);

  // Analysis polling (auto-starts if status is parsing/analyzing on mount)
  const {
    isPolling, analysisStep: pollingStep, analysisMessage: pollingMessage,
    isStale, completedStatus, startPolling,
  } = useAnalysisPolling(paperId, data?.metadata.status ?? null);

  // When polling detects completion, reload full paper data
  useEffect(() => {
    if (completedStatus) refetch();
  }, [completedStatus, refetch]);

  // Merged state: SSE takes priority when active, polling as fallback
  const effectiveIsAnalyzing = isSSEStreaming || isPolling;
  const effectiveStep = isSSEStreaming ? sseStep : pollingStep;
  const effectiveMessage = isSSEStreaming ? sseMessage : pollingMessage;

  // Resizable panel state — restored from localStorage per paper
  const containerRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState<number | null>(null);
  const [topHeight, setTopHeight] = useState<number | null>(null);

  // Load saved panel ratios from localStorage
  useEffect(() => {
    try {
      const savedLeft = localStorage.getItem(`easypaper-left-${paperId}`);
      const savedTop = localStorage.getItem(`easypaper-top-${paperId}`);
      if (savedLeft) setLeftWidth(parseFloat(savedLeft));
      if (savedTop) setTopHeight(parseFloat(savedTop));
    } catch { /* ignore */ }
  }, [paperId]);

  // Fetch model name for chat header badge
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(s => { if (s.model) setModelName(s.model); })
      .catch(() => {});
  }, []);

  // Fetch note count for tab badge
  useEffect(() => {
    fetch(`/api/paper/${paperId}/notes`)
      .then(r => r.json())
      .then(d => { if (d.notes) setNoteCount(d.notes.length); })
      .catch(() => {});
  }, [paperId]);

  // Fetch sessions on mount and when paper data loads
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`/api/paper/${paperId}/chat-sessions`);
      if (!res.ok) return;
      const result = await res.json();
      setSessions(result.sessions);
      if (result.sessions.length > 0 && !activeSessionIdRef.current) {
        const mostRecent = result.sessions[0];
        setActiveSessionId(mostRecent.id);
        const sessionRes = await fetch(`/api/paper/${paperId}/chat-sessions/${mostRecent.id}`);
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          setChatMessages(sessionData.messages || []);
        }
      }
    } catch { /* ignore */ }
  }, [paperId]);

  useEffect(() => {
    if (data) fetchSessions();
  }, [data, fetchSessions]);

  const handleAnalyze = useCallback(async () => {
    setAnalysisError(null);
    setSSEStep(null);
    setSSEMessage(null);
    setVisionStreamContent('');
    setVisionProgress(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        setAnalysisError(errorData.error?.message || 'Analysis failed');
        return;
      }

      const contentType = response.headers.get('Content-Type') || '';

      // Already running → switch to polling mode
      if (contentType.includes('application/json')) {
        startPolling();
        return;
      }

      // SSE stream → read inline for real-time progress
      setIsSSEStreaming(true);
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
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
              const event = JSON.parse(trimmed.slice(6));
              if (event.done) {
                refetch();
                return;
              }
              if (event.error) {
                setAnalysisError(event.error);
                refetch();
                return;
              }
              if ('step' in event) {
                setSSEStep(event.step);
                setSSEMessage(event.message || null);
              }
              if (event.type === 'vision_stream') {
                setVisionStreamContent(prev => prev + event.content);
              }
              if (event.type === 'vision_progress') {
                setVisionProgress({
                  batch: event.batch, totalBatches: event.totalBatches,
                  pages: event.pages, elapsed: event.elapsed,
                });
              }
              if ('section' in event) {
                setAnalysis(prev => prev || {
                  summary: { content: '' }, contributions: { items: [] },
                  methodology: { content: '' }, experiments: { content: '' },
                  conclusions: { content: '' }, generatedAt: new Date().toISOString(),
                });
              }
            } catch { /* skip malformed */ }
          }
        }
      } finally {
        setIsSSEStreaming(false);
      }
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis failed');
    }
  }, [paperId, refetch, startPolling]);

  const handleRename = useCallback(
    async (newTitle: string) => {
      const response = await fetch(`/api/paper/${paperId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      if (!response.ok) throw new Error('Failed to rename');
      await refetch();
    },
    [paperId, refetch]
  );

  const handleSelectSession = useCallback(async (sessionId: string) => {
    if (sessionId === activeSessionId) return;
    // Don't abort the stream — let it continue in background so the backend
    // finishes processing and saves the AI response to disk.
    setIsChatStreaming(false);
    setStreamingContent('');
    setActiveSessionId(sessionId);
    setChatMessages([]);
    try {
      const res = await fetch(`/api/paper/${paperId}/chat-sessions/${sessionId}`);
      if (res.ok) {
        const sessionData = await res.json();
        setChatMessages(sessionData.messages || []);
      }
    } catch { /* ignore */ }
  }, [paperId, activeSessionId]);

  const handleNewSession = useCallback(async () => {
    // Don't abort the stream — let it finish in background
    setIsChatStreaming(false);
    setStreamingContent('');
    try {
      const res = await fetch(`/api/paper/${paperId}/chat-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) return;
      const newSession = await res.json();
      setSessions(prev => [{ ...newSession, messageCount: 0 }, ...prev]);
      setActiveSessionId(newSession.id);
      setChatMessages([]);
      setStreamingContent('');
    } catch { /* ignore */ }
  }, [paperId]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/paper/${paperId}/chat-sessions/${sessionId}`, { method: 'DELETE' });
      if (!res.ok) return;
      const remaining = sessions.filter(s => s.id !== sessionId);
      setSessions(remaining);
      if (sessionId === activeSessionId) {
        if (remaining.length > 0) {
          handleSelectSession(remaining[0].id);
        } else {
          setActiveSessionId(null);
          setChatMessages([]);
        }
      }
    } catch { /* ignore */ }
  }, [paperId, activeSessionId, sessions, handleSelectSession]);

  const handleSendMessage = useCallback(
    async (message: string) => {
      // Capture the session this message belongs to, so we can guard UI updates
      // if the user switches sessions while the stream is still running.
      const sendingSessionId = activeSessionId;
      setChatMessages((prev) => [...prev, { role: 'user', content: message }]);
      setIsChatStreaming(true);
      setStreamingContent('');

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paperId, sessionId: activeSessionId, message }),
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
                // Only update streaming UI if still on the same session
                if (activeSessionIdRef.current === sendingSessionId) {
                  setStreamingContent(fullResponse);
                  // Restore streaming state if user switched back to this session
                  setIsChatStreaming(true);
                }
              }
              if (data.done) {
                if (activeSessionIdRef.current === sendingSessionId) {
                  setChatMessages((prev) => [
                    ...prev,
                    { role: 'assistant', content: fullResponse },
                  ]);
                  setStreamingContent('');
                }
                if (data.sessionId && !sendingSessionId) {
                  setActiveSessionId(data.sessionId);
                }
                // Always refresh session list (updates title, message count)
                fetchSessions();
              }
            } catch { /* skip malformed */ }
          }
        }
      } catch (error) {
        console.error('Chat error:', error);
      } finally {
        // Only clear streaming state if still on the same session
        if (activeSessionIdRef.current === sendingSessionId) {
          setIsChatStreaming(false);
        }
      }
    },
    [paperId, activeSessionId, fetchSessions]
  );

  // Horizontal divider: save left panel width to localStorage
  const handleLeftWidthChange = useCallback(
    (newWidth: number) => {
      setLeftWidth(newWidth);
      try { localStorage.setItem(`easypaper-left-${paperId}`, String(newWidth)); } catch {}
    },
    [paperId]
  );

  // Vertical divider: save top panel height to localStorage
  const handleTopHeightChange = useCallback(
    (newHeight: number) => {
      setTopHeight(newHeight);
      try { localStorage.setItem(`easypaper-top-${paperId}`, String(newHeight)); } catch {}
    },
    [paperId]
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-44px)]" style={{ background: 'var(--bg)' }}>
        <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full mb-3" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading paper...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-44px)]" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <div className="font-medium" style={{ color: 'var(--rose)' }}>{error || 'Paper not found'}</div>
          <a href="/" className="text-sm hover:underline mt-2 inline-block" style={{ color: 'var(--accent)' }}>Back to home</a>
        </div>
      </div>
    );
  }

  const displayAnalysis = data.analysis || analysis;
  const needsAnalysis = (data.metadata.status === 'pending' || data.metadata.status === 'error') && !effectiveIsAnalyzing && !displayAnalysis;
  const statusLabel = data.metadata.status === 'analyzed' ? '✓ Analyzed' : data.metadata.status === 'error' ? 'Error' : data.metadata.status;
  const statusColor = data.metadata.status === 'analyzed' ? 'var(--green)' : data.metadata.status === 'error' ? 'var(--rose)' : 'var(--amber)';
  const statusBg = data.metadata.status === 'analyzed' ? 'var(--green-subtle)' : data.metadata.status === 'error' ? 'var(--rose-subtle)' : 'var(--amber-subtle)';

  // Compute initial sizes from container if not set (guard for SSR)
  const safeWindowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const safeWindowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const containerWidth = containerRef.current?.clientWidth ?? safeWindowWidth;
  const rightPanelHeight = rightPanelRef.current?.clientHeight ?? (safeWindowHeight - 44 - 48);
  const effectiveLeftWidth = leftWidth ?? containerWidth * 0.55;
  const effectiveTopHeight = topHeight ?? rightPanelHeight * 0.55;

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      {/* Top Bar */}
      <div
        className="flex items-center gap-3 px-4"
        style={{
          height: '48px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {/* Back button */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center justify-center rounded-lg transition-colors"
          style={{
            width: '32px', height: '32px',
            background: 'var(--glass)', border: '1px solid var(--glass-border)',
            color: 'var(--text-secondary)',
          }}
          aria-label="Back to home"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Paper title (editable) */}
        <div className="flex-1 min-w-0">
          <EditableTitle value={data.metadata.title} onSave={handleRename} />
        </div>

        {/* Status badge */}
        <span
          className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ background: statusBg, color: statusColor }}
        >
          {statusLabel}
        </span>

        {/* Re-analyze button */}
        {(data.metadata.status === 'analyzed' || needsAnalysis) && (
          <button
            onClick={handleAnalyze}
            disabled={effectiveIsAnalyzing}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
            style={{
              background: needsAnalysis ? 'var(--text-primary)' : 'var(--glass)',
              color: needsAnalysis ? 'var(--bg)' : 'var(--text-secondary)',
              border: needsAnalysis ? 'none' : '1px solid var(--glass-border)',
              opacity: effectiveIsAnalyzing ? 0.5 : 1,
            }}
          >
            {effectiveIsAnalyzing ? 'Analyzing...' : needsAnalysis ? 'Analyze' : 'Re-analyze'}
          </button>
        )}
      </div>

      {/* Analysis error banner */}
      {(analysisError || isStale) && (
        <div className="px-4 py-2.5 text-sm flex items-center gap-2" style={{ background: 'var(--rose-subtle)', color: 'var(--rose)', borderBottom: '1px solid var(--border)' }}>
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1">
            <strong>{isStale ? 'Analysis stuck:' : 'Analysis failed:'}</strong>{' '}
            {isStale ? 'Analysis appears to be stuck. Try re-analyzing.' : analysisError}
          </div>
          {isStale && (
            <button
              onClick={() => {
                fetch('/api/analyze', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ paperId, force: true }),
                }).then(() => { startPolling(); });
              }}
              className="px-3 py-1 text-xs font-medium rounded-md flex-shrink-0"
              style={{ background: 'var(--rose)', color: 'var(--bg)' }}
            >
              Re-analyze
            </button>
          )}
        </div>
      )}

      {/* Main content: PDF + Right Panel with resizable divider */}
      <div ref={containerRef} className="flex" style={{ height: (analysisError || isStale) ? 'calc(100vh - 44px - 48px - 37px)' : 'calc(100vh - 44px - 48px)' }}>
        {/* Left: PDF Viewer */}
        <div style={{ width: `${effectiveLeftWidth}px`, minWidth: '300px', flexShrink: 0 }}>
          <PdfViewer
            url={`/api/paper/${paperId}/pdf`}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>

        {/* Horizontal resizable divider */}
        <ResizableDivider
          direction="horizontal"
          onResize={(delta) => {
            const newWidth = Math.max(300, Math.min(effectiveLeftWidth + delta, containerWidth - 280));
            handleLeftWidthChange(newWidth);
          }}
        />

        {/* Right: Split Panel */}
        <div ref={rightPanelRef} className="flex-1 flex flex-col" style={{ minWidth: '280px', overflow: 'hidden' }}>
          {/* Shared card container for Analysis + Chat */}
          <div className="flex-1 flex flex-col overflow-hidden" style={{
            borderRadius: '12px',
            border: '1px solid var(--glass-border)',
            margin: '4px',
          }}>
          {/* Top Zone: Analysis/Notes tabs */}
          <div style={{ height: `${effectiveTopHeight}px`, minHeight: '150px', flexShrink: 0 }} className="flex flex-col overflow-hidden">
            {/* Tab bar */}
            <div className="flex items-center gap-1 px-4" style={{ height: '40px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <button
                onClick={() => setActiveTab('analysis')}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
                style={{
                  background: activeTab === 'analysis' ? 'var(--accent-subtle)' : 'transparent',
                  color: activeTab === 'analysis' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  border: activeTab === 'analysis' ? '1px solid var(--accent)' : '1px solid transparent',
                }}
              >
                Analysis
                {displayAnalysis && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--glass)', color: 'var(--text-tertiary)' }}>
                    {Object.keys(displayAnalysis).filter(k => k !== 'generatedAt').length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
                style={{
                  background: activeTab === 'notes' ? 'var(--accent-subtle)' : 'transparent',
                  color: activeTab === 'notes' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  border: activeTab === 'notes' ? '1px solid var(--accent)' : '1px solid transparent',
                }}
              >
                Notes
                {noteCount > 0 && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--glass)', color: 'var(--text-tertiary)' }}>
                    {noteCount}
                  </span>
                )}
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'analysis' ? (
                <AnalysisPanel
                  analysis={displayAnalysis}
                  isAnalyzing={effectiveIsAnalyzing}
                  analysisStep={effectiveStep}
                  analysisMessage={effectiveMessage}
                  visionStreamContent={visionStreamContent}
                  visionProgress={visionProgress}
                  onReAnalyze={handleAnalyze}
                />
              ) : (
                <NotesPanel
                  paperId={paperId}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                />
              )}
            </div>
          </div>

          {/* Vertical resizable divider */}
          <ResizableDivider
            direction="vertical"
            onResize={(delta) => {
              const maxTop = (rightPanelRef.current?.clientHeight ?? rightPanelHeight) - 120;
              const newHeight = Math.max(150, Math.min(effectiveTopHeight + delta, maxTop));
              handleTopHeightChange(newHeight);
            }}
            barStyle={{
              background: 'linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent), white 25%), var(--accent))',
              opacity: 0.6,
              width: '100%',
              borderRadius: 0,
            }}
          />

          {/* Bottom Zone: AI Chat */}
          <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: '120px' }}>
            {/* Chat header with model badge */}
            <div className="flex items-center justify-between px-4" style={{ height: '36px', borderBottom: sessions.length > 0 && showSessionBar ? 'none' : '1px solid var(--border)', flexShrink: 0 }}>
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent), white 25%))',
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="10" rx="2" />
                    <circle cx="12" cy="5" r="2" />
                    <path d="M12 7v4" />
                    <line x1="8" y1="16" x2="8" y2="16" />
                    <line x1="16" y1="16" x2="16" y2="16" />
                  </svg>
                </div>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>AI Chat</span>
              </div>
              <div className="flex items-center gap-1.5">
                {sessions.length > 0 && (
                  <button
                    onClick={() => setShowSessionBar(prev => !prev)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors"
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-tertiary)',
                      background: 'var(--glass)',
                      border: '1px solid var(--glass-border)',
                    }}
                  >
                    Sessions
                    <span style={{ fontSize: '8px', transform: showSessionBar ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                  </button>
                )}
                <button
                  onClick={handleNewSession}
                  className="flex items-center justify-center rounded-md transition-colors"
                  style={{
                    width: '22px',
                    height: '22px',
                    background: 'var(--glass)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--text-tertiary)',
                    fontSize: '14px',
                    lineHeight: 1,
                  }}
                  title="New session"
                >
                  +
                </button>
                {modelName && (
                  <span
                    className="flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-tertiary)' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green)' }} />
                    {modelName}
                  </span>
                )}
              </div>
            </div>
            {showSessionBar && (
              <ChatSessionBar
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelectSession={handleSelectSession}
                onDeleteSession={handleDeleteSession}
              />
            )}

            {/* Messages */}
            <div className="flex-1 overflow-auto px-4">
              <ChatMessages
                messages={chatMessages}
                streamingContent={streamingContent}
                isStreaming={isChatStreaming}
              />
            </div>

            {/* Input */}
            <div className="px-4 pb-3 pt-2">
              <ChatInput onSend={handleSendMessage} disabled={isChatStreaming} />
            </div>
          </div>
          </div>{/* end shared card container */}
        </div>
      </div>
    </div>
  );
}
