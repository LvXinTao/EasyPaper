import { PATCH } from '@/app/api/paper/[id]/route';
import { storage } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  storage: {
    paperExists: jest.fn(),
    updateMetadata: jest.fn(),
  },
}));

describe('PATCH /api/paper/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates paper title', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.updateMetadata as jest.Mock).mockResolvedValue({
      id: 'test-123', title: 'New Title', filename: 'test.pdf',
      pages: 5, createdAt: '2025-03-11', status: 'analyzed',
    });
    const request = new Request('http://localhost/api/paper/test-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Title' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-123' }) });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.metadata.title).toBe('New Title');
    expect(storage.updateMetadata).toHaveBeenCalledWith('test-123', { title: 'New Title' });
  });

  it('updates paper folderId', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.updateMetadata as jest.Mock).mockResolvedValue({
      id: 'test-123', title: 'Test', filename: 'test.pdf',
      pages: 5, createdAt: '2025-03-11', status: 'analyzed', folderId: 'f_abc',
    });
    const request = new Request('http://localhost/api/paper/test-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId: 'f_abc' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-123' }) });
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(storage.updateMetadata).toHaveBeenCalledWith('test-123', { folderId: 'f_abc' });
  });

  it('rejects empty title', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    const request = new Request('http://localhost/api/paper/test-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '   ' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-123' }) });
    expect(response.status).toBe(400);
  });

  it('rejects title over 200 characters', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    const request = new Request('http://localhost/api/paper/test-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'a'.repeat(201) }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-123' }) });
    expect(response.status).toBe(400);
  });

  it('returns 404 for non-existent paper', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(false);
    const request = new Request('http://localhost/api/paper/missing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nope' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'missing' }) });
    expect(response.status).toBe(404);
  });

  it('rejects request with no valid fields', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    const request = new Request('http://localhost/api/paper/test-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-123' }) });
    expect(response.status).toBe(400);
  });

  it('rejects non-string folderId', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    const request = new Request('http://localhost/api/paper/test-123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderId: 42 }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-123' }) });
    expect(response.status).toBe(400);
  });
});
