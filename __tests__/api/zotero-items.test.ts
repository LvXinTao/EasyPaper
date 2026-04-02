const mockGetSettings = jest.fn();
const mockFindPaperByFilename = jest.fn();
const mockGetZoteroDbPath = jest.fn();
const mockGetItems = jest.fn();
const mockGetPdfFileSize = jest.fn();

jest.mock('@/lib/storage', () => ({
  storage: {
    getSettings: (...args: unknown[]) => mockGetSettings(...args),
    findPaperByFilename: (...args: unknown[]) => mockFindPaperByFilename(...args),
  },
}));

jest.mock('@/lib/zotero', () => ({
  getZoteroDbPath: (...args: unknown[]) => mockGetZoteroDbPath(...args),
  getItems: (...args: unknown[]) => mockGetItems(...args),
  getPdfFileSize: (...args: unknown[]) => mockGetPdfFileSize(...args),
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

import { GET } from '@/app/api/zotero/items/route';

function createRequest(url: string): Request {
  return new Request(url);
}

describe('GET /api/zotero/items', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSettings.mockResolvedValue(null);
    mockGetZoteroDbPath.mockReturnValue('/fake/zotero.sqlite');
    mockGetItems.mockReturnValue([
      { key: 'P1', title: 'Paper One', attachmentKey: 'A1', pdfFilename: 'paper1.pdf' },
    ]);
    mockGetPdfFileSize.mockReturnValue(12345);
    mockFindPaperByFilename.mockResolvedValue(null);
  });

  it('returns items for a collection', async () => {
    const request = createRequest('http://localhost/api/zotero/items?collectionId=1');
    const response = await GET(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.items[0].title).toBe('Paper One');
    expect(data.items[0].alreadyImported).toBe(false);
    expect(data.items[0].pdfSize).toBe(12345);
  });

  it('returns all items when no collectionId', async () => {
    const request = createRequest('http://localhost/api/zotero/items');
    const response = await GET(request);
    expect(response.status).toBe(200);
  });
});
