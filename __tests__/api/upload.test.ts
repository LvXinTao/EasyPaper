import { POST } from '@/app/api/upload/route';

// Note: File polyfill is now handled globally in jest.setup.ts

jest.mock('@/lib/storage', () => ({
  storage: { createPaperDir: jest.fn(), savePdf: jest.fn(), saveMetadata: jest.fn(), getPdfPath: jest.fn().mockReturnValue('/test/paper/original.pdf') },
}));
jest.mock('uuid', () => ({ v4: () => 'test-uuid-123' }));
jest.mock('@/lib/pdf-metadata', () => ({
  extractPdfMetadata: jest.fn().mockResolvedValue({
    title: 'Test Paper',
    authors: ['Test Author'],
    date: '2024-01-01',
    fieldSources: { title: 'pdf-properties', authors: 'pdf-properties', date: 'pdf-properties' },
    extractedAt: new Date().toISOString(),
    pageCount: 5,
  }),
}));

// Helper to create a mock File object that works in both Node 18 and 20
function createMockFile(content: string, name: string, type: string): File {
  const buffer = Buffer.from(content);
  return {
    name,
    type,
    size: buffer.length,
    arrayBuffer: () => {
      const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      ) as ArrayBuffer;
      return Promise.resolve(arrayBuffer);
    },
  } as File;
}

// Helper to create a mock request with formData support
function createMockRequest(file: File | null): Request {
  return {
    formData: async () => ({
      get: (key: string) => (key === 'file' ? file : null),
    }),
  } as Request;
}

describe('POST /api/upload', () => {
  it('uploads a PDF and returns paper ID', async () => {
    const file = createMockFile('fake pdf content', 'test.pdf', 'application/pdf');
    const request = createMockRequest(file);
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(201);
    expect(data.id).toBe('test-uuid-123');
    expect(data.status).toBe('pending');
  });
  it('rejects non-PDF files', async () => {
    const file = createMockFile('not a pdf', 'test.txt', 'text/plain');
    const request = createMockRequest(file);
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe('INVALID_FILE_TYPE');
  });
  it('rejects missing file', async () => {
    const request = createMockRequest(null);
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
  it('extracts PDF metadata on upload', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { extractPdfMetadata } = require('@/lib/pdf-metadata');

    const file = createMockFile('fake pdf content', 'test.pdf', 'application/pdf');
    const request = createMockRequest(file);
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(extractPdfMetadata).toHaveBeenCalledWith('/test/paper/original.pdf');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { storage } = require('@/lib/storage');
    const savedMetadata = storage.saveMetadata.mock.calls[0][1];
    expect(savedMetadata.pages).toBe(5);
    expect(savedMetadata.pdfMetadata).toBeDefined();
    expect(savedMetadata.pdfMetadata.title).toBe('Test Paper');
  });
});