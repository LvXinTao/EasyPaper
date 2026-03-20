import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import type { PaperMetadata, PaperAnalysis, ChatHistory, ChatSession, ChatSessionMeta, PaperListItem, Note, Folder, PromptSettings, Bookmark } from '@/types';

function getDataDir(): string {
  return process.env.DATA_DIR || path.join(os.homedir(), '.easypaper', 'data');
}

function getConfigDir(): string {
  return process.env.CONFIG_DIR || path.join(os.homedir(), '.easypaper', 'config');
}

function paperDir(paperId: string): string {
  return path.join(getDataDir(), 'papers', paperId);
}

function generateSessionId(): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `session_${Date.now()}_${suffix}`;
}

export const storage = {
  async createPaperDir(paperId: string): Promise<void> {
    const dir = paperDir(paperId);
    await fs.mkdir(path.join(dir, 'images'), { recursive: true });
  },
  async saveMetadata(paperId: string, metadata: PaperMetadata): Promise<void> {
    const filePath = path.join(paperDir(paperId), 'metadata.json');
    await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
  },
  async getMetadata(paperId: string): Promise<PaperMetadata> {
    const filePath = path.join(paperDir(paperId), 'metadata.json');
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  },
  async updateMetadata(paperId: string, updates: Partial<PaperMetadata>): Promise<PaperMetadata> {
    const current = await this.getMetadata(paperId);
    const { id: _ignoreId, ...safeUpdates } = updates;
    const merged = { ...current, ...safeUpdates };
    await this.saveMetadata(paperId, merged);
    return merged;
  },
  async savePdf(paperId: string, buffer: Buffer): Promise<void> {
    const filePath = path.join(paperDir(paperId), 'original.pdf');
    await fs.writeFile(filePath, buffer);
  },
  getPdfPath(paperId: string): string {
    return path.join(paperDir(paperId), 'original.pdf');
  },
  async saveParsedContent(paperId: string, markdown: string): Promise<void> {
    const filePath = path.join(paperDir(paperId), 'parsed.md');
    await fs.writeFile(filePath, markdown);
  },
  async getParsedContent(paperId: string): Promise<string | null> {
    try {
      const filePath = path.join(paperDir(paperId), 'parsed.md');
      return await fs.readFile(filePath, 'utf-8');
    } catch { return null; }
  },
  async saveAnalysis(paperId: string, analysis: PaperAnalysis): Promise<void> {
    const filePath = path.join(paperDir(paperId), 'analysis.json');
    await fs.writeFile(filePath, JSON.stringify(analysis, null, 2));
  },
  async getAnalysis(paperId: string): Promise<PaperAnalysis | null> {
    try {
      const filePath = path.join(paperDir(paperId), 'analysis.json');
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch { return null; }
  },
  async saveChatHistory(paperId: string, history: ChatHistory): Promise<void> {
    const filePath = path.join(paperDir(paperId), 'chat-history.json');
    await fs.writeFile(filePath, JSON.stringify(history, null, 2));
  },
  async getChatHistory(paperId: string): Promise<ChatHistory> {
    try {
      const filePath = path.join(paperDir(paperId), 'chat-history.json');
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch { return { messages: [] }; }
  },
  async createChatSession(paperId: string): Promise<ChatSession> {
    const sessionsDir = path.join(paperDir(paperId), 'chat-sessions');
    await fs.mkdir(sessionsDir, { recursive: true });
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: generateSessionId(),
      title: 'New Chat',
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    const filePath = path.join(sessionsDir, `${session.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(session, null, 2));
    return session;
  },
  async getChatSession(paperId: string, sessionId: string): Promise<ChatSession | null> {
    try {
      const filePath = path.join(paperDir(paperId), 'chat-sessions', `${sessionId}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch { return null; }
  },
  async saveChatSession(paperId: string, session: ChatSession): Promise<void> {
    const filePath = path.join(paperDir(paperId), 'chat-sessions', `${session.id}.json`);
    session.updatedAt = new Date().toISOString();
    await fs.writeFile(filePath, JSON.stringify(session, null, 2));
  },
  async deleteChatSession(paperId: string, sessionId: string): Promise<void> {
    const filePath = path.join(paperDir(paperId), 'chat-sessions', `${sessionId}.json`);
    await fs.rm(filePath, { force: true });
  },
  async listChatSessions(paperId: string): Promise<ChatSessionMeta[]> {
    await this.migrateChatHistory(paperId);
    const sessionsDir = path.join(paperDir(paperId), 'chat-sessions');
    try {
      const files = await fs.readdir(sessionsDir);
      const sessions: ChatSessionMeta[] = [];
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const content = await fs.readFile(path.join(sessionsDir, file), 'utf-8');
          const session: ChatSession = JSON.parse(content);
          sessions.push({
            id: session.id,
            title: session.title,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            messageCount: session.messages.length,
          });
        } catch { /* skip malformed files */ }
      }
      sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      return sessions;
    } catch { return []; }
  },
  async migrateChatHistory(paperId: string): Promise<void> {
    const sessionsDir = path.join(paperDir(paperId), 'chat-sessions');
    const oldPath = path.join(paperDir(paperId), 'chat-history.json');

    try {
      await fs.stat(sessionsDir);
      return; // sessions dir exists, skip
    } catch { /* doesn't exist, check for old file */ }

    let oldHistory: ChatHistory;
    try {
      const content = await fs.readFile(oldPath, 'utf-8');
      oldHistory = JSON.parse(content);
    } catch { return; } // no old file

    if (!oldHistory.messages || oldHistory.messages.length === 0) {
      await fs.rm(oldPath, { force: true });
      return;
    }

    await fs.mkdir(sessionsDir, { recursive: true });
    const firstUserMsg = oldHistory.messages.find(m => m.role === 'user');
    const title = firstUserMsg ? firstUserMsg.content.slice(0, 30) : 'New Chat';
    const now = new Date().toISOString();
    const session: ChatSession = {
      id: generateSessionId(),
      title,
      createdAt: now,
      updatedAt: now,
      messages: oldHistory.messages,
    };
    await fs.writeFile(
      path.join(sessionsDir, `${session.id}.json`),
      JSON.stringify(session, null, 2)
    );
    await fs.rm(oldPath, { force: true });
  },
  async getNotes(paperId: string): Promise<Note[]> {
    try {
      const filePath = path.join(paperDir(paperId), 'notes.json');
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch { return []; }
  },
  async saveNotes(paperId: string, notes: Note[]): Promise<void> {
    const filePath = path.join(paperDir(paperId), 'notes.json');
    await fs.writeFile(filePath, JSON.stringify(notes, null, 2));
  },
  async getBookmarks(paperId: string): Promise<Bookmark[]> {
    try {
      const filePath = path.join(paperDir(paperId), 'bookmarks.json');
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch { return []; }
  },
  async saveBookmarks(paperId: string, bookmarks: Bookmark[]): Promise<void> {
    const filePath = path.join(paperDir(paperId), 'bookmarks.json');
    await fs.writeFile(filePath, JSON.stringify(bookmarks, null, 2));
  },
  async listPapers(): Promise<PaperListItem[]> {
    const papersDir = path.join(getDataDir(), 'papers');
    try {
      const dirs = await fs.readdir(papersDir);
      const papers: PaperListItem[] = [];
      for (const dir of dirs) {
        try {
          const metadata = await this.getMetadata(dir);
          papers.push({ id: metadata.id, title: metadata.title, createdAt: metadata.createdAt, status: metadata.status, folderId: metadata.folderId ?? null, sortIndex: metadata.sortIndex, starred: metadata.starred });
        } catch { /* Skip directories without valid metadata */ }
      }
      return papers;
    } catch { return []; }
  },
  async deletePaper(paperId: string): Promise<void> {
    const dir = paperDir(paperId);
    await fs.rm(dir, { recursive: true, force: true });
  },
  async paperExists(paperId: string): Promise<boolean> {
    try { await fs.stat(paperDir(paperId)); return true; } catch { return false; }
  },
  async getFolders(): Promise<Folder[]> {
    try {
      const filePath = path.join(getConfigDir(), 'folders.json');
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      return data.folders || [];
    } catch { return []; }
  },
  async saveFolders(folders: Folder[]): Promise<void> {
    const configDir = getConfigDir();
    await fs.mkdir(configDir, { recursive: true });
    const filePath = path.join(configDir, 'folders.json');
    await fs.writeFile(filePath, JSON.stringify({ folders }, null, 2));
  },
  async saveSettings(settings: Record<string, unknown>): Promise<void> {
    const configDir = getConfigDir();
    await fs.mkdir(configDir, { recursive: true });
    const filePath = path.join(configDir, 'settings.json');
    await fs.writeFile(filePath, JSON.stringify(settings, null, 2));
  },
  async getSettings(): Promise<Record<string, unknown> | null> {
    try {
      const filePath = path.join(getConfigDir(), 'settings.json');
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch { return null; }
  },
  async getPromptSettings(): Promise<PromptSettings | null> {
    const settings = await this.getSettings();
    if (!settings || !settings.prompts) return null;
    return settings.prompts as PromptSettings;
  },
  async savePromptSettings(prompts: PromptSettings): Promise<void> {
    const existing = (await this.getSettings()) || {};
    existing.prompts = prompts;
    await this.saveSettings(existing);
  },
};
