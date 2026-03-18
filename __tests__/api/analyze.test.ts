import { POST } from '@/app/api/analyze/route';
import { storage } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  storage: { paperExists: jest.fn(), getMetadata: jest.fn(), saveMetadata: jest.fn(), getPdfPath: jest.fn(), saveParsedContent: jest.fn(), saveAnalysis: jest.fn(), getSettings: jest.fn().mockResolvedValue(null) },
}));
jest.mock('@/lib/pdf-parser', () => ({ parsePdfWithVision: jest.fn() }));
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('POST /api/analyze', () => {
  beforeEach(() => { process.env.AI_API_KEY = 'sk-test'; process.env.AI_BASE_URL = 'https://api.test.com/v1'; process.env.AI_MODEL = 'gpt-4o'; });
  it('returns 404 for non-existent paper', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(false);
    const request = new Request('http://localhost/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paperId: 'non-existent' }) });
    const response = await POST(request);
    expect(response.status).toBe(404);
  });
  it('returns 400 when API key is not configured', async () => {
    delete process.env.AI_API_KEY;
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    const request = new Request('http://localhost/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paperId: 'test-id' }) });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
