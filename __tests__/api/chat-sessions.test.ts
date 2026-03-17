import { GET, POST } from '@/app/api/paper/[id]/chat-sessions/route';
import { storage } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  storage: {
    paperExists: jest.fn(),
    listChatSessions: jest.fn(),
    createChatSession: jest.fn(),
    saveChatSession: jest.fn(),
  },
}));

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/paper/[id]/chat-sessions', () => {
  it('returns 404 for non-existent paper', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(false);
    const req = new Request('http://localhost/api/paper/test-id/chat-sessions');
    const res = await GET(req, makeContext('test-id'));
    expect(res.status).toBe(404);
  });

  it('returns session list', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.listChatSessions as jest.Mock).mockResolvedValue([
      { id: 'session_1', title: 'Test', createdAt: '2026-01-01', updatedAt: '2026-01-01', messageCount: 3 },
    ]);
    const req = new Request('http://localhost/api/paper/test-id/chat-sessions');
    const res = await GET(req, makeContext('test-id'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].id).toBe('session_1');
  });
});

describe('POST /api/paper/[id]/chat-sessions', () => {
  it('returns 404 for non-existent paper', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(false);
    const req = new Request('http://localhost/api/paper/test-id/chat-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req, makeContext('test-id'));
    expect(res.status).toBe(404);
  });

  it('creates and returns a new session', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    const mockSession = { id: 'session_new', title: 'New Chat', createdAt: '2026-01-01', updatedAt: '2026-01-01', messages: [] };
    (storage.createChatSession as jest.Mock).mockResolvedValue(mockSession);
    const req = new Request('http://localhost/api/paper/test-id/chat-sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req, makeContext('test-id'));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe('session_new');
  });
});
