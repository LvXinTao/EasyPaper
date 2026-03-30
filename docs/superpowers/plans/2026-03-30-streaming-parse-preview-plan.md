# Streaming Parse Preview Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 PDF 解析过程中实时展示已解析的 markdown 内容并显示预估剩余时间。

**Architecture:** 在现有 SSE 数据流基础上，前端累积 `parse_batch_done` 事件的 `content` 字段，通过新增的 `StreamingParsePreview` 组件实时渲染，替换现有的 `BatchProgressBar`。

**Tech Stack:** React 19, TypeScript, SSE, react-markdown (复用 MarkdownContent)

---

## Chunk 1: 状态管理与 SSE 处理 (page.tsx)

### Task 1: 新增时间格式化函数

**Files:**
- Modify: `src/lib/format.ts:21` (追加)

- [ ] **Step 1: 添加 formatTimeRemaining 函数**

```typescript
export function formatTimeRemaining(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `约 ${seconds} 秒剩余`;
  }
  const minutes = Math.round(seconds / 60);
  return `约 ${minutes} 分钟剩余`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/format.ts
git commit -m "feat: add formatTimeRemaining utility for time estimation"
```

---

### Task 2: 扩展状态定义 (page.tsx)

**Files:**
- Modify: `src/app/paper/[id]/page.tsx:44-46`

- [ ] **Step 1: 在现有 parseBatchProgress 状态后添加新状态**

在 `const [parseBatchProgress, setParseBatchProgress] = useState<{ done: number; total: number } | null>(null);` (约第44行) 后添加：

```typescript
// Streaming parse content (accumulated batch markdown)
const [streamingParsedContent, setStreamingParsedContent] = useState<string>('');
// Time estimation for parsing progress
const [parseStartTime, setParseStartTime] = useState<number | null>(null);
const [avgBatchTime, setAvgBatchTime] = useState<number>(0);
```

- [ ] **Step 2: Commit**

```bash
git add src/app/paper/[id]/page.tsx
git commit -m "feat: add state for streaming parsed content and time estimation"
```

---

### Task 3: 更新 SSE 处理逻辑 (page.tsx)

**Files:**
- Modify: `src/app/paper/[id]/page.tsx:328-330`

- [ ] **Step 1: 扩展 parse_batch_done 事件处理**

找到现有的处理逻辑 (约第328行)：
```typescript
if (event.type === 'parse_batch_done') {
  setParseBatchProgress({ done: event.batchIndex + 1, total: event.totalBatches });
}
```

替换为：
```typescript
if (event.type === 'parse_batch_done') {
  const batchIndex = event.batchIndex;
  const totalBatches = event.totalBatches;

  // Update progress
  setParseBatchProgress({ done: batchIndex + 1, total: totalBatches });

  // Accumulate content
  setStreamingParsedContent(prev => {
    if (prev === '') return event.content;
    return prev + '\n\n---\n\n' + event.content;
  });

  // Calculate time estimation
  if (parseStartTime === null) {
    setParseStartTime(Date.now());
  } else if (batchIndex >= 1) {
    const elapsed = Date.now() - parseStartTime;
    const avgTime = elapsed / (batchIndex + 1);
    setAvgBatchTime(avgTime);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/paper/[id]/page.tsx
git commit -m "feat: accumulate parse content and calculate time estimation from SSE"
```

---

### Task 4: 更新 handleAnalyze 重置逻辑 (page.tsx)

**Files:**
- Modify: `src/app/paper/[id]/page.tsx:268-272`

- [ ] **Step 1: 在 handleAnalyze 函数开头添加重置新状态**

找到现有的重置逻辑 (约第268行)：
```typescript
const handleAnalyze = useCallback(async () => {
  setAnalysisError(null);
  setSSEStep(null);
  setSSEMessage(null);
  setParseBatchProgress(null);
```

在 `setParseBatchProgress(null);` 后添加：
```typescript
  setStreamingParsedContent('');
  setParseStartTime(null);
  setAvgBatchTime(0);
```

- [ ] **Step 2: Commit**

```bash
git add src/app/paper/[id]/page.tsx
git commit -m "feat: reset streaming state on analyze start"
```

---

### Task 5: 更新 AnalysisPanel props (page.tsx)

**Files:**
- Modify: `src/app/paper/[id]/page.tsx:720-727`

- [ ] **Step 1: 传递新 props 给 AnalysisPanel**

