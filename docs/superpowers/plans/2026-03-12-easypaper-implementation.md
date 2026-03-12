# EasyPaper Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a paper reading Web application where users upload PDFs and get AI-powered structured interpretations in a dual-column layout with follow-up Q&A.

**Architecture:** Next.js App Router application with API routes calling Python Marker for PDF parsing and OpenAI-compatible APIs for AI analysis. Local filesystem storage with JSON/Markdown files. SSE streaming for real-time AI responses.

**Tech Stack:** Next.js 14+ (App Router), React 18+, TypeScript, PDF.js, Marker (Python), Node.js crypto (AES-256-GCM), TailwindCSS

---

## File Structure

```
easypaper/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── .env.example
├── scripts/
│   └── parse-pdf.py                    # Python script for Marker PDF parsing
├── src/
│   ├── app/
│   │   ├── layout.tsx                   # Root layout with global styles
│   │   ├── page.tsx                     # Home page - upload entry
│   │   ├── paper/
│   │   │   └── [id]/
│   │   │       └── page.tsx             # Paper detail page - dual column
│   │   ├── settings/
│   │   │   └── page.tsx                 # Settings page - API config
│   │   └── api/
│   │       ├── upload/
│   │       │   └── route.ts             # POST /api/upload
│   │       ├── analyze/
│   │       │   └── route.ts             # POST /api/analyze (SSE)
│   │       ├── chat/
│   │       │   └── route.ts             # POST /api/chat (SSE)
│   │       ├── papers/
│   │       │   └── route.ts             # GET /api/papers
│   │       ├── paper/
│   │       │   └── [id]/
│   │       │       └── route.ts         # GET/DELETE /api/paper/[id]
│   │       └── settings/
│   │           └── route.ts             # GET/POST /api/settings
│   ├── lib/
│   │   ├── storage.ts                   # File system operations
│   │   ├── crypto.ts                    # API key encryption/decryption
│   │   ├── marker.ts                    # Marker Python integration
│   │   ├── ai-client.ts                 # OpenAI-compatible API client
│   │   ├── ai-config.ts                 # AI configuration resolution
│   │   ├── prompts.ts                   # AI prompt templates
│   │   └── errors.ts                    # Error codes and helpers
│   ├── components/
│   │   ├── pdf-viewer.tsx               # PDF.js viewer component
│   │   ├── upload-zone.tsx              # Drag-and-drop upload component
│   │   ├── analysis-panel.tsx           # Right panel with sections
│   │   ├── section-tabs.tsx             # Section tab switcher
│   │   ├── chat-input.tsx               # Chat input with send button
│   │   ├── chat-messages.tsx            # Chat message list
│   │   ├── paper-card.tsx               # Paper list item card
│   │   ├── settings-form.tsx            # Settings form component
│   │   └── streaming-text.tsx           # SSE streaming text renderer
│   ├── hooks/
│   │   ├── use-sse.ts                   # SSE stream hook
│   │   └── use-paper.ts                 # Paper data fetching hook
│   └── types/
│       └── index.ts                     # TypeScript type definitions
├── __tests__/
│   ├── lib/
│   │   ├── storage.test.ts
│   │   ├── crypto.test.ts
│   │   ├── marker.test.ts
│   │   ├── ai-client.test.ts
│   │   └── errors.test.ts
│   └── api/
│       ├── upload.test.ts
│       ├── analyze.test.ts
│       ├── chat.test.ts
│       ├── papers.test.ts
│       ├── paper-id.test.ts
│       └── settings.test.ts
└── data/                                # Runtime data directory (gitignored)
    └── papers/
```

---

## Chunk 1: Project Scaffolding & Core Types

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `.env.example`, `.gitignore`

- [ ] **Step 1: Scaffold Next.js project**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias
```

- [ ] **Step 2: Install additional dependencies**

```bash
npm install uuid pdfjs-dist
npm install -D @types/uuid jest @testing-library/react @testing-library/jest-dom ts-jest @types/jest
```

- [ ] **Step 3: Create .env.example**

Create `.env.example`:
```
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-xxx
AI_MODEL=gpt-4o
AI_VISION_MODEL=gpt-4o
```

- [ ] **Step 4: Update .gitignore**

Add to `.gitignore`:
```
data/
config/
```

- [ ] **Step 5: Configure Jest**

Create `jest.config.ts`:
```typescript
import type { Config } from 'jest';
import nextJest from 'next/jest';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

export default createJestConfig(config);
```

Add to `package.json` scripts:
```json
"test": "jest",
"test:watch": "jest --watch"
```

- [ ] **Step 6: Verify project builds**

```bash
npm run build
```
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: initialize Next.js project with TypeScript, TailwindCSS, Jest"
```

---

### Task 2: Define TypeScript Types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Create type definitions**

Create `src/types/index.ts`:
```typescript
// Paper status lifecycle
export type PaperStatus = 'pending' | 'parsing' | 'analyzing' | 'analyzed' | 'error';

// Paper metadata stored in metadata.json
export interface PaperMetadata {
  id: string;
  title: string;
  filename: string;
  pages: number;
  createdAt: string;
  status: PaperStatus;
}

// Page reference for click-to-locate
export interface PageReference {
  text: string;
  page: number;
}

// Analysis section with references
export interface AnalysisSection {
  content: string;
  references: PageReference[];
}

// Contributions section (list format)
export interface ContributionsSection {
  items: string[];
  references: PageReference[];
}

// Full analysis result stored in analysis.json
export interface PaperAnalysis {
  summary: AnalysisSection;
  contributions: ContributionsSection;
  methodology: AnalysisSection;
  conclusions: AnalysisSection;
  generatedAt: string;
}

// Chat message
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Chat history stored in chat-history.json
export interface ChatHistory {
  messages: ChatMessage[];
}

// Settings stored in config/settings.json
export interface AppSettings {
  baseUrl: string;
  apiKeyEncrypted: string;
  apiKeyIV: string;
  model: string;
  visionModel: string;
}

// API error response
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// SSE event types for analyze endpoint
export type AnalyzeEvent =
  | { step: 'parsing' }
  | { step: 'analyzing' }
  | { section: string; content: string }
  | { done: true };

// SSE event types for chat endpoint
export type ChatEvent =
  | { content: string }
  | { done: true };

// Paper list item (subset of metadata for listing)
export interface PaperListItem {
  id: string;
  title: string;
  createdAt: string;
  status: PaperStatus;
}

// Full paper data returned by GET /api/paper/[id]
export interface PaperData {
  metadata: PaperMetadata;
  analysis: PaperAnalysis | null;
  parsedContent: string | null;
  chatHistory: ChatHistory;
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add TypeScript type definitions for all data models"
```

---

### Task 3: Create Error Handling Module

**Files:**
- Create: `src/lib/errors.ts`
- Test: `__tests__/lib/errors.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/errors.test.ts`:
```typescript
import { AppError, ErrorCode, createErrorResponse } from '@/lib/errors';

describe('AppError', () => {
  it('creates an error with code and message', () => {
    const err = new AppError('INVALID_FILE_TYPE', 'Only PDF files are supported');
    expect(err.code).toBe('INVALID_FILE_TYPE');
    expect(err.message).toBe('Only PDF files are supported');
    expect(err.statusCode).toBe(400);
  });

  it('maps error codes to correct HTTP status codes', () => {
    expect(new AppError('FILE_TOO_LARGE', '').statusCode).toBe(413);
    expect(new AppError('PAPER_NOT_FOUND', '').statusCode).toBe(404);
    expect(new AppError('PARSING_FAILED', '').statusCode).toBe(500);
    expect(new AppError('API_KEY_MISSING', '').statusCode).toBe(400);
    expect(new AppError('VALIDATION_ERROR', '').statusCode).toBe(400);
  });
});

describe('createErrorResponse', () => {
  it('creates a NextResponse with correct format', () => {
    const response = createErrorResponse('INVALID_FILE_TYPE', 'Only PDF files');
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/errors.test.ts
```
Expected: FAIL - module not found

- [ ] **Step 3: Write implementation**

