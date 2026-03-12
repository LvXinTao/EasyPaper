import { GET, DELETE } from '@/app/api/paper/[id]/route';
import { storage } from '@/lib/storage';
jest.mock('@/lib/storage', () => ({ storage: { paperExists: jest.fn(), getMetadata: jest.fn(), getAnalysis: jest.fn(), getParsedContent: jest.fn(), getChatHistory: jest.fn(), deletePaper: jest.fn() } }));

const params = { id: 'test-123' };

describe('GET /api/paper/[id]', () => {
  it('returns paper data including chat history', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getMetadata as jest.Mock).mockResolvedValue({ id: 'test-123', title: 'Test', filename: 'test.pdf', pages: 5, createdAt: '2025-03-11', status: 'analyzed' });
    (storage.getAnalysis as jest.Mock).mockResolvedValue({ summary: {} });
    (storage.getParsedContent as jest.Mock).mockResolvedValue('# Content');
    (storage.getChatHistory as jest.Mock).mockResolvedValue({ messages: [] });
    const request = new Request('http://localhost/api/paper/test-123');
    const response = await GET(request, { params: Promise.resolve(params) });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.metadata.id).toBe('test-123');
    expect(data.chatHistory).toEqual({ messages: [] });
  });
  it('returns 404 for non-existent paper', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(false);
    const request = new Request('http://localhost/api/paper/missing');
    const response = await GET(request, { params: Promise.resolve({ id: 'missing' }) });
    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/paper/[id]', () => {
  it('deletes a paper', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    const request = new Request('http://localhost/api/paper/test-123', { method: 'DELETE' });
    const response = await DELETE(request, { params: Promise.resolve(params) });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
