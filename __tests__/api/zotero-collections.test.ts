const mockGetSettings = jest.fn();
const mockGetZoteroDbPath = jest.fn();
const mockGetCollections = jest.fn();

jest.mock('@/lib/storage', () => ({
  storage: {
    getSettings: (...args: unknown[]) => mockGetSettings(...args),
  },
}));

jest.mock('@/lib/zotero', () => ({
  getZoteroDbPath: (...args: unknown[]) => mockGetZoteroDbPath(...args),
  getCollections: (...args: unknown[]) => mockGetCollections(...args),
}));

// Mock next/server NextResponse
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

import { GET } from '@/app/api/zotero/collections/route';

describe('GET /api/zotero/collections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSettings.mockResolvedValue(null);
    mockGetZoteroDbPath.mockReturnValue('/fake/zotero.sqlite');
    mockGetCollections.mockReturnValue({
      collections: [{ id: 1, name: 'ML', parentId: null, children: [] }],
      totalPapers: 10,
    });
  });

  it('returns collection tree', async () => {
    const response = await GET();
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.collections).toHaveLength(1);
    expect(data.collections[0].name).toBe('ML');
    expect(data.totalPapers).toBe(10);
  });
});
