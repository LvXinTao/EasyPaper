const mockGetSettings = jest.fn();
const mockCreatePaperDir = jest.fn();
const mockSavePdf = jest.fn();
const mockSaveMetadata = jest.fn();
const mockGetZoteroDbPath = jest.fn();
const mockResolveZoteroPdfPath = jest.fn();

jest.mock('@/lib/storage', () => ({
  storage: {
    getSettings: (...args: unknown[]) => mockGetSettings(...args),
    createPaperDir: (...args: unknown[]) => mockCreatePaperDir(...args),
    savePdf: (...args: unknown[]) => mockSavePdf(...args),
    saveMetadata: (...args: unknown[]) => mockSaveMetadata(...args),
  },
}));

jest.mock('@/lib/zotero', () => ({
  getZoteroDbPath: (...args: unknown[]) => mockGetZoteroDbPath(...args),
  resolveZoteroPdfPath: (...args: unknown[]) => mockResolveZoteroPdfPath(...args),
}));

jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

jest.mock('uuid', () => ({ v4: () => 'import-uuid-123' }));

import { POST } from '@/app/api/zotero/import/route';
import fs from 'fs/promises';

jest.mock('fs/promises', () => ({
  access: jest.fn(),
  readFile: jest.fn(),
}));

describe('POST /api/zotero/import', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSettings.mockResolvedValue(null);
    mockResolveZoteroPdfPath.mockReturnValue('/fake/Zotero/storage/ATT1/paper.pdf');
    (fs.access as jest.Mock).mockResolvedValue(undefined);
    (fs.readFile as jest.Mock).mockResolvedValue(Buffer.from('fake pdf /Type /Page content'));
    mockCreatePaperDir.mockResolvedValue(undefined);
    mockSavePdf.mockResolvedValue(undefined);
    mockSaveMetadata.mockResolvedValue(undefined);
  });

  it('imports papers successfully', async () => {
    const request = new Request('http://localhost/api/zotero/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ key: 'P1', title: 'Test Paper', attachmentKey: 'ATT1', pdfFilename: 'paper.pdf' }],
      }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.results).toHaveLength(1);
    expect(data.results[0].status).toBe('success');
    expect(data.results[0].paperId).toBe('import-uuid-123');
  });

  it('handles missing PDF gracefully', async () => {
    (fs.access as jest.Mock).mockRejectedValueOnce(new Error('ENOENT'));

    const request = new Request('http://localhost/api/zotero/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{ key: 'P2', title: 'Missing', attachmentKey: 'ATT2', pdfFilename: 'gone.pdf' }],
      }),
    });

    const response = await POST(request);
    const data = await response.json();
    expect(data.results[0].status).toBe('error');
  });
});
