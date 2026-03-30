# 划句向AI提问功能实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 添加划句向AI提问功能，用户在PDF中选中文本后可直接向AI提问，引用文本保留位置信息支持跳转。

**Architecture:** 扩展 ChatMessage 类型添加 quote 字段，在 SelectionToolbar 新增入口按钮，通过 pendingQuote 状态管理引用上下文，新建 MessageQuote 组件渲染引用区块，API 层处理引用上下文注入。

**Tech Stack:** Next.js 16, React 19, TypeScript, SSE streaming

> **Note:** 文中引用的行号为估计值，实际执行时需根据代码当前状态调整。

---

## Chunk 1: 类型定义与工具函数

### Task 1: 扩展 ChatMessage 类型

**Files:**
- Modify: `src/types/index.ts:39-42`

- [ ] **Step 1: 添加 quote 字段到 ChatMessage**

```typescript
// src/types/index.ts 第 39-42 行
// 修改为:

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  quote?: TextSelection;  // 新增：引用文本及位置信息
}
```

- [ ] **Step 2: 验证类型定义正确**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add quote field to ChatMessage type"
```

### Task 2: 添加 buildQuoteContext 函数

**Files:**
- Modify: `src/lib/prompts.ts`
- Create: `__tests__/lib/prompts-quote.test.ts`

- [ ] **Step 1: 写测试用例**

```typescript
// __tests__/lib/prompts-quote.test.ts
import { buildQuoteContext } from '@/lib/prompts';
import type { TextSelection } from '@/types';

