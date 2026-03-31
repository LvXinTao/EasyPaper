# 全局并发解析限制设计

## 概述

限制同时解析的论文数量（默认 3 篇），超过限制的请求进入排队状态，任务完成后自动触发下一个排队任务。

## 需求

- 最大并发数：3 篇（用户可配置）
- 超限时状态：`queued`（排队中）
- 存储方式：每篇论文 metadata 中
- 队列处理：完成回调驱动，自动触发下一个

## 架构限制说明

**重要**：EasyPaper 是本地文件存储应用，运行在单机环境（数据存储在 `~/.easypaper`）。本设计基于单进程假设，内存状态仅在单个 Next.js 进程内共享。

若未来部署到 serverless 或多实例环境，需要改用持久化存储（如 Redis）或分布式锁。

## 架构

### 新增模块

1. **`src/lib/analysis-queue.ts`** — 队列管理模块
2. **`src/lib/analysis-runner.ts`** — 分析核心逻辑（从 route 抽取）

### 改动模块

- `src/app/api/analyze/route.ts` — 集成队列检查
- `src/app/api/analyze/queue/route.ts` — 新增：队列状态查询与取消
- `src/types/index.ts` — 添加 `queued` 状态
- `src/lib/settings.ts` 或 `~/.easypaper/settings.json` — 添加 `maxConcurrent` 配置

## 数据结构

### QueueState（内存单例）

```typescript
interface QueueState {
  activeCount: number;         // 当前正在解析的数量
  activePaperIds: Set<string>; // 正在解析的 paperId 集合
  maxConcurrent: number;       // 最大并发数（默认 3，可配置）
  initPromise: Promise<void> | null; // 确保 init 只执行一次
  lock: Promise<void>;         // 用于同步 tryAcquire
}
```

### PaperStatus 扩展

```typescript
type PaperStatus = 'pending' | 'queued' | 'parsing' | 'analyzing' | 'analyzed' | 'error';
```

新增 `queued` 状态，表示论文在排队等待解析。

### AnalysisProgress 扩展

```typescript
interface AnalysisProgress {
  step: 'queued' | 'parsing' | 'analyzing' | 'saving';  // 添加 'queued'
  message: string;
  updatedAt: string;
  queuePosition?: number;  // 新增：排队位置
  batchesDone?: number;
  totalBatches?: number;
}
```

## 队列操作

### analysisQueue 模块

```typescript
export const analysisQueue = {
  // 初始化：启动时扫描所有 papers 重建状态（单次执行）
  async init(): Promise<void>;

  // 尝试获取 slot：原子操作，返回 true 表示可以开始，false 表示需要排队
  tryAcquire(paperId: string): Promise<boolean>;

  // 释放 slot：任务完成时调用，自动触发下一个 queued 任务
  async release(paperId: string): Promise<void>;

  // 获取排队中的论文列表（按 queuedAt 时间排序）
  async getQueuedPapers(): Promise<{ id: string; queuedAt: string }[]>;

  // 获取当前状态（供前端展示）
  getStatus(): { active: number; max: number; queued: number };

  // 取消排队
  async cancelQueued(paperId: string): Promise<boolean>;
};
```

### init 逻辑（单次执行）

```typescript
async init(): Promise<void> {
  // 防止重复初始化
  if (this.state.initPromise) return this.state.initPromise;

  this.state.initPromise = this.doInit();
  return this.state.initPromise;
}

private async doInit(): Promise<void> {
  // 从 settings 读取 maxConcurrent
  const settings = await storage.getSettings();
  this.state.maxConcurrent = settings?.maxConcurrent || 3;

  const papers = await storage.listPapers();
  for (const paper of papers) {
    const meta = await storage.getMetadata(paper.id);
    if (meta?.status === 'parsing' || meta?.status === 'analyzing') {
      const updatedAt = new Date(meta.analysisProgress?.updatedAt || 0).getTime();
      const ageMs = Date.now() - updatedAt;
      const staleThresholdMs = (settings?.staleThresholdMinutes || 10) * 60 * 1000;

      if (ageMs > staleThresholdMs) {
        await storage.updateMetadata(paper.id, { status: 'pending' });
      } else {
        this.state.activePaperIds.add(paper.id);
        this.state.activeCount++;
      }
    }
  }
}
```

