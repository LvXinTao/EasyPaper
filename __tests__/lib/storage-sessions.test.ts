import { storage } from '@/lib/storage';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('storage - chat sessions', () => {
  let testDir: string;
  let originalDataDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'easypaper-test-'));
    originalDataDir = process.env.DATA_DIR || '';
    process.env.DATA_DIR = testDir;
  });

  afterEach(async () => {
    process.env.DATA_DIR = originalDataDir;
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('createChatSession', () => {
    it('creates a session file with correct structure', async () => {
      await storage.createPaperDir('paper-1');
      const session = await storage.createChatSession('paper-1');
      expect(session.id).toMatch(/^session_\d+_[a-z0-9]{6}$/);
      expect(session.title).toBe('New Chat');
      expect(session.messages).toEqual([]);
      expect(session.createdAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();
    });

    it('creates unique IDs for rapid successive calls', async () => {
      await storage.createPaperDir('paper-1');
      const s1 = await storage.createChatSession('paper-1');
      const s2 = await storage.createChatSession('paper-1');
      expect(s1.id).not.toBe(s2.id);
    });
  });

  describe('getChatSession', () => {
    it('returns full session with messages', async () => {
      await storage.createPaperDir('paper-1');
      const created = await storage.createChatSession('paper-1');
      const loaded = await storage.getChatSession('paper-1', created.id);
      expect(loaded).toEqual(created);
    });

    it('returns null for non-existent session', async () => {
      await storage.createPaperDir('paper-1');
      const loaded = await storage.getChatSession('paper-1', 'session_nonexistent');
      expect(loaded).toBeNull();
    });
  });

  describe('saveChatSession', () => {
    it('persists messages and updates updatedAt', async () => {
      await storage.createPaperDir('paper-1');
      const session = await storage.createChatSession('paper-1');
      const originalUpdatedAt = session.updatedAt;

      await new Promise(r => setTimeout(r, 10));

      session.messages.push({ role: 'user', content: 'hello' });
      await storage.saveChatSession('paper-1', session);

      const loaded = await storage.getChatSession('paper-1', session.id);
      expect(loaded!.messages).toHaveLength(1);
      expect(loaded!.messages[0].content).toBe('hello');
      expect(loaded!.updatedAt).not.toBe(originalUpdatedAt);
    });
  });

  describe('listChatSessions', () => {
    it('returns sessions sorted by updatedAt descending', async () => {
      await storage.createPaperDir('paper-1');
      const s1 = await storage.createChatSession('paper-1');
      await new Promise(r => setTimeout(r, 10));
      const s2 = await storage.createChatSession('paper-1');

      await new Promise(r => setTimeout(r, 10));
      s1.messages.push({ role: 'user', content: 'test' });
      await storage.saveChatSession('paper-1', s1);

      const sessions = await storage.listChatSessions('paper-1');
      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe(s1.id);
      expect(sessions[0].messageCount).toBe(1);
      expect(sessions[1].id).toBe(s2.id);
      expect(sessions[1].messageCount).toBe(0);
    });

    it('returns empty array when no sessions exist', async () => {
      await storage.createPaperDir('paper-1');
      const sessions = await storage.listChatSessions('paper-1');
      expect(sessions).toEqual([]);
    });

    it('does not include message content in metadata', async () => {
      await storage.createPaperDir('paper-1');
      const session = await storage.createChatSession('paper-1');
      session.messages.push({ role: 'user', content: 'secret' });
      await storage.saveChatSession('paper-1', session);

      const sessions = await storage.listChatSessions('paper-1');
      expect((sessions[0] as any).messages).toBeUndefined();
    });
  });

  describe('deleteChatSession', () => {
    it('removes the session file', async () => {
      await storage.createPaperDir('paper-1');
      const session = await storage.createChatSession('paper-1');
      await storage.deleteChatSession('paper-1', session.id);
      const loaded = await storage.getChatSession('paper-1', session.id);
      expect(loaded).toBeNull();
    });
  });

  describe('migrateChatHistory', () => {
    it('migrates old chat-history.json to a session file', async () => {
      await storage.createPaperDir('paper-1');
      const oldHistory = {
        messages: [
          { role: 'user', content: 'What is attention?' },
          { role: 'assistant', content: 'Attention is...' },
        ],
      };
      const historyPath = path.join(testDir, 'papers', 'paper-1', 'chat-history.json');
      await fs.writeFile(historyPath, JSON.stringify(oldHistory));

      await storage.migrateChatHistory('paper-1');

      await expect(fs.stat(historyPath)).rejects.toThrow();

      const sessions = await storage.listChatSessions('paper-1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].title).toBe('What is attention?');
      expect(sessions[0].messageCount).toBe(2);
    });

    it('uses "New Chat" title when no user messages exist', async () => {
      await storage.createPaperDir('paper-1');
      const oldHistory = { messages: [{ role: 'assistant', content: 'Hi!' }] };
      const historyPath = path.join(testDir, 'papers', 'paper-1', 'chat-history.json');
      await fs.writeFile(historyPath, JSON.stringify(oldHistory));

      await storage.migrateChatHistory('paper-1');

      const sessions = await storage.listChatSessions('paper-1');
      expect(sessions[0].title).toBe('New Chat');
    });

    it('is a no-op when no old history exists', async () => {
      await storage.createPaperDir('paper-1');
      await storage.migrateChatHistory('paper-1');
      const sessions = await storage.listChatSessions('paper-1');
      expect(sessions).toEqual([]);
    });

    it('is a no-op when chat-sessions directory already exists', async () => {
      await storage.createPaperDir('paper-1');
      await storage.createChatSession('paper-1');

      const historyPath = path.join(testDir, 'papers', 'paper-1', 'chat-history.json');
      await fs.writeFile(historyPath, JSON.stringify({ messages: [{ role: 'user', content: 'old' }] }));

      await storage.migrateChatHistory('paper-1');

      const sessions = await storage.listChatSessions('paper-1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].title).toBe('New Chat');
    });

    it('is called automatically by listChatSessions', async () => {
      await storage.createPaperDir('paper-1');
      const oldHistory = {
        messages: [{ role: 'user', content: 'Auto migrate test' }],
      };
      const historyPath = path.join(testDir, 'papers', 'paper-1', 'chat-history.json');
      await fs.writeFile(historyPath, JSON.stringify(oldHistory));

      const sessions = await storage.listChatSessions('paper-1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].title).toBe('Auto migrate test');
    });
  });
});
