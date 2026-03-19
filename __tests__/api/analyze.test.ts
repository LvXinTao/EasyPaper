import { POST } from '@/app/api/analyze/route';
import { storage } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  storage: {
    paperExists: jest.fn(),
    getMetadata: jest.fn(),
    saveMetadata: jest.fn(),
    updateMetadata: jest.fn(),
    getPdfPath: jest.fn(),
    getParsedContent: jest.fn(),
    saveParsedContent: jest.fn(),
    saveAnalysis: jest.fn(),
    getSettings: jest.fn().mockResolvedValue(null),
    getPromptSettings: jest.fn().mockResolvedValue(null),
  },
}));
jest.mock('@/lib/pdf-parser', () => ({ parsePdfWithVision: jest.fn() }));
const mockFetch = jest.fn();
global.fetch = mockFetch;

const makeRequest = (body: Record<string, unknown>) =>
  new Request('http://localhost/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/analyze', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AI_API_KEY = 'sk-test';
    process.env.AI_BASE_URL = 'https://api.test.com/v1';
    process.env.AI_MODEL = 'gpt-4o';
    process.env.AI_VISION_MODEL = 'gpt-4o';
  });

  it('returns 404 for non-existent paper', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(false);
    const response = await POST(makeRequest({ paperId: 'non-existent' }));
    expect(response.status).toBe(404);
  });

  it('returns 400 when API key is not configured', async () => {
    delete process.env.AI_API_KEY;
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    const response = await POST(makeRequest({ paperId: 'test-id' }));
    expect(response.status).toBe(400);
  });

  it('returns already_running when analysis is in progress and fresh', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getMetadata as jest.Mock).mockResolvedValue({
      id: 'test-id', status: 'analyzing',
      analysisProgress: {
        step: 'analyzing',
        message: 'Analyzing...',
        updatedAt: new Date().toISOString(), // fresh
      },
    });

    const response = await POST(makeRequest({ paperId: 'test-id' }));
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('already_running');
    expect(response.headers.get('Content-Type')).toContain('application/json');
  });

  it('allows restart when force is true even if analysis is running', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getMetadata as jest.Mock).mockResolvedValue({
      id: 'test-id', status: 'analyzing',
      analysisProgress: {
        step: 'analyzing',
        message: 'Analyzing...',
        updatedAt: new Date().toISOString(),
      },
    });
    (storage.saveMetadata as jest.Mock).mockResolvedValue(undefined);

    const response = await POST(makeRequest({ paperId: 'test-id', force: true }));
    // Should return SSE stream, not already_running
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    // Verify it reset the metadata
    expect(storage.saveMetadata).toHaveBeenCalledWith('test-id', expect.objectContaining({ status: 'pending' }));
  });

  it('allows restart when analysis progress is stale (>10 min)', async () => {
    const staleDate = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getMetadata as jest.Mock).mockResolvedValue({
      id: 'test-id', status: 'analyzing',
      analysisProgress: {
        step: 'analyzing',
        message: 'Analyzing...',
        updatedAt: staleDate,
      },
    });
    (storage.saveMetadata as jest.Mock).mockResolvedValue(undefined);

    const response = await POST(makeRequest({ paperId: 'test-id' }));
    // Should return SSE stream, not already_running
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });
});