### tryAcquire 逻辑（原子操作）

```typescript
async tryAcquire(paperId: string): Promise<boolean> {
  // 等待之前的操作完成
  await this.state.lock;

  // 创建新的 lock promise
  let resolveLock: () => void;
  this.state.lock = new Promise<void>((resolve) => { resolveLock = resolve; });

  try {
    if (this.state.activeCount < this.state.maxConcurrent) {
      this.state.activeCount++;
      this.state.activePaperIds.add(paperId);
      return true;
    }
    return false;
  } finally {
    resolveLock!();
  }
}
```

### release 逻辑

```typescript
async release(paperId: string): Promise<void> {
  this.state.activePaperIds.delete(paperId);
  this.state.activeCount--;

  // 检查是否有排队中的论文
  const queuedPapers = await this.getQueuedPapers();
  if (queuedPapers.length > 0) {
    const next = queuedPapers[0];

    // 验证论文是否仍然存在
    const exists = await storage.paperExists(next.id);
    if (!exists) {
      // 跳过已删除的论文，继续检查下一个
      return this.release(paperId);
    }

    await this.tryAcquire(next.id);
    // 后台执行，不阻塞 release
    runAnalysisCore(next.id, await getAIConfig()).catch(console.error);
  }
}
```

### getQueuedPapers 逻辑

```typescript
async getQueuedPapers(): Promise<{ id: string; queuedAt: string }[]> {
  const papers = await storage.listPapers();
  const queued: { id: string; queuedAt: string }[] = [];

  for (const paper of papers) {
    const meta = await storage.getMetadata(paper.id);
    if (meta?.status === 'queued' && meta.analysisProgress?.step === 'queued') {
      queued.push({
        id: paper.id,
        queuedAt: meta.analysisProgress.updatedAt,
      });
    }
  }

  // 按排队时间排序（先排队的优先）
  return queued.sort((a, b) => new Date(a.queuedAt).getTime() - new Date(b.queuedAt).getTime());
}
```

### cancelQueued 逻辑

```typescript
async cancelQueued(paperId: string): Promise<boolean> {
  const meta = await storage.getMetadata(paperId);
  if (meta?.status !== 'queued') return false;

  await storage.updateMetadata(paperId, {
    status: 'pending',
    analysisProgress: undefined,
  });
  return true;
}
```

## 分析核心逻辑抽取

### runAnalysisCore

```typescript
// src/lib/analysis-runner.ts

export async function runAnalysisCore(
  paperId: string,
  config: AIConfig,
  onProgress?: (data: Record<string, unknown>) => void
): Promise<void> {
  const send = onProgress || ((_) => {}); // 默认空回调

  try {
    // 现有的 runAnalysis 逻辑，使用 send 发送进度
    // ...

    // 完成时更新状态
    await storage.updateMetadata(paperId, { status: 'analyzed' });
    send({ done: true });
  } catch (error) {
    await storage.updateMetadata(paperId, { status: 'error' });
    send({ error: error instanceof Error ? error.message : 'Analysis failed' });
  } finally {
    await analysisQueue.release(paperId);
  }
}
```

## /api/analyze 改动

```typescript
export async function POST(request: Request) {
  const { paperId, force } = await request.json();

  // 现有验证逻辑...

  // 幂等性检查
  const metadata = await storage.getMetadata(paperId);
  if (metadata?.status === 'queued') {
    const position = await getQueuePosition(paperId);
    return new Response(JSON.stringify({
      status: 'already_queued',
      queuePosition: position,
    }), { headers: { 'Content-Type': 'application/json' } });
  }
  if (metadata?.status === 'parsing' || metadata?.status === 'analyzing') {
    // 现有的 already_running 处理...
  }

  // 确保 queue 已初始化
  await analysisQueue.init();

  // 尝试获取 slot
  if (!(await analysisQueue.tryAcquire(paperId))) {
    const queuePosition = await analysisQueue.getStatus().queued + 1;
    await storage.updateMetadata(paperId, {
      status: 'queued',
      analysisProgress: {
        step: 'queued',
        message: `Waiting in queue (position: ${queuePosition})...`,
        updatedAt: new Date().toISOString(),
        queuePosition,
      },
    });
    return new Response(JSON.stringify({
      status: 'queued',
      queuePosition,
    }), { headers: { 'Content-Type': 'application/json' } });
  }

  // SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      await runAnalysisCore(paperId, config, send);
      controller.close();
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } });
}
```