找到现有的 AnalysisPanel 调用 (约第720行)：
```typescript
<AnalysisPanel
  analysis={displayAnalysis}
  isAnalyzing={effectiveIsAnalyzing}
  analysisStep={effectiveStep}
  analysisMessage={effectiveMessage}
  parseBatchProgress={parseBatchProgress}
  onReAnalyze={handleAnalyze}
/>
```

添加两个新 props：
```typescript
<AnalysisPanel
  analysis={displayAnalysis}
  isAnalyzing={effectiveIsAnalyzing}
  analysisStep={effectiveStep}
  analysisMessage={effectiveMessage}
  parseBatchProgress={parseBatchProgress}
  streamingParsedContent={streamingParsedContent}
  avgBatchTime={avgBatchTime}
  onReAnalyze={handleAnalyze}
/>
```

- [ ] **Step 2: Commit**

```bash
git add src/app/paper/[id]/page.tsx
git commit -m "feat: pass streaming content and time estimation to AnalysisPanel"
```

---

## Chunk 2: StreamingParsePreview 组件 (analysis-panel.tsx)

### Task 6: 新增 StreamingParsePreview 组件

**Files:**
- Modify: `src/components/analysis-panel.tsx:105-140` (替换 BatchProgressBar)

- [ ] **Step 1: 导入 useMemo 和 useRef**

将现有的 import (第3行) 从：
```typescript
import { useState } from 'react';
```
改为：
```typescript
import { useState, useRef, useMemo, useEffect } from 'react';
```

- [ ] **Step 2: 导入 formatTimeRemaining**

在第7行后添加：
```typescript
import { formatTimeRemaining } from '@/lib/format';
```

- [ ] **Step 3: 定义 StreamingParsePreviewProps 接口**

在 `AnalysisPanelProps` 接口后 (约第18行) 添加：
```typescript
interface StreamingParsePreviewProps {
  progress: { done: number; total: number };
  content: string;
  avgBatchTime: number; // milliseconds
}
```

- [ ] **Step 4: 实现 StreamingParsePreview 组件**

找到现有的 `BatchProgressBar` 函数 (约第105行)，将其替换为 `StreamingParsePreview`：

```typescript
function StreamingParsePreview({ progress, content, avgBatchTime }: StreamingParsePreviewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when content updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content]);

  // Calculate estimated remaining time
  const estimatedTime = useMemo(() => {
    if (avgBatchTime === 0) return null;
    const remaining = progress.total - progress.done;
    const ms = remaining * avgBatchTime;
    return formatTimeRemaining(ms);
  }, [progress, avgBatchTime]);

  const percent = Math.round((progress.done / progress.total) * 100);

  return (
    <div className="flex flex-col flex-1 overflow-hidden mx-4 mb-3 rounded-lg" style={{ border: '1px solid var(--glass-border)', minHeight: '200px' }}>
      {/* Progress indicator row */}
      <div className="px-3 py-2 flex items-center gap-3" style={{ background: 'var(--glass)' }}>
        <div
          className="animate-spin w-3 h-3 border-2 border-t-transparent rounded-full"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
        />
        <div className="flex-1 flex items-center gap-2 text-xs">
          <span style={{ color: 'var(--text-secondary)' }}>
            Parsing batch {progress.done}/{progress.total}
          </span>
          <span style={{ color: 'var(--text-tertiary)' }}>·</span>
          <span style={{ color: 'var(--accent)' }}>{percent}%</span>
          {estimatedTime && (
            <>
              <span style={{ color: 'var(--text-tertiary)' }}>·</span>
              <span style={{ color: 'var(--text-secondary)' }}>{estimatedTime}</span>
            </>
          )}
        </div>
      </div>

      {/* Markdown scrolling area */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-3">
        {content && <MarkdownContent content={content} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/analysis-panel.tsx
git commit -m "feat: replace BatchProgressBar with StreamingParsePreview component"
```

---

### Task 7: 更新 AnalysisPanel Props 接口

**Files:**
- Modify: `src/components/analysis-panel.tsx:11-18`

- [ ] **Step 1: 扩展 AnalysisPanelProps 接口**

将现有的接口 (约第11-18行)：
```typescript
interface AnalysisPanelProps {
  analysis: PaperAnalysis | null;
  isAnalyzing?: boolean;
  analysisStep?: string | null;
  analysisMessage?: string | null;
  parseBatchProgress?: { done: number; total: number } | null;
  onReAnalyze?: () => void;
}
```

