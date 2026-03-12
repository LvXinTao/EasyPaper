import { POST } from '@/app/api/chat/route';
import { storage } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  storage: { paperExists: jest.fn(), getParsedContent: jest.fn(), getChatHistory: jest.fn(), saveChatHistory: jest.fn(), getSettings: jest.fn().mockResolvedValue(null) },
}));
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('POST /api/chat', () => {
  beforeEach(() => { process.env.AI_API_KEY = 'sk-test'; process.env.AI_BASE_URL = 'https://api.test.com/v1'; process.env.AI_MODEL = 'gpt-4o'; });
  it('returns 404 for non-existent paper', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(false);
    const request = new Request('http://localhost/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paperId: 'non-existent', message: 'hello' }) });
    const response = await POST(request);
    expect(response.status).toBe(404);
  });
  it('returns 400 when message is missing', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    const request = new Request('http://localhost/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paperId: 'test-id' }) });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
