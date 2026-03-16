# EasyPaper UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign EasyPaper's home page and paper detail page with a glassmorphism dark theme, three-column home layout, resizable split-panel detail page, integrated AI chat, and theme customization.

**Architecture:** CSS Variables drive the entire color system, enabling theme switching without Tailwind config changes. The home page becomes a three-column layout (folder sidebar / paper list / preview). The detail page gets resizable split panels with a shared `ResizableDivider` component. Chat moves from a floating dialog into the right panel's fixed bottom zone.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, pdfjs-dist 5

**Spec:** `docs/superpowers/specs/2026-03-17-ui-redesign-design.md`

---

## Chunk 1: Foundation — CSS Variables, Types, Theme Infrastructure

### Task 1: Add theme types to type definitions

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add theme types at end of file**

Add at the end of the file, after the `Note` interface definition:

```typescript
export type ThemePreset = 'dark-minimal' | 'light-minimal' | 'deep-blue' | 'warm-dark';

export interface ThemeSettings {
  preset: ThemePreset;
  customAccent: string | null;
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add ThemePreset and ThemeSettings types"
```

---

### Task 2: Replace globals.css with CSS Variable system and theme presets

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Rewrite globals.css with full variable system**

Replace entire file with:

```css
@import "tailwindcss";

/* ============================================
   Theme: Dark Minimal (default)
   ============================================ */
:root,
[data-theme="dark-minimal"] {
  --bg: #161618;
  --bg-deep: #121214;
  --surface: rgba(255, 255, 255, 0.03);
  --surface-hover: rgba(255, 255, 255, 0.055);
  --border: rgba(255, 255, 255, 0.06);
  --border-strong: rgba(255, 255, 255, 0.1);
  --text-primary: #e8e8ec;
  --text-secondary: #8b8b9e;
  --text-tertiary: #55556a;
  --accent: #9d9db5;
  --accent-subtle: rgba(157, 157, 181, 0.1);
  --glass: rgba(255, 255, 255, 0.04);
  --glass-border: rgba(255, 255, 255, 0.08);
  --green: #6ee7a0;
  --green-subtle: rgba(110, 231, 160, 0.08);
  --amber: #fbbf24;
  --amber-subtle: rgba(251, 191, 36, 0.08);
  --blue: #7daeff;
  --blue-subtle: rgba(125, 174, 255, 0.08);
  --rose: #f87171;
  --rose-subtle: rgba(248, 113, 113, 0.08);
  --scrollbar-thumb: rgba(255, 255, 255, 0.08);
  --scrollbar-thumb-hover: rgba(255, 255, 255, 0.15);
}

/* ============================================
   Theme: Light Minimal
   ============================================ */
[data-theme="light-minimal"] {
  --bg: #fafafa;
  --bg-deep: #f0f0f2;
  --surface: rgba(0, 0, 0, 0.02);
  --surface-hover: rgba(0, 0, 0, 0.04);
  --border: rgba(0, 0, 0, 0.06);
  --border-strong: rgba(0, 0, 0, 0.1);
  --text-primary: #1a1a1e;
  --text-secondary: #6b6b7a;
  --text-tertiary: #9b9baa;
  --accent: #6b6b82;
  --accent-subtle: rgba(107, 107, 130, 0.1);
  --glass: rgba(0, 0, 0, 0.04);
  --glass-border: rgba(0, 0, 0, 0.06);
  --green: #16a34a;
  --green-subtle: rgba(22, 163, 74, 0.08);
  --amber: #d97706;
  --amber-subtle: rgba(217, 119, 6, 0.08);
  --blue: #2563eb;
  --blue-subtle: rgba(37, 99, 235, 0.08);
  --rose: #dc2626;
  --rose-subtle: rgba(220, 38, 38, 0.08);
  --scrollbar-thumb: rgba(0, 0, 0, 0.1);
  --scrollbar-thumb-hover: rgba(0, 0, 0, 0.2);
}

/* ============================================
   Theme: Deep Blue
   ============================================ */
[data-theme="deep-blue"] {
  --bg: #0d1117;
  --bg-deep: #090c10;
  --surface: rgba(136, 182, 255, 0.03);
  --surface-hover: rgba(136, 182, 255, 0.06);
  --border: rgba(136, 182, 255, 0.06);
  --border-strong: rgba(136, 182, 255, 0.12);
  --text-primary: #e2e8f0;
  --text-secondary: #7b8ca8;
  --text-tertiary: #4a5568;
  --accent: #7daeff;
  --accent-subtle: rgba(125, 174, 255, 0.1);
  --glass: rgba(136, 182, 255, 0.04);
  --glass-border: rgba(136, 182, 255, 0.08);
  --green: #6ee7a0;
  --green-subtle: rgba(110, 231, 160, 0.08);
  --amber: #fbbf24;
  --amber-subtle: rgba(251, 191, 36, 0.08);
  --blue: #7daeff;
  --blue-subtle: rgba(125, 174, 255, 0.08);
  --rose: #f87171;
  --rose-subtle: rgba(248, 113, 113, 0.08);
  --scrollbar-thumb: rgba(136, 182, 255, 0.1);
  --scrollbar-thumb-hover: rgba(136, 182, 255, 0.18);
}

/* ============================================
   Theme: Warm Dark
   ============================================ */
[data-theme="warm-dark"] {
  --bg: #1a1816;
  --bg-deep: #141210;
  --surface: rgba(255, 235, 200, 0.03);
  --surface-hover: rgba(255, 235, 200, 0.055);
  --border: rgba(255, 235, 200, 0.06);
  --border-strong: rgba(255, 235, 200, 0.1);
  --text-primary: #ece5d8;
  --text-secondary: #9e9586;
  --text-tertiary: #6a6358;
  --accent: #c4a882;
  --accent-subtle: rgba(196, 168, 130, 0.1);
  --glass: rgba(255, 235, 200, 0.04);
  --glass-border: rgba(255, 235, 200, 0.08);
  --green: #6ee7a0;
  --green-subtle: rgba(110, 231, 160, 0.08);
  --amber: #fbbf24;
  --amber-subtle: rgba(251, 191, 36, 0.08);
  --blue: #7daeff;
  --blue-subtle: rgba(125, 174, 255, 0.08);
  --rose: #f87171;
  --rose-subtle: rgba(248, 113, 113, 0.08);
  --scrollbar-thumb: rgba(255, 235, 200, 0.08);
  --scrollbar-thumb-hover: rgba(255, 235, 200, 0.15);
}

/* ============================================
   Base styles
   ============================================ */
body {
  background: var(--bg);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif;
}

/* Modal animations */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes scaleIn {
  from { transform: scale(0.95); }
  to { transform: scale(1); }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--scrollbar-thumb-hover);
}
```

- [ ] **Step 2: Verify no components depend on removed `@theme inline` tokens**

The old CSS had `@theme inline` defining `--color-background`, `--color-foreground`, `--font-sans`, `--font-mono`. Search the codebase:

Run: `grep -r "color-background\|color-foreground\|font-sans\|font-mono" src/ --include="*.tsx" --include="*.ts" --include="*.css"`

If matches found, add equivalent declarations to the new CSS. If none found, proceed.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: replace CSS with theme variable system and 4 presets"
```

---

### Task 3: Update root layout with theme script and new navbar height

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add inline theme script and update layout**

Replace entire file:

```tsx
import type { Metadata } from 'next';
import { Navbar } from '@/components/navbar';
import './globals.css';

