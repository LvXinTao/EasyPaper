# PDF解析加速 & 渲染器优化 设计文档

## 背景

EasyPaper当前存在两个核心问题：

1. **PDF解析慢**：当前使用Vision LLM逐批串行解析PDF页面图片，一篇30页论文需要3-4分钟
2. **文字选择不准**：手写的pdfjs-dist text layer实现存在字体不匹配、选区偏移等多种问题

## 设计目标

- 将PDF解析时间缩短50%以上（30页论文从~3-4分钟降到~1-1.5分钟）
- 实现可靠的PDF文字选择功能
- 不引入Python等外部依赖

---

## 部分1：PDF解析优化

### 当前架构

```
渲染所有页面为150DPI图片（串行）
    ↓
Batch 1 (Page 1-15) → Vision API → 等待响应
    ↓
Batch 2 (Page 14-30) → Vision API → 等待响应
    ↓
Batch 3 (Page 29-45) → Vision API → 等待响应
    ↓
拼接所有结果
```

**瓶颈**：
- 页面渲染串行执行
- Vision API请求串行发送
- DPI=150产生较大图片
- 用户无法看到中间进度

### 新架构

```
渲染所有页面为120DPI图片（串行，MuPDF单线程限制）
    ↓
并行发送所有batch（并发限制=3）:
  Batch 1 (Page 1-15) → Vision API ──┐
  Batch 2 (Page 14-30) → Vision API ──├─→ 按序号排列
  Batch 3 (Page 29-45) → Vision API ──┘
    ↓
每个batch完成 → 立即通过SSE推送前端
    ↓
所有batch完成 → 去重拼接 → 保存 parsed.md
```

### 具体改动

#### `src/lib/pdf-parser.ts`

**常量调整**：
- `DPI`: 150 → 120（图片体积减少~36%，文字识别影响极小）

**核心逻辑改动**：
- 将多batch串行循环改为 `Promise.allSettled` 并行发送
- 添加并发控制（最多3个同时请求），使用简单的信号量模式
- 每个batch完成后通过 `onBatchDone(batchIndex, content)` 回调通知上层
- 失败的batch重试一次后标记为失败，不阻塞其他batch
- 去重拼接逻辑保持不变（基于overlap的后80字符匹配）

**新增回调接口**：
```typescript
interface ParseOptions {
  onProgress?: (message: string) => void;
  onBatchDone?: (batchIndex: number, totalBatches: number, content: string) => void;
  signal?: AbortSignal;
}
```

#### `src/app/api/analyze/route.ts`

**新增SSE事件类型**：
- `parse_batch_done`: 携带 `{ batchIndex, totalBatches, content }` 数据
- 前端可选择在收到每个batch后逐步展示已解析内容

**解析进度**：
- metadata中的 `analysisProgress` 增加 `batchesDone` 和 `totalBatches` 字段

### 错误处理

- 单个batch失败：重试1次，仍失败则在最终结果中标注缺失页码范围
- 所有batch失败：回退到MuPDF纯文本提取（现有fallback逻辑）
- API限流（429）：捕获后延迟2秒重试

### 预期效果

| 场景 | 当前耗时 | 优化后耗时 |
|------|---------|-----------|
| 10页论文（1个batch） | ~60s | ~45s（降DPI） |
| 30页论文（3个batch） | ~180s | ~70s（并行+降DPI） |
| 50页论文（4个batch） | ~300s | ~90s（并行+降DPI） |

---

## 部分2：PDF渲染器替换

### 当前实现

- 993行手写 `pdf-viewer.tsx`
- 手动管理canvas渲染、TextLayer创建、viewport同步
- 自定义像素扫描算法修正字体不匹配（不完全有效）
- 2200+行 `pdf_viewer.css` 中包含大量自定义text layer样式

### 新实现：基于 react-pdf

**依赖变更**：
- 新增：`react-pdf`（基于pdfjs-dist的成熟React封装，周下载~350万）
- 保留：`pdfjs-dist`（react-pdf的peer dependency）

**组件结构**：
```
src/components/pdf-viewer.tsx (重写)
├── <Document file={url} onLoadSuccess={onDocLoad}>
│   └── <Page pageNumber={currentPage} scale={scale}
│         renderTextLayer={true}
│         renderAnnotationLayer={true} />
├── PageNavigation — 页面导航（键盘快捷键 + 进度条）
├── ZoomControls — 缩放控件（0.5x-3x）
├── ProgressBar — 底部进度条（带书签标记和缩略图预览）
└── BookmarkManager — 书签功能
```

**CSS导入**：
```typescript
import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';
```

**Next.js集成**：
```typescript
// 动态导入禁用SSR
const PdfViewer = dynamic(() => import('@/components/pdf-viewer'), { ssr: false });
```

### 保留功能

| 功能 | 实现方式 |
|------|---------|
| 页面导航 | 保留现有键盘快捷键逻辑，适配react-pdf的pageNumber prop |
| 缩放 | 映射到react-pdf的scale prop |
| 书签 | 保留现有书签数据结构和API，适配新组件 |
| 进度条 | 保留现有进度条UI，适配react-pdf的onLoadSuccess获取页数 |
| 缩略图预览 | 使用react-pdf的 `<Page width={小值}>` 渲染缩略图 |
| 文字选择 | react-pdf内置TextLayer自动处理，无需手动代码 |

### 移除的代码

- 手动canvas渲染（`pdfPage.render()`）
- 手动TextLayer创建和对齐
- 像素扫描高亮算法（566-605行）
- `highlightRects` 状态和自定义高亮overlay
- `pdf_viewer.css` 中的自定义 `.textLayer` 样式

### 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| react-pdf与当前pdfjs-dist版本冲突 | 检查兼容性，必要时统一版本 |
| 自定义高亮overlay丢失 | 浏览器原生选择即可满足需求；如需持久高亮后续可用react-pdf-highlighter扩展 |
| 大文件性能 | react-pdf只渲染当前页，性能与手写实现相当 |
| Next.js SSR问题 | 使用dynamic import + ssr: false |

---

## 实施顺序

1. **Phase 1**：PDF解析优化（并行batch + 降DPI + 流式推送）
2. **Phase 2**：PDF渲染器替换（react-pdf）

两个Phase相互独立，可以按任意顺序实施。建议先做Phase 1（解析优化），因为它不涉及UI变更，风险更小。

## 不包含在本次改动中

- 解析结果的AI分析优化（prompt调优等）
- 新增PDF annotation/高亮持久化功能
- 解析缓存策略变更（已有parsed.md缓存，保持不变）