describe('buildQuoteContext', () => {
  it('builds context string with quote text and page', () => {
    const quote: TextSelection = {
      text: '假设空间的严格约束',
      rects: [{ left: 10, top: 20, width: 30, height: 5 }],
      page: 3,
    };
    const result = buildQuoteContext(quote);
    expect(result).toContain('假设空间的严格约束');
    expect(result).toContain('第 3 页');
    expect(result).toContain('用户引用了论文中的以下内容');
  });

  it('returns empty string for undefined quote', () => {
    const result = buildQuoteContext(null as unknown as undefined);
    expect(result).toBe('');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx jest __tests__/lib/prompts-quote.test.ts`
Expected: FAIL - buildQuoteContext not defined

- [ ] **Step 3: 实现 buildQuoteContext 函数**

```typescript
// src/lib/prompts.ts 文件末尾添加:

import type { TextSelection } from '@/types';

export function buildQuoteContext(quote: TextSelection | null | undefined): string {
  if (!quote) return '';
  return `用户引用了论文中的以下内容作为提问背景：
> ${quote.text}（第 ${quote.page} 页）

请优先关注这段引用内容回答问题，同时可以参考论文的其他部分提供补充说明。`;
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest __tests__/lib/prompts-quote.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/prompts.ts __tests__/lib/prompts-quote.test.ts
git commit -m "feat: add buildQuoteContext function for quote prompt"
```

---

## Chunk 2: 入口组件与跳转功能

### Task 3: 扩展 SelectionToolbar

**Files:**
- Modify: `src/components/selection-toolbar.tsx`

- [ ] **Step 1: 修改 Props 接口和组件**

```typescript
// src/components/selection-toolbar.tsx 全部内容替换为:

'use client';

interface SelectionToolbarProps {
  position: { x: number; y: number };
  onNoteCreate: () => void;
  onAskAI: () => void;
}

export function SelectionToolbar({ position, onNoteCreate, onAskAI }: SelectionToolbarProps) {
  const toolbarX = position.x + 8;
  const toolbarY = position.y + 8;

  return (
    <div
      className="fixed z-50 pointer-events-auto animate-in fade-in duration-150"
      style={{
        left: toolbarX,
        top: toolbarY,
      }}
    >
      <div style={{ display: 'flex', gap: '8px' }}>
        {/* 添加笔记按钮 */}
        <button
          onClick={onNoteCreate}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border-strong)',
            color: 'var(--text-primary)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-strong)';
          }}
          aria-label="Add note to selected text"
        >
          <svg className="w-4 h-4" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <span>添加笔记</span>
        </button>
        {/* 向AI提问按钮 */}
        <button
          onClick={onAskAI}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all"
          style={{
            background: 'rgba(96, 165, 250, 0.15)',
            border: '1px solid var(--accent)',
            color: 'var(--accent)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(96, 165, 250, 0.25)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(96, 165, 250, 0.15)';
          }}
          aria-label="Ask AI about selected text"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.545-2.01 3H9V9h3.228z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-3-3v6" />
          </svg>
          <span>向AI提问</span>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证组件无类型错误**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/components/selection-toolbar.tsx
git commit -m "feat: add Ask AI button to SelectionToolbar"
```

### Task 4: 添加 scrollToQuote 到 PdfViewerRef

**Files:**
- Modify: `src/components/pdf-viewer.tsx:20-22,114-150`

- [ ] **Step 1: 扩展 PdfViewerRef 接口**

```typescript
// src/components/pdf-viewer.tsx 第 20-22 行修改为:

export interface PdfViewerRef {
  scrollToNote: (note: Note) => void;
  scrollToQuote: (quote: TextSelection) => void;
}
```

- [ ] **Step 2: 实现 scrollToQuote 方法**

找到 `useImperativeHandle` 部分（约第 114-150 行），在 `scrollToNote` 方法后添加 `scrollToQuote`:

```typescript
// 在 scrollToNote 方法后面添加:

scrollToQuote: async (quote: TextSelection) => {
  if (!scrollContainerRef.current) return;

  // Navigate to page if needed
  if (quote.page !== page) {
    pageRenderPromiseRef.current = new Promise<void>((resolve) => {
      let cancelled = false;
      const timeoutId = setTimeout(() => {
        cancelled = true;
        resolve();
      }, 5000);

      const checkRender = () => {
        if (cancelled) return;
        if (pageElementRef.current) {
          clearTimeout(timeoutId);
          requestAnimationFrame(() => resolve());
        } else {
          setTimeout(checkRender, 50);
        }
      };
      checkRender();
    });

    goToPage(quote.page);
    await pageRenderPromiseRef.current;
  }

  const topPercent = quote.rects[0]?.top || 0;
  const container = scrollContainerRef.current;
  const scrollY = (topPercent / 100) * container.scrollHeight;
  container.scrollTo({ top: scrollY - 50, behavior: 'smooth' });
},
```

- [ ] **Step 3: 验证类型无错误**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 4: Commit**

```bash
git add src/components/pdf-viewer.tsx
git commit -m "feat: add scrollToQuote method to PdfViewerRef"
```

---

## Chunk 3: 引用区块组件

### Task 5: 创建 MessageQuote 组件

**Files:**
- Create: `src/components/message-quote.tsx`

- [ ] **Step 1: 创建 MessageQuote 组件**

```typescript
// src/components/message-quote.tsx

'use client';

import type { TextSelection } from '@/types';

interface MessageQuoteProps {
  quote: TextSelection;
  onJumpToQuote?: (quote: TextSelection) => void;
}

export function MessageQuote({ quote, onJumpToQuote }: MessageQuoteProps) {
  const handleClick = () => {
    if (onJumpToQuote) {
      onJumpToQuote(quote);
    }
  };

  return (
    <div
      onClick={handleClick}
      style={{
        background: 'rgba(96, 165, 250, 0.1)',
        borderLeft: '3px solid var(--accent)',
        padding: '8px 12px',
        marginBottom: '8px',
        borderRadius: '0 6px 6px 0',
        cursor: onJumpToQuote ? 'pointer' : 'default',
      }}
      role={onJumpToQuote ? 'button' : undefined}
      aria-label={`Jump to quote on page ${quote.page}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
        <svg style={{ width: '10px', height: '10px', color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
        </svg>
        <span style={{ color: 'var(--accent)', fontSize: '10px' }}>P.{quote.page}</span>
      </div>
      <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', margin: 0, fontStyle: 'italic', fontFamily: 'serif' }}>
        "{quote.text}"
      </p>
    </div>
  );
}
```

- [ ] **Step 2: 验证组件无类型错误**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/components/message-quote.tsx
git commit -m "feat: create MessageQuote component for rendering quote blocks"
```

### Task 6: 更新 ChatMessages 组件

**Files:**
- Modify: `src/components/chat-messages.tsx`

- [ ] **Step 1: 更新 ChatMessagesProps 和渲染逻辑**

```typescript
// src/components/chat-messages.tsx 修改为:

'use client';

import { useEffect, useRef } from 'react';
import type { ChatMessage, TextSelection } from '@/types';
import { useTypewriter } from '@/hooks/use-typewriter';
import { MarkdownContent } from './markdown-content';
import { MessageQuote } from './message-quote';

interface ChatMessagesProps {
  messages: ChatMessage[];
  streamingContent?: string;
  isStreaming?: boolean;
  onJumpToQuote?: (quote: TextSelection) => void;
}

export function ChatMessages({ messages, streamingContent, isStreaming, onJumpToQuote }: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const { displayedText, isTyping } = useTypewriter(streamingContent || '', {
    isStreaming,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, displayedText]);

  if (messages.length === 0 && !isStreaming) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12" style={{ color: 'var(--text-tertiary)' }}>
        <svg className="w-10 h-10 mb-3" style={{ color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p className="text-sm">Ask a question about this paper</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'rounded-br-md'
                : 'rounded-bl-md'
            }`}
            style={
              msg.role === 'user'
                ? { background: 'var(--accent-subtle)', color: 'var(--text-primary)' }
                : { background: 'var(--glass)', color: 'var(--text-secondary)' }
            }
          >
            {msg.role === 'user' && msg.quote && (
              <MessageQuote quote={msg.quote} onJumpToQuote={onJumpToQuote} />
            )}
            {msg.role === 'assistant' ? (
              <MarkdownContent content={msg.content} />
            ) : (
              <div className="whitespace-pre-wrap">{msg.content}</div>
            )}
          </div>
        </div>
      ))}
      {isStreaming && !displayedText && (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed" style={{ background: 'var(--glass)', color: 'var(--text-secondary)' }}>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
      {(isTyping || isStreaming) && displayedText && (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm leading-relaxed" style={{ background: 'var(--glass)', color: 'var(--text-secondary)' }}>
            <MarkdownContent content={displayedText} />
            <span className="inline-block w-1.5 h-4 animate-pulse ml-0.5 rounded-sm" style={{ background: 'var(--accent)' }} />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
```

- [ ] **Step 2: 验证类型无错误**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/components/chat-messages.tsx
git commit -m "feat: render quote blocks in ChatMessages, add onJumpToQuote prop"
```

---

## Chunk 4: 聊天输入与状态管理

### Task 7: 更新 ChatInput 支持 pendingQuote

**Files:**
- Modify: `src/components/chat-input.tsx`

- [ ] **Step 1: 更新 ChatInput 组件**

```typescript
// src/components/chat-input.tsx 修改为:

'use client';

import { useState, useCallback } from 'react';
import type { TextSelection } from '@/types';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  pendingQuote?: TextSelection | null;
  onClearQuote?: () => void;
}

export function ChatInput({ onSend, disabled, pendingQuote, onClearQuote }: ChatInputProps) {
  const [message, setMessage] = useState('');

  const handleSend = useCallback(() => {
    if (!message.trim() || disabled) return;
    onSend(message.trim());
    setMessage('');
  }, [message, disabled, onSend]);

  return (
    <div style={{ paddingTop: '12px', borderTop: '1px solid var(--glass-border)' }}>
      {/* Pending quote display */}
      {pendingQuote && (
        <div
          style={{
            margin: '0 0 12px 0',
            padding: '12px',
            background: 'rgba(96, 165, 250, 0.08)',
            border: '1px dashed var(--accent)',
            borderRadius: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <svg style={{ width: '12px', height: '12px', color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500' }}>引用上下文</span>
            <span style={{ color: 'var(--text-tertiary)', fontSize: '10px' }}>第 {pendingQuote.page} 页</span>
            {onClearQuote && (
              <button
                onClick={onClearQuote}
                style={{
                  marginLeft: 'auto',
                  padding: '2px 6px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  borderRadius: '4px',
                  color: 'var(--text-tertiary)',
                  fontSize: '10px',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--text-tertiary)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)';
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
                }}
                aria-label="Clear quote"
              >
                清除
              </button>
            )}
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0, fontStyle: 'italic', fontFamily: 'serif' }}>
            "{pendingQuote.text}"
          </p>
        </div>
      )}
      {/* Input and send button */}
      <div className="flex gap-2">
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder={pendingQuote ? "针对这段引用，你想问什么？" : "Ask a question about this paper..."}
          disabled={disabled}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:ring-2 disabled:opacity-50"
          style={{
            background: 'var(--glass)',
            border: '1px solid var(--glass-border)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || disabled}
          className="px-5 py-2.5 text-sm font-medium rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          style={{
            background: 'var(--text-primary)',
            color: 'var(--bg)',
          }}
        >
          {disabled ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 验证类型无错误**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 3: Commit**

```bash
git add src/components/chat-input.tsx
git commit -m "feat: add pendingQuote display to ChatInput with clear button"
```

### Task 8: 更新主页面管理 pendingQuote 状态

**Files:**
- Modify: `src/app/paper/[id]/page.tsx`

此任务涉及多处修改，需仔细操作。

- [ ] **Step 1: 添加 pendingQuote 状态和 pdfViewerRef**

找到状态定义区域（约第 39-72 行），添加新的状态和 ref:

```typescript
// 在状态定义区域添加（约第 63 行后）:

const [pendingQuote, setPendingQuote] = useState<TextSelection | null>(null);
const pdfViewerRef = useRef<PdfViewerRef>(null);
```

确保导入 `PdfViewerRef`:

```typescript
// 在 import 区域添加:
import type { PdfViewerRef } from '@/components/pdf-viewer';
```

- [ ] **Step 2: 添加 handleAskAI 回调**

在回调函数区域（约第 200-300 行），添加:

```typescript
// 添加 handleAskAI 回调:

const handleAskAI = useCallback((selection: TextSelection) => {
  setPendingQuote(selection);
  setActiveTab('analysis'); // 跳转到 analysis tab（包含聊天区域）
  window.getSelection()?.removeAllRanges();
}, []);
```

- [ ] **Step 3: 添加 handleJumpToQuote 回调**

```typescript
// 添加 handleJumpToQuote 回调:

const handleJumpToQuote = useCallback((quote: TextSelection) => {
  pdfViewerRef.current?.scrollToQuote(quote);
}, []);
```

- [ ] **Step 4: 添加 handleClearQuote 回调**

```typescript
// 添加 handleClearQuote 回调:

const handleClearQuote = useCallback(() => {
  setPendingQuote(null);
}, []);
```

- [ ] **Step 5: 更新 handleSendMessage 以携带 quote**

找到 `handleSendMessage` 函数（约第 473-540 行），修改以携带 pendingQuote:

```typescript
// 修改 handleSendMessage 函数:

const handleSendMessage = useCallback(
  async (message: string) => {
    const sendingSessionId = activeSessionId;
    const quoteToSend = pendingQuote; // Capture before clearing

    // 添加消息时携带 quote
    setChatMessages((prev) => [...prev, { role: 'user', content: message, quote: quoteToSend }]);
    setPendingQuote(null); // Clear after capturing
    setIsChatStreaming(true);
    setStreamingContent('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 添加 quote 参数
        body: JSON.stringify({ paperId, sessionId: activeSessionId, message, quote: quoteToSend }),
      });
      if (!response.ok) throw new Error('Failed to send message');

      // ... 后续 SSE 处理逻辑保持不变 ...
    } catch (error) {
      // ... error handling ...
    }
  },
  [paperId, activeSessionId, pendingQuote]
);
```

注意：需要更新依赖数组添加 `pendingQuote`。

- [ ] **Step 6: 更新 PdfViewer 组件传参**

找到 PdfViewer 组件（约第 700 行），添加 ref 和更新 SelectionToolbar 回调:

```typescript
// 更新 PdfViewer 组件:

<PdfViewer
  ref={pdfViewerRef}
  url={...}
  ...
  // SelectionToolbar 相关回调需要在 pdf-viewer.tsx 中传递
/>
```

找到 SelectionToolbar 的渲染位置（在 PdfViewer 内部，约第 1043-1074 行），需要从 PdfViewerProps 接收 onAskAI 回调并传递给 SelectionToolbar。

这需要修改 `PdfViewerProps` 接口，添加 `onAskAI` prop，并在 `SelectionToolbar` 渲染时传递。

- [ ] **Step 6a: 更新 PdfViewerProps 接口**

```typescript
// src/components/pdf-viewer.tsx 第 24-37 行修改为:

interface PdfViewerProps {
  url: string;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  bookmarks?: Bookmark[];
  onAddBookmark?: (page: number, label?: string) => void;
  onRemoveBookmark?: (bookmarkId: string) => void;
  onBookmarksChange?: () => void;
  notes?: Note[];
  onNoteCreate?: (data: { title: string; content: string; tags: NoteTag[]; selection: TextSelection }) => Promise<void>;
  onNoteUpdate?: (note: Note) => Promise<void>;
  onNoteDelete?: (noteId: string) => Promise<void>;
  onAskAI?: (selection: TextSelection) => void;  // 新增
}
```

- [ ] **Step 6b: 更新 PdfViewer 组件签名**

```typescript
// 第 39-51 行修改为:

export const PdfViewer = forwardRef<PdfViewerRef, PdfViewerProps>(({
  url,
  currentPage = 1,
  onPageChange,
  bookmarks = [],
  onAddBookmark,
  onRemoveBookmark,
  onBookmarksChange,
  notes = [],
  onNoteCreate,
  onNoteUpdate,
  onNoteDelete,
  onAskAI,  // 新增
}, ref) => {
```

- [ ] **Step 6c: 更新 SelectionToolbar 渲染**

找到 SelectionToolbar 渲染位置（约第 1043-1074 行），修改为:

```typescript
// 修改 SelectionToolbar 渲染:

{currentSelection && selectionPosition && !editorPopup && (
  <div data-selection-toolbar>
    <SelectionToolbar
      position={selectionPosition}
      onNoteCreate={() => {
        setEditorPopup({
          mode: 'create',
          position: selectionPosition,
          selection: currentSelection,
        });
      }}
      onAskAI={() => {
        if (onAskAI) {
          onAskAI(currentSelection);
        }
        window.getSelection()?.removeAllRanges();
        setCurrentSelection(null);
        setSelectionPosition(null);
      }}
    />
  </div>
)}
```

- [ ] **Step 7: 更新主页面 PdfViewer 调用**

在主页面中传递 onAskAI:

```typescript
// 找到 PdfViewer 组件调用，添加 onAskAI prop:

<PdfViewer
  ref={pdfViewerRef}
  url={`/api/paper/${paperId}/pdf`}
  currentPage={currentPage}
  onPageChange={setCurrentPage}
  bookmarks={bookmarks}
  onAddBookmark={handleAddBookmark}
  onRemoveBookmark={handleRemoveBookmark}
  notes={notes}
  onNoteCreate={handleNoteCreate}
  onNoteUpdate={handleNoteUpdate}
  onNoteDelete={handleNoteDelete}
  onAskAI={handleAskAI}  // 新增
/>
```

- [ ] **Step 8: 更新 ChatInput 组件传参**

找到 ChatInput 组件（约第 920-940 行），添加 pendingQuote 相关 props:

```typescript
// 更新 ChatInput 组件调用:

<ChatInput
  onSend={handleSendMessage}
  disabled={isChatStreaming}
  pendingQuote={pendingQuote}
  onClearQuote={handleClearQuote}
/>
```

- [ ] **Step 9: 更新 ChatMessages 组件传参**

找到 ChatMessages 组件（约第 904 行），添加 onJumpToQuote prop:

```typescript
// 更新 ChatMessages 组件调用:

<ChatMessages
  messages={chatMessages}
  streamingContent={streamingContent}
  isStreaming={isChatStreaming}
  onJumpToQuote={handleJumpToQuote}
/>
```

- [ ] **Step 10: 验证类型无错误**

Run: `npx tsc --noEmit`
Expected: 无类型错误

- [ ] **Step 11: Commit**

```bash
git add src/app/paper/[id]/page.tsx src/components/pdf-viewer.tsx
git commit -m "feat: integrate pendingQuote state management and connect all components"
```

---

## Chunk 5: API 路由更新

### Task 9: 更新 chat API 路由

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Modify: `__tests__/api/chat.test.ts`

- [ ] **Step 1: 写测试用例**

```typescript
// __tests__/api/chat.test.ts 添加测试用例:

import type { TextSelection } from '@/types';

// 在现有测试后添加:

describe('POST /api/chat with quote', () => {
  beforeEach(() => {
    process.env.AI_API_KEY = 'sk-test';
    process.env.AI_BASE_URL = 'https://api.test.com/v1';
    process.env.AI_MODEL = 'gpt-4o';
  });

  it('accepts quote parameter in request', async () => {
    (storage.paperExists as jest.Mock).mockResolvedValue(true);
    (storage.getChatSession as jest.Mock).mockResolvedValue({
      id: 'test-session',
      title: 'Test',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
      messages: [],
    });
    (storage.getParsedContent as jest.Mock).mockResolvedValue('Test paper content');

    const quote: TextSelection = {
      text: 'Test quote text',
      rects: [{ left: 10, top: 20, width: 30, height: 5 }],
      page: 1,
    };

    const request = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paperId: 'test-id', message: 'What does this mean?', quote }),
    });

    // Mock successful streaming response
    mockFetch.mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"content":"test"}\n\n'));
          controller.enqueue(new TextEncoder().encode('data: {"done":true}\n\n'));
          controller.close();
        },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
  });
});
```

- [ ] **Step 2: 运行测试确认失败（quote 未处理）**

Run: `npx jest __tests__/api/chat.test.ts`
Expected: 现有测试通过，新测试可能失败或 quote 未被使用

- [ ] **Step 3: 更新 API 路由处理 quote**

```typescript
// src/app/api/chat/route.ts 修改为:

import { storage } from '@/lib/storage';
import { createAIClient } from '@/lib/ai-client';
import { createErrorResponse } from '@/lib/errors';
import { CHAT_PROMPT, buildQuoteContext } from '@/lib/prompts';
import { getAIConfig } from '@/lib/ai-config';
import type { ChatSession, TextSelection } from '@/types';

export async function POST(request: Request) {
  try {
    const { paperId, sessionId, message, quote } = await request.json() as {
      paperId: string;
      sessionId?: string;
      message: string;
      quote?: TextSelection;
    };
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
    const promptSettings = await storage.getPromptSettings();
    const chatPromptTemplate = promptSettings?.chat?.custom || CHAT_PROMPT;

    // Build quote context if provided
    const quoteContext = buildQuoteContext(quote);

    // Update prompt template to include quoteContext placeholder
    // If the template doesn't have {quoteContext}, append it before {question}
    let promptTemplate = chatPromptTemplate;
    if (!promptTemplate.includes('{quoteContext}')) {
      // Insert quoteContext placeholder before the question
      promptTemplate = promptTemplate.replace('{question}', '{quoteContext}\n\nUser question: {question}');
    }

    const prompt = promptTemplate
      .replaceAll('{content}', parsedContent || '')
      .replaceAll('{history}', historyStr)
      .replaceAll('{quoteContext}', quoteContext)
      .replaceAll('{question}', message);

    const client = createAIClient({ baseUrl, apiKey, model });
    const encoder = new TextEncoder();

    // Persist user message with quote if provided
    session.messages.push({ role: 'user', content: message, quote });
    if (session.title === 'New Chat') {
      session.title = message.slice(0, 30);
    }
    await storage.saveChatSession(paperId, session);

    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)); }
          catch { /* client disconnected */ }
        };
        try {
          let fullResponse = '';
          for await (const chunk of client.streamComplete([{ role: 'user', content: prompt }])) {
            fullResponse += chunk;
            send({ content: chunk });
          }
          session.messages.push({ role: 'assistant', content: fullResponse });
          await storage.saveChatSession(paperId, session);
          send({ done: true, sessionId: session.id });
        } catch (error) { send({ error: error instanceof Error ? error.message : 'Chat failed' }); }
        finally { try { controller.close(); } catch { /* already closed */ } }
      },
    });
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' } });
  } catch (error) {
    return createErrorResponse('API_CALL_FAILED', `Chat failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx jest __tests__/api/chat.test.ts`
Expected: PASS

- [ ] **Step 5: 运行完整测试套件**

Run: `npm test`
Expected: 所有测试通过

- [ ] **Step 6: Commit**

```bash
git add src/app/api/chat/route.ts __tests__/api/chat.test.ts
git commit -m "feat: handle quote parameter in chat API, inject quote context into prompt"
```

---

## Chunk 6: 集成测试与验收

### Task 10: 端到端验证

- [ ] **Step 1: 启动开发服务器**

Run: `npm run dev`
Expected: 服务器启动成功

- [ ] **Step 2: 手动测试完整流程**

1. 上传一个 PDF 并完成解析
2. 在 PDF 中选中文本
3. 确认工具栏显示两个按钮（添加笔记 + 向AI提问）
4. 点击「向AI提问」按钮
5. 确认跳转到聊天面板，引用显示在输入框上方
6. 输入问题并发送
7. 确认消息中显示引用区块
8. 点击引用区块，确认跳转到 PDF 对应位置
9. 确认 AI 回复关注了引用内容

- [ ] **Step 3: 测试清除引用功能**

点击「清除」按钮，确认引用消失，输入框 placeholder 恢复默认。

- [ ] **Step 4: 测试向后兼容**

查看已有聊天记录（无 quote），确认正常显示。

- [ ] **Step 5: 运行 lint 检查**

Run: `npm run lint`
Expected: 无 lint 错误

- [ ] **Step 6: 运行完整测试**

Run: `npm test`
Expected: 所有测试通过

- [ ] **Step 7: 构建**

Run: `npm run build`
Expected: 构建成功

- [ ] **Step 8: Final Commit**

```bash
git add -A
git commit -m "feat: complete quote-ask-ai feature with all tests passing"
```

---

## 文件修改清单

| 文件 | 操作 | 变更说明 |
|------|------|----------|
| `src/types/index.ts` | 修改 | ChatMessage 添加 quote 字段 |
| `src/lib/prompts.ts` | 修改 | 新增 buildQuoteContext 函数 |
| `src/components/selection-toolbar.tsx` | 修改 | 新增 onAskAI 按钮 |
| `src/components/pdf-viewer.tsx` | 修改 | PdfViewerRef 新增 scrollToQuote，Props 新增 onAskAI |
| `src/components/message-quote.tsx` | 新建 | 引用区块组件 |
| `src/components/chat-messages.tsx` | 修改 | 渲染 quote，新增 onJumpToQuote |
| `src/components/chat-input.tsx` | 修改 | 显示 pendingQuote，清除按钮 |
| `src/app/paper/[id]/page.tsx` | 修改 | pendingQuote 状态管理 |
| `src/app/api/chat/route.ts` | 修改 | 接收和处理 quote |
| `__tests__/lib/prompts-quote.test.ts` | 新建 | buildQuoteContext 测试 |
| `__tests__/api/chat.test.ts` | 修改 | quote 参数测试 |