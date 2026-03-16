import { GET, POST, PUT, DELETE } from '@/app/api/paper/[id]/notes/route';
import { storage } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  storage: {
    paperExists: jest.fn(),
    getNotes: jest.fn(),
    saveNotes: jest.fn(),
  },
}));

const makeContext = (id: string) => ({ params: Promise.resolve({ id }) });

describe('GET /api/paper/[id]/notes', () => {
  it('returns notes array', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    const notes = [{ id: 'n1', title: 'Note 1', content: 'text', tags: [], createdAt: '', updatedAt: '' }];
    (storage.getNotes as jest.Mock).mockResolvedValue(notes);
    const request = new Request('http://localhost/api/paper/p1/notes');
    const response = await GET(request, makeContext('p1'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data).toEqual(notes);
  });

  it('returns 404 for non-existent paper', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(false);
    const request = new Request('http://localhost/api/paper/missing/notes');
    const response = await GET(request, makeContext('missing'));
    expect(response.status).toBe(404);
  });
});

describe('POST /api/paper/[id]/notes', () => {
  it('creates a new note with server-generated fields', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getNotes as jest.Mock).mockResolvedValue([]);
    (storage.saveNotes as jest.Mock).mockResolvedValue(undefined);
    const request = new Request('http://localhost/api/paper/p1/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New Note', content: '# Hi', tags: ['important'], page: 5 }),
    });
    const response = await POST(request, makeContext('p1'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.title).toBe('New Note');
    expect(data.content).toBe('# Hi');
    expect(data.tags).toEqual(['important']);
    expect(data.page).toBe(5);
    expect(data.id).toBeDefined();
    expect(data.createdAt).toBeDefined();
    expect(data.updatedAt).toBeDefined();
    expect(storage.saveNotes).toHaveBeenCalledWith('p1', [data]);
  });
});

describe('PUT /api/paper/[id]/notes', () => {
  it('updates an existing note preserving createdAt', async () => {
    const existing = {
      id: 'n1', title: 'Old', content: 'old', tags: [] as string[],
      createdAt: '2026-03-16T10:00:00Z', updatedAt: '2026-03-16T10:00:00Z',
    };
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getNotes as jest.Mock).mockResolvedValue([existing]);
    (storage.saveNotes as jest.Mock).mockResolvedValue(undefined);
    const request = new Request('http://localhost/api/paper/p1/notes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'n1', title: 'Updated', content: 'new', tags: ['idea'] }),
    });
    const response = await PUT(request, makeContext('p1'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.title).toBe('Updated');
    expect(data.createdAt).toBe('2026-03-16T10:00:00Z');
    expect(data.updatedAt).not.toBe('2026-03-16T10:00:00Z');
  });

  it('returns 404 when note id not found', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getNotes as jest.Mock).mockResolvedValue([]);
    const request = new Request('http://localhost/api/paper/p1/notes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'nonexistent', title: 'X', content: '', tags: [] }),
    });
    const response = await PUT(request, makeContext('p1'));
    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/paper/[id]/notes', () => {
  it('deletes a note by id', async () => {
    const existing = [
      { id: 'n1', title: 'A', content: '', tags: [], createdAt: '', updatedAt: '' },
      { id: 'n2', title: 'B', content: '', tags: [], createdAt: '', updatedAt: '' },
    ];
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getNotes as jest.Mock).mockResolvedValue(existing);
    (storage.saveNotes as jest.Mock).mockResolvedValue(undefined);
    const request = new Request('http://localhost/api/paper/p1/notes?noteId=n1', { method: 'DELETE' });
    const response = await DELETE(request, makeContext('p1'));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(storage.saveNotes).toHaveBeenCalledWith('p1', [existing[1]]);
  });

  it('returns 404 when noteId not found', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getNotes as jest.Mock).mockResolvedValue([]);
    const request = new Request('http://localhost/api/paper/p1/notes?noteId=missing', { method: 'DELETE' });
    const response = await DELETE(request, makeContext('p1'));
    expect(response.status).toBe(404);
  });
});