改为：
```typescript
interface AnalysisPanelProps {
  analysis: PaperAnalysis | null;
  isAnalyzing?: boolean;
  analysisStep?: string | null;
  analysisMessage?: string | null;
  parseBatchProgress?: { done: number; total: number } | null;
  streamingParsedContent?: string;
  avgBatchTime?: number;
  onReAnalyze?: () => void;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/analysis-panel.tsx
git commit -m "feat: extend AnalysisPanelProps with streaming content props"
```

---

### Task 8: 更新 AnalysisPanel 渲染逻辑

**Files:**
- Modify: `src/components/analysis-panel.tsx:142-163`

- [ ] **Step 1: 更新函数参数解构**

找到 `AnalysisPanel` 函数参数 (约第142行)：
```typescript
export function AnalysisPanel({
  analysis,
  isAnalyzing,
  analysisStep,
  analysisMessage,
  parseBatchProgress,
  onReAnalyze,
}: AnalysisPanelProps)
```

改为：
```typescript
export function AnalysisPanel({
  analysis,
  isAnalyzing,
  analysisStep,
  analysisMessage,
  parseBatchProgress,
  streamingParsedContent,
  avgBatchTime,
  onReAnalyze,
}: AnalysisPanelProps)
```

- [ ] **Step 2: 更新 isAnalyzing 渲染分支**

找到现有的 isAnalyzing 渲染逻辑 (约第153-162行)：
```typescript
if (isAnalyzing) {
  return (
    <div className="flex flex-col h-full">
      <SectionTabs activeSection={activeSection} onSectionChange={setActiveSection} />
      <AnalysisProgress step={analysisStep || null} message={analysisMessage || null} />
      {analysisStep === 'parsing' && parseBatchProgress && (
        <BatchProgressBar progress={parseBatchProgress} />
      )}
    </div>
  );
}
```

改为：
```typescript
if (isAnalyzing) {
  return (
    <div className="flex flex-col h-full">
      <SectionTabs activeSection={activeSection} onSectionChange={setActiveSection} />
      <AnalysisProgress step={analysisStep || null} message={analysisMessage || null} />
      {analysisStep === 'parsing' && parseBatchProgress && (
        <StreamingParsePreview
          progress={parseBatchProgress}
          content={streamingParsedContent || ''}
          avgBatchTime={avgBatchTime || 0}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/analysis-panel.tsx
git commit -m "feat: render StreamingParsePreview during parsing phase"
```

---

## Chunk 3: 集成验证

### Task 9: 运行 lint 检查

- [ ] **Step 1: 执行 lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 2: 如有错误，修复后重新 lint**

---

### Task 10: 运行类型检查

- [ ] **Step 1: 执行 TypeScript 类型检查**

Run: `npx tsc --noEmit`
Expected: No type errors

---

### Task 11: 手动功能测试

- [ ] **Step 1: 启动开发服务器**

Run: `npm run dev`

- [ ] **Step 2: 测试解析流程**

1. 上传一个 PDF 文件
2. 点击 Analyze
3. 验证：
   - 进度指示行显示 "Parsing batch X/Y · Z%"
   - 从第二个批次开始显示预估时间 "约 X 分钟剩余"
   - Markdown 内容实时追加显示
   - 自动滚动到底部

- [ ] **Step 3: 测试解析完成**

1. 等待解析完成 (step 变为 analyzing)
2. 验证内容保留显示
3. 等待分析完成
4. 验证内容正确切换为分析结果

- [ ] **Step 4: 测试重新分析**

1. 点击 Re-analyze
2. 验证状态正确重置

---

### Task 12: 最终提交

- [ ] **Step 1: 确认所有改动已提交**

Run: `git status`
Expected: clean working tree (所有改动已在各 Task 中提交)

- [ ] **Step 2: 推送到远程 (可选)**

```bash
git push origin main
```

---

## 文件改动清单

| 文件 | 改动类型 | Task |
|------|----------|------|
| `src/lib/format.ts` | 修改 | Task 1 |
| `src/app/paper/[id]/page.tsx` | 修改 | Task 2, 3, 4, 5 |
| `src/components/analysis-panel.tsx` | 修改 | Task 6, 7, 8 |

## 测试要点

1. SSE 连接正常时，内容实时追加显示
2. 自动滚动到底部
3. 预估时间从第二批次开始显示
4. 预估时间格式正确（秒/分钟）
5. 解析完成后内容保留直到分析完成
6. 分析完成后内容正确清空
7. 重新分析时状态正确重置
8. TypeScript 类型无错误
9. ESLint 无错误