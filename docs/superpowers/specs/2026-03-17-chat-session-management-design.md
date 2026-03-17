# Chat Session Management Design

## Overview

Add multi-session support to AI Chat. Users can create new chat sessions (equivalent to "clearing" the current conversation), switch between sessions, and delete old ones. Each paper has its own set of chat sessions.

## Data Storage

**Approach: Multi-file storage (one file per session)**

```
data/papers/{paperId}/
├── chat-sessions/
│   ├── {sessionId}.json
│   └── ...
```

Each session file:

```json
{
  "id": "session_1710672000000",
  "title": "什么是 Transformer 的自注意力机制？",
  "createdAt": "2026-03-17T12:00:00.000Z",
  "updatedAt": "2026-03-17T12:05:00.000Z",
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

- **ID generation**: `session_` + `Date.now()` + `_` + 6-char random suffix (e.g., `session_1710672000000_a3xk2f`) to avoid collision on rapid creation
- **Title**: Default "New Chat" on creation. Auto-updated to first user message (truncated to 30 characters) when the first message is sent via `/api/chat`
- **Delete**: Remove the file

## API Design

### New Routes

**`GET /api/paper/[id]/chat-sessions`** — List sessions

Returns sessions sorted by `updatedAt` descending. Does not include message content.

```json
{
  "sessions": [
    { "id": "session_xxx", "title": "...", "createdAt": "...", "updatedAt": "...", "messageCount": 5 }
  ]
}
```

**`POST /api/paper/[id]/chat-sessions`** — Create session

Request body: empty or `{ "title": "custom title" }`. Returns the new session object with empty messages.

**`DELETE /api/paper/[id]/chat-sessions/[sessionId]`** — Delete session

Returns `{ "success": true }`.

### Modified Route

**`POST /api/chat`** — Send message (existing, modified)

Request body changes from `{ paperId, message }` to `{ paperId, sessionId?, message }`.

- If `sessionId` is omitted, a new session is created automatically.
- SSE `done` event returns `{ done: true, sessionId: "xxx" }` so the frontend can track which session received the message.

### App Router File Paths

- `src/app/api/paper/[id]/chat-sessions/route.ts` — handles GET (list) and POST (create)
- `src/app/api/paper/[id]/chat-sessions/[sessionId]/route.ts` — handles DELETE

## Storage Layer

New methods in `src/lib/storage.ts`:

- `listChatSessions(paperId)` — Read `chat-sessions/` directory, return session metadata (no messages), sorted by `updatedAt` descending. **Calls `migrateChatHistory` internally** before reading, so migration is transparent to all callers.
- `getChatSession(paperId, sessionId)` — Read single session file with full messages
- `createChatSession(paperId)` — Create empty session file with title "New Chat", return new session object
- `saveChatSession(paperId, session)` — Write session file, auto-update `updatedAt`
- `deleteChatSession(paperId, sessionId)` — Delete session file
- `migrateChatHistory(paperId)` — Check for old `chat-history.json`, migrate to session file if found, then delete old file. No-op if already migrated.

Existing `saveChatHistory` / `getChatHistory` deprecated.

## UI Design

**Tab bar below chat header (Option B)**

A horizontal tab bar sits between the chat header and the messages area. Each session is a tab showing its truncated title and a close (×) button. The active session tab is highlighted. The bar is horizontally scrollable when sessions overflow.

### Header area changes

- "Sessions" toggle button + "▼" indicator on the right side of the header (collapses/expands the tab bar)
- "+" button to create a new session

### Tab bar

- Each tab: truncated session title + "×" delete button
- Active tab: accent color background and border
- Inactive tabs: subtle glass background
- Horizontally scrollable
- Approximate height: 28px

### Delete confirmation

- Lightweight popover (not full-screen modal) appears near the × button
- Text: "删除此会话？此操作不可撤销"
- Buttons: "取消" (cancel) and "删除" (red, destructive)
- Clicking outside dismisses

## Frontend State

New state in `paper/[id]/page.tsx`:

```typescript
const [sessions, setSessions] = useState<ChatSessionMeta[]>([]);
const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
const [showSessionBar, setShowSessionBar] = useState(true);
```

### Interaction Flow

1. **Page load** → Fetch `GET /api/paper/{id}/chat-sessions` → populate sessions list
2. **Has sessions** → Select most recently updated, load its messages
3. **No sessions** → Empty state, first message auto-creates a session
4. **Click "+"** → `POST` create new session, switch to it, clear message area
5. **Click tab** → Switch `activeSessionId`, load that session's messages
6. **Click "×"** → Show delete confirmation popover
7. **Confirm delete** → `DELETE` session; if it was active, switch to next available session; if none left, show empty state

## New & Updated Types

```typescript
// New types
interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

interface ChatSessionMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

// Updated type — add sessionId to done event
type ChatEvent =
  | { content: string }
  | { done: true; sessionId: string };
```

`PaperData.chatHistory` field becomes optional and deprecated. New code should use the session APIs instead of relying on `chatHistory` from `usePaper`.

## Backward Compatibility

- `listChatSessions` calls `migrateChatHistory` internally, so migration is transparent
- Migration: read old `chat-history.json` → create one session file (title from first user message up to 30 chars, or "New Chat" if no user messages) → delete old file
- Migration happens once, transparently
- `PaperData.chatHistory` becomes optional; new code uses session APIs

## Known Limitations

- **Concurrent writes**: If the same session is open in multiple browser tabs, simultaneous messages could cause data loss (read-modify-write race). The frontend mitigates this by disabling the send button during streaming, but cross-tab concurrency is not protected. This is a pre-existing limitation inherited from the original single-history design.
