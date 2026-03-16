import { GET, POST } from '@/app/api/folders/route';
import { PATCH, DELETE } from '@/app/api/folders/[id]/route';
import { storage } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  storage: {
    getFolders: jest.fn(),
    saveFolders: jest.fn(),
    listPapers: jest.fn(),
    updateMetadata: jest.fn(),
  },
}));

jest.mock('uuid', () => ({ v4: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee' }));

describe('GET /api/folders', () => {
  it('returns folders list', async () => {
    const folders = [{ id: 'f_1', name: 'NLP', parentId: null }];
    (storage.getFolders as jest.Mock).mockResolvedValue(folders);
    const response = await GET();
    const data = await response.json();
    expect(data.folders).toEqual(folders);
  });
});

describe('POST /api/folders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a root folder', async () => {
    (storage.getFolders as jest.Mock).mockResolvedValue([]);
    const request = new Request('http://localhost/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'NLP' }),
    });
    const response = await POST(request);
    const data = await response.json();
    expect(response.status).toBe(201);
    expect(data.folder.name).toBe('NLP');
    expect(data.folder.id).toBe('f_aaaaaaaa');
    expect(data.folder.parentId).toBeNull();
    expect(storage.saveFolders).toHaveBeenCalled();
  });

  it('creates a sub-folder under an existing parent', async () => {
    (storage.getFolders as jest.Mock).mockResolvedValue([{ id: 'f_parent', name: 'NLP', parentId: null }]);
    const request = new Request('http://localhost/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Transformer', parentId: 'f_parent' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.folder.parentId).toBe('f_parent');
  });

  it('rejects empty name', async () => {
    const request = new Request('http://localhost/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('rejects non-existent parentId', async () => {
    (storage.getFolders as jest.Mock).mockResolvedValue([]);
    const request = new Request('http://localhost/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Sub', parentId: 'f_nonexistent' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it('rejects name exceeding 100 characters', async () => {
    const request = new Request('http://localhost/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x'.repeat(101) }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

describe('PATCH /api/folders/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renames a folder', async () => {
    (storage.getFolders as jest.Mock).mockResolvedValue([{ id: 'f_1', name: 'Old', parentId: null }]);
    const request = new Request('http://localhost/api/folders/f_1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'f_1' }) });
    const data = await response.json();
    expect(data.folder.name).toBe('New');
  });

  it('returns 404 for unknown folder', async () => {
    (storage.getFolders as jest.Mock).mockResolvedValue([]);
    const request = new Request('http://localhost/api/folders/f_missing', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    const response = await PATCH(request, { params: Promise.resolve({ id: 'f_missing' }) });
    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/folders/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes a folder and moves papers to parent', async () => {
    (storage.getFolders as jest.Mock).mockResolvedValue([
      { id: 'f_parent', name: 'NLP', parentId: null },
      { id: 'f_child', name: 'Transformer', parentId: 'f_parent' },
    ]);
    (storage.listPapers as jest.Mock).mockResolvedValue([
      { id: 'p1', title: 'Paper', folderId: 'f_child', createdAt: '', status: 'analyzed' },
    ]);
    const request = new Request('http://localhost/api/folders/f_parent', { method: 'DELETE' });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'f_parent' }) });
    expect(response.status).toBe(200);
    expect(storage.updateMetadata).toHaveBeenCalledWith('p1', { folderId: null });
    expect(storage.saveFolders).toHaveBeenCalledWith([]);
  });

  it('returns 404 for unknown folder', async () => {
    (storage.getFolders as jest.Mock).mockResolvedValue([]);
    const request = new Request('http://localhost/api/folders/f_nope', { method: 'DELETE' });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'f_nope' }) });
    expect(response.status).toBe(404);
  });

  it('cascade deletes multi-level descendants', async () => {
    (storage.getFolders as jest.Mock).mockResolvedValue([
      { id: 'f_root', name: 'Root', parentId: null },
      { id: 'f_child', name: 'Child', parentId: 'f_root' },
      { id: 'f_grandchild', name: 'Grandchild', parentId: 'f_child' },
    ]);
    (storage.listPapers as jest.Mock).mockResolvedValue([
      { id: 'p1', title: 'Deep Paper', folderId: 'f_grandchild', createdAt: '', status: 'analyzed' },
    ]);
    const request = new Request('http://localhost/api/folders/f_root', { method: 'DELETE' });
    const response = await DELETE(request, { params: Promise.resolve({ id: 'f_root' }) });
    expect(response.status).toBe(200);
    expect(storage.updateMetadata).toHaveBeenCalledWith('p1', { folderId: null });
    expect(storage.saveFolders).toHaveBeenCalledWith([]);
  });
});