Create `src/lib/errors.ts`:
```typescript
import { NextResponse } from 'next/server';

export type ErrorCode =
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'PARSING_FAILED'
  | 'ANALYSIS_FAILED'
  | 'API_KEY_MISSING'
  | 'API_CALL_FAILED'
  | 'PAPER_NOT_FOUND'
  | 'VALIDATION_ERROR';

const STATUS_MAP: Record<ErrorCode, number> = {
  INVALID_FILE_TYPE: 400,
  FILE_TOO_LARGE: 413,
  PARSING_FAILED: 500,
  ANALYSIS_FAILED: 500,
  API_KEY_MISSING: 400,
  API_CALL_FAILED: 502,
  PAPER_NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
};

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.statusCode = STATUS_MAP[code];
    this.details = details;
  }
}

export function createErrorResponse(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>
): NextResponse {
  const statusCode = STATUS_MAP[code];
  return NextResponse.json(
    { error: { code, message, ...(details && { details }) } },
    { status: statusCode }
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/lib/errors.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/errors.ts __tests__/lib/errors.test.ts
git commit -m "feat: add error handling module with error codes and response helpers"
```

---

## Chunk 2: Data Storage Layer

### Task 4: Implement File Storage Module

**Files:**
- Create: `src/lib/storage.ts`
- Test: `__tests__/lib/storage.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/storage.test.ts`:
```typescript
import { storage } from '@/lib/storage';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('storage', () => {
  let testDir: string;
  let originalDataDir: string;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'easypaper-test-'));
    // Override data directory for tests
    originalDataDir = process.env.DATA_DIR || '';
    process.env.DATA_DIR = testDir;
  });

  afterEach(async () => {
    process.env.DATA_DIR = originalDataDir;
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('createPaperDir', () => {
    it('creates the paper directory structure', async () => {
      const paperId = 'test-123';
      await storage.createPaperDir(paperId);
      const dirPath = path.join(testDir, 'papers', paperId);
      const stat = await fs.stat(dirPath);
      expect(stat.isDirectory()).toBe(true);
      const imagesStat = await fs.stat(path.join(dirPath, 'images'));
      expect(imagesStat.isDirectory()).toBe(true);
    });
  });

  describe('saveMetadata / getMetadata', () => {
    it('round-trips metadata through JSON', async () => {
      const paperId = 'test-456';
      await storage.createPaperDir(paperId);
      const metadata = {
        id: paperId,
        title: 'Test Paper',
        filename: 'test.pdf',
        pages: 10,
        createdAt: '2025-03-11T10:00:00Z',
        status: 'pending' as const,
      };
      await storage.saveMetadata(paperId, metadata);
      const loaded = await storage.getMetadata(paperId);
      expect(loaded).toEqual(metadata);
    });
  });

  describe('savePdf / getPdfPath', () => {
    it('saves PDF buffer and returns correct path', async () => {
      const paperId = 'test-789';
      await storage.createPaperDir(paperId);
      const pdfBuffer = Buffer.from('fake pdf content');
      await storage.savePdf(paperId, pdfBuffer);
      const pdfPath = storage.getPdfPath(paperId);
      const content = await fs.readFile(pdfPath);
      expect(content).toEqual(pdfBuffer);
    });
  });

  describe('saveParsedContent / getParsedContent', () => {
    it('saves and retrieves markdown content', async () => {
      const paperId = 'test-md';
      await storage.createPaperDir(paperId);
      await storage.saveParsedContent(paperId, '# Title\n\nContent');
      const content = await storage.getParsedContent(paperId);
      expect(content).toBe('# Title\n\nContent');
    });
  });

  describe('saveAnalysis / getAnalysis', () => {
    it('round-trips analysis JSON', async () => {
      const paperId = 'test-analysis';
      await storage.createPaperDir(paperId);
      const analysis = {
        summary: { content: 'test', references: [] },
        contributions: { items: ['a'], references: [] },
        methodology: { content: 'test', references: [] },
        conclusions: { content: 'test', references: [] },
        generatedAt: '2025-03-11T10:05:00Z',
      };
      await storage.saveAnalysis(paperId, analysis);
      const loaded = await storage.getAnalysis(paperId);
      expect(loaded).toEqual(analysis);
    });
  });

  describe('saveChatHistory / getChatHistory', () => {
    it('round-trips chat history', async () => {
      const paperId = 'test-chat';
      await storage.createPaperDir(paperId);
      const history = { messages: [{ role: 'user' as const, content: 'hello' }] };
      await storage.saveChatHistory(paperId, history);
      const loaded = await storage.getChatHistory(paperId);
      expect(loaded).toEqual(history);
    });

    it('returns empty messages when no history exists', async () => {
      const paperId = 'test-empty';
      await storage.createPaperDir(paperId);
      const history = await storage.getChatHistory(paperId);
      expect(history).toEqual({ messages: [] });
    });
  });

  describe('listPapers', () => {
    it('lists all papers with metadata', async () => {
      await storage.createPaperDir('paper-1');
      await storage.saveMetadata('paper-1', {
        id: 'paper-1',
        title: 'Paper 1',
        filename: 'p1.pdf',
        pages: 5,
        createdAt: '2025-03-11T10:00:00Z',
        status: 'analyzed',
      });
      await storage.createPaperDir('paper-2');
      await storage.saveMetadata('paper-2', {
        id: 'paper-2',
        title: 'Paper 2',
        filename: 'p2.pdf',
        pages: 8,
        createdAt: '2025-03-11T11:00:00Z',
        status: 'pending',
      });
      const papers = await storage.listPapers();
      expect(papers).toHaveLength(2);
      expect(papers.map(p => p.id).sort()).toEqual(['paper-1', 'paper-2']);
    });

    it('returns empty array when no papers exist', async () => {
      const papers = await storage.listPapers();
      expect(papers).toEqual([]);
    });
  });

  describe('deletePaper', () => {
    it('removes the paper directory', async () => {
      await storage.createPaperDir('to-delete');
      await storage.saveMetadata('to-delete', {
        id: 'to-delete',
        title: 'Delete Me',
        filename: 'd.pdf',
        pages: 1,
        createdAt: '2025-03-11T10:00:00Z',
        status: 'pending',
      });
      await storage.deletePaper('to-delete');
      const papers = await storage.listPapers();
      expect(papers).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/storage.test.ts
```
Expected: FAIL - module not found

- [ ] **Step 3: Write implementation**

Create `src/lib/storage.ts`:
```typescript
import fs from 'fs/promises';
import path from 'path';
import type { PaperMetadata, PaperAnalysis, ChatHistory, PaperListItem } from '@/types';

function getDataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), 'data');
}

function getConfigDir(): string {
  return process.env.CONFIG_DIR || path.join(process.cwd(), 'config');
}

function paperDir(paperId: string): string {
  return path.join(getDataDir(), 'papers', paperId);
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
    } catch {
      return null;
    }
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
    } catch {
      return null;
    }
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
    } catch {
      return { messages: [] };
    }
  },

  async listPapers(): Promise<PaperListItem[]> {
    const papersDir = path.join(getDataDir(), 'papers');
    try {
      const dirs = await fs.readdir(papersDir);
      const papers: PaperListItem[] = [];
      for (const dir of dirs) {
        try {
          const metadata = await this.getMetadata(dir);
          papers.push({
            id: metadata.id,
            title: metadata.title,
            createdAt: metadata.createdAt,
            status: metadata.status,
          });
        } catch {
          // Skip directories without valid metadata
        }
      }
      return papers;
    } catch {
      return [];
    }
  },

  async deletePaper(paperId: string): Promise<void> {
    const dir = paperDir(paperId);
    await fs.rm(dir, { recursive: true, force: true });
  },

  async paperExists(paperId: string): Promise<boolean> {
    try {
      await fs.stat(paperDir(paperId));
      return true;
    } catch {
      return false;
    }
  },

  // Settings operations
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
    } catch {
      return null;
    }
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/lib/storage.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts __tests__/lib/storage.test.ts
git commit -m "feat: add file storage module for paper data management"
```

---

### Task 5: Implement API Key Encryption Module

