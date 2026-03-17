# Chat Session Management Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-session chat support so users can create, switch, and delete chat sessions per paper.

**Architecture:** Multi-file storage (`chat-sessions/{sessionId}.json` per paper), three new API routes for CRUD, modified `/api/chat` route to accept `sessionId`, and a tab bar UI in the chat panel header for session switching.

**Tech Stack:** Next.js 16 App Router, TypeScript, file-based storage (fs/promises), Jest for testing.

**Spec:** `docs/superpowers/specs/2026-03-17-chat-session-management-design.md`

---

## Chunk 1: Types & Storage Layer

### Task 1: Add new types to `src/types/index.ts`

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add ChatSession and ChatSessionMeta types**

Add after the existing `ChatHistory` interface (line 37):

```typescript
export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ChatSessionMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}
```

- [ ] **Step 2: Update ChatEvent type**

Replace the existing `ChatEvent` (lines 61-63):

```typescript
export type ChatEvent =
  | { content: string }
  | { done: true; sessionId: string };
```

- [ ] **Step 3: Make PaperData.chatHistory optional**

Change line 77 from:
```typescript
  chatHistory: ChatHistory;
```
to:
```typescript
  chatHistory?: ChatHistory;
```

- [ ] **Step 4: Add SESSION_NOT_FOUND error code**

In `src/lib/errors.ts`, add `'SESSION_NOT_FOUND'` to the `ErrorCode` union type (after `'NOTE_NOT_FOUND'`):

```typescript
  | 'SESSION_NOT_FOUND'
```

And add to `STATUS_MAP`:

