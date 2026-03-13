/**
 * @jest-environment node
 */
import { GET, POST } from '@/app/api/papers/[id]/annotations/route';
import { PUT, DELETE } from '@/app/api/papers/[id]/annotations/[annotationId]/route';
import { storage } from '@/lib/storage';

jest.mock('uuid', () => ({
  v4: () => 'mock-uuid-1234',
}));

jest.mock('@/lib/storage', () => ({
  storage: {
    getAnnotations: jest.fn(),
    saveAnnotations: jest.fn(),
    getMetadata: jest.fn(),
  },
}));

const mockStorage = storage as jest.Mocked<typeof storage>;

function makeRequest(body?: unknown): Request {
  return new Request('http://localhost/api/papers/test-id/annotations', {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/papers/[id]/annotations', () => {
  it('returns annotations for a paper', async () => {
    (mockStorage.getMetadata as jest.Mock).mockResolvedValue({ id: 'test-id' } as any);
    (mockStorage.getAnnotations as jest.Mock).mockResolvedValue([
      { id: 'a1', page: 1, text: 'hello', color: 'yellow', comment: '', spanRange: { startIdx: 0, endIdx: 4 }, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ]);

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'test-id' }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.annotations).toHaveLength(1);
    expect(data.annotations[0].text).toBe('hello');
  });

  it('returns 404 for nonexistent paper', async () => {
    (mockStorage.getMetadata as jest.Mock).mockResolvedValue(null);

    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'nonexistent' }) });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/papers/[id]/annotations', () => {
  it('creates a new annotation', async () => {
    (mockStorage.getMetadata as jest.Mock).mockResolvedValue({ id: 'test-id' } as any);
    (mockStorage.getAnnotations as jest.Mock).mockResolvedValue([]);
    (mockStorage.saveAnnotations as jest.Mock).mockResolvedValue(undefined);

    const body = {
      page: 1,
      text: 'hello world',
      color: 'yellow',
      comment: 'test comment',
      spanRange: { startIdx: 0, endIdx: 10 },
    };

    const req = new Request('http://localhost/api/papers/test-id/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'test-id' }) });
    const data = await res.json();
    expect(res.status).toBe(201);
    expect(data.annotation.text).toBe('hello world');
    expect(data.annotation.id).toBeDefined();
  });

  it('validates required fields', async () => {
    (mockStorage.getMetadata as jest.Mock).mockResolvedValue({ id: 'test-id' } as any);

    const req = new Request('http://localhost/api/papers/test-id/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: 1 }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'test-id' }) });
    expect(res.status).toBe(400);
  });

  it('validates color value', async () => {
    (mockStorage.getMetadata as jest.Mock).mockResolvedValue({ id: 'test-id' } as any);

    const req = new Request('http://localhost/api/papers/test-id/annotations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: 1, text: 'hi', color: 'red', comment: '', spanRange: { startIdx: 0, endIdx: 1 },
      }),
    });

    const res = await POST(req, { params: Promise.resolve({ id: 'test-id' }) });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/papers/[id]/annotations/[annotationId]', () => {
  it('updates an annotation', async () => {
    (mockStorage.getMetadata as jest.Mock).mockResolvedValue({ id: 'test-id' } as any);
    (mockStorage.getAnnotations as jest.Mock).mockResolvedValue([
      { id: 'a1', page: 1, text: 'hello', color: 'yellow', comment: '', spanRange: { startIdx: 0, endIdx: 4 }, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ]);
    (mockStorage.saveAnnotations as jest.Mock).mockResolvedValue(undefined);

    const req = new Request('http://localhost/api/papers/test-id/annotations/a1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color: 'green', comment: 'updated' }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: 'test-id', annotationId: 'a1' }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.annotation.color).toBe('green');
    expect(data.annotation.comment).toBe('updated');
  });

  it('returns 404 for nonexistent annotation', async () => {
    (mockStorage.getMetadata as jest.Mock).mockResolvedValue({ id: 'test-id' } as any);
    (mockStorage.getAnnotations as jest.Mock).mockResolvedValue([]);

    const req = new Request('http://localhost/api/papers/test-id/annotations/nonexistent', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color: 'green' }),
    });

    const res = await PUT(req, { params: Promise.resolve({ id: 'test-id', annotationId: 'nonexistent' }) });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/papers/[id]/annotations/[annotationId]', () => {
  it('deletes an annotation', async () => {
    (mockStorage.getMetadata as jest.Mock).mockResolvedValue({ id: 'test-id' } as any);
    (mockStorage.getAnnotations as jest.Mock).mockResolvedValue([
      { id: 'a1', page: 1, text: 'hello', color: 'yellow', comment: '', spanRange: { startIdx: 0, endIdx: 4 }, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ]);
    (mockStorage.saveAnnotations as jest.Mock).mockResolvedValue(undefined);

    const req = new Request('http://localhost/api/papers/test-id/annotations/a1', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'test-id', annotationId: 'a1' }) });
    expect(res.status).toBe(200);
  });

  it('returns 404 for nonexistent annotation', async () => {
    (mockStorage.getMetadata as jest.Mock).mockResolvedValue({ id: 'test-id' } as any);
    (mockStorage.getAnnotations as jest.Mock).mockResolvedValue([]);

    const req = new Request('http://localhost/api/papers/test-id/annotations/nonexistent', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'test-id', annotationId: 'nonexistent' }) });
    expect(res.status).toBe(404);
  });
});
