import { GET } from '@/app/api/paper/[id]/status/route';
import { storage } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  storage: {
    paperExists: jest.fn(),
    getMetadata: jest.fn(),
  },
}));

const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

describe('GET /api/paper/[id]/status', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 for non-existent paper', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(false);
    const request = new Request('http://localhost/api/paper/missing/status');
    const response = await GET(request, makeParams('missing'));
    expect(response.status).toBe(404);
  });

  it('returns status and analysisProgress when analyzing', async () => {
    const progress = { step: 'analyzing', message: 'Analyzing with AI...', updatedAt: '2026-03-19T10:00:00Z' };
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getMetadata as jest.Mock).mockResolvedValue({
      id: 'test-1', title: 'Test', filename: 'test.pdf', pages: 5,
      createdAt: '2026-03-19', status: 'analyzing', analysisProgress: progress,
    });
    const request = new Request('http://localhost/api/paper/test-1/status');
    const response = await GET(request, makeParams('test-1'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.status).toBe('analyzing');
    expect(data.analysisProgress).toEqual(progress);
  });

  it('returns null analysisProgress when not analyzing', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getMetadata as jest.Mock).mockResolvedValue({
      id: 'test-2', title: 'Test', filename: 'test.pdf', pages: 5,
      createdAt: '2026-03-19', status: 'analyzed',
    });
    const request = new Request('http://localhost/api/paper/test-2/status');
    const response = await GET(request, makeParams('test-2'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.status).toBe('analyzed');
    expect(data.analysisProgress).toBeNull();
  });
});