```typescript
  SESSION_NOT_FOUND: 404,
```

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/lib/errors.ts
git commit -m "feat: add ChatSession types, update ChatEvent, add SESSION_NOT_FOUND error code"
```

---

### Task 2: Add session storage methods to `src/lib/storage.ts`

**Files:**
- Modify: `src/lib/storage.ts`
- Test: `__tests__/lib/storage-sessions.test.ts`

- [ ] **Step 1: Write failing tests for session storage**

Create `__tests__/lib/storage-sessions.test.ts`:

```typescript
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

      // Small delay to ensure updatedAt changes
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

      // Update s1 to make it newer
      await new Promise(r => setTimeout(r, 10));
      s1.messages.push({ role: 'user', content: 'test' });
      await storage.saveChatSession('paper-1', s1);

      const sessions = await storage.listChatSessions('paper-1');
      expect(sessions).toHaveLength(2);
      expect(sessions[0].id).toBe(s1.id); // s1 updated more recently
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

      // Old file should be gone
      await expect(fs.stat(historyPath)).rejects.toThrow();

      // Should have one session with the old messages
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
      // Create a session first (this creates the directory)
      await storage.createChatSession('paper-1');

      // Also create an old history file (simulating partial state)
      const historyPath = path.join(testDir, 'papers', 'paper-1', 'chat-history.json');
      await fs.writeFile(historyPath, JSON.stringify({ messages: [{ role: 'user', content: 'old' }] }));

      await storage.migrateChatHistory('paper-1');

      // Should still only have the one session created above, not migrate
      const sessions = await storage.listChatSessions('paper-1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].title).toBe('New Chat'); // From createChatSession, not migration
    });

    it('is called automatically by listChatSessions', async () => {
      await storage.createPaperDir('paper-1');
      const oldHistory = {
        messages: [{ role: 'user', content: 'Auto migrate test' }],
      };
      const historyPath = path.join(testDir, 'papers', 'paper-1', 'chat-history.json');
      await fs.writeFile(historyPath, JSON.stringify(oldHistory));

      // listChatSessions should trigger migration transparently
      const sessions = await storage.listChatSessions('paper-1');
      expect(sessions).toHaveLength(1);
      expect(sessions[0].title).toBe('Auto migrate test');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/storage-sessions.test.ts --no-coverage`
Expected: FAIL — storage methods don't exist yet.

- [ ] **Step 3: Implement session storage methods**

Add to `src/lib/storage.ts`, inside the `storage` object, after the `getChatHistory` method. Also add `ChatSession` and `ChatSessionMeta` to the import from `@/types`.

Update the import line:
```typescript
import type { PaperMetadata, PaperAnalysis, ChatHistory, ChatSession, ChatSessionMeta, PaperListItem, Note, Folder } from '@/types';
```

Add a helper function above the `storage` object for generating session IDs:
```typescript
function generateSessionId(): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `session_${Date.now()}_${suffix}`;
}
```

Add these methods inside the `storage` object:

```typescript
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

    // If sessions directory already exists, skip migration
    try {
      await fs.stat(sessionsDir);
      return;
    } catch { /* directory doesn't exist, check for old file */ }

    // Check if old chat-history.json exists
    let oldHistory: ChatHistory;
    try {
      const content = await fs.readFile(oldPath, 'utf-8');
      oldHistory = JSON.parse(content);
    } catch { return; } // No old file, nothing to migrate

    if (!oldHistory.messages || oldHistory.messages.length === 0) {
      // Empty history, just delete the old file
      await fs.rm(oldPath, { force: true });
      return;
    }

    // Create session from old history
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

    // Remove old file
    await fs.rm(oldPath, { force: true });
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/storage-sessions.test.ts --no-coverage`
Expected: All tests PASS.

- [ ] **Step 5: Run all existing tests to check for regressions**

Run: `npm test -- --no-coverage`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/storage.ts __tests__/lib/storage-sessions.test.ts
git commit -m "feat: add chat session storage methods with migration support"
```

---

## Chunk 2: API Routes

### Task 3: Create `GET` and `POST /api/paper/[id]/chat-sessions`

**Files:**
- Create: `src/app/api/paper/[id]/chat-sessions/route.ts`
- Test: `__tests__/api/chat-sessions.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/chat-sessions.test.ts`:

```typescript
import { GET, POST } from '@/app/api/paper/[id]/chat-sessions/route';
import { storage } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  storage: {
    paperExists: jest.fn(),
    listChatSessions: jest.fn(),
    createChatSession: jest.fn(),
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/api/chat-sessions.test.ts --no-coverage`
Expected: FAIL — route file doesn't exist yet.

- [ ] **Step 3: Implement the route**

Create `src/app/api/paper/[id]/chat-sessions/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';

interface RouteContext { params: Promise<{ id: string }>; }

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');

  const sessions = await storage.listChatSessions(id);
  return NextResponse.json({ sessions });
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');

  const session = await storage.createChatSession(id);

  // If a custom title was provided, update it
  try {
    const body = await request.json();
    if (body.title) {
      session.title = body.title;
      await storage.saveChatSession(id, session);
    }
  } catch { /* empty body is fine */ }

  return NextResponse.json(session, { status: 201 });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/api/chat-sessions.test.ts --no-coverage`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/paper/[id]/chat-sessions/route.ts __tests__/api/chat-sessions.test.ts
git commit -m "feat: add GET/POST API routes for chat sessions"
```

---

### Task 4: Create `DELETE /api/paper/[id]/chat-sessions/[sessionId]`

**Files:**
- Create: `src/app/api/paper/[id]/chat-sessions/[sessionId]/route.ts`
- Test: `__tests__/api/chat-session-delete.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/api/chat-session-delete.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/api/chat-session-delete.test.ts --no-coverage`
Expected: FAIL — route file doesn't exist.

- [ ] **Step 3: Implement the route**

Create `src/app/api/paper/[id]/chat-sessions/[sessionId]/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';

interface RouteContext { params: Promise<{ id: string; sessionId: string }>; }

export async function DELETE(_request: Request, context: RouteContext) {
  const { id, sessionId } = await context.params;
  const exists = await storage.paperExists(id);
  if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');

  const session = await storage.getChatSession(id, sessionId);
  if (!session) return createErrorResponse('SESSION_NOT_FOUND', 'Session not found');

  await storage.deleteChatSession(id, sessionId);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/api/chat-session-delete.test.ts --no-coverage`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/paper/[id]/chat-sessions/[sessionId]/route.ts __tests__/api/chat-session-delete.test.ts
git commit -m "feat: add DELETE API route for chat session"
```

---

### Task 5: Modify `/api/chat` route for session support

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Modify: `__tests__/api/chat.test.ts`

- [ ] **Step 1: Update tests for session support**

Replace `__tests__/api/chat.test.ts` contents:

```typescript
import { POST } from '@/app/api/chat/route';
import { storage } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  storage: {
    paperExists: jest.fn(),
    getParsedContent: jest.fn(),
    getChatHistory: jest.fn(),
    saveChatHistory: jest.fn(),
    getChatSession: jest.fn(),
    saveChatSession: jest.fn(),
    createChatSession: jest.fn(),
    getSettings: jest.fn().mockResolvedValue(null),
  },
}));
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('POST /api/chat', () => {
  beforeEach(() => {
    process.env.AI_API_KEY = 'sk-test';
    process.env.AI_BASE_URL = 'https://api.test.com/v1';
    process.env.AI_MODEL = 'gpt-4o';
  });

  it('returns 404 for non-existent paper', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(false);
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperId: 'non-existent', message: 'hello' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it('returns 400 when message is missing', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperId: 'test-id' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 404 when sessionId is provided but session not found', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getChatSession as jest.Mock).mockResolvedValue(null);
    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperId: 'test-id', sessionId: 'session_nonexistent', message: 'hello' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run tests to verify the new test fails**

Run: `npx jest __tests__/api/chat.test.ts --no-coverage`
Expected: The "returns 404 when sessionId is provided but session not found" test FAILS.

- [ ] **Step 3: Rewrite the chat route to use sessions**

Replace `src/app/api/chat/route.ts`:

```typescript
import { storage } from '@/lib/storage';
import { createAIClient } from '@/lib/ai-client';
import { createErrorResponse } from '@/lib/errors';
import { CHAT_PROMPT } from '@/lib/prompts';
import { getAIConfig } from '@/lib/ai-config';
import type { ChatSession } from '@/types';

export async function POST(request: Request) {
  try {
    const { paperId, sessionId, message } = await request.json();
    if (!paperId) return createErrorResponse('VALIDATION_ERROR', 'paperId is required');
    if (!message) return createErrorResponse('VALIDATION_ERROR', 'message is required');
    const exists = await storage.paperExists(paperId);
    if (!exists) return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');

    // Resolve or create session
    let session: ChatSession;
    if (sessionId) {
      const existing = await storage.getChatSession(paperId, sessionId);
      if (!existing) return createErrorResponse('SESSION_NOT_FOUND', 'Session not found');
      session = existing;
    } else {
      session = await storage.createChatSession(paperId);
    }

    const { apiKey, baseUrl, model } = await getAIConfig();
    if (!apiKey) return createErrorResponse('API_KEY_MISSING', 'API key is not configured');

    const parsedContent = await storage.getParsedContent(paperId);
    const historyStr = session.messages.map((m) => `${m.role}: ${m.content}`).join('\n');
    const prompt = CHAT_PROMPT.replace('{content}', parsedContent || '').replace('{history}', historyStr).replace('{question}', message);
    const client = createAIClient({ baseUrl, apiKey, model });
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); };
        try {
          let fullResponse = '';
          for await (const chunk of client.streamComplete([{ role: 'user', content: prompt }])) {
            fullResponse += chunk;
            send({ content: chunk });
          }
          session.messages.push({ role: 'user', content: message }, { role: 'assistant', content: fullResponse });

          // Auto-update title from first user message
          if (session.title === 'New Chat') {
            const firstUserMsg = session.messages.find(m => m.role === 'user');
            if (firstUserMsg) {
              session.title = firstUserMsg.content.slice(0, 30);
            }
          }

          await storage.saveChatSession(paperId, session);
          send({ done: true, sessionId: session.id });
        } catch (error) { send({ error: error instanceof Error ? error.message : 'Chat failed' }); }
        finally { controller.close(); }
      },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
  } catch (error) {
    return createErrorResponse('API_CALL_FAILED', `Chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/api/chat.test.ts --no-coverage`
Expected: All tests PASS.

- [ ] **Step 5: Run all tests for regressions**

Run: `npm test -- --no-coverage`
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/chat/route.ts __tests__/api/chat.test.ts
git commit -m "feat: update chat route to use session-based storage"
```

---

## Chunk 3: Frontend — Session Tab Bar & Integration

### Task 6: Create `ChatSessionBar` component

**Files:**
- Create: `src/components/chat-session-bar.tsx`

This component renders the horizontal tab bar showing all sessions.

- [ ] **Step 1: Create the component**

Create `src/components/chat-session-bar.tsx`:

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import type { ChatSessionMeta } from '@/types';

interface ChatSessionBarProps {
  sessions: ChatSessionMeta[];
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export function ChatSessionBar({ sessions, activeSessionId, onSelectSession, onDeleteSession }: ChatSessionBarProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on click outside
  useEffect(() => {
    if (!confirmDeleteId) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setConfirmDeleteId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [confirmDeleteId]);

  if (sessions.length === 0) return null;

  return (
    <div
      className="flex gap-1 overflow-x-auto"
      style={{
        padding: '4px 8px',
        borderBottom: '1px solid var(--border)',
        scrollbarWidth: 'none',
      }}
    >
      {sessions.map((session) => (
        <div key={session.id} className="relative flex-shrink-0">
          <button
            onClick={() => onSelectSession(session.id)}
            className="flex items-center gap-1 rounded-md transition-colors"
            style={{
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: session.id === activeSessionId ? 500 : 400,
              background: session.id === activeSessionId
                ? 'var(--accent-subtle)'
                : 'var(--glass)',
              border: session.id === activeSessionId
                ? '1px solid var(--accent)'
                : '1px solid var(--glass-border)',
              color: session.id === activeSessionId
                ? 'var(--text-primary)'
                : 'var(--text-tertiary)',
              maxWidth: '160px',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {session.title}
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                setConfirmDeleteId(session.id);
              }}
              className="ml-1 rounded hover:bg-[rgba(255,255,255,0.1)] transition-colors"
              style={{
                fontSize: '10px',
                color: 'var(--text-tertiary)',
                padding: '0 2px',
                cursor: 'pointer',
                lineHeight: 1,
              }}
            >
              ×
            </span>
          </button>

          {/* Delete confirmation popover */}
          {confirmDeleteId === session.id && (
            <div
              ref={popoverRef}
              className="absolute z-50 rounded-lg shadow-lg"
              style={{
                top: 'calc(100% + 4px)',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '10px 14px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                minWidth: '180px',
              }}
            >
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                删除此会话？此操作不可撤销
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="px-2.5 py-1 text-xs rounded-md transition-colors"
                  style={{
                    background: 'var(--glass)',
                    border: '1px solid var(--glass-border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    onDeleteSession(session.id);
                    setConfirmDeleteId(null);
                  }}
                  className="px-2.5 py-1 text-xs rounded-md transition-colors"
                  style={{
                    background: 'var(--rose-subtle)',
                    border: '1px solid var(--rose)',
                    color: 'var(--rose)',
                  }}
                >
                  删除
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/chat-session-bar.tsx
git commit -m "feat: add ChatSessionBar component with delete confirmation popover"
```

---

### Task 7: Integrate session management into paper detail page

**Files:**
- Modify: `src/app/paper/[id]/page.tsx`

This is the main integration task. We need to:
1. Add session state variables
2. Fetch sessions on page load
3. Load active session messages when switching
4. Update `handleSendMessage` to pass `sessionId`
5. Add new session / toggle session bar buttons to chat header
6. Render `ChatSessionBar`

- [ ] **Step 1: Add imports and session state**

At the top of `page.tsx`, add the import:

```typescript
import { ChatSessionBar } from '@/components/chat-session-bar';
import type { PaperAnalysis, ChatMessage, ChatSessionMeta } from '@/types';
```

(Update the existing `import type` line to include `ChatSessionMeta`.)

Add session state after the existing chat state block (after the `noteCount` state around line 34):

```typescript
  // Session state
  const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [showSessionBar, setShowSessionBar] = useState(true);
```

- [ ] **Step 2: Add session fetching effect**

Replace the existing `useEffect` that initializes chat messages from `data.chatHistory` (around lines 69-73) with:

```typescript
  // Track activeSessionId in a ref to avoid stale closures
  const activeSessionIdRef = useRef<string | null>(null);
  useEffect(() => { activeSessionIdRef.current = activeSessionId; }, [activeSessionId]);

  // Fetch sessions on mount and when paper data loads
  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch(`/api/paper/${paperId}/chat-sessions`);
      if (!res.ok) return;
      const result = await res.json();
      setSessions(result.sessions);
      if (result.sessions.length > 0 && !activeSessionIdRef.current) {
        // Select most recent session
        const mostRecent = result.sessions[0];
        setActiveSessionId(mostRecent.id);
        // Load its messages
        const sessionRes = await fetch(`/api/paper/${paperId}/chat-sessions/${mostRecent.id}`);
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          setChatMessages(sessionData.messages || []);
        }
      }
    } catch { /* ignore */ }
  }, [paperId]);

  useEffect(() => {
    if (data) fetchSessions();
  }, [data, fetchSessions]);
```

Note: We use `activeSessionIdRef` instead of `activeSessionId` in the dependency array to prevent unnecessary re-fetches when the active session changes.

- [ ] **Step 3: Add session switching handler**

```typescript
  const handleSelectSession = useCallback(async (sessionId: string) => {
    if (sessionId === activeSessionId) return;
    setActiveSessionId(sessionId);
    setChatMessages([]);
    setStreamingContent('');
    try {
      const res = await fetch(`/api/paper/${paperId}/chat-sessions/${sessionId}`);
      if (res.ok) {
        const sessionData = await res.json();
        setChatMessages(sessionData.messages || []);
      }
    } catch { /* ignore */ }
  }, [paperId, activeSessionId]);
```

- [ ] **Step 4: Add new session handler**

```typescript
  const handleNewSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/paper/${paperId}/chat-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) return;
      const newSession = await res.json();
      setSessions(prev => [{ ...newSession, messageCount: 0 }, ...prev]);
      setActiveSessionId(newSession.id);
      setChatMessages([]);
      setStreamingContent('');
    } catch { /* ignore */ }
  }, [paperId]);
```

- [ ] **Step 5: Add delete session handler**

```typescript
  const handleDeleteSession = useCallback(async (sessionId: string) => {
    try {
      const res = await fetch(`/api/paper/${paperId}/chat-sessions/${sessionId}`, { method: 'DELETE' });
      if (!res.ok) return;

      const remaining = sessions.filter(s => s.id !== sessionId);
      setSessions(remaining);

      // If we deleted the active session, switch to next available
      if (sessionId === activeSessionId) {
        if (remaining.length > 0) {
          handleSelectSession(remaining[0].id);
        } else {
          setActiveSessionId(null);
          setChatMessages([]);
        }
      }
    } catch { /* ignore */ }
  }, [paperId, activeSessionId, sessions, handleSelectSession]);
```

- [ ] **Step 6: Update handleSendMessage to use sessionId**

Modify the existing `handleSendMessage` callback. Change the fetch body from:
```typescript
body: JSON.stringify({ paperId, message }),
```
to:
```typescript
body: JSON.stringify({ paperId, sessionId: activeSessionId, message }),
```

Also, inside the SSE parsing where `data.done` is handled, add session list refresh and handle auto-created sessions:
```typescript
if (data.done) {
  setChatMessages((prev) => [
    ...prev,
    { role: 'assistant', content: fullResponse },
  ]);
  setStreamingContent('');
  // Update session ID if auto-created
  if (data.sessionId && !activeSessionId) {
    setActiveSessionId(data.sessionId);
  }
  // Refresh session list to get updated titles and counts
  fetchSessions();
}
```

Update the dependency array for `handleSendMessage` to include `activeSessionId` and `fetchSessions`:
```typescript
}, [paperId, activeSessionId, fetchSessions]);
```

- [ ] **Step 7: Update chat header JSX**

Replace the existing chat header `div` (the one with "AI Chat" title) with:

```tsx
<div className="flex items-center justify-between px-4" style={{ height: '36px', borderBottom: sessions.length > 0 && showSessionBar ? 'none' : '1px solid var(--border)', flexShrink: 0 }}>
  <div className="flex items-center gap-2">
    <div
      className="flex items-center justify-center"
      style={{
        width: '24px',
        height: '24px',
        borderRadius: '8px',
        background: 'linear-gradient(135deg, var(--accent), color-mix(in srgb, var(--accent), white 25%))',
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <circle cx="12" cy="5" r="2" />
        <path d="M12 7v4" />
        <line x1="8" y1="16" x2="8" y2="16" />
        <line x1="16" y1="16" x2="16" y2="16" />
      </svg>
    </div>
    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>AI Chat</span>
  </div>
  <div className="flex items-center gap-1.5">
    {sessions.length > 0 && (
      <button
        onClick={() => setShowSessionBar(prev => !prev)}
        className="flex items-center gap-1 px-2 py-0.5 rounded-md transition-colors"
        style={{
          fontSize: '10px',
          color: 'var(--text-tertiary)',
          background: 'var(--glass)',
          border: '1px solid var(--glass-border)',
        }}
      >
        Sessions
        <span style={{ fontSize: '8px', transform: showSessionBar ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </button>
    )}
    <button
      onClick={handleNewSession}
      className="flex items-center justify-center rounded-md transition-colors"
      style={{
        width: '22px',
        height: '22px',
        background: 'var(--glass)',
        border: '1px solid var(--glass-border)',
        color: 'var(--text-tertiary)',
        fontSize: '14px',
        lineHeight: 1,
      }}
      title="New session"
    >
      +
    </button>
    {modelName && (
      <span
        className="flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full"
        style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-tertiary)' }}
      >
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--green)' }} />
        {modelName}
      </span>
    )}
  </div>
</div>
```

- [ ] **Step 8: Add ChatSessionBar below the header**

Right after the chat header div, add:

```tsx
{showSessionBar && (
  <ChatSessionBar
    sessions={sessions}
    activeSessionId={activeSessionId}
    onSelectSession={handleSelectSession}
    onDeleteSession={handleDeleteSession}
  />
)}
```

And add a border-bottom to the session bar area if it's visible (the header already conditionally removes its bottom border when the session bar is shown).

- [ ] **Step 9: Commit**

```bash
git add src/app/paper/[id]/page.tsx
git commit -m "feat: integrate chat session management into paper detail page"
```

---

### Task 8: Manual verification and cleanup

- [ ] **Step 1: Run full test suite**

Run: `npm test -- --no-coverage`
Expected: All tests PASS.

- [ ] **Step 2: Run dev server and manually test**

Run: `npm run dev`

Manual test checklist:
1. Open a paper that has existing chat history → verify migration: old messages appear in a session
2. Send a new message → verify it works within the session
3. Click "+" to create a new session → verify empty message area
4. Send a message in new session → verify title updates from "New Chat" to message content
5. Click between session tabs → verify messages switch correctly
6. Click "×" on a session tab → verify confirmation popover appears
7. Confirm delete → verify session removed and switches to next available
8. Delete all sessions → verify empty state

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No new errors.

- [ ] **Step 4: Final commit if any cleanup needed**

```bash
git add -A
git commit -m "chore: cleanup and fix lint issues for chat session feature"
```
