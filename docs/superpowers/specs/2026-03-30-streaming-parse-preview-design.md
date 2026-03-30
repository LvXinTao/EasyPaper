---
name: streaming-parse-preview
description: 在 PDF 解析时实时展示已解析的 markdown 内容并预估剩余时间
type: project
---

# Streaming Parse Preview Design

## 背景

当前 PDF 解析过程中，前端只显示进度条 "Parsing batch 3/10"，用户无法知道正在解析什么内容。后端已通过 SSE 发送每个批次的解析内容，但前端未使用。

## 目标

- 实时展示已解析的 markdown 内容，让用户了解解析进度和内容质量
- 显示预估剩余时间，缓解等待焦虑

## 设计概览

### 组件结构

```
AnalysisPanel (parsing 阶段)
├── SectionTabs (保持不变)
├── AnalysisProgress (步骤进度条，保持不变)
└── StreamingParsePreview (新增，替换 BatchProgressBar)
    ├── 进度指示行: "Parsing batch 3/10 · 45% · 约 5 分钟剩余"
    └── Markdown 滚动区域 (累积内容，自动滚动到底部)
```

### 数据流

```
SSE parse_batch_done event
    ↓
page.tsx: 提取 content 字段
    ↓
累积到 streamingParsedContent 状态
    ↓
计算预估时间 (基于历史批次耗时)
    ↓
传递给 AnalysisPanel → StreamingParsePreview
    ↓
使用 MarkdownContent 渲染，自动滚动
    ↓
解析完成 → 保留内容直到分析完成
    ↓
分析完成 → 清空，显示最终分析结果
```

## 实现细节

### 1. 状态管理 (page.tsx)

新增状态：

```typescript
// 累积的解析内容
const [streamingParsedContent, setStreamingParsedContent] = useState<string>('');

// 时间预估相关
const [parseStartTime, setParseStartTime] = useState<number | null>(null);
const [avgBatchTime, setAvgBatchTime] = useState<number>(0); // 平均每批次耗时(ms)
```

SSE 处理逻辑更新：

```typescript
if (event.type === 'parse_batch_done') {
  const batchIndex = event.batchIndex;
  const totalBatches = event.totalBatches;

  // 更新进度
  setParseBatchProgress({ done: batchIndex + 1, total: totalBatches });

  // 累积内容
  setStreamingParsedContent(prev => {
    if (prev === '') return event.content;
    return prev + '\n\n---\n\n' + event.content;
  });

  // 计算预估时间
  if (parseStartTime === null) {
    setParseStartTime(Date.now());
  } else if (batchIndex >= 1) {
    const elapsed = Date.now() - parseStartTime;
    const avgTime = elapsed / (batchIndex + 1);
    setAvgBatchTime(avgTime);
  }
}
```

清理逻辑：

- step 变为 'analyzing'：保留内容
- 收到 `done`：清空 streamingParsedContent
- 重新分析：重置所有状态

### 2. StreamingParsePreview 组件 (analysis-panel.tsx)

接口定义：

```typescript
interface StreamingParsePreviewProps {
  progress: { done: number; total: number } | null;
  content: string;
  avgBatchTime: number; // 毫秒
}
```

布局结构：

```tsx
function StreamingParsePreview({ progress, content, avgBatchTime }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content]);

  // 计算预估时间
  const estimatedTime = useMemo(() => {
    if (!progress || avgBatchTime === 0) return null;
    const remaining = progress.total - progress.done;
    const ms = remaining * avgBatchTime;
    return formatTimeRemaining(ms);
  }, [progress, avgBatchTime]);

  return (
    <div className="flex flex-col" style={{ height: '...', minHeight: '200px' }}>
      {/* 进度指示行 */}
      <div style={{ height: '32px', background: 'var(--glass)', ... }}>
        <Spinner />
        <span>Parsing batch {progress.done}/{progress.total} · {percent}%</span>
        {estimatedTime && <span>· {estimatedTime}</span>}
      </div>

      {/* Markdown 滚动区域 */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-3">
        <MarkdownContent content={content} />
      </div>
    </div>
  );
}
```

### 3. 时间格式化

```typescript
function formatTimeRemaining(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) {
    return `约 ${seconds} 秒剩余`;
  }
  const minutes = Math.round(seconds / 60);
  return `约 ${minutes} 分钟剩余`;
}
```

显示策略：

| 条件 | 显示 |
|------|------|
| avgBatchTime === 0 (第一批次) | 不显示时间 |
| 预估 < 1 分钟 | "约 30 秒剩余" |
| 预估 >= 1 分钟 | "约 5 分钟剩余" |

### 4. AnalysisPanel Props 扩展

新增 props：

```typescript
interface AnalysisPanelProps {
  // ...existing props...
  streamingParsedContent?: string;  // 新增
  avgBatchTime?: number;            // 新增
}
```

渲染逻辑：

```tsx
if (isAnalyzing) {
  return (
    <div className="flex flex-col h-full">
      <SectionTabs ... />
      <AnalysisProgress step={analysisStep} message={analysisMessage} />
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

## UI 样式

### 进度指示行

- 左侧：spinner (复用现有样式) + 文字
- 右侧：百分比
- 高度：32px
- 背景：`var(--glass)`
- 文字颜色：`var(--text-secondary)`

### Markdown 区域

- flex-1 占满剩余空间
- overflow-auto
- padding: 12px
- 最小高度：200px
- 批次分隔：`---` markdown 水平线

## 改动文件清单

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `src/app/paper/[id]/page.tsx` | 修改 | 新增状态、SSE 处理、时间计算 |
| `src/components/analysis-panel.tsx` | 修改 | 新增 StreamingParsePreview 组件 |
| 无新增文件 | - | 所有改动在现有文件内 |

## 无需改动

- 后端 API (已发送 content 字段)
- `src/lib/pdf-parser.ts`
- `src/components/markdown-content.tsx` (直接复用)

## 测试要点

1. SSE 连接正常时，内容实时追加显示
2. 自动滚动到底部
3. 预估时间从第二批次开始显示
4. 预估时间格式正确（秒/分钟）
5. 解析完成后内容保留直到分析完成
6. 分析完成后内容正确清空
7. 重新分析时状态正确重置