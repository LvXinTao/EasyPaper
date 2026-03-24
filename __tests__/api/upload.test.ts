import { POST } from '@/app/api/upload/route';

// Mock File class for Node.js test environment
class MockFile {
  content: Buffer;
  name: string;
  type: string;

  constructor(content: string | Buffer, name: string, options?: { type?: string }) {
    this.content = Buffer.isBuffer(content) ? content : Buffer.from(content);
    this.name = name;
    this.type = options?.type || '';
  }

  get size(): number {
    return this.content.length;
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    const buffer = this.content.buffer.slice(
      this.content.byteOffset,
      this.content.byteOffset + this.content.byteLength
    ) as ArrayBuffer;
    return Promise.resolve(buffer);
  }
}

// Set up global File if not available (Node.js < 20)
if (typeof globalThis.File === 'undefined') {
  // @ts-expect-error Mocking File for Node.js
  globalThis.File = MockFile;
}

jest.mock('@/lib/storage', () => ({
  storage: { createPaperDir: jest.fn(), savePdf: jest.fn(), saveMetadata: jest.fn() },
}));
jest.mock('uuid', () => ({ v4: () => 'test-uuid-123' }));

// Helper to create a mock request with formData support (Node 18 compatibility)
function createMockRequest(formData: FormData): Request {
  return {
    formData: async () => formData,
  } as Request;
}

describe('POST /api/upload', () => {
  it('uploads a PDF and returns paper ID', async () => {
    const file = new File(['fake pdf content'], 'test.pdf', { type: 'application/pdf' });
    const formData = new FormData();
    formData.append('file', file);
    const request = createMockRequest(formData);
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(201);
    expect(data.id).toBe('test-uuid-123');
    expect(data.status).toBe('pending');
  });
  it('rejects non-PDF files', async () => {
    const file = new File(['not a pdf'], 'test.txt', { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', file);
    const request = createMockRequest(formData);
    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe('INVALID_FILE_TYPE');
  });
  it('rejects missing file', async () => {
    const formData = new FormData();
    const request = createMockRequest(formData);
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});