**Files:**
- Create: `src/lib/crypto.ts`
- Test: `__tests__/lib/crypto.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/crypto.test.ts`:
```typescript
import { encryptApiKey, decryptApiKey } from '@/lib/crypto';

describe('crypto', () => {
  it('encrypts and decrypts an API key', () => {
    const apiKey = 'sk-test-1234567890abcdef';
    const { encrypted, iv } = encryptApiKey(apiKey);
    expect(encrypted).not.toBe(apiKey);
    expect(iv).toBeTruthy();
    const decrypted = decryptApiKey(encrypted, iv);
    expect(decrypted).toBe(apiKey);
  });

  it('produces different ciphertexts for the same key (random IV)', () => {
    const apiKey = 'sk-test-key';
    const result1 = encryptApiKey(apiKey);
    const result2 = encryptApiKey(apiKey);
    expect(result1.encrypted).not.toBe(result2.encrypted);
    expect(result1.iv).not.toBe(result2.iv);
  });

  it('throws on tampered ciphertext', () => {
    const { encrypted, iv } = encryptApiKey('sk-test');
    expect(() => decryptApiKey(encrypted + 'tampered', iv)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/lib/crypto.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

Create `src/lib/crypto.ts`:
```typescript
import crypto from 'crypto';
import os from 'os';

function getMachineKey(): Buffer {
  const hostname = os.hostname();
  return crypto.createHash('sha256').update(hostname).digest();
}

export function encryptApiKey(apiKey: string): { encrypted: string; iv: string } {
  const key = getMachineKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return {
    encrypted: encrypted + ':' + authTag.toString('hex'),
    iv: iv.toString('hex'),
  };
}

export function decryptApiKey(encrypted: string, iv: string): string {
  const key = getMachineKey();
  const [data, authTag] = encrypted.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(data, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/lib/crypto.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/crypto.ts __tests__/lib/crypto.test.ts
git commit -m "feat: add AES-256-GCM encryption for API key storage"
```

---

## Chunk 3: PDF Parsing & AI Integration

### Task 6: Implement Marker Integration

**Files:**
- Create: `src/lib/marker.ts`, `scripts/parse-pdf.py`
- Test: `__tests__/lib/marker.test.ts`

- [ ] **Step 1: Create the Python parsing script**

Create `scripts/parse-pdf.py`:
```python
#!/usr/bin/env python3
"""Parse a PDF file to Markdown using Marker."""
import sys
import json
import os

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: parse-pdf.py <pdf_path> <output_dir>"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_dir = sys.argv[2]

    if not os.path.exists(pdf_path):
        print(json.dumps({"error": f"File not found: {pdf_path}"}))
        sys.exit(1)

    try:
        from marker.converters.pdf import PdfConverter
        from marker.models import create_model_dict
        from marker.output import text_from_rendered

        converter = PdfConverter(artifact_dict=create_model_dict())
        rendered = converter(pdf_path)
        text, _, images = text_from_rendered(rendered)

        # Save images
        images_dir = os.path.join(output_dir, "images")
        os.makedirs(images_dir, exist_ok=True)
        for img_name, img_data in images.items():
            img_path = os.path.join(images_dir, img_name)
            img_data.save(img_path)

        # Output markdown to stdout
        print(text)
    except ImportError:
        print(json.dumps({"error": "marker-pdf not installed. Run: pip install marker-pdf"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Make script executable**

```bash
chmod +x scripts/parse-pdf.py
```

- [ ] **Step 3: Write the failing test**

Create `__tests__/lib/marker.test.ts`:
```typescript
import { parsePdfWithMarker } from '@/lib/marker';
import { spawn } from 'child_process';

// Mock child_process to avoid needing Python/Marker installed during tests
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

describe('parsePdfWithMarker', () => {
  it('returns parsed markdown on success', async () => {
    const mockProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
    };

    mockSpawn.mockReturnValue(mockProcess as any);

    const promise = parsePdfWithMarker('/test.pdf', '/output');

    // Simulate stdout data
    const stdoutCallback = mockProcess.stdout.on.mock.calls.find(
      (c: any[]) => c[0] === 'data'
    )![1];
    stdoutCallback(Buffer.from('# Parsed Content\n\nSome text'));

    // Simulate process close with success
    const closeCallback = mockProcess.on.mock.calls.find(
      (c: any[]) => c[0] === 'close'
    )![1];
    closeCallback(0);

    const result = await promise;
    expect(result).toBe('# Parsed Content\n\nSome text');
  });

  it('rejects on non-zero exit code', async () => {
    const mockProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn(),
    };

    mockSpawn.mockReturnValue(mockProcess as any);

    const promise = parsePdfWithMarker('/test.pdf', '/output');

    const stderrCallback = mockProcess.stderr.on.mock.calls.find(
      (c: any[]) => c[0] === 'data'
    )![1];
    stderrCallback(Buffer.from('Error occurred'));

    const closeCallback = mockProcess.on.mock.calls.find(
      (c: any[]) => c[0] === 'close'
    )![1];
    closeCallback(1);

    await expect(promise).rejects.toThrow('Marker failed');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

```bash
npx jest __tests__/lib/marker.test.ts
```
Expected: FAIL

- [ ] **Step 5: Write implementation**

Create `src/lib/marker.ts`:
```typescript
import { spawn } from 'child_process';
import path from 'path';

export async function parsePdfWithMarker(
  pdfPath: string,
  outputDir: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'parse-pdf.py');
    const proc = spawn('python3', [scriptPath, pdfPath, outputDir]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code: number | null) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Marker failed (exit ${code}): ${stderr}`));
      }
    });

    proc.on('error', (err: Error) => {
      reject(new Error(`Failed to start Marker: ${err.message}`));
    });
  });
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npx jest __tests__/lib/marker.test.ts
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/marker.ts scripts/parse-pdf.py __tests__/lib/marker.test.ts
git commit -m "feat: add Marker PDF-to-Markdown integration via Python subprocess"
```

---

### Task 7: Implement AI Client

**Files:**
- Create: `src/lib/ai-client.ts`, `src/lib/ai-config.ts`, `src/lib/prompts.ts`
- Test: `__tests__/lib/ai-client.test.ts`

- [ ] **Step 1: Write AI prompt templates**

Create `src/lib/prompts.ts`:
```typescript
export const ANALYSIS_PROMPT = `You are an academic paper analyst. Given the following paper content in Markdown format, provide a structured analysis.

For each section, include page references where relevant content appears. Format references as JSON arrays.

Respond in the SAME LANGUAGE as the paper content. If the paper is in Chinese, respond in Chinese. If in English, respond in English.

Paper content:
{content}

Provide your analysis in the following JSON format:
{
  "summary": {
    "content": "Core summary of the paper's main ideas and innovations",
    "references": [{"text": "quoted text snippet", "page": 1}]
  },
  "contributions": {
    "items": ["Contribution 1", "Contribution 2"],
    "references": [{"text": "quoted text snippet", "page": 2}]
  },
  "methodology": {
    "content": "Overview of research methods and technical approach",
    "references": [{"text": "quoted text snippet", "page": 3}]
  },
  "conclusions": {
    "content": "Key findings and conclusions",
    "references": [{"text": "quoted text snippet", "page": 10}]
  }
}

IMPORTANT: Return ONLY valid JSON. No markdown code blocks, no extra text.`;

export const CHAT_PROMPT = `You are an academic paper assistant. Answer the user's question based on the paper content provided.

Respond in the SAME LANGUAGE as the user's question.

Paper content:
{content}

Previous conversation:
{history}

User question: {question}

Provide a clear, accurate answer based on the paper content.`;
```

- [ ] **Step 1b: Create shared AI config module**

Create `src/lib/ai-config.ts`:
```typescript
import { storage } from '@/lib/storage';
import { decryptApiKey } from '@/lib/crypto';

export async function getAIConfig() {
  const settings = await storage.getSettings();

  let apiKey = process.env.AI_API_KEY || '';
  const baseUrl =
    (settings?.baseUrl as string) || process.env.AI_BASE_URL || 'https://api.openai.com/v1';
  const model = (settings?.model as string) || process.env.AI_MODEL || 'gpt-4o';

  if (settings?.apiKeyEncrypted && settings?.apiKeyIV) {
    try {
      apiKey = decryptApiKey(
        settings.apiKeyEncrypted as string,
        settings.apiKeyIV as string
      );
    } catch {
      // Fall back to env var
    }
  }

  return { apiKey, baseUrl, model };
}
```

- [ ] **Step 2: Write the failing test**

Create `__tests__/lib/ai-client.test.ts`:
```typescript
import { createAIClient } from '@/lib/ai-client';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('createAIClient', () => {
  const client = createAIClient({
    baseUrl: 'https://api.test.com/v1',
    apiKey: 'sk-test',
    model: 'gpt-4o',
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  describe('complete', () => {
    it('sends a request and returns the response content', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: '{"summary": "test"}' } }],
        }),
      });

      const result = await client.complete([
        { role: 'user', content: 'Analyze this paper' },
      ]);

      expect(result).toBe('{"summary": "test"}');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.test.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer sk-test',
          }),
        })
      );
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'Invalid API key',
      });

      await expect(
        client.complete([{ role: 'user', content: 'test' }])
      ).rejects.toThrow('API call failed');
    });
  });

  describe('streamComplete', () => {
    it('yields chunks from SSE stream', async () => {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n')
          );
          controller.enqueue(
            encoder.encode('data: {"choices":[{"delta":{"content":" World"}}]}\n\n')
          );
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        },
      });

      mockFetch.mockResolvedValue({
        ok: true,
        body: stream,
      });

      const chunks: string[] = [];
      for await (const chunk of client.streamComplete([
        { role: 'user', content: 'test' },
      ])) {
        chunks.push(chunk);
      }

      expect(chunks).toEqual(['Hello', ' World']);
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx jest __tests__/lib/ai-client.test.ts
```
Expected: FAIL

- [ ] **Step 4: Write implementation**

Create `src/lib/ai-client.ts`:
```typescript
interface AIClientConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function createAIClient(config: AIClientConfig) {
  const { baseUrl, apiKey, model } = config;

  async function complete(messages: Message[]): Promise<string> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, stream: false }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API call failed (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  async function* streamComplete(
    messages: Message[]
  ): AsyncGenerator<string> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, stream: true }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API call failed (${response.status}): ${errorText}`
      );
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // Skip malformed lines
        }
      }
    }
  }

  return { complete, streamComplete };
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest __tests__/lib/ai-client.test.ts
```
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/ai-client.ts src/lib/ai-config.ts src/lib/prompts.ts __tests__/lib/ai-client.test.ts
git commit -m "feat: add AI client with streaming support and prompt templates"
```

