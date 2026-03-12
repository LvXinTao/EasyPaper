import { GET } from '@/app/api/papers/route';
import { storage } from '@/lib/storage';
jest.mock('@/lib/storage', () => ({ storage: { listPapers: jest.fn() } }));

describe('GET /api/papers', () => {
  it('returns a list of papers', async () => {
    (storage.listPapers as jest.Mock).mockResolvedValue([{ id: '1', title: 'Paper 1', createdAt: '2025-03-11', status: 'analyzed' }]);
    const request = new Request('http://localhost/api/papers');
    const response = await GET(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.papers).toHaveLength(1);
  });
  it('returns empty array when no papers', async () => {
    (storage.listPapers as jest.Mock).mockResolvedValue([]);
    const request = new Request('http://localhost/api/papers');
    const response = await GET(request);
    const data = await response.json();
    expect(data.papers).toEqual([]);
  });
});
