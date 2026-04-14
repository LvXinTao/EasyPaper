import '@testing-library/jest-dom';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PreviewPanel } from '@/components/preview-panel';
import { useAnalysisPolling } from '@/hooks/use-analysis-polling';
import type { PaperListItem } from '@/types';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Mock useAnalysisPolling
const mockPollingReturn = {
  isPolling: false,
  analysisStep: null,
  analysisMessage: null,
  isStale: false,
  completedStatus: null,
  startPolling: jest.fn(),
  stopPolling: jest.fn(),
};
jest.mock('@/hooks/use-analysis-polling', () => ({
  useAnalysisPolling: jest.fn(() => mockPollingReturn),
}));

// Mock markdown-content
jest.mock('@/components/markdown-content', () => ({
  MarkdownContent: ({ content }: { content: string }) => <div data-testid="markdown">{content}</div>,
}));

// Mock metadata-card
jest.mock('@/components/paper/metadata-card', () => ({
  MetadataCard: () => <div data-testid="metadata-card" />,
}));

// Suppress fetch calls from useLayoutEffect
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ analysis: null, metadata: {}, chatHistory: { messages: [] }, sessions: [] }),
  })
) as jest.Mock;

const basePaper: PaperListItem = {
  id: 'paper-1',
  title: 'Test Paper',
  createdAt: '2024-01-01T00:00:00Z',
  status: 'pending',
};

describe('PreviewPanel — Analyze', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAnalysisPolling as jest.Mock).mockReturnValue({ ...mockPollingReturn });
  });

  it('shows Analyze button for pending paper when onAnalyze is provided', async () => {
    const onAnalyze = jest.fn();
    await act(async () => {
      render(<PreviewPanel paper={basePaper} onAnalyze={onAnalyze} />);
    });
    const btn = screen.getByText('Analyze');
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onAnalyze).toHaveBeenCalledWith('paper-1');
  });

  it('hides Analyze button when status is analyzed', async () => {
    await act(async () => {
      render(<PreviewPanel paper={{ ...basePaper, status: 'analyzed' }} onAnalyze={jest.fn()} />);
    });
    expect(screen.queryByText('Analyze')).not.toBeInTheDocument();
  });

  it('hides Analyze button when status is queued', async () => {
    await act(async () => {
      render(<PreviewPanel paper={{ ...basePaper, status: 'queued' }} onAnalyze={jest.fn()} />);
    });
    expect(screen.queryByText('Analyze')).not.toBeInTheDocument();
  });

  it('hides Analyze button when status is parsing', async () => {
    await act(async () => {
      render(<PreviewPanel paper={{ ...basePaper, status: 'parsing' }} onAnalyze={jest.fn()} />);
    });
    expect(screen.queryByText('Analyze')).not.toBeInTheDocument();
  });

  it('shows polling progress text when isPolling is true', async () => {
    (useAnalysisPolling as jest.Mock).mockReturnValue({
      ...mockPollingReturn,
      isPolling: true,
      analysisStep: 'parsing',
    });
    await act(async () => {
      render(<PreviewPanel paper={{ ...basePaper, status: 'parsing' }} onAnalyze={jest.fn()} />);
    });
    expect(screen.getByText('Parsing...')).toBeInTheDocument();
    expect(screen.queryByText('Analyze')).not.toBeInTheDocument();
  });

  it('shows "Queued..." when polling with no step', async () => {
    (useAnalysisPolling as jest.Mock).mockReturnValue({
      ...mockPollingReturn,
      isPolling: true,
      analysisStep: null,
    });
    await act(async () => {
      render(<PreviewPanel paper={{ ...basePaper, status: 'queued' }} onAnalyze={jest.fn()} />);
    });
    expect(screen.getByText('Queued...')).toBeInTheDocument();
  });

  it('shows "Analysis stuck" when stale', async () => {
    (useAnalysisPolling as jest.Mock).mockReturnValue({
      ...mockPollingReturn,
      isPolling: true,
      isStale: true,
    });
    await act(async () => {
      render(<PreviewPanel paper={{ ...basePaper, status: 'analyzing' }} onAnalyze={jest.fn()} />);
    });
    expect(screen.getByText('Analysis stuck')).toBeInTheDocument();
  });

  it('calls onAnalysisComplete when completedStatus changes', async () => {
    const onAnalysisComplete = jest.fn();
    (useAnalysisPolling as jest.Mock).mockReturnValue({
      ...mockPollingReturn,
      completedStatus: 'analyzed',
    });
    await act(async () => {
      render(
        <PreviewPanel
          paper={{ ...basePaper, status: 'analyzed' }}
          onAnalyze={jest.fn()}
          onAnalysisComplete={onAnalysisComplete}
        />
      );
    });
    expect(onAnalysisComplete).toHaveBeenCalled();
  });

  it('does not show Analyze button when onAnalyze is not provided', async () => {
    await act(async () => {
      render(<PreviewPanel paper={basePaper} />);
    });
    expect(screen.queryByText('Analyze')).not.toBeInTheDocument();
  });

  it('resets polling display when switching from analyzing to pending paper', async () => {
    (useAnalysisPolling as jest.Mock).mockReturnValue({
      ...mockPollingReturn,
      isPolling: true,
      analysisStep: 'parsing',
    });
    const { unmount } = await act(async () => {
      return render(<PreviewPanel paper={{ ...basePaper, status: 'parsing' }} onAnalyze={jest.fn()} />);
    });
    expect(screen.getByText('Parsing...')).toBeInTheDocument();

    // Simulate paper switch: parent uses key={paper.id} so PreviewPanel remounts
    unmount();
    (useAnalysisPolling as jest.Mock).mockReturnValue({ ...mockPollingReturn });
    await act(async () => {
      render(<PreviewPanel paper={{ ...basePaper, id: 'paper-2', status: 'pending' }} onAnalyze={jest.fn()} />);
    });
    expect(screen.queryByText('Parsing...')).not.toBeInTheDocument();
    expect(screen.getByText('Analyze')).toBeInTheDocument();
  });
});
