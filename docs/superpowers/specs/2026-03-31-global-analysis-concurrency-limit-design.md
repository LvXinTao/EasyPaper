# 全局并发解析限制设计

## 概述

限制同时解析的论文数量（默认 3 篇），超过限制的请求进入排队状态，任务完成后自动触发下一个排队任务。

## 需求

- 最大并发数：3 篇
- 超限时状态：`queued`（排队中）
- 存储方式：每篇论文 metadata 中
- 队列处理：完成回调驱动，自动触发下一个

## 架构

### 新增模块

1. **`src/lib/analysis-queue.ts`** — 队列管理模块
2. **`src/lib/analysis-runner.ts`** — 分析核心逻辑（从 route 抽取）

### 改动模块

- `src/app/api/analyze/route.ts` — 集成队列检查
- `src/types/index.ts` — 添加 `queued` 状态

## 数据结构

### QueueState（内存单例）

```typescript
interface QueueState {
  activeCount: number;         // 当前正在解析的数量
  activePaperIds: Set<string>; // 正在解析的 paperId 集合
  maxConcurrent: number;       // 最大并发数（默认 3）
}
```

### PaperStatus 扩展

```typescript
type PaperStatus = 'pending' | 'queued' | 'parsing' | 'analyzing' | 'analyzed' | 'error';
```

新增 `queued` 状态，表示论文在排队等待解析。

## 队列操作

### analysisQueue 模块

```typescript
export const analysisQueue = {
  // 初始化：启动时扫描所有 papers 重建状态
  async init(): Promise<void>;

  // 尝试获取 slot：返回 true 表示可以开始，false 表示需要排队
  tryAcquire(paperId: string): boolean;

  // 释放 slot：任务完成时调用，自动触发下一个 queued 任务
  async release(paperId: string): Promise<void>;

  // 获取排队中的论文列表（按 createdAt 排序）
  async getQueuedPapers(): Promise<string[]>;

  // 获取当前状态（供前端展示）
  getStatus(): { active: number; max: number; queued: number };
};
```

### tryAcquire 逻辑

```typescript
tryAcquire(paperId: string): boolean {
  if (this.state.activeCount < this.state.maxConcurrent) {
    this.state.activeCount++;
    this.state.activePaperIds.add(paperId);
    return true;
  }
  return false;
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
    const nextPaperId = queuedPapers[0];
    this.tryAcquire(nextPaperId);
    await runAnalysisCore(nextPaperId, await getAIConfig());
  }
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
  // 现有的 runAnalysis 逻辑
  // onProgress 为可选回调：
  // - SSE 版本：传入 send 函数推送事件
  // - 队列触发版本：传入简单日志回调或空函数

  // 在 finally 块中：
  // - 调用 analysisQueue.release(paperId)
}
```

## /api/analyze 改动

```typescript
export async function POST(request: Request) {
  const { paperId, force } = await request.json();

  // ... 现有验证逻辑 ...

  // 尝试获取 slot
  if (!analysisQueue.tryAcquire(paperId)) {
    await storage.updateMetadata(paperId, {
      status: 'queued',
      analysisProgress: {
        step: 'queued',
        message: 'Waiting in queue...',
        updatedAt: new Date().toISOString(),
      },
    });
    return new Response(JSON.stringify({ status: 'queued' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // SSE stream 调用 runAnalysisCore
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

## 初始化逻辑

### init()

```typescript
async init(): Promise<void> {
  const papers = await storage.listPapers();
  for (const paper of papers) {
    const meta = await storage.getMetadata(paper.id);
    if (meta?.status === 'parsing' || meta?.status === 'analyzing') {
      const updatedAt = new Date(meta.analysisProgress?.updatedAt || 0).getTime();
      const ageMs = Date.now() - updatedAt;

      if (ageMs > 10 * 60 * 1000) {
        // 过期，重置为 pending
        await storage.updateMetadata(paper.id, { status: 'pending' });
      } else {
        // 活跃任务，加入计数
        this.state.activePaperIds.add(paper.id);
        this.state.activeCount++;
      }
    }
  }
}
```

### 初始化时机

使用 Next.js `instrumentation.ts` 或在首次 API 请求时懒加载。

## 前端改动

### 状态展示

- **PaperCard**：显示 "排队中" 状态标识
- **Analysis Panel**：显示排队进度 "排队中 (等待 N 个任务)"

### 轮询处理

现有 `use-analysis-polling.ts` 已支持状态轮询，新增 `queued` 状态后自动生效。

## 数据流

```
用户请求 → tryAcquire()
  ├─ 成功 → runAnalysisCore() → release() → 触发下一个 queued
  └─ 失败 → status: 'queued' → 等待 release() 触发
```

## 错误处理

- `runAnalysisCore` 的 `finally` 块确保 `release()` 总是调用
- 分析失败时状态设为 `error`，仍释放 slot
- 初始化时检测过期任务并重置

## 文件改动清单

| 文件 | 改动类型 |
|------|---------|
| `src/lib/analysis-queue.ts` | 新增 |
| `src/lib/analysis-runner.ts` | 新增 |
| `src/app/api/analyze/route.ts` | 改动 |
| `src/types/index.ts` | 改动 |
| `src/instrumentation.ts` | 新增（可选） |
| 前端 PaperCard/AnalysisPanel | 改动 |