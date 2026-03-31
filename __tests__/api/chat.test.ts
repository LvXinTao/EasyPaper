import { POST } from '@/app/api/chat/route';
import { storage } from '@/lib/storage';
import type { TextSelection } from '@/types';

jest.mock('@/lib/storage', () => ({
  storage: {
    paperExists: jest.fn(),
    getParsedContent: jest.fn(),
    getChatSession: jest.fn(),
    saveChatSession: jest.fn(),
    createChatSession: jest.fn().mockResolvedValue({
      id: 'test-session',
      title: 'New Chat',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      messages: [],
    }),
    getSettings: jest.fn().mockResolvedValue(null),
    getPromptSettings: jest.fn().mockResolvedValue(null),
    getEmbeddings: jest.fn().mockResolvedValue(null),
    getAnalysis: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('@/lib/ai-client', () => ({
  createAIClient: jest.fn(),
}));

jest.mock('@/lib/retrieval', () => ({
  search: jest.fn().mockResolvedValue([]),
  buildRAGContext: jest.fn().mockReturnValue(''),
  ensureQuoteIncluded: jest.fn().mockReturnValue([]),
  LOW_CONFIDENCE_THRESHOLD: 0.3,
}));

jest.mock('@/lib/embedding', () => ({
  getEmbeddingConfig: jest.fn().mockResolvedValue({
    embeddingModel: 'text-embedding-3-small',
    baseUrl: 'https://api.test.com/v1',
    apiKey: 'sk-test',
  }),
  triggerEmbeddingGeneration: jest.fn().mockResolvedValue(undefined),
}));

describe('POST /api/chat', () => {
  beforeEach(() => {
    process.env.AI_API_KEY = 'sk-test';
    process.env.AI_BASE_URL = 'https://api.test.com/v1';
    process.env.AI_MODEL = 'gpt-4o';
  });

  it('returns 404 for non-existent paper', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(false);
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperId: 'non-existent', message: 'hello' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it('returns 400 when message is missing', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperId: 'test-id' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 404 when sessionId is provided but session not found', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getChatSession as jest.Mock).mockResolvedValue(null);
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperId: 'test-id', sessionId: 'session_nonexistent', message: 'hello' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(404);
  });
});

describe('POST /api/chat with quote', () => {
  beforeEach(() => {
    process.env.AI_API_KEY = 'sk-test';
    process.env.AI_BASE_URL = 'https://api.test.com/v1';
    process.env.AI_MODEL = 'gpt-4o';
    jest.clearAllMocks();
  });

  it('accepts quote parameter in request', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.createChatSession as jest.Mock).mockResolvedValue({
      id: 'test-session',
      title: 'New Chat',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      messages: [],
    });
    (storage.getParsedContent as jest.Mock).mockResolvedValue('Test paper content');

    // Import the mock to verify it's set up
    const { createAIClient } = await import('@/lib/ai-client');
    const mockStreamComplete = jest.fn().mockImplementation(async function* () {
      yield 'test response';
    });
    (createAIClient as jest.Mock).mockReturnValue({
      streamComplete: mockStreamComplete,
    });

    const quote: TextSelection = {
      text: 'Test quote text',
      rects: [{ left: 10, top: 20, width: 30, height: 5 }],
      page: 1,
    };

    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperId: 'test-id', message: 'What does this mean?', quote }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });
});
