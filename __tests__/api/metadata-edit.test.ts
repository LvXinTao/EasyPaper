import { PUT } from '@/app/api/paper/[id]/metadata/route';
import { storage } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  storage: {
    paperExists: jest.fn(),
    getMetadata: jest.fn(),
    updateMetadata: jest.fn(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PUT /api/paper/[id]/metadata', () => {
  const context = { params: Promise.resolve({ id: 'test-paper-id' }) };

  it('updates metadata fields and marks them as manual', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getMetadata as jest.Mock).mockResolvedValue({
      id: 'test-paper-id',
      title: 'Original',
      filename: 'test.pdf',
      pages: 10,
      createdAt: '2024-01-01',
      status: 'analyzed',
      pdfMetadata: {
        title: 'Old Title',
        authors: ['Old Author'],
        fieldSources: {
          title: 'pdf-properties',
          authors: 'pdf-properties',
        },
        extractedAt: '2024-01-01T00:00:00.000Z',
      },
    });
    (storage.updateMetadata as jest.Mock).mockImplementation(async (_id, updates) => {
      return { ...updates };
    });

    const request = new Request('http://localhost/api/paper/test-paper-id/metadata', {
      method: 'PUT',
      body: JSON.stringify({
        title: 'New Manual Title',
        authors: ['Manual Author'],
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await PUT(request, context);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pdfMetadata.title).toBe('New Manual Title');
    expect(data.pdfMetadata.authors).toEqual(['Manual Author']);
    expect(data.pdfMetadata.fieldSources.title).toBe('manual');
    expect(data.pdfMetadata.fieldSources.authors).toBe('manual');
  });

  it('returns 404 for non-existent paper', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(false);

    const request = new Request('http://localhost/api/paper/nonexistent/metadata', {
      method: 'PUT',
      body: JSON.stringify({ title: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await PUT(request, context);

    expect(response.status).toBe(404);
  });

  it('validates title is not empty', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);

    const request = new Request('http://localhost/api/paper/test-paper-id/metadata', {
      method: 'PUT',
      body: JSON.stringify({ title: '' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await PUT(request, context);

    expect(response.status).toBe(400);
  });
});