export const metadata: Metadata = {
  title: 'EasyPaper - AI Paper Reader',
  description: 'Upload and understand academic papers with AI',
};

const themeScript = `
(function() {
  try {
    var theme = localStorage.getItem('easypaper-theme');
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    var accent = localStorage.getItem('easypaper-accent');
    if (accent) {
      document.documentElement.style.setProperty('--accent', accent);
      var r = parseInt(accent.slice(1, 3), 16);
      var g = parseInt(accent.slice(3, 5), 16);
      var b = parseInt(accent.slice(5, 7), 16);
      document.documentElement.style.setProperty('--accent-subtle', 'rgba(' + r + ',' + g + ',' + b + ',0.1)');
    }
  } catch(e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add theme persistence script and update root layout"
```

---

### Task 4: Extend settings API to support theme field

**Files:**
- Modify: `src/app/api/settings/route.ts`

- [ ] **Step 1: Read current settings API route**

Read the file to understand current structure before modifying.

- [ ] **Step 2: Replace POST handler with merge-based implementation**

Replace the entire POST handler in `src/app/api/settings/route.ts` with:

```typescript
export async function POST(request: Request) {
  const body = await request.json();
  const existing = (await storage.getSettings()) || {};

  // Start from existing settings to preserve all fields
  const merged: Record<string, unknown> = { ...existing };

  // Only update API fields if explicitly provided
  if (body.baseUrl !== undefined) merged.baseUrl = body.baseUrl || 'https://api.openai.com/v1';
  if (body.model !== undefined) merged.model = body.model || 'gpt-4o';
  if (body.visionModel !== undefined) merged.visionModel = body.visionModel || 'gpt-4o';

  // Only update encrypted key if a new plaintext key is provided
  if (body.apiKey) {
    const { encrypted, iv } = encryptApiKey(body.apiKey);
    merged.apiKeyEncrypted = encrypted;
    merged.apiKeyIV = iv;
  }
  // Otherwise, existing apiKeyEncrypted/apiKeyIV are preserved from spread

  // Update theme if provided
  if (body.theme !== undefined) merged.theme = body.theme;

  await storage.saveSettings(merged);
  return NextResponse.json({ success: true });
}
```

This ensures ThemePicker can POST `{ theme: { preset, customAccent } }` without losing the encrypted API key, and vice versa.

- [ ] **Step 3: Add theme field handling to GET handler**

Update the GET handler to include `theme` in the response. Add after the existing fields:

```typescript
// In GET handler, add to both response branches:
theme: settings.theme || { preset: 'dark-minimal', customAccent: null }
```

Also ensure `model` is included (already present) so the chat panel can display the model badge.

- [ ] **Step 3: Verify existing settings tests still pass**

Run: `npx jest __tests__/api/settings.test.ts --verbose`
Expected: All existing tests pass

- [ ] **Step 4: Commit**

```bash
git add src/app/api/settings/route.ts
git commit -m "feat: extend settings API to persist theme preference"
```

---

## Chunk 2: Core Shared Components

### Task 5: Create ResizableDivider component

**Files:**
- Create: `src/components/resizable-divider.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useCallback, useEffect, useRef } from 'react';

interface ResizableDividerProps {
  direction: 'horizontal' | 'vertical';
  onResize: (delta: number) => void;
  onResizeEnd?: () => void;
}

export function ResizableDivider({ direction, onResize, onResizeEnd }: ResizableDividerProps) {
  const isDragging = useRef(false);
  const lastPos = useRef(0);
  const dividerRef = useRef<HTMLDivElement>(null);

  // Use refs for callbacks to avoid re-registering event listeners on every render
  const onResizeRef = useRef(onResize);
  const onResizeEndRef = useRef(onResizeEnd);
  useEffect(() => { onResizeRef.current = onResize; }, [onResize]);
  useEffect(() => { onResizeEndRef.current = onResizeEnd; }, [onResizeEnd]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    lastPos.current = direction === 'horizontal' ? e.clientX : e.clientY;
    document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }, [direction]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPos - lastPos.current;
      lastPos.current = currentPos;
      onResizeRef.current(delta);
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      onResizeEndRef.current?.();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [direction]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const step = 20;
    if (direction === 'horizontal') {
      if (e.key === 'ArrowLeft') { onResizeRef.current(-step); onResizeEndRef.current?.(); }
      if (e.key === 'ArrowRight') { onResizeRef.current(step); onResizeEndRef.current?.(); }
    } else {
      if (e.key === 'ArrowUp') { onResizeRef.current(-step); onResizeEndRef.current?.(); }
      if (e.key === 'ArrowDown') { onResizeRef.current(step); onResizeEndRef.current?.(); }
    }
  }, [direction]);

  const isHorizontal = direction === 'horizontal';

  return (
    <div
      ref={dividerRef}
      role="separator"
      tabIndex={0}
      aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
      onMouseDown={handleMouseDown}
      onKeyDown={handleKeyDown}
      className="group flex items-center justify-center flex-shrink-0"
      style={{
        width: isHorizontal ? '6px' : '100%',
        height: isHorizontal ? '100%' : '6px',
        cursor: isHorizontal ? 'col-resize' : 'row-resize',
      }}
    >
      <div
        className="rounded-full transition-colors"
        style={{
          width: isHorizontal ? '3px' : '32px',
          height: isHorizontal ? '32px' : '3px',
          background: 'var(--border)',
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/resizable-divider.tsx
git commit -m "feat: create ResizableDivider component with mouse and keyboard support"
```

---

### Task 6: Create PaperRow component

**Files:**
- Create: `src/components/paper-row.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import type { PaperListItem } from '@/types';

interface PaperRowProps {
  paper: PaperListItem;
  isActive: boolean;
  onClick: () => void;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  analyzed: { label: '✓ Analyzed', className: 'analyzed' },
  pending: { label: 'Pending', className: 'pending' },
  parsing: { label: 'Parsing...', className: 'parsing' },
  analyzing: { label: 'Analyzing...', className: 'analyzing' },
  error: { label: 'Error', className: 'error' },
};

export function PaperRow({ paper, isActive, onClick }: PaperRowProps) {
  const status = statusConfig[paper.status] || statusConfig.pending;

  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-lg transition-colors"
      style={{
        padding: '10px',
        marginBottom: '2px',
        background: isActive ? 'var(--accent-subtle)' : 'transparent',
        border: isActive ? '1px solid rgba(157,157,181,0.08)' : '1px solid transparent',
      }}
    >
      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.35 }}>
        {paper.title}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '3px' }}>
        {new Date(paper.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </div>
      <div className="flex items-center gap-1 mt-1.5 flex-wrap">
        <span
          className="rounded"
          style={{
            fontSize: '10px',
            padding: '1px 6px',
            background: status.className === 'analyzed' ? 'var(--green-subtle)' :
                        status.className === 'error' ? 'var(--rose-subtle)' :
                        status.className === 'parsing' || status.className === 'analyzing' ? 'var(--blue-subtle)' :
                        'var(--amber-subtle)',
            color: status.className === 'analyzed' ? 'var(--green)' :
                   status.className === 'error' ? 'var(--rose)' :
                   status.className === 'parsing' || status.className === 'analyzing' ? 'var(--blue)' :
                   'var(--amber)',
          }}
        >
          {status.label}
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/paper-row.tsx
git commit -m "feat: create PaperRow list item component"
```

