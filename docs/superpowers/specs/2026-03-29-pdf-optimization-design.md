# PDF解析加速 & 渲染器优化 设计文档

## 背景

EasyPaper当前存在两个核心问题：

1. **PDF解析慢**：当前使用MuPDF(WASM)渲染页面为图片，再通过Vision LLM逐批串行解析，一篇30页论文需要3-4分钟
2. **文字选择不准**：手写的pdfjs-dist text layer实现存在字体不匹配、选区偏移等多种问题

## 设计目标

- 将PDF解析时间缩短50%以上
- 实现可靠的PDF文字选择功能
- 保持现有纯JS/WASM架构（当前已使用mupdf WASM，无Python依赖）

---

## 部分1：PDF解析优化

### 当前架构

```
渲染所有页面为150DPI图片（串行，mupdf WASM）
    ↓
Batch 1 (Page 1-15) → Vision API → 等待响应
    ↓
Batch 2 (Page 14-30) → Vision API → 等待响应
    ↓
拼接所有结果 → 保存 parsed.md
```

**瓶颈**：
- Vision API请求串行发送，多batch时延迟累加
- DPI=150产生较大图片，传输和处理耗时
- 用户无法看到中间进度

### 新架构

```
渲染所有页面为120DPI图片（串行，mupdf WASM单线程限制）
    ↓
并行发送所有batch（并发限制=3）:
  Batch 1 (Page 1-15)  → Vision API ──┐
  Batch 2 (Page 14-30) → Vision API ──├─→ 按序号排列
  ...                                 ┘
    ↓
每个batch完成 → 通过 onBatchDone 回调通知上层
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
- **移除 `onVisionChunk` 逐字符流式回调**：并行执行时多个batch的chunk会交错，无法有序展示。改为每个batch完成后通过 `onBatchDone` 整块回调
- 失败的batch重试一次后标记为失败，不阻塞其他batch
- 去重拼接逻辑改进：由于Vision LLM对同一overlap页面可能产生不同文本，改用**基于页码标记的去重**——在batch prompt中要求LLM在每页开头标注 `<!-- page N -->`，拼接时按页码去重而非文本匹配

**Abort信号处理**：
- 外部 `signal` 与内部 `timeoutSignal` 通过 `AbortSignal.any([signal, timeoutSignal])` 合并
- 当外部signal abort时，所有进行中的batch请求同时取消

**新增回调接口**：
```typescript
interface ParseOptions {
  onProgress?: (message: string) => void;
  onBatchDone?: (batchIndex: number, totalBatches: number, content: string) => void;
  signal?: AbortSignal;
}
```

> 注意：原有的 `onVisionChunk` 和 `onVisionProgress` 回调将被移除，统一替换为 `onBatchDone`。

#### `src/app/api/analyze/route.ts`

**新增SSE事件类型**：
- `parse_batch_done`: 携带 `{ batchIndex, totalBatches, content }` 数据
- 前端可选择在收到每个batch后逐步展示已解析内容

**解析进度**：
- metadata中的 `analysisProgress` 增加 `batchesDone` 和 `totalBatches` 字段

### 错误处理

- 单个batch失败：重试1次，仍失败则在最终结果中标注缺失页码范围
- 所有batch失败：回退到MuPDF纯文本提取（现有fallback逻辑）
- API限流（429）：优先使用响应头中的 `Retry-After` 值；如未提供，使用指数退避（2s → 4s）。当任一batch收到429时，暂停新batch的派发直到重试成功

### 预期效果

> 注：实际耗时高度依赖Vision API提供商的响应延迟。以下基于单batch~45-60s估算。

| 场景 | Batch数 | 当前耗时（串行） | 优化后耗时（并行+降DPI） |
|------|---------|-----------------|------------------------|
| 10页论文 | 1 | ~60s | ~45s（仅降DPI收益） |
| 30页论文 | 2 | ~120s | ~50-55s |
| 50页论文 | 4 | ~240s | ~55-65s |

### 内存考量

峰值内存：所有页面base64图片 + 并发请求体。对50页论文在120DPI下，约50×200KB = ~10MB图片 + 3个并发请求体~30MB开销。在Node.js默认内存限制内，无需特殊处理。

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
- **实施前须验证**：`react-pdf` 最新版本与当前 `pdfjs-dist@^4.10.38` 的兼容性。如不兼容，需统一到react-pdf要求的pdfjs-dist版本。

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
// 动态导入禁用SSR（react-pdf依赖浏览器API）
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
- 像素扫描高亮算法
- `highlightRects` 状态和自定义高亮overlay
- `pdf_viewer.css` 中的自定义 `.textLayer` 样式

### 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| react-pdf与pdfjs-dist版本冲突 | **实施前用 `npm install` 验证兼容性**，必要时统一版本 |
| 自定义高亮overlay丢失 | 浏览器原生选择即可满足需求；如需持久高亮后续可用react-pdf-highlighter扩展 |
| 大文件性能 | react-pdf只渲染当前页，性能与手写实现相当 |
| Next.js SSR问题 | 使用dynamic import + ssr: false |

### 未来可选增强

- 多页连续滚动模式（react-pdf支持渲染多个Page组件）
- PDF内搜索功能

---

## 测试策略

### Phase 1（解析优化）

**单元测试**：
- 并行batch执行逻辑：mock Vision API，验证并发控制、重试、abort传播
- 去重拼接：测试页码标记去重在各种边界条件下的正确性
- 429限流处理：验证Retry-After尊重和退避逻辑

**集成测试**：
- SSE事件顺序：验证 `parse_batch_done` 事件按batch序号有序推送

### Phase 2（渲染器替换）

**手动测试清单**：
- [ ] 文字选择：在多篇不同格式的论文上测试选中准确性
- [ ] 缩放：0.5x到3x全范围测试
- [ ] 键盘导航：左右箭头、PageUp/Down、Home/End
- [ ] 书签：添加、删除、进度条上显示
- [ ] 缩略图预览：hover进度条时显示
- [ ] 大文件（100+页）加载性能

---

## 实施顺序

1. **Phase 1**：PDF解析优化（并行batch + 降DPI + batch完成回调）
2. **Phase 2**：PDF渲染器替换（react-pdf）

两个Phase相互独立，可以按任意顺序实施。建议先做Phase 1（解析优化），因为它不涉及UI变更，风险更小。

## 不包含在本次改动中

- 解析结果的AI分析优化（prompt调优等）
- 新增PDF annotation/高亮持久化功能
- 解析缓存策略变更（已有parsed.md缓存，保持不变）