---

## Chunk 4: API Routes

### Task 8: Upload API Route

**Files:**
- Create: `src/app/api/upload/route.ts`
- Test: `__tests__/api/upload.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/upload.test.ts`:
```typescript
import { POST } from '@/app/api/upload/route';
import { storage } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  storage: {
    createPaperDir: jest.fn(),
    savePdf: jest.fn(),
    saveMetadata: jest.fn(),
  },
}));

jest.mock('uuid', () => ({ v4: () => 'test-uuid-123' }));

describe('POST /api/upload', () => {
  it('uploads a PDF and returns paper ID', async () => {
    const file = new File(['fake pdf content'], 'test.pdf', {
      type: 'application/pdf',
    });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe('test-uuid-123');
    expect(data.status).toBe('pending');
    expect(storage.createPaperDir).toHaveBeenCalledWith('test-uuid-123');
    expect(storage.savePdf).toHaveBeenCalled();
    expect(storage.saveMetadata).toHaveBeenCalled();
  });

  it('rejects non-PDF files', async () => {
    const file = new File(['not a pdf'], 'test.txt', {
      type: 'text/plain',
    });
    const formData = new FormData();
    formData.append('file', file);

    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe('INVALID_FILE_TYPE');
  });

  it('rejects missing file', async () => {
    const formData = new FormData();
    const request = new Request('http://localhost/api/upload', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/upload.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

Create `src/app/api/upload/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return createErrorResponse('INVALID_FILE_TYPE', 'No file provided');
    }

    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      return createErrorResponse('INVALID_FILE_TYPE', 'Only PDF files are supported');
    }

    if (file.size > MAX_FILE_SIZE) {
      return createErrorResponse('FILE_TOO_LARGE', 'File exceeds 50MB limit');
    }

    const paperId = uuidv4();
    const buffer = Buffer.from(await file.arrayBuffer());

    await storage.createPaperDir(paperId);
    await storage.savePdf(paperId, buffer);
    await storage.saveMetadata(paperId, {
      id: paperId,
      title: file.name.replace(/\.pdf$/i, ''),
      filename: file.name,
      pages: 0, // Will be updated after parsing
      createdAt: new Date().toISOString(),
      status: 'pending',
    });

    return NextResponse.json({ id: paperId, status: 'pending' }, { status: 201 });
  } catch (error) {
    return createErrorResponse(
      'PARSING_FAILED',
      `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/upload.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/upload/route.ts __tests__/api/upload.test.ts
git commit -m "feat: add PDF upload API route with validation"
```

---

### Task 9: Analyze API Route (SSE Streaming)

**Files:**
- Create: `src/app/api/analyze/route.ts`
- Test: `__tests__/api/analyze.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/analyze.test.ts`:
```typescript
import { POST } from '@/app/api/analyze/route';
import { storage } from '@/lib/storage';
import * as marker from '@/lib/marker';

jest.mock('@/lib/storage', () => ({
  storage: {
    paperExists: jest.fn(),
    getMetadata: jest.fn(),
    saveMetadata: jest.fn(),
    getPdfPath: jest.fn(),
    saveParsedContent: jest.fn(),
    saveAnalysis: jest.fn(),
  },
}));

jest.mock('@/lib/marker', () => ({
  parsePdfWithMarker: jest.fn(),
}));

// Mock fetch for AI API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('POST /api/analyze', () => {
  beforeEach(() => {
    process.env.AI_API_KEY = 'sk-test';
    process.env.AI_BASE_URL = 'https://api.test.com/v1';
    process.env.AI_MODEL = 'gpt-4o';
  });

  it('returns 404 for non-existent paper', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(false);

    const request = new Request('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperId: 'non-existent' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it('returns 400 when API key is not configured', async () => {
    delete process.env.AI_API_KEY;
    (storage.paperExists as jest.Mock).mockResolvedValue(true);

    const request = new Request('http://localhost/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperId: 'test-id' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/analyze.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

Create `src/app/api/analyze/route.ts`:
```typescript
import { storage } from '@/lib/storage';
import { parsePdfWithMarker } from '@/lib/marker';
import { createAIClient } from '@/lib/ai-client';
import { createErrorResponse } from '@/lib/errors';
import { ANALYSIS_PROMPT } from '@/lib/prompts';
import { getAIConfig } from '@/lib/ai-config';
import type { PaperAnalysis } from '@/types';

export async function POST(request: Request) {
  try {
    const { paperId } = await request.json();

    if (!paperId) {
      return createErrorResponse('PAPER_NOT_FOUND', 'paperId is required');
    }

    const exists = await storage.paperExists(paperId);
    if (!exists) {
      return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
    }

    const { apiKey, baseUrl, model } = await getAIConfig();
    if (!apiKey) {
      return createErrorResponse('API_KEY_MISSING', 'API key is not configured');
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          // Step 1: Parse PDF with Marker
          send({ step: 'parsing' });
          await storage.saveMetadata(paperId, {
            ...(await storage.getMetadata(paperId)),
            status: 'parsing',
          });

          const pdfPath = storage.getPdfPath(paperId);
          const paperDir = pdfPath.replace('/original.pdf', '');
          const markdown = await parsePdfWithMarker(pdfPath, paperDir);
          await storage.saveParsedContent(paperId, markdown);

          // Step 2: AI Analysis
          send({ step: 'analyzing' });
          await storage.saveMetadata(paperId, {
            ...(await storage.getMetadata(paperId)),
            status: 'analyzing',
          });

          const client = createAIClient({ baseUrl, apiKey, model });
          const prompt = ANALYSIS_PROMPT.replace('{content}', markdown);
          const result = await client.complete([
            { role: 'user', content: prompt },
          ]);

          // Parse AI response as structured analysis
          const analysis: PaperAnalysis = {
            ...JSON.parse(result),
            generatedAt: new Date().toISOString(),
          };

          await storage.saveAnalysis(paperId, analysis);

          // Send section results
          for (const section of ['summary', 'contributions', 'methodology', 'conclusions'] as const) {
            const sectionData = analysis[section];
            send({
              section,
              content: 'content' in sectionData ? sectionData.content : JSON.stringify(sectionData.items),
            });
          }

          // Update status
          await storage.saveMetadata(paperId, {
            ...(await storage.getMetadata(paperId)),
            status: 'analyzed',
          });

          send({ done: true });
        } catch (error) {
          await storage.saveMetadata(paperId, {
            ...(await storage.getMetadata(paperId)),
            status: 'error',
          });
          send({
            error: error instanceof Error ? error.message : 'Analysis failed',
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return createErrorResponse(
      'ANALYSIS_FAILED',
      `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/analyze.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/analyze/route.ts __tests__/api/analyze.test.ts
git commit -m "feat: add paper analysis API with SSE streaming and Marker integration"
```

---

### Task 10: Chat API Route (SSE Streaming)

**Files:**
- Create: `src/app/api/chat/route.ts`
- Test: `__tests__/api/chat.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/chat.test.ts`:
```typescript
import { POST } from '@/app/api/chat/route';
import { storage } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  storage: {
    paperExists: jest.fn(),
    getParsedContent: jest.fn(),
    getChatHistory: jest.fn(),
    saveChatHistory: jest.fn(),
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
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/chat.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

Create `src/app/api/chat/route.ts`:
```typescript
import { storage } from '@/lib/storage';
import { createAIClient } from '@/lib/ai-client';
import { createErrorResponse } from '@/lib/errors';
import { CHAT_PROMPT } from '@/lib/prompts';
import { getAIConfig } from '@/lib/ai-config';

export async function POST(request: Request) {
  try {
    const { paperId, message } = await request.json();

    if (!paperId) {
      return createErrorResponse('VALIDATION_ERROR', 'paperId is required');
    }

    if (!message) {
      return createErrorResponse('VALIDATION_ERROR', 'message is required');
    }

    const exists = await storage.paperExists(paperId);
    if (!exists) {
      return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
    }

    const { apiKey, baseUrl, model } = await getAIConfig();
    if (!apiKey) {
      return createErrorResponse('API_KEY_MISSING', 'API key is not configured');
    }

    const parsedContent = await storage.getParsedContent(paperId);
    const chatHistory = await storage.getChatHistory(paperId);

    // Build context
    const historyStr = chatHistory.messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const prompt = CHAT_PROMPT
      .replace('{content}', parsedContent || '')
      .replace('{history}', historyStr)
      .replace('{question}', message);

    const client = createAIClient({ baseUrl, apiKey, model });
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          let fullResponse = '';

          for await (const chunk of client.streamComplete([
            { role: 'user', content: prompt },
          ])) {
            fullResponse += chunk;
            send({ content: chunk });
          }

          // Save to chat history
          chatHistory.messages.push(
            { role: 'user', content: message },
            { role: 'assistant', content: fullResponse }
          );
          await storage.saveChatHistory(paperId, chatHistory);

          send({ done: true });
        } catch (error) {
          send({
            error: error instanceof Error ? error.message : 'Chat failed',
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    return createErrorResponse(
      'API_CALL_FAILED',
      `Chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/chat.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/chat/route.ts __tests__/api/chat.test.ts
git commit -m "feat: add chat API with SSE streaming and conversation history"
```

---

### Task 11: Papers List & Paper Detail API Routes

**Files:**
- Create: `src/app/api/papers/route.ts`, `src/app/api/paper/[id]/route.ts`
- Test: `__tests__/api/papers.test.ts`, `__tests__/api/paper-id.test.ts`

- [ ] **Step 1: Write the failing tests for papers list**

Create `__tests__/api/papers.test.ts`:
```typescript
import { GET } from '@/app/api/papers/route';
import { storage } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  storage: {
    listPapers: jest.fn(),
  },
}));

describe('GET /api/papers', () => {
  it('returns a list of papers', async () => {
    (storage.listPapers as jest.Mock).mockResolvedValue([
      { id: '1', title: 'Paper 1', createdAt: '2025-03-11', status: 'analyzed' },
    ]);

    const request = new Request('http://localhost/api/papers');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.papers).toHaveLength(1);
    expect(data.papers[0].id).toBe('1');
  });

  it('returns empty array when no papers', async () => {
    (storage.listPapers as jest.Mock).mockResolvedValue([]);

    const request = new Request('http://localhost/api/papers');
    const response = await GET(request);
    const data = await response.json();

    expect(data.papers).toEqual([]);
  });
});
```

- [ ] **Step 2: Write the failing tests for paper detail**

Create `__tests__/api/paper-id.test.ts`:
```typescript
import { GET, DELETE } from '@/app/api/paper/[id]/route';
import { storage } from '@/lib/storage';

jest.mock('@/lib/storage', () => ({
  storage: {
    paperExists: jest.fn(),
    getMetadata: jest.fn(),
    getAnalysis: jest.fn(),
    getParsedContent: jest.fn(),
    getChatHistory: jest.fn(),
    deletePaper: jest.fn(),
  },
}));

const params = { id: 'test-123' };

describe('GET /api/paper/[id]', () => {
  it('returns paper data including chat history', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getMetadata as jest.Mock).mockResolvedValue({
      id: 'test-123',
      title: 'Test',
      filename: 'test.pdf',
      pages: 5,
      createdAt: '2025-03-11',
      status: 'analyzed',
    });
    (storage.getAnalysis as jest.Mock).mockResolvedValue({ summary: {} });
    (storage.getParsedContent as jest.Mock).mockResolvedValue('# Content');
    (storage.getChatHistory as jest.Mock).mockResolvedValue({ messages: [] });

    const request = new Request('http://localhost/api/paper/test-123');
    const response = await GET(request, { params: Promise.resolve(params) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.metadata.id).toBe('test-123');
    expect(data.parsedContent).toBe('# Content');
    expect(data.chatHistory).toEqual({ messages: [] });
  });

  it('returns 404 for non-existent paper', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(false);

    const request = new Request('http://localhost/api/paper/missing');
    const response = await GET(request, { params: Promise.resolve({ id: 'missing' }) });
    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/paper/[id]', () => {
  it('deletes a paper', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);

    const request = new Request('http://localhost/api/paper/test-123', {
      method: 'DELETE',
    });
    const response = await DELETE(request, { params: Promise.resolve(params) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(storage.deletePaper).toHaveBeenCalledWith('test-123');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx jest __tests__/api/papers.test.ts __tests__/api/paper-id.test.ts
```
Expected: FAIL

- [ ] **Step 4: Write papers list implementation**

Create `src/app/api/papers/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';

export async function GET() {
  const papers = await storage.listPapers();
  return NextResponse.json({ papers });
}
```

- [ ] **Step 5: Write paper detail implementation**

Create `src/app/api/paper/[id]/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const exists = await storage.paperExists(id);
  if (!exists) {
    return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
  }

  const [metadata, analysis, parsedContent, chatHistory] = await Promise.all([
    storage.getMetadata(id),
    storage.getAnalysis(id),
    storage.getParsedContent(id),
    storage.getChatHistory(id),
  ]);

  return NextResponse.json({ metadata, analysis, parsedContent, chatHistory });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const exists = await storage.paperExists(id);
  if (!exists) {
    return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
  }

  await storage.deletePaper(id);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx jest __tests__/api/papers.test.ts __tests__/api/paper-id.test.ts
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/api/papers/route.ts src/app/api/paper/\[id\]/route.ts __tests__/api/papers.test.ts __tests__/api/paper-id.test.ts
git commit -m "feat: add paper list and detail API routes with CRUD operations"
```

---

### Task 12: Settings API Route

**Files:**
- Create: `src/app/api/settings/route.ts`
- Test: `__tests__/api/settings.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/api/settings.test.ts`:
```typescript
import { GET, POST } from '@/app/api/settings/route';
import { storage } from '@/lib/storage';
import * as cryptoModule from '@/lib/crypto';

jest.mock('@/lib/storage', () => ({
  storage: {
    getSettings: jest.fn(),
    saveSettings: jest.fn(),
  },
}));

jest.mock('@/lib/crypto', () => ({
  encryptApiKey: jest.fn().mockReturnValue({
    encrypted: 'enc-data',
    iv: 'enc-iv',
  }),
  decryptApiKey: jest.fn().mockReturnValue('sk-decrypted'),
}));

describe('GET /api/settings', () => {
  it('returns settings without exposing API key', async () => {
    (storage.getSettings as jest.Mock).mockResolvedValue({
      baseUrl: 'https://api.test.com/v1',
      apiKeyEncrypted: 'encrypted',
      apiKeyIV: 'iv',
      model: 'gpt-4o',
      visionModel: 'gpt-4o',
    });

    const request = new Request('http://localhost/api/settings');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.baseUrl).toBe('https://api.test.com/v1');
    expect(data.hasApiKey).toBe(true);
    expect(data.apiKeyEncrypted).toBeUndefined();
  });
});

describe('POST /api/settings', () => {
  it('saves settings with encrypted API key', async () => {
    const request = new Request('http://localhost/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baseUrl: 'https://api.test.com/v1',
        apiKey: 'sk-new-key',
        model: 'gpt-4o',
        visionModel: 'gpt-4o',
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(storage.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: 'https://api.test.com/v1',
        apiKeyEncrypted: 'enc-data',
        apiKeyIV: 'enc-iv',
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest __tests__/api/settings.test.ts
```
Expected: FAIL

- [ ] **Step 3: Write implementation**

Create `src/app/api/settings/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { encryptApiKey } from '@/lib/crypto';

export async function GET() {
  const settings = await storage.getSettings();

  if (!settings) {
    return NextResponse.json({
      baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1',
      model: process.env.AI_MODEL || 'gpt-4o',
      visionModel: process.env.AI_VISION_MODEL || 'gpt-4o',
      hasApiKey: !!process.env.AI_API_KEY,
    });
  }

  return NextResponse.json({
    baseUrl: settings.baseUrl,
    model: settings.model,
    visionModel: settings.visionModel,
    hasApiKey: !!(settings.apiKeyEncrypted || process.env.AI_API_KEY),
  });
}

export async function POST(request: Request) {
  const { baseUrl, apiKey, model, visionModel } = await request.json();

  const settingsToSave: Record<string, unknown> = {
    baseUrl: baseUrl || 'https://api.openai.com/v1',
    model: model || 'gpt-4o',
    visionModel: visionModel || 'gpt-4o',
  };

  if (apiKey) {
    const { encrypted, iv } = encryptApiKey(apiKey);
    settingsToSave.apiKeyEncrypted = encrypted;
    settingsToSave.apiKeyIV = iv;
  }

  await storage.saveSettings(settingsToSave);

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest __tests__/api/settings.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/settings/route.ts __tests__/api/settings.test.ts
git commit -m "feat: add settings API with encrypted API key storage"
```

---

## Chunk 5: Frontend Components

### Task 13: SSE Hook and Paper Data Hook

**Files:**
- Create: `src/hooks/use-sse.ts`, `src/hooks/use-paper.ts`

- [ ] **Step 1: Create SSE hook**

Create `src/hooks/use-sse.ts`:
```typescript
'use client';

import { useState, useCallback, useRef } from 'react';

interface UseSSEOptions {
  onMessage?: (data: Record<string, unknown>) => void;
  onError?: (error: Error) => void;
  onDone?: () => void;
}

export function useSSE(url: string, options: UseSSEOptions = {}) {
  const [isStreaming, setIsStreaming] = useState(false);
  // Use refs to avoid stale closures in the useCallback dependency array
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const start = useCallback(
    async (body: Record<string, unknown>) => {
      setIsStreaming(true);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Request failed');
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;

            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.done) {
                optionsRef.current.onDone?.();
              } else if (data.error) {
                optionsRef.current.onError?.(new Error(data.error));
              } else {
                optionsRef.current.onMessage?.(data);
              }
            } catch {
              // Skip malformed lines
            }
          }
        }
      } catch (error) {
        optionsRef.current.onError?.(
          error instanceof Error ? error : new Error('Stream failed')
        );
      } finally {
        setIsStreaming(false);
      }
    },
    [url]
  );

  return { isStreaming, start };
}
```

- [ ] **Step 2: Create paper data hook**

Create `src/hooks/use-paper.ts`:
```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PaperData } from '@/types';

export function usePaper(paperId: string) {
  const [data, setData] = useState<PaperData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPaper = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/paper/${paperId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to load paper');
      }
      const paperData = await response.json();
      setData(paperData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load paper');
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  useEffect(() => {
    fetchPaper();
  }, [fetchPaper]);

  return { data, loading, error, refetch: fetchPaper };
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-sse.ts src/hooks/use-paper.ts
git commit -m "feat: add SSE streaming hook and paper data fetching hook"
```

---

### Task 14: PDF Viewer Component

**Files:**
- Create: `src/components/pdf-viewer.tsx`

- [ ] **Step 1: Create PDF viewer component**

Create `src/components/pdf-viewer.tsx`:
```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PdfViewerProps {
  url: string;
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

export function PdfViewer({ url, currentPage = 1, onPageChange }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(currentPage);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);

  // Load PDF document
  useEffect(() => {
    let cancelled = false;

    async function loadPdf() {
      setLoading(true);
      const loadingTask = pdfjsLib.getDocument(url);
      const pdfDoc = await loadingTask.promise;
      if (!cancelled) {
        setPdf(pdfDoc);
        setTotalPages(pdfDoc.numPages);
        setLoading(false);
      }
    }

    loadPdf();
    return () => { cancelled = true; };
  }, [url]);

  // Navigate to page when prop changes
  useEffect(() => {
    if (currentPage > 0 && currentPage <= totalPages) {
      setPage(currentPage);
    }
  }, [currentPage, totalPages]);

  // Render current page
  useEffect(() => {
    if (!pdf || !canvasRef.current) return;

    let cancelled = false;

    async function renderPage() {
      const pdfPage = await pdf!.getPage(page);
      const viewport = pdfPage.getViewport({ scale });
      const canvas = canvasRef.current!;
      const context = canvas.getContext('2d')!;
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      if (!cancelled) {
        await pdfPage.render({ canvasContext: context, viewport }).promise;
      }
    }

    renderPage();
    return () => { cancelled = true; };
  }, [pdf, page, scale]);

  const goToPage = (p: number) => {
    if (p >= 1 && p <= totalPages) {
      setPage(p);
      onPageChange?.(p);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        Loading PDF...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b">
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="px-2 py-1 text-sm bg-white border rounded disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            className="px-2 py-1 text-sm bg-white border rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
            className="px-2 py-1 text-sm bg-white border rounded"
          >
            -
          </button>
          <span className="text-sm">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.2))}
            className="px-2 py-1 text-sm bg-white border rounded"
          >
            +
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto bg-gray-200 flex justify-center p-4">
        <canvas ref={canvasRef} className="shadow-lg" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/pdf-viewer.tsx
git commit -m "feat: add PDF.js viewer component with zoom and navigation"
```

---

### Task 15: Upload Zone Component

**Files:**
- Create: `src/components/upload-zone.tsx`

- [ ] **Step 1: Create upload zone component**

Create `src/components/upload-zone.tsx`:
```tsx
'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

export function UploadZone() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  const uploadFile = useCallback(
    async (file: File) => {
      if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
        setError('Please upload a PDF file');
        return;
      }

      setUploading(true);
      setError(null);
      setProgress('Uploading...');

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Upload failed');
        }

        const { id } = await response.json();
        setProgress('Upload complete! Redirecting...');
        router.push(`/paper/${id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        setUploading(false);
        setProgress('');
      }
    },
    [router]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
        isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-300 hover:border-gray-400'
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {uploading ? (
        <div>
          <div className="text-lg text-gray-600">{progress}</div>
          <div className="mt-4 w-48 mx-auto h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse w-full" />
          </div>
        </div>
      ) : (
        <div>
          <div className="text-4xl mb-4">📄</div>
          <div className="text-lg text-gray-600 mb-2">
            Drag & drop your PDF here
          </div>
          <div className="text-sm text-gray-400">or click to select a file</div>
        </div>
      )}

      {error && (
        <div className="mt-4 text-red-500 text-sm">{error}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/upload-zone.tsx
git commit -m "feat: add drag-and-drop upload zone component"
```

---

### Task 16: Analysis Panel Components

**Files:**
- Create: `src/components/section-tabs.tsx`, `src/components/analysis-panel.tsx`, `src/components/streaming-text.tsx`

- [ ] **Step 1: Create section tabs**

Create `src/components/section-tabs.tsx`:
```tsx
'use client';

interface SectionTabsProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const SECTIONS = [
  { key: 'summary', label: 'Summary' },
  { key: 'contributions', label: 'Contributions' },
  { key: 'methodology', label: 'Methodology' },
  { key: 'conclusions', label: 'Conclusions' },
  { key: 'chat', label: 'Q&A' },
];

export function SectionTabs({ activeSection, onSectionChange }: SectionTabsProps) {
  return (
    <div className="flex border-b">
      {SECTIONS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onSectionChange(key)}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeSection === key
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create streaming text component**

Create `src/components/streaming-text.tsx`:
```tsx
'use client';

interface StreamingTextProps {
  content: string;
  isStreaming?: boolean;
}

export function StreamingText({ content, isStreaming }: StreamingTextProps) {
  return (
    <div className="prose prose-sm max-w-none">
      <div className="whitespace-pre-wrap">{content}</div>
      {isStreaming && (
        <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create analysis panel**

Create `src/components/analysis-panel.tsx`:
```tsx
'use client';

import { useState, useCallback } from 'react';
import type { PaperAnalysis, PageReference, ChatMessage } from '@/types';
import { SectionTabs } from './section-tabs';
import { ChatInput } from './chat-input';
import { ChatMessages } from './chat-messages';
import { StreamingText } from './streaming-text';

interface AnalysisPanelProps {
  paperId: string;
  analysis: PaperAnalysis | null;
  initialChatMessages?: ChatMessage[];
  isAnalyzing?: boolean;
  onReferenceClick?: (page: number) => void;
}

function ReferenceLink({
  reference,
  onClick,
}: {
  reference: PageReference;
  onClick?: (page: number) => void;
}) {
  return (
    <button
      onClick={() => onClick?.(reference.page)}
      className="inline-flex items-center text-xs text-blue-500 hover:text-blue-700 hover:underline ml-1"
      title={reference.text}
    >
      [p.{reference.page}]
    </button>
  );
}

function SectionContent({
  analysis,
  section,
  onReferenceClick,
}: {
  analysis: PaperAnalysis;
  section: string;
  onReferenceClick?: (page: number) => void;
}) {
  const sectionData = analysis[section as keyof PaperAnalysis];
  if (!sectionData || typeof sectionData === 'string') return null;

  if (section === 'contributions' && 'items' in sectionData) {
    return (
      <div>
        <ul className="list-disc pl-5 space-y-2">
          {sectionData.items.map((item, i) => (
            <li key={i} className="text-gray-700">{item}</li>
          ))}
        </ul>
        {sectionData.references.length > 0 && (
          <div className="mt-4 text-xs text-gray-400">
            References:
            {sectionData.references.map((ref, i) => (
              <ReferenceLink key={i} reference={ref} onClick={onReferenceClick} />
            ))}
          </div>
        )}
      </div>
    );
  }

  if ('content' in sectionData) {
    return (
      <div>
        <div className="text-gray-700 whitespace-pre-wrap">{sectionData.content}</div>
        {sectionData.references.length > 0 && (
          <div className="mt-4 text-xs text-gray-400">
            References:
            {sectionData.references.map((ref, i) => (
              <ReferenceLink key={i} reference={ref} onClick={onReferenceClick} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}

export function AnalysisPanel({
  paperId,
  analysis,
  initialChatMessages = [],
  isAnalyzing,
  onReferenceClick,
}: AnalysisPanelProps) {
  const [activeSection, setActiveSection] = useState('summary');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialChatMessages);
  const [streamingContent, setStreamingContent] = useState('');
  const [isChatStreaming, setIsChatStreaming] = useState(false);

  const handleSendMessage = useCallback(
    async (message: string) => {
      // Add user message immediately
      setChatMessages((prev) => [...prev, { role: 'user', content: message }]);
      setIsChatStreaming(true);
      setStreamingContent('');

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paperId, message }),
        });

        if (!response.ok) throw new Error('Failed to send message');

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullResponse = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.content) {
                fullResponse += data.content;
                setStreamingContent(fullResponse);
              }
              if (data.done) {
                setChatMessages((prev) => [
                  ...prev,
                  { role: 'assistant', content: fullResponse },
                ]);
                setStreamingContent('');
              }
            } catch {
              // Skip malformed lines
            }
          }
        }
      } catch (error) {
        console.error('Chat error:', error);
      } finally {
        setIsChatStreaming(false);
      }
    },
    [paperId]
  );

  if (isAnalyzing) {
    return (
      <div className="flex flex-col h-full">
        <SectionTabs activeSection={activeSection} onSectionChange={setActiveSection} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <div className="text-gray-500">Analyzing paper...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        No analysis yet. Click "Analyze" to start.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <SectionTabs activeSection={activeSection} onSectionChange={setActiveSection} />
      <div className="flex-1 overflow-auto p-4">
        {activeSection === 'chat' ? (
          <div className="flex flex-col h-full">
            <div className="flex-1 overflow-auto">
              <ChatMessages
                messages={chatMessages}
                streamingContent={streamingContent}
                isStreaming={isChatStreaming}
              />
            </div>
            <ChatInput
              onSend={handleSendMessage}
              disabled={isChatStreaming}
            />
          </div>
        ) : (
          <SectionContent
            analysis={analysis}
            section={activeSection}
            onReferenceClick={onReferenceClick}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/section-tabs.tsx src/components/streaming-text.tsx src/components/analysis-panel.tsx
git commit -m "feat: add analysis panel with section tabs and reference links"
```

---

### Task 17: Chat Components

**Files:**
- Create: `src/components/chat-input.tsx`, `src/components/chat-messages.tsx`

- [ ] **Step 1: Create chat messages component**

Create `src/components/chat-messages.tsx`:
```tsx
'use client';

import { useEffect, useRef } from 'react';
import type { ChatMessage } from '@/types';

interface ChatMessagesProps {
  messages: ChatMessage[];
  streamingContent?: string;
  isStreaming?: boolean;
}

export function ChatMessages({ messages, streamingContent, isStreaming }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  return (
    <div className="space-y-4 pb-4">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-lg px-4 py-2 ${
              msg.role === 'user'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            <div className="whitespace-pre-wrap">{msg.content}</div>
          </div>
        </div>
      ))}
      {isStreaming && streamingContent && (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-100 text-gray-700">
            <div className="whitespace-pre-wrap">{streamingContent}</div>
            <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 2: Create chat input component**

Create `src/components/chat-input.tsx`:
```tsx
'use client';

import { useState, useCallback } from 'react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = useCallback(() => {
    if (!message.trim() || disabled) return;
    onSend(message.trim());
    setMessage('');
  }, [message, disabled, onSend]);

  return (
    <div className="flex gap-2 border-t pt-3">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
        placeholder="Ask a question about this paper..."
        disabled={disabled}
        className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={!message.trim() || disabled}
        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
      >
        {disabled ? 'Sending...' : 'Send'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/chat-messages.tsx src/components/chat-input.tsx
git commit -m "feat: add chat message list and input components"
```

---

### Task 18: Paper Card Component

**Files:**
- Create: `src/components/paper-card.tsx`

- [ ] **Step 1: Create paper card component**

Create `src/components/paper-card.tsx`:
```tsx
'use client';

import Link from 'next/link';
import type { PaperListItem } from '@/types';

interface PaperCardProps {
  paper: PaperListItem;
  onDelete?: (id: string) => void;
}

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  pending: { text: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  parsing: { text: 'Parsing', color: 'bg-blue-100 text-blue-700' },
  analyzing: { text: 'Analyzing', color: 'bg-purple-100 text-purple-700' },
  analyzed: { text: 'Analyzed', color: 'bg-green-100 text-green-700' },
  error: { text: 'Error', color: 'bg-red-100 text-red-700' },
};

export function PaperCard({ paper, onDelete }: PaperCardProps) {
  const status = STATUS_LABELS[paper.status] || STATUS_LABELS.pending;

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <Link
          href={`/paper/${paper.id}`}
          className="text-lg font-medium text-gray-800 hover:text-blue-600 flex-1"
        >
          {paper.title}
        </Link>
        <span className={`text-xs px-2 py-1 rounded-full ${status.color}`}>
          {status.text}
        </span>
      </div>
      <div className="flex items-center justify-between mt-3 text-sm text-gray-400">
        <span>{new Date(paper.createdAt).toLocaleDateString()}</span>
        {onDelete && (
          <button
            onClick={() => onDelete(paper.id)}
            className="text-red-400 hover:text-red-600"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/paper-card.tsx
git commit -m "feat: add paper card component for paper listing"
```

---

## Chunk 6: Pages & Layout

### Task 19: Root Layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Update root layout**

Replace `src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EasyPaper - AI Paper Reader',
  description: 'Upload and understand academic papers with AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <nav className="border-b bg-white">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" className="text-xl font-bold text-gray-800">
              EasyPaper
            </a>
            <a
              href="/settings"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Settings
            </a>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: update root layout with navigation bar"
```

---

### Task 20: Home Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create home page with upload and paper list**

Replace `src/app/page.tsx`:
```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { UploadZone } from '@/components/upload-zone';
import { PaperCard } from '@/components/paper-card';
import type { PaperListItem } from '@/types';

export default function HomePage() {
  const [papers, setPapers] = useState<PaperListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPapers = useCallback(async () => {
    try {
      const res = await fetch('/api/papers');
      const data = await res.json();
      setPapers(data.papers || []);
    } catch {
      // Ignore errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this paper?')) return;

    await fetch(`/api/paper/${id}`, { method: 'DELETE' });
    setPapers((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          EasyPaper
        </h1>
        <p className="text-gray-500">
          Upload a PDF paper and let AI help you understand it.
        </p>
      </div>

      <UploadZone />

      {papers.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">
            Your Papers
          </h2>
          <div className="grid gap-4">
            {papers.map((paper) => (
              <PaperCard
                key={paper.id}
                paper={paper}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="mt-8 text-center text-gray-400">Loading papers...</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: create home page with upload zone and paper list"
```

---

### Task 21: Paper Detail Page

**Files:**
- Create: `src/app/paper/[id]/page.tsx`

- [ ] **Step 1: Create dual-column paper detail page**

Create `src/app/paper/[id]/page.tsx`:
```tsx
'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { PdfViewer } from '@/components/pdf-viewer';
import { AnalysisPanel } from '@/components/analysis-panel';
import { usePaper } from '@/hooks/use-paper';
import { useSSE } from '@/hooks/use-sse';
import type { PaperAnalysis } from '@/types';

export default function PaperDetailPage() {
  const params = useParams();
  const paperId = params.id as string;
  const { data, loading, error, refetch } = usePaper(paperId);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PaperAnalysis | null>(null);

  const { start: startAnalysis } = useSSE('/api/analyze', {
    onMessage: (event) => {
      if ('section' in event) {
        // Update analysis incrementally
        setAnalysis((prev) => {
          if (!prev) {
            return {
              summary: { content: '', references: [] },
              contributions: { items: [], references: [] },
              methodology: { content: '', references: [] },
              conclusions: { content: '', references: [] },
              generatedAt: new Date().toISOString(),
            };
          }
          return prev;
        });
      }
    },
    onDone: () => {
      setIsAnalyzing(false);
      refetch();
    },
    onError: () => {
      setIsAnalyzing(false);
    },
  });

  const handleAnalyze = useCallback(() => {
    setIsAnalyzing(true);
    startAnalysis({ paperId });
  }, [paperId, startAnalysis]);

  const handleReferenceClick = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]">
        <div className="text-gray-400">Loading paper...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-60px)]">
        <div className="text-red-500">{error || 'Paper not found'}</div>
      </div>
    );
  }

  const displayAnalysis = data.analysis || analysis;
  const needsAnalysis = data.metadata.status === 'pending' && !isAnalyzing;

  return (
    <div className="flex h-[calc(100vh-60px)]">
      {/* Left: PDF Viewer (55%) */}
      <div className="w-[55%] border-r">
        <PdfViewer
          url={`/api/paper/${paperId}/pdf`}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Right: Analysis Panel (45%) */}
      <div className="w-[45%] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
          <h1 className="text-lg font-semibold text-gray-800 truncate">
            {data.metadata.title}
          </h1>
          {needsAnalysis && (
            <button
              onClick={handleAnalyze}
              className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
            >
              Analyze
            </button>
          )}
        </div>

        {/* Analysis */}
        <div className="flex-1 overflow-hidden">
          <AnalysisPanel
            paperId={paperId}
            analysis={displayAnalysis}
            initialChatMessages={data.chatHistory?.messages || []}
            isAnalyzing={isAnalyzing}
            onReferenceClick={handleReferenceClick}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/paper/\[id\]/page.tsx
git commit -m "feat: create dual-column paper detail page with PDF viewer and analysis"
```

---

### Task 22: Settings Page

**Files:**
- Create: `src/app/settings/page.tsx`, `src/components/settings-form.tsx`

- [ ] **Step 1: Create settings form component**

Create `src/components/settings-form.tsx`:
```tsx
'use client';

import { useState, useEffect } from 'react';

interface SettingsData {
  baseUrl: string;
  model: string;
  visionModel: string;
  hasApiKey: boolean;
}

export function SettingsForm() {
  const [settings, setSettings] = useState<SettingsData>({
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    visionModel: 'gpt-4o',
    hasApiKey: false,
  });
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        setSettings(data);
      } catch {
        // Use defaults
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const body: Record<string, string> = {
        baseUrl: settings.baseUrl,
        model: settings.model,
        visionModel: settings.visionModel,
      };
      if (apiKey) {
        body.apiKey = apiKey;
      }

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error('Failed to save settings');

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setApiKey('');
      setSettings((prev) => ({ ...prev, hasApiKey: true }));
    } catch {
      setMessage({ type: 'error', text: 'Failed to save settings.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Base URL
        </label>
        <input
          type="url"
          value={settings.baseUrl}
          onChange={(e) => setSettings({ ...settings, baseUrl: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="https://api.openai.com/v1"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          API Key
          {settings.hasApiKey && (
            <span className="ml-2 text-xs text-green-600">(configured)</span>
          )}
        </label>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={settings.hasApiKey ? 'Enter new key to update' : 'sk-xxx'}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Model
        </label>
        <input
          type="text"
          value={settings.model}
          onChange={(e) => setSettings({ ...settings, model: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="gpt-4o"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Vision Model
        </label>
        <input
          type="text"
          value={settings.visionModel}
          onChange={(e) => setSettings({ ...settings, visionModel: e.target.value })}
          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="gpt-4o"
        />
      </div>

      {message && (
        <div
          className={`text-sm ${
            message.type === 'success' ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {message.text}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create settings page**

Create `src/app/settings/page.tsx`:
```tsx
import { SettingsForm } from '@/components/settings-form';

export default function SettingsPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">
        API Settings
      </h1>
      <div className="bg-white rounded-lg border p-6">
        <SettingsForm />
      </div>
      <p className="mt-4 text-sm text-gray-400">
        Your API key is encrypted and stored locally. It never leaves your machine.
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/settings-form.tsx src/app/settings/page.tsx
git commit -m "feat: add settings page with API configuration form"
```

---

## Chunk 7: PDF Serving & Final Integration

### Task 23: PDF File Serving Route

**Files:**
- Create: `src/app/api/paper/[id]/pdf/route.ts`

The paper detail page needs to serve the uploaded PDF file to the browser for PDF.js to render.

- [ ] **Step 1: Create PDF serving route**

Create `src/app/api/paper/[id]/pdf/route.ts`:
```typescript
import { NextResponse } from 'next/server';
import { storage } from '@/lib/storage';
import { createErrorResponse } from '@/lib/errors';
import fs from 'fs/promises';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const exists = await storage.paperExists(id);
  if (!exists) {
    return createErrorResponse('PAPER_NOT_FOUND', 'Paper not found');
  }

  const pdfPath = storage.getPdfPath(id);

  try {
    const fileBuffer = await fs.readFile(pdfPath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline',
      },
    });
  } catch {
    return createErrorResponse('PAPER_NOT_FOUND', 'PDF file not found');
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/paper/\[id\]/pdf/route.ts
git commit -m "feat: add PDF file serving route for browser rendering"
```

---

### Task 24: End-to-End Verification

- [ ] **Step 1: Run all tests**

```bash
npx jest --verbose
```
Expected: All tests PASS

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```
Expected: No errors

- [ ] **Step 3: Build the application**

```bash
npm run build
```
Expected: Build succeeds

- [ ] **Step 4: Verify the dev server starts**

```bash
npm run dev
```
Expected: Server starts at http://localhost:3000

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete EasyPaper MVP with all core features"
```

---

## Summary

| Chunk | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-3 | Project scaffolding, types, error handling |
| 2 | 4-5 | File storage layer, API key encryption |
| 3 | 6-7 | Marker PDF parsing, AI client with streaming |
| 4 | 8-12 | All API routes (upload, analyze, chat, papers, settings) |
| 5 | 13-18 | Frontend components (hooks, PDF viewer, upload, analysis, chat, cards) |
| 6 | 19-22 | Pages and layout (home, paper detail, settings) |
| 7 | 23-24 | PDF serving and end-to-end verification |

**Total: 24 tasks across 7 chunks**

**Dependencies:** Tasks should be executed in order. Tasks within the same chunk can potentially be parallelized where they don't share files.