---

### Task 7: Create UploadModal component

**Files:**
- Create: `src/components/upload-modal.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete?: (paperId: string) => void;
  initialFile?: File | null;
}

export function UploadModal({ isOpen, onClose, onUploadComplete, initialFile }: UploadModalProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');

  // Auto-upload if opened with an initial file (from drag onto paper list)
  useEffect(() => {
    if (initialFile && isOpen) {
      uploadFile(initialFile);
    }
  }, [initialFile, isOpen]);

  const uploadFile = useCallback(async (file: File) => {
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
      const response = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Upload failed');
      }
      const { id } = await response.json();
      setProgress('Upload complete!');
      onClose();
      if (onUploadComplete) {
        onUploadComplete(id);
      } else {
        router.push(`/paper/${id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setProgress('');
    }
  }, [router, onClose, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', animation: 'fadeIn 150ms ease-out' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md mx-4 rounded-2xl"
        style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', boxShadow: '0 16px 64px rgba(0,0,0,0.5)', animation: 'fadeIn 150ms ease-out, scaleIn 150ms ease-out' }}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-1">
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Upload Paper</h3>
            <button onClick={onClose} className="cursor-pointer" style={{ color: 'var(--text-tertiary)', fontSize: '18px' }}>×</button>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '16px' }}>Upload a PDF to add it to your library</p>

          <div
            className="rounded-xl text-center transition-all cursor-pointer"
            style={{
              border: isDragging ? '2px dashed var(--accent)' : '2px dashed var(--border-strong)',
              background: isDragging ? 'var(--accent-subtle)' : 'transparent',
              padding: '32px',
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <input ref={inputRef} type="file" accept=".pdf,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }} className="hidden" />
            {uploading ? (
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--accent)' }}>{progress}</div>
                <div className="mt-3 mx-auto h-1 rounded-full overflow-hidden" style={{ width: '120px', background: 'var(--surface)' }}>
                  <div className="h-full rounded-full animate-pulse" style={{ background: 'var(--accent)', width: '100%' }} />
                </div>
              </div>
            ) : (
              <div>
                <div className="mx-auto mb-3 rounded-xl flex items-center justify-center" style={{ width: '44px', height: '44px', background: 'var(--accent-subtle)' }}>
                  <svg className="w-5 h-5" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>Drag & drop your PDF here</div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>or click to browse · PDF only</div>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-3 rounded-lg" style={{ fontSize: '12px', color: 'var(--rose)', background: 'var(--rose-subtle)', padding: '8px 12px' }}>
              {error}
            </div>
          )}

          <div className="flex justify-end mt-4">
            <button
              onClick={onClose}
              className="cursor-pointer rounded-lg transition-colors"
              style={{ padding: '6px 16px', fontSize: '12px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/upload-modal.tsx
git commit -m "feat: create UploadModal component with drag-and-drop"
```

---

### Task 8: Create PreviewPanel component

**Files:**
- Create: `src/components/preview-panel.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { PaperListItem, PaperAnalysis, Note } from '@/types';

interface PreviewPanelProps {
  paper: PaperListItem | null;
  onDelete?: (id: string) => void;
  onAnalyze?: (id: string) => void;
  onMovePaper?: (paperId: string, folderId: string | null) => void;
  folders?: { id: string; name: string }[];
}

export function PreviewPanel({ paper, onDelete, onAnalyze, onMovePaper, folders }: PreviewPanelProps) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<PaperAnalysis | null>(null);
  const [noteCount, setNoteCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);
  const [pages, setPages] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!paper) return;
    setAnalysis(null);
    setNoteCount(0);
    setChatCount(0);
    setPages(0);

    (async () => {
      try {
        const res = await fetch(`/api/paper/${paper.id}`);
        const data = await res.json();
        if (data.analysis) setAnalysis(data.analysis);
        setPages(data.metadata?.pages || 0);
        setChatCount(data.chatHistory?.messages?.filter((m: { role: string }) => m.role === 'user').length || 0);
      } catch { /* ignore */ }
      try {
        const res = await fetch(`/api/paper/${paper.id}/notes`);
        const notes: Note[] = await res.json();
        setNoteCount(notes.length);
      } catch { /* ignore */ }
    })();
  }, [paper]);

  if (!paper) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: 'var(--text-tertiary)' }}>
        <div className="rounded-2xl flex items-center justify-center" style={{ width: '56px', height: '56px', background: 'var(--glass)', border: '1px solid var(--glass-border)' }}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
        </div>
        <span style={{ fontSize: '12px' }}>Select a paper to preview</span>
      </div>
    );
  }

  const sectionCount = analysis ? Object.keys(analysis).filter(k => k !== 'generatedAt').length : 0;

  return (
    <div className="flex-1 flex flex-col gap-3.5 overflow-y-auto" style={{ padding: '20px' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.4, letterSpacing: '-0.2px' }}>{paper.title}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
            Added {new Date(paper.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button onClick={() => router.push(`/paper/${paper.id}`)} className="cursor-pointer rounded-lg" style={{ padding: '5px 11px', fontSize: '11px', fontWeight: 500, background: 'var(--text-primary)', color: 'var(--bg)', border: 'none' }}>Open</button>
          {paper.status !== 'analyzed' && paper.status !== 'analyzing' && paper.status !== 'parsing' && onAnalyze && (
            <button onClick={() => onAnalyze(paper.id)} className="cursor-pointer rounded-lg" style={{ padding: '5px 11px', fontSize: '11px', fontWeight: 500, background: 'var(--glass)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)' }}>Analyze</button>
          )}
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="cursor-pointer rounded-lg" style={{ padding: '5px 8px', fontSize: '11px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>⋯</button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 rounded-lg overflow-hidden z-10" style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: '140px' }}>
                {onMovePaper && folders && folders.length > 0 && (
                  <div className="relative group">
                    <button className="w-full text-left cursor-pointer block" style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>Move to folder</button>
                    <div className="hidden group-hover:block absolute left-full top-0 rounded-lg overflow-hidden" style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: '120px' }}>
                      <button onClick={() => { setMenuOpen(false); onMovePaper(paper.id, null); }} className="w-full text-left cursor-pointer block" style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>No folder</button>
                      {folders.map(f => (
                        <button key={f.id} onClick={() => { setMenuOpen(false); onMovePaper(paper.id, f.id); }} className="w-full text-left cursor-pointer block" style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)' }}>{f.name}</button>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => { setMenuOpen(false); if (onDelete) onDelete(paper.id); }} className="w-full text-left cursor-pointer block" style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--rose)' }}>Delete</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { val: sectionCount, label: 'Sections' },
          { val: noteCount, label: 'Notes' },
          { val: chatCount, label: 'Chats' },
          { val: pages, label: 'Pages' },
        ].map(s => (
          <div key={s.label} className="text-center rounded-lg" style={{ padding: '10px', background: 'var(--glass)', border: '1px solid var(--glass-border)' }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{s.val}</div>
            <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Analysis sections */}
      {analysis && (
        <>
          <div>
            <div className="uppercase" style={{ fontSize: '10px', letterSpacing: '0.8px', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '6px' }}>Summary</div>
            <div className="rounded-lg" style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.65, background: 'var(--glass)', border: '1px solid var(--glass-border)', padding: '13px' }}>
              {analysis.summary?.content || 'No summary available'}
            </div>
          </div>
          {analysis.contributions?.items?.length > 0 && (
            <div>
              <div className="uppercase" style={{ fontSize: '10px', letterSpacing: '0.8px', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '6px' }}>Key Contributions</div>
              <div className="rounded-lg" style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.65, background: 'var(--glass)', border: '1px solid var(--glass-border)', padding: '13px' }}>
                {analysis.contributions.items.map((item, i) => (
                  <div key={i}>• {item}</div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/preview-panel.tsx
git commit -m "feat: create PreviewPanel component for home page column 3"
```

---

## Chunk 3: Navbar Redesign

### Task 9: Redesign Navbar to glassmorphism style

**Files:**
- Modify: `src/components/navbar.tsx`

- [ ] **Step 1: Rewrite Navbar with new design**

Replace entire file:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { SettingsForm } from './settings-form';
import { UploadModal } from './upload-modal';

export function Navbar() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  useEffect(() => {
    if (isSettingsOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isSettingsOpen]);

  return (
    <>
      <nav
        className="flex items-center"
        style={{
          height: '44px',
          padding: '0 18px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <a
          href="/"
          style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.4px', textDecoration: 'none' }}
        >
          EasyPaper
        </a>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsUploadOpen(true)}
            className="cursor-pointer rounded-lg transition-colors"
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 500,
              background: 'var(--text-primary)',
              color: 'var(--bg)',
              border: 'none',
            }}
          >
            + Upload
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="cursor-pointer rounded-lg transition-colors flex items-center gap-1.5"
            style={{
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 500,
              background: 'var(--glass)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-secondary)',
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
        </div>
      </nav>

      {/* Settings modal */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)', animation: 'fadeIn 150ms ease-out' }}
          onClick={(e) => { if (e.target === e.currentTarget) setIsSettingsOpen(false); }}
        >
          <div
            className="max-w-xl w-full mx-4 rounded-2xl"
            style={{ background: 'var(--bg)', border: '1px solid var(--border-strong)', boxShadow: '0 16px 64px rgba(0,0,0,0.5)', padding: '24px', animation: 'fadeIn 150ms ease-out, scaleIn 150ms ease-out' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Settings</h2>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>Configure your AI provider and appearance.</p>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="cursor-pointer"
                style={{ color: 'var(--text-tertiary)', fontSize: '18px' }}
                aria-label="Close settings"
              >
                ×
              </button>
            </div>
            <SettingsForm />
            <p className="text-center" style={{ marginTop: '16px', fontSize: '11px', color: 'var(--text-tertiary)' }}>
              Your API key is encrypted and stored locally.
            </p>
          </div>
        </div>
      )}

      {/* Upload modal */}
      <UploadModal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} />
    </>
  );
}
```

- [ ] **Step 2: Restyle SettingsForm to match theme**

Update `src/components/settings-form.tsx`: replace all Tailwind color classes with CSS variable inline styles. Key changes:
- Input backgrounds: `var(--glass)` with `var(--glass-border)` borders
- Label text: `var(--text-secondary)`
- Button: `var(--text-primary)` bg with `var(--bg)` text
- Success/error messages: use `var(--green)` / `var(--rose)` with subtle backgrounds

- [ ] **Step 3: Verify the app loads**

Run: `npm run dev` and check `localhost:3000`
Expected: New dark navbar displays correctly

- [ ] **Step 4: Commit**

```bash
git add src/components/navbar.tsx src/components/settings-form.tsx
git commit -m "feat: redesign navbar and settings form to glassmorphism style"
```

---

## Chunk 4: Home Page Three-Column Layout

### Task 10: Rewrite home page with three-column layout

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/folder-tree.tsx` (restyle)

- [ ] **Step 1: Rewrite page.tsx with three-column layout**

Replace the entire file with the following structure:

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { FolderTree } from '@/components/folder-tree';
import { PaperRow } from '@/components/paper-row';
import { PreviewPanel } from '@/components/preview-panel';
import { UploadModal } from '@/components/upload-modal';
import type { PaperListItem, Folder } from '@/types';

export default function HomePage() {
  const [papers, setPapers] = useState<PaperListItem[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);

  const fetchPapers = useCallback(async () => {
    try {
      const res = await fetch('/api/papers');
      const data = await res.json();
      setPapers(data.papers || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  const fetchFolders = useCallback(async () => {
    try {
      const res = await fetch('/api/folders');
      const data = await res.json();
      setFolders(data.folders || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchPapers(); fetchFolders(); }, [fetchPapers, fetchFolders]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this paper?')) return;
    await fetch(`/api/paper/${id}`, { method: 'DELETE' });
    setPapers(prev => prev.filter(p => p.id !== id));
    if (selectedPaperId === id) setSelectedPaperId(null);
  };

  const handleUploadComplete = (paperId: string) => {
    setDroppedFile(null);
    fetchPapers().then(() => setSelectedPaperId(paperId));
  };

  // Folder CRUD handlers
  const handleCreateFolder = async (name: string, parentId: string | null) => {
    await fetch('/api/folders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parentId }) });
    await fetchFolders();
  };
  const handleRenameFolder = async (folderId: string, name: string) => {
    await fetch(`/api/folders/${folderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    await fetchFolders();
  };
  const handleDeleteFolder = async (folderId: string) => {
    await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
    await fetchFolders();
    if (selectedFolderId === folderId) setSelectedFolderId(null);
  };
  const handleMovePaper = async (paperId: string, folderId: string | null) => {
    await fetch(`/api/paper/${paperId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folderId }) });
    await fetchPapers();
  };

  // Filter papers
  const filtered = papers.filter(p => {
    if (selectedFolderId && p.folderId !== selectedFolderId) return false;
    if (filterStatus === 'analyzed' && p.status !== 'analyzed') return false;
    if (filterStatus === 'pending' && !['pending', 'parsing', 'analyzing'].includes(p.status)) return false;
    if (filterStatus === 'error' && p.status !== 'error') return false;
    if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const selectedPaper = papers.find(p => p.id === selectedPaperId) || null;
  const filters = [
    { key: 'all', label: 'All' },
    { key: 'analyzed', label: 'Analyzed' },
    { key: 'pending', label: 'Pending' },
    { key: 'error', label: 'Error' },
  ];

  // Drag-and-drop on Column 2 to trigger upload
  const handleCol2Drop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'application/pdf' || file.name.endsWith('.pdf'))) {
      setDroppedFile(file);
      setUploadOpen(true);
    }
  };

  return (
    <div className="flex" style={{ height: 'calc(100vh - 44px)' }}>
      {/* Column 1: Folder Sidebar */}
      <div
        className="flex flex-col overflow-y-auto"
        style={{ width: '200px', padding: '14px 10px', borderRight: '1px solid var(--border)', background: 'rgba(255,255,255,0.012)' }}
      >
        <div className="uppercase" style={{ fontSize: '9px', letterSpacing: '1.2px', color: 'var(--text-tertiary)', padding: '8px 10px 5px', fontWeight: 600 }}>
          Library
        </div>
        <div
          onClick={() => setSelectedFolderId(null)}
          className="cursor-pointer rounded-lg flex items-center gap-2 transition-colors"
          style={{
            padding: '6px 10px', fontSize: '12px',
            background: !selectedFolderId ? 'var(--accent-subtle)' : 'transparent',
            color: !selectedFolderId ? 'var(--accent)' : 'var(--text-secondary)',
          }}
        >
          All Papers
          <span className="ml-auto" style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{papers.length}</span>
        </div>
        <div className="uppercase" style={{ fontSize: '9px', letterSpacing: '1.2px', color: 'var(--text-tertiary)', padding: '12px 10px 5px', fontWeight: 600 }}>
          Folders
        </div>
        <FolderTree
          folders={folders}
          papers={papers}
          currentPaperId={''}
          searchQuery={''}
          onClose={() => {}}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
          onMovePaper={handleMovePaper}
          onDeletePaper={handleDelete}
        />
      </div>

      {/* Column 2: Paper List */}
      <div
        className="flex flex-col"
        style={{ width: '300px', borderRight: '1px solid var(--border)' }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleCol2Drop}
      >
        <div className="flex items-center justify-between" style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {selectedFolderId ? 'Folder' : 'All Papers'}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{filtered.length} papers</div>
        </div>
        <div style={{ margin: '8px 10px' }}>
          <input
            type="text"
            placeholder="Search papers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg"
            style={{
              height: '32px', padding: '0 10px', fontSize: '12px',
              background: 'var(--glass)', border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)', outline: 'none',
            }}
          />
        </div>
        <div className="flex gap-1" style={{ padding: '0 10px 8px' }}>
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setFilterStatus(f.key)}
              className="cursor-pointer rounded-full"
              style={{
                padding: '3px 9px', fontSize: '10px',
                background: filterStatus === f.key ? 'var(--text-primary)' : 'var(--glass)',
                color: filterStatus === f.key ? 'var(--bg)' : 'var(--text-tertiary)',
                border: filterStatus === f.key ? 'none' : '1px solid var(--glass-border)',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Paper list or empty state */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '4px 8px' }}>
          {loading && (
            <div className="text-center" style={{ padding: '32px 0', color: 'var(--text-tertiary)', fontSize: '12px' }}>
              Loading papers...
            </div>
          )}
          {!loading && filtered.length === 0 && papers.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center gap-3" style={{ padding: '48px 16px', color: 'var(--text-tertiary)' }}>
              <div className="rounded-2xl flex items-center justify-center" style={{ width: '48px', height: '48px', background: 'var(--glass)', border: '1px solid var(--glass-border)' }}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 500 }}>Upload your first paper</div>
              <div style={{ fontSize: '11px' }}>Drag a PDF here or click the button</div>
              <button
                onClick={() => setUploadOpen(true)}
                className="cursor-pointer rounded-lg"
                style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 500, background: 'var(--text-primary)', color: 'var(--bg)', border: 'none', marginTop: '4px' }}
              >
                + Upload
              </button>
            </div>
          )}
          {!loading && filtered.length === 0 && papers.length > 0 && (
            <div className="text-center" style={{ padding: '32px 0', color: 'var(--text-tertiary)', fontSize: '12px' }}>
              No papers match this filter
            </div>
          )}
          {filtered.map(paper => (
            <PaperRow
              key={paper.id}
              paper={paper}
              isActive={paper.id === selectedPaperId}
              onClick={() => setSelectedPaperId(paper.id)}
            />
          ))}
        </div>
      </div>

      {/* Column 3: Preview Panel */}
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'rgba(255,255,255,0.006)' }}>
        <PreviewPanel paper={selectedPaper} onDelete={handleDelete} />
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={uploadOpen}
        onClose={() => { setUploadOpen(false); setDroppedFile(null); }}
        onUploadComplete={handleUploadComplete}
        initialFile={droppedFile}
      />
    </div>
  );
}
```

Note: The `FolderTree` component receives all its existing props from the home page. Step 2 will restyle it and add optional `onSelectFolder`/`selectedFolderId` props for folder-based filtering.

- [ ] **Step 2: Restyle FolderTree for home page sidebar**

Update `src/components/folder-tree.tsx`:
1. Replace all Tailwind color classes with CSS variable inline styles:
   - `bg-slate-*` → `var(--surface)` / `var(--surface-hover)`
   - `text-slate-*` → `var(--text-primary)` / `var(--text-secondary)` / `var(--text-tertiary)`
   - `bg-indigo-*` → `var(--accent-subtle)` / `var(--accent)`
   - Borders → `var(--border)` / `var(--border-strong)`
   - Menus and dropdowns: `var(--surface)` bg, `var(--glass-border)` border
2. Add optional `onSelectFolder?: (folderId: string | null) => void` and `selectedFolderId?: string | null` to `FolderTreeProps`.
3. When a folder row is clicked, call `onSelectFolder?.(folderId)` in addition to existing toggle behavior.
4. Highlight the selected folder using `var(--accent-subtle)` background when `selectedFolderId` matches.

- [ ] **Step 3: Verify home page renders**

Run: `npm run dev` and check `localhost:3000`
Expected: Three-column layout with dark theme, papers visible, folder sidebar works

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/components/folder-tree.tsx
git commit -m "feat: implement three-column home page layout"
```

---

## Chunk 5: Paper Detail Page Redesign

### Task 11: Redesign paper detail page top bar and layout shell

**Files:**
- Modify: `src/app/paper/[id]/page.tsx`

- [ ] **Step 1: Replace the entire file with the new layout**

Replace the entire contents of `src/app/paper/[id]/page.tsx` with:

```tsx
'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PdfViewer } from '@/components/pdf-viewer';
import { AnalysisPanel } from '@/components/analysis-panel';
import { NotesPanel } from '@/components/notes-panel';
import { ChatMessages } from '@/components/chat-messages';
import { ChatInput } from '@/components/chat-input';
import { EditableTitle } from '@/components/editable-title';
import { ResizableDivider } from '@/components/resizable-divider';
import { usePaper } from '@/hooks/use-paper';
import { useSSE } from '@/hooks/use-sse';
import type { PaperAnalysis, ChatMessage } from '@/types';

export default function PaperDetailPage() {
  const params = useParams();
  const router = useRouter();
  const paperId = params.id as string;
  const { data, loading, error, refetch } = usePaper(paperId);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState<string | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<PaperAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'analysis' | 'notes'>('analysis');

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isChatStreaming, setIsChatStreaming] = useState(false);
  const [modelName, setModelName] = useState<string>('');
  const [noteCount, setNoteCount] = useState(0);

  // Resizable panel state — restored from localStorage per paper
  const containerRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState<number | null>(null);
  const [topHeight, setTopHeight] = useState<number | null>(null);

  // Load saved panel ratios from localStorage
  useEffect(() => {
    try {
      const savedLeft = localStorage.getItem(`easypaper-left-${paperId}`);
      const savedTop = localStorage.getItem(`easypaper-top-${paperId}`);
      if (savedLeft) setLeftWidth(parseFloat(savedLeft));
      if (savedTop) setTopHeight(parseFloat(savedTop));
    } catch { /* ignore */ }
  }, [paperId]);

  // Fetch model name for chat header badge
  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(s => { if (s.model) setModelName(s.model); })
      .catch(() => {});
  }, []);

  // Fetch note count for tab badge
  useEffect(() => {
    fetch(`/api/paper/${paperId}/notes`)
      .then(r => r.json())
      .then(d => { if (d.notes) setNoteCount(d.notes.length); })
      .catch(() => {});
  }, [paperId]);

  // Initialize chat messages when data loads
  useEffect(() => {
    if (data?.chatHistory?.messages) {
      setChatMessages(data.chatHistory.messages);
    }
  }, [data?.chatHistory?.messages]);

  const { start: startAnalysis } = useSSE('/api/analyze', {
    onMessage: (event) => {
      if ('step' in event) {
        setAnalysisStep(event.step as string);
        setAnalysisMessage((event.message as string) || null);
      }
      if ('section' in event) {
        setAnalysis((prev) => {
          if (!prev) {
            return {
              summary: { content: '' },
              contributions: { items: [] },
              methodology: { content: '' },
              experiments: { content: '' },
              conclusions: { content: '' },
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
    onError: (err) => {
      setIsAnalyzing(false);
      setAnalysisError(err.message);
      refetch();
    },
  });

  const handleAnalyze = useCallback(() => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisStep(null);
    setAnalysisMessage(null);
    startAnalysis({ paperId });
  }, [paperId, startAnalysis]);

  const handleRename = useCallback(
    async (newTitle: string) => {
      const response = await fetch(`/api/paper/${paperId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      if (!response.ok) throw new Error('Failed to rename');
      await refetch();
    },
    [paperId, refetch]
  );

  const handleSendMessage = useCallback(
    async (message: string) => {
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
            } catch { /* skip malformed */ }
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

  // Horizontal divider: save left panel width to localStorage
  const handleLeftWidthChange = useCallback(
    (newWidth: number) => {
      setLeftWidth(newWidth);
      try { localStorage.setItem(`easypaper-left-${paperId}`, String(newWidth)); } catch {}
    },
    [paperId]
  );

  // Vertical divider: save top panel height to localStorage
  const handleTopHeightChange = useCallback(
    (newHeight: number) => {
      setTopHeight(newHeight);
      try { localStorage.setItem(`easypaper-top-${paperId}`, String(newHeight)); } catch {}
    },
    [paperId]
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-44px)]" style={{ background: 'var(--bg)' }}>
        <div className="animate-spin w-6 h-6 border-2 border-t-transparent rounded-full mb-3" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
        <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Loading paper...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-44px)]" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <div className="font-medium" style={{ color: 'var(--rose)' }}>{error || 'Paper not found'}</div>
          <a href="/" className="text-sm hover:underline mt-2 inline-block" style={{ color: 'var(--accent)' }}>Back to home</a>
        </div>
      </div>
    );
  }

  const displayAnalysis = data.analysis || analysis;
  const needsAnalysis = (data.metadata.status === 'pending' || data.metadata.status === 'error') && !isAnalyzing && !displayAnalysis;
  const statusLabel = data.metadata.status === 'analyzed' ? '✓ Analyzed' : data.metadata.status === 'error' ? 'Error' : data.metadata.status;
  const statusColor = data.metadata.status === 'analyzed' ? 'var(--green)' : data.metadata.status === 'error' ? 'var(--rose)' : 'var(--amber)';
  const statusBg = data.metadata.status === 'analyzed' ? 'var(--green-subtle)' : data.metadata.status === 'error' ? 'var(--rose-subtle)' : 'var(--amber-subtle)';

  // Compute initial sizes from container if not set (guard for SSR)
  const safeWindowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const safeWindowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
  const containerWidth = containerRef.current?.clientWidth ?? safeWindowWidth;
  const rightPanelHeight = rightPanelRef.current?.clientHeight ?? (safeWindowHeight - 44 - 48);
  const effectiveLeftWidth = leftWidth ?? containerWidth * 0.55;
  const effectiveTopHeight = topHeight ?? rightPanelHeight * 0.55;

  return (
    <div style={{ background: 'var(--bg)', color: 'var(--text-primary)' }}>
      {/* Top Bar */}
      <div
        className="flex items-center gap-3 px-4"
        style={{
          height: '48px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {/* Back button */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center justify-center rounded-lg transition-colors"
          style={{
            width: '32px', height: '32px',
            background: 'var(--glass)', border: '1px solid var(--glass-border)',
            color: 'var(--text-secondary)',
          }}
          aria-label="Back to home"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Paper title (editable) */}
        <div className="flex-1 min-w-0">
          <EditableTitle value={data.metadata.title} onSave={handleRename} />
        </div>

        {/* Status badge */}
        <span
          className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ background: statusBg, color: statusColor }}
        >
          {statusLabel}
        </span>

        {/* Re-analyze button */}
        {(data.metadata.status === 'analyzed' || needsAnalysis) && (
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
            style={{
              background: needsAnalysis ? 'var(--text-primary)' : 'var(--glass)',
              color: needsAnalysis ? 'var(--bg)' : 'var(--text-secondary)',
              border: needsAnalysis ? 'none' : '1px solid var(--glass-border)',
              opacity: isAnalyzing ? 0.5 : 1,
            }}
          >
            {isAnalyzing ? 'Analyzing...' : needsAnalysis ? 'Analyze' : 'Re-analyze'}
          </button>
        )}
      </div>

      {/* Analysis error banner */}
      {analysisError && (
        <div className="px-4 py-2.5 text-sm flex items-start gap-2" style={{ background: 'var(--rose-subtle)', color: 'var(--rose)', borderBottom: '1px solid var(--border)' }}>
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div><strong>Analysis failed:</strong> {analysisError}</div>
        </div>
      )}

      {/* Main content: PDF + Right Panel with resizable divider */}
      <div ref={containerRef} className="flex" style={{ height: analysisError ? 'calc(100vh - 44px - 48px - 37px)' : 'calc(100vh - 44px - 48px)' }}>
        {/* Left: PDF Viewer */}
        <div style={{ width: `${effectiveLeftWidth}px`, minWidth: '300px', flexShrink: 0 }}>
          <PdfViewer
            url={`/api/paper/${paperId}/pdf`}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>

        {/* Horizontal resizable divider */}
        <ResizableDivider
          direction="horizontal"
          onResize={(delta) => {
            const newWidth = Math.max(300, Math.min(effectiveLeftWidth + delta, containerWidth - 280));
            handleLeftWidthChange(newWidth);
          }}
        />

        {/* Right: Split Panel */}
        <div ref={rightPanelRef} className="flex-1 flex flex-col" style={{ minWidth: '280px', overflow: 'hidden' }}>
          {/* Top Zone: Analysis/Notes tabs */}
          <div style={{ height: `${effectiveTopHeight}px`, minHeight: '150px', flexShrink: 0 }} className="flex flex-col overflow-hidden">
            {/* Tab bar */}
            <div className="flex items-center gap-1 px-4" style={{ height: '40px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <button
                onClick={() => setActiveTab('analysis')}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
                style={{
                  background: activeTab === 'analysis' ? 'var(--accent-subtle)' : 'transparent',
                  color: activeTab === 'analysis' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  border: activeTab === 'analysis' ? '1px solid var(--accent)' : '1px solid transparent',
                }}
              >
                Analysis
                {displayAnalysis && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--glass)', color: 'var(--text-tertiary)' }}>
                    {Object.keys(displayAnalysis).filter(k => k !== 'generatedAt').length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('notes')}
                className="px-3 py-1.5 text-xs font-medium rounded-md transition-colors"
                style={{
                  background: activeTab === 'notes' ? 'var(--accent-subtle)' : 'transparent',
                  color: activeTab === 'notes' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  border: activeTab === 'notes' ? '1px solid var(--accent)' : '1px solid transparent',
                }}
              >
                Notes
                {noteCount > 0 && (
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: 'var(--glass)', color: 'var(--text-tertiary)' }}>
                    {noteCount}
                  </span>
                )}
              </button>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'analysis' ? (
                <AnalysisPanel
                  analysis={displayAnalysis}
                  isAnalyzing={isAnalyzing}
                  analysisStep={analysisStep}
                  analysisMessage={analysisMessage}
                  onReAnalyze={handleAnalyze}
                />
              ) : (
                <NotesPanel
                  paperId={paperId}
                  currentPage={currentPage}
                  onPageChange={setCurrentPage}
                />
              )}
            </div>
          </div>

          {/* Vertical resizable divider */}
          <ResizableDivider
            direction="vertical"
            onResize={(delta) => {
              const maxTop = (rightPanelRef.current?.clientHeight ?? rightPanelHeight) - 120;
              const newHeight = Math.max(150, Math.min(effectiveTopHeight + delta, maxTop));
              handleTopHeightChange(newHeight);
            }}
          />

          {/* Bottom Zone: AI Chat */}
          <div className="flex-1 flex flex-col overflow-hidden" style={{ minHeight: '120px' }}>
            {/* Chat header with model badge */}
            <div className="flex items-center justify-between px-4" style={{ height: '36px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>AI Chat</span>
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

            {/* Messages */}
            <div className="flex-1 overflow-auto px-4">
              <ChatMessages
                messages={chatMessages}
                streamingContent={streamingContent}
                isStreaming={isChatStreaming}
              />
            </div>

            {/* Input */}
            <div className="px-4 pb-3 pt-2">
              <ChatInput onSend={handleSendMessage} disabled={isChatStreaming} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the page loads with a paper**

Run: `npm run dev`, navigate to a paper detail page
Expected: PDF viewer on left, split right panel with tabs and chat, model badge visible

- [ ] **Step 3: Test resizable dividers**

Verify: drag horizontal divider (between PDF and right panel), drag vertical divider (between Analysis/Notes and Chat). Both should respect min constraints (PDF min 300px, right panel min 280px, top zone min 150px, bottom zone min 120px). Ratios should persist after page refresh.

- [ ] **Step 4: Commit**

```bash
git add src/app/paper/[id]/page.tsx
git commit -m "feat: redesign paper detail page with resizable split panels"
```

---

### Task 12: Restyle analysis panel and section tabs

**Files:**
- Modify: `src/components/analysis-panel.tsx`
- Modify: `src/components/section-tabs.tsx`

- [ ] **Step 1: Update analysis-panel.tsx**

Replace all Tailwind color classes with CSS variable inline styles:
- Card backgrounds: `var(--glass)` with `var(--glass-border)`
- Section titles: uppercase labels with `var(--text-tertiary)`
- Body text: `var(--text-secondary)`
- Progress indicators: use `var(--accent)` for active, `var(--green)` for complete
- Re-analyze button: `var(--glass)` background

- [ ] **Step 2: Update section-tabs.tsx**

Replace tab styling:
- Active tab: `var(--text-primary)` with accent underline
- Inactive: `var(--text-tertiary)`
- Underline: `var(--accent)` bar

- [ ] **Step 3: Commit**

```bash
git add src/components/analysis-panel.tsx src/components/section-tabs.tsx
git commit -m "feat: restyle analysis panel and tabs to glassmorphism theme"
```

---

### Task 13: Integrate chat into right panel bottom zone

**Files:**
- Modify: `src/components/chat-messages.tsx`
- Modify: `src/components/chat-input.tsx`
- Modify: `src/components/chat-dialog.tsx`

- [ ] **Step 1: Restyle chat-messages.tsx**

Replace bubble styling:
- User messages: `var(--accent-subtle)` bg, `var(--text-primary)` text, rounded with bottom-right reduced
- AI messages: `var(--glass)` bg, `var(--text-secondary)` text, rounded with bottom-left reduced
- Streaming dots: use `var(--text-tertiary)`

- [ ] **Step 2: Restyle chat-input.tsx**

Replace input styling:
- Input: `var(--glass)` bg, `var(--glass-border)` border, `var(--text-tertiary)` placeholder
- Send button: `var(--text-primary)` bg, `var(--bg)` text

- [ ] **Step 3: Convert chat-dialog.tsx to embedded panel**

Rewrite `chat-dialog.tsx` to be an embedded panel component (not floating). Remove:
- Fixed positioning
- Resize handles (parent handles this now)
- Drag handle
- Shadow and floating styles

Add:
- Chat header with "AI Chat" label
- **Model badge**: glass pill showing model name. Fetch from `/api/settings` on mount to read `model` field.
- Green dot indicator next to model name
- Flex column layout filling parent height

- [ ] **Step 4: Commit**

```bash
git add src/components/chat-messages.tsx src/components/chat-input.tsx src/components/chat-dialog.tsx
git commit -m "feat: restyle chat components and integrate as embedded panel"
```

---

### Task 14: Restyle notes panel and list

**Files:**
- Modify: `src/components/notes-panel.tsx`
- Modify: `src/components/notes-list.tsx`
- Modify: `src/components/note-editor.tsx`

- [ ] **Step 1: Restyle all three files**

Apply CSS variable theme to all notes components:
- Note cards: `var(--glass)` bg with `var(--glass-border)` border
- Tag colors: maintain existing tag type colors but adjust for dark theme
- Note title: `var(--text-primary)`
- Meta info (page, time): `var(--text-tertiary)`, show relative time from `updatedAt`
- "+ New note" button: dashed border with `var(--border)` color
- Editor inputs/textareas: `var(--glass)` bg
- Save button: `var(--text-primary)` bg
- Delete button: `var(--rose)` color

- [ ] **Step 2: Commit**

```bash
git add src/components/notes-panel.tsx src/components/notes-list.tsx src/components/note-editor.tsx
git commit -m "feat: restyle notes components to glassmorphism theme"
```

---

### Task 15: Restyle PDF viewer toolbar

**Files:**
- Modify: `src/components/pdf-viewer.tsx`

- [ ] **Step 1: Update toolbar colors only**

This is a minimal change — only the toolbar and wrapper styling, NOT the core rendering logic (which is 500+ lines of canvas/pdfjs code).

Changes:
- Toolbar background: `var(--surface)` with `var(--border)` bottom border
- Button colors: `var(--text-tertiary)`, hover `var(--text-secondary)`
- Page indicator: `var(--text-secondary)`
- Zoom text: `var(--text-tertiary)`
- Canvas wrapper background: `#1a1a1e` (keep as-is, matches dark theme)
- Progress bar: `var(--accent)` for handle

- [ ] **Step 2: Verify PDF still renders correctly**

Run: `npm run dev`, open a paper
Expected: PDF renders normally, toolbar has new dark style

- [ ] **Step 3: Commit**

```bash
git add src/components/pdf-viewer.tsx
git commit -m "feat: restyle PDF viewer toolbar to match dark theme"
```

---

## Chunk 6: Theme Customization & Cleanup

### Task 16: Create ThemePicker component and add to settings

**Files:**
- Create: `src/components/theme-picker.tsx`
- Modify: `src/components/settings-form.tsx`

- [ ] **Step 1: Create ThemePicker**

```tsx
'use client';

import { useState, useEffect } from 'react';
import type { ThemePreset } from '@/types';

const presets: { id: ThemePreset; name: string; preview: string }[] = [
  { id: 'dark-minimal', name: 'Dark Minimal', preview: '#161618' },
  { id: 'light-minimal', name: 'Light Minimal', preview: '#fafafa' },
  { id: 'deep-blue', name: 'Deep Blue', preview: '#0d1117' },
  { id: 'warm-dark', name: 'Warm Dark', preview: '#1a1816' },
];

export function ThemePicker() {
  const [current, setCurrent] = useState<ThemePreset>('dark-minimal');
  const [customAccent, setCustomAccent] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('easypaper-theme') as ThemePreset | null;
    if (stored) setCurrent(stored);
    const accent = localStorage.getItem('easypaper-accent');
    if (accent) setCustomAccent(accent);
  }, []);

  const applyTheme = (preset: ThemePreset) => {
    setCurrent(preset);
    document.documentElement.setAttribute('data-theme', preset);
    localStorage.setItem('easypaper-theme', preset);
    // Persist to server — POST only the theme field; server merges it
    fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: { preset, customAccent: customAccent || null } }),
    });
  };

  const applyAccent = (color: string) => {
    setCustomAccent(color);
    if (color) {
      document.documentElement.style.setProperty('--accent', color);
      // Compute subtle variant at 10% opacity
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      document.documentElement.style.setProperty('--accent-subtle', `rgba(${r},${g},${b},0.1)`);
      localStorage.setItem('easypaper-accent', color);
    } else {
      document.documentElement.style.removeProperty('--accent');
      document.documentElement.style.removeProperty('--accent-subtle');
      localStorage.removeItem('easypaper-accent');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Theme
        </label>
        <div className="grid grid-cols-2 gap-2">
          {presets.map(p => (
            <button
              key={p.id}
              onClick={() => applyTheme(p.id)}
              className="cursor-pointer rounded-lg flex items-center gap-3 transition-colors"
              style={{
                padding: '10px 12px',
                background: current === p.id ? 'var(--accent-subtle)' : 'var(--glass)',
                border: current === p.id ? '1px solid var(--accent)' : '1px solid var(--glass-border)',
                textAlign: 'left',
              }}
            >
              <div className="rounded-md flex-shrink-0" style={{ width: '24px', height: '24px', background: p.preview, border: '1px solid var(--border-strong)' }} />
              <span style={{ fontSize: '12px', color: 'var(--text-primary)', fontWeight: 500 }}>{p.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          Custom Accent Color
        </label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={customAccent || '#9d9db5'}
            onChange={(e) => applyAccent(e.target.value)}
            className="cursor-pointer rounded"
            style={{ width: '36px', height: '36px', border: '1px solid var(--border)', background: 'none' }}
          />
          <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
            {customAccent || 'Using theme default'}
          </span>
          {customAccent && (
            <button onClick={() => applyAccent('')} className="cursor-pointer" style={{ fontSize: '11px', color: 'var(--rose)' }}>
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add ThemePicker to SettingsForm**

In `settings-form.tsx`, import `ThemePicker` and add an "Appearance" section above the API settings section:

```tsx
import { ThemePicker } from './theme-picker';

// In the JSX, before the Base URL field:
<div className="mb-6 pb-6" style={{ borderBottom: '1px solid var(--border)' }}>
  <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>Appearance</h3>
  <ThemePicker />
</div>
```

- [ ] **Step 3: Verify theme switching works**

Run: `npm run dev`, open Settings, switch themes
Expected: Theme changes immediately, persists on page refresh

- [ ] **Step 4: Commit**

```bash
git add src/components/theme-picker.tsx src/components/settings-form.tsx
git commit -m "feat: add theme picker with 4 presets and custom accent color"
```

---

### Task 17: Restyle standalone settings page

**Files:**
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Replace settings page styling with CSS variable theme**

Replace the entire contents of `src/app/settings/page.tsx` with:

```tsx
import { SettingsForm } from '@/components/settings-form';

export default function SettingsPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
        Settings
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-tertiary)' }}>
        Configure your AI provider and customize appearance.
      </p>
      <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <SettingsForm />
      </div>
      <p className="mt-4 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>
        Your API key is encrypted and stored locally. It never leaves your machine.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "feat: restyle settings page to match glassmorphism theme"
```

---

### Task 18: Remove deprecated components and clean up imports

**Files:**
- Delete: `src/components/chat-button.tsx`
- Delete: `src/components/paper-drawer.tsx`
- Delete: `src/components/upload-zone.tsx`
- Delete: `src/components/paper-card.tsx`

- [ ] **Step 1: Verify no remaining imports of deleted components**

Search the codebase for imports of the deleted files. The paper detail page and home page rewrites (Tasks 10, 11) should have already removed these imports. If any remain, remove them.

Run: `grep -r "chat-button\|paper-drawer\|upload-zone\|paper-card" src/ --include="*.tsx" --include="*.ts"`
Expected: No matches (or only the files themselves)

- [ ] **Step 2: Delete the files**

```bash
rm src/components/chat-button.tsx
rm src/components/paper-drawer.tsx
rm src/components/upload-zone.tsx
rm src/components/paper-card.tsx
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds with no import errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove deprecated components (chat-button, paper-drawer, upload-zone, paper-card)"
```

---

### Task 19: Restyle markdown-content and streaming-text

**Files:**
- Modify: `src/components/markdown-content.tsx`
- Modify: `src/components/streaming-text.tsx`

- [ ] **Step 1: Update markdown-content.tsx**

Replace prose color classes:
- Code block bg: use dark bg regardless of theme (already dark in current implementation)
- Text color: inherit from parent (which uses CSS vars)
- Link colors: `var(--accent)`
- Heading colors: `var(--text-primary)`

- [ ] **Step 2: Update streaming-text.tsx cursor animation**

Replace cursor color with `var(--accent)`.

- [ ] **Step 3: Commit**

```bash
git add src/components/markdown-content.tsx src/components/streaming-text.tsx
git commit -m "feat: restyle markdown and streaming components for dark theme"
```

---

### Task 20: Run full test suite and fix any breakages

**Files:**
- May modify: various test files and components

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: Check for failures

- [ ] **Step 2: Fix any failing tests**

Most likely failures:
- Tests that assert specific CSS classes (e.g., `bg-slate-50`, `bg-indigo-500`) will fail because we changed to inline styles with CSS variables. Update assertions to check for the new inline style patterns or rendered structure instead of specific Tailwind classes.
- Tests that import deleted components (`paper-card`, `upload-zone`, etc.) need updating.

- [ ] **Step 3: Verify all tests pass**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test: fix tests for UI redesign changes"
```

---

### Task 21: Final verification

- [ ] **Step 1: Run production build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Manual smoke test**

Verify in browser:
1. Home page: three columns visible, folder sidebar works, paper list filters, preview panel shows
2. Upload: click "+ Upload" in navbar, modal opens, can upload PDF
3. Paper detail: PDF renders, resizable dividers work, Analysis/Notes tabs switch, Chat works with model badge
4. Theme: open Settings, switch themes, verify persistence after refresh
5. All transitions and glassmorphism effects render correctly

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: final adjustments from manual smoke test"
```