## 新增 API: /api/analyze/queue

### GET: 查询队列状态

```typescript
// GET /api/analyze/queue
export async function GET() {
  await analysisQueue.init();
  const status = analysisQueue.getStatus();
  const queuedPapers = await analysisQueue.getQueuedPapers();

  return new Response(JSON.stringify({
    ...status,
    queuedPapers: queuedPapers.map((p, i) => ({
      id: p.id,
      position: i + 1,
      queuedAt: p.queuedAt,
    })),
  }), { headers: { 'Content-Type': 'application/json' } });
}
```

### DELETE: 取消排队

```typescript
// DELETE /api/analyze/queue?paperId=xxx
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const paperId = searchParams.get('paperId');

  if (!paperId) return createErrorResponse('PAPER_ID_REQUIRED', 'paperId is required');

  const cancelled = await analysisQueue.cancelQueued(paperId);
  if (!cancelled) {
    return createErrorResponse('NOT_QUEUED', 'Paper is not in queue');
  }

  return new Response(JSON.stringify({ status: 'cancelled' }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

## 前端改动

### 状态展示

- **PaperCard**：显示 "排队中" 状态标识（灰色/黄色）
- **Analysis Panel**：显示排队进度 "排队中 (等待 N 个任务，当前位置: M)"

### 轮询机制增强

当论文状态为 `queued` 时：

1. 客户端收到 `{ status: 'queued', queuePosition: N }` 响应
2. 开始轮询 `/api/paper/[id]/status`
3. 当状态变为 `parsing` 时，重新建立 SSE 连接获取实时进度

```typescript
// use-analysis-polling.ts 增强
// 当检测到 status 从 'queued' 变为 'parsing'/'analyzing'
// 调用 startSSEConnection(paperId) 重新建立 SSE 连接
```

### 取消排队按钮

在 `queued` 状态的 PaperCard 上显示"取消排队"按钮，调用 `DELETE /api/analyze/queue?paperId=xxx`。

## 配置项

在 `~/.easypaper/settings.json` 中添加：

```json
{
  "maxConcurrent": 3,
  "staleThresholdMinutes": 10
}
```

可通过 `/settings` 页面 UI 配置。

## 数据流

```
用户请求 → init() → tryAcquire()
  ├─ 成功 → SSE stream → runAnalysisCore() → finally: release() → 触发下一个 queued
  └─ 失败 → status: 'queued' → 客户端轮询 → 状态变为 parsing → 建立 SSE 连接
```

## 错误处理

- `runAnalysisCore` 的 `finally` 块确保 `release()` 总是调用
- 分析失败时状态设为 `error`，仍释放 slot
- 初始化时检测过期任务并重置
- 论文被删除时 `release()` 跳过并继续检查下一个
- 取消排队时清理状态

## 边界情况处理

| 场景 | 处理 |
|------|------|
| 同一论文重复请求排队 | 返回 `already_queued` 和当前位置 |
| 论文删除时正在排队 | `release()` 检查存在性，跳过已删除 |
| Force re-analyze queued 论文 | 取消排队，重新排队（或立即开始若 slot 可用） |
| 服务重启恢复 | `init()` 重建状态，过期任务重置 |
| 多请求同时 tryAcquire | Promise lock 确保原子操作 |

## 文件改动清单

| 文件 | 改动类型 |
|------|---------|
| `src/lib/analysis-queue.ts` | 新增 |
| `src/lib/analysis-runner.ts` | 新增 |
| `src/app/api/analyze/route.ts` | 改动 |
| `src/app/api/analyze/queue/route.ts` | 新增 |
| `src/types/index.ts` | 改动 |
| `src/instrumentation.ts` | 新增（可选） |
| `src/components/PaperCard.tsx` | 改动 |
| `src/hooks/use-analysis-polling.ts` | 改动 |
| `src/app/settings/page.tsx` | 改动（添加配置项） |