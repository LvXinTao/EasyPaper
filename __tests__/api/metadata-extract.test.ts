import { POST } from '@/app/api/paper/[id]/metadata/extract/route';
import { storage } from '@/lib/storage';
import { extractPdfMetadata } from '@/lib/pdf-metadata';

jest.mock('@/lib/storage', () => ({
  storage: {
    paperExists: jest.fn(),
    getMetadata: jest.fn(),
    saveMetadata: jest.fn(),
    updateMetadata: jest.fn(),
    getPdfPath: jest.fn().mockReturnValue('/test/paper/original.pdf'),
  },
}));

jest.mock('@/lib/pdf-metadata', () => ({
  extractPdfMetadata: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/paper/[id]/metadata/extract', () => {
  const context = { params: Promise.resolve({ id: 'test-paper-id' }) };

  it('re-extracts metadata preserving manual edits', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getMetadata as jest.Mock).mockResolvedValue({
      id: 'test-paper-id',
      title: 'Original Title',
      filename: 'test.pdf',
      pages: 10,
      createdAt: '2024-01-01',
      status: 'analyzed',
      pdfMetadata: {
        title: 'Old Title',
        authors: ['Old Author'],
        date: '2024-01-01',
        fieldSources: {
          title: 'manual',
          authors: 'pdf-properties',
          date: 'pdf-properties',
        },
        extractedAt: '2024-01-01T00:00:00.000Z',
      },
    });
    (extractPdfMetadata as jest.Mock).mockResolvedValue({
      title: 'New Extracted Title',
      authors: ['New Author'],
      date: '2024-06-01',
      fieldSources: {
        title: 'pdf-properties',
        authors: 'pdf-properties',
        date: 'pdf-properties',
      },
      extractedAt: new Date().toISOString(),
      pageCount: 10,
    });

    const request = new Request('http://localhost/api/paper/test-paper-id/metadata/extract', {
      method: 'POST',
    });
    const response = await POST(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pdfMetadata.title).toBe('Old Title');
    expect(data.pdfMetadata.authors).toEqual(['New Author']);
    expect(data.pdfMetadata.date).toBe('2024-06-01');
    expect(data.pdfMetadata.fieldSources.title).toBe('manual');
    expect(data.pdfMetadata.fieldSources.authors).toBe('pdf-properties');
  });

  it('returns 404 for non-existent paper', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(false);

    const request = new Request('http://localhost/api/paper/nonexistent/metadata/extract', {
      method: 'POST',
    });
    const response = await POST(request, context);

    expect(response.status).toBe(404);
  });
});
