import { DELETE } from '@/app/api/paper/[id]/chat-sessions/[sessionId]/route';
import { storage } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  storage: {
    paperExists: jest.fn(),
    getChatSession: jest.fn(),
    deleteChatSession: jest.fn(),
  },
}));

function makeContext(id: string, sessionId: string) {
  return { params: Promise.resolve({ id, sessionId }) };
}

describe('DELETE /api/paper/[id]/chat-sessions/[sessionId]', () => {
  it('returns 404 for non-existent paper', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(false);
    const req = new Request('http://localhost/api/paper/test-id/chat-sessions/session_1', { method: 'DELETE' });
    const res = await DELETE(req, makeContext('test-id', 'session_1'));
    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent session', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getChatSession as jest.Mock).mockResolvedValue(null);
    const req = new Request('http://localhost/api/paper/test-id/chat-sessions/session_1', { method: 'DELETE' });
    const res = await DELETE(req, makeContext('test-id', 'session_1'));
    expect(res.status).toBe(404);
  });

  it('deletes session and returns success', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getChatSession as jest.Mock).mockResolvedValue({ id: 'session_1' });
    (storage.deleteChatSession as jest.Mock).mockResolvedValue(undefined);
    const req = new Request('http://localhost/api/paper/test-id/chat-sessions/session_1', { method: 'DELETE' });
    const res = await DELETE(req, makeContext('test-id', 'session_1'));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(storage.deleteChatSession).toHaveBeenCalledWith('test-id', 'session_1');
  });
});
