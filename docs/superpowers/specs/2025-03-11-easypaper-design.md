# EasyPaper 设计文档

> 论文解读 Web App - 2025-03-11

## 项目概述

EasyPaper 是一个论文解读 Web 应用，用户上传 PDF 论文后，AI 以双栏方式展示原文和解读内容，支持结构化解读和追问对话。

### 核心特性

- **双栏布局**：左侧 PDF 原文预览，右侧 AI 解读内容
- **结构化解读**：自动生成核心摘要、主要贡献、方法概述、关键结论
- **追问对话**：支持用户针对论文内容追问
- **点击定位**：解读内容点击后自动定位到 PDF 对应位置
- **本地存储**：数据完全存储在本地，用户完全掌控
- **自定义 API**：用户配置自己的 AI API（OpenAI 兼容端点）

## 技术架构

### 技术栈选择

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Next.js (App Router) | React 框架，支持 SSR |
| PDF 预览 | PDF.js | Mozilla 开源 PDF 渲染库 |
| PDF 解析 | Marker | Python 工具，PDF 转 Markdown |
| AI 调用 | 用户自定义 API | OpenAI 兼容端点 |
| 数据存储 | 本地文件系统 | JSON + Markdown |

### 架构图

```
┌─────────────────────────────────────────┐
│              Next.js 应用                │
├─────────────┬───────────────────────────┤
│   Frontend  │      API Routes           │
│  (React)    │  /api/upload              │
│             │  /api/analyze             │
│  - PDF.js   │  /api/chat                │
│  - 对话UI   │  - Marker 处理            │
│             │  - AI 调用                │
├─────────────┴───────────────────────────┤
│         本地文件存储                      │
│    ./data/papers/{id}/                   │
└─────────────────────────────────────────┘
```

## 页面结构

### 路由设计

```
app/
├── page.tsx              // 首页 - 上传入口
├── paper/[id]/page.tsx   // 论文详情页 - 双栏解读
├── settings/page.tsx     // 设置页 - API 配置
├── layout.tsx            // 全局布局
└── api/
    ├── upload/route.ts   // 上传 PDF
    ├── analyze/route.ts  // 分析论文
    ├── chat/route.ts     // 追问对话
    └── settings/route.ts // 保存设置
```

### 页面详情

#### 首页 (/)

- 拖拽上传 PDF 或选择文件上传
- 显示上传进度
- 完成后跳转到论文详情页

#### 论文详情页 (/paper/[id])

核心页面，对话式双栏布局：

- **左侧 (55%)**：PDF.js 预览，支持缩放、翻页
- **右侧 (45%)**：
  - 顶部：章节标签切换
  - 中部：解读内容展示
  - 底部：追问输入框

#### 设置页 (/settings)

API 配置界面：

- Base URL（API 端点地址）
- API Key
- 模型名称
- 视觉模型名称

## API 接口设计

### POST /api/upload

上传 PDF 文件

**Request:**
```
FormData:
  file: PDF文件
```

**Response:**
```json
{
  "id": "uuid-xxx",
  "status": "pending"
}
```

### POST /api/analyze

解析并分析论文，SSE 流式输出

**Request:**
```json
{
  "paperId": "uuid-xxx"
}
```

**Response (SSE Stream):**
```
data: {"step": "parsing"}
data: {"step": "analyzing"}
data: {"section": "summary", "content": "..."}
data: {"done": true}
```

**处理流程：**
1. Marker 解析 PDF 为 Markdown
2. 提取图表截图
3. AI 生成结构化解读

### POST /api/chat

追问对话，SSE 流式输出

**Request:**
```json
{
  "paperId": "uuid-xxx",
  "message": "这个方法的复杂度是多少？"
}
```

**Response (SSE Stream):**
```
data: {"content": "根据论文..."}
data: {"done": true}
```

**上下文构建：**
- 已解析的 Markdown 内容
- 对话历史记录

### GET /api/paper/[id]

获取论文数据

**Response:**
```json
{
  "metadata": {...},
  "analysis": {...},
  "parsedContent": "markdown..."
}
```

## 数据存储设计

### 目录结构

```
data/
└── papers/
    └── {paper-id}/
        ├── original.pdf       // 原始 PDF 文件
        ├── parsed.md          // Marker 解析的 Markdown
        ├── metadata.json      // 元数据
        ├── analysis.json      // 结构化解读结果
        ├── chat-history.json  // 追问对话历史
        └── images/            // 提取的图片/图表

config/
└── settings.json             // API 配置
```

### 文件格式

#### metadata.json

```json
{
  "id": "uuid-xxx",
  "title": "论文标题",
  "filename": "paper.pdf",
  "pages": 12,
  "createdAt": "2025-03-11T10:00:00Z",
  "status": "analyzed"
}
```

状态值：`pending` | `parsing` | `analyzing` | `analyzed` | `error`

#### analysis.json

```json
{
  "summary": "核心摘要内容...",
  "contributions": ["贡献1", "贡献2"],
  "methodology": "方法概述...",
  "conclusions": "关键结论...",
  "generatedAt": "2025-03-11T10:05:00Z"
}
```

#### chat-history.json

```json
{
  "messages": [
    {"role": "user", "content": "这个方法的复杂度是多少？"},
    {"role": "assistant", "content": "根据论文..."}
  ]
}
```

#### settings.json

```json
{
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-xxx",
  "model": "gpt-4o",
  "visionModel": "gpt-4o"
}
```

## 核心功能模块

### PDF 处理模块

**技术方案：Marker + 视觉模型补充**

1. **主要流程**：使用 Marker 将 PDF 转换为 Markdown
   - 保留表格、公式、图片链接
   - 提取页面结构信息

2. **图表处理**：对于复杂图表
   - 截图保存到 images/ 目录
   - 使用视觉模型解读图表内容

3. **PDF 预览**：使用 PDF.js
   - 支持缩放、翻页
   - 支持跳转到指定页面

### AI 解读模块

**解读结构（简化版）：**

| 章节 | 说明 |
|------|------|
| 核心摘要 | 论文主要内容和创新点概述 |
| 主要贡献 | 列出论文的核心贡献（2-5点） |
| 方法概述 | 研究方法和技术方案的解读 |
| 关键结论 | 实验结果和结论的总结 |

**Prompt 设计要点：**
- 基于解析的 Markdown 内容生成
- 每个章节独立生成，支持流式输出
- 生成页面引用，支持点击定位

### 交互功能

#### 点击定位

- 解读内容中标注引用来源（页码）
- 用户点击后，左侧 PDF 自动跳转到对应页面
- 实现方式：在分析时记录内容与页码的映射关系

#### 章节切换

- 顶部标签页快速切换
- 切换时保留对话历史
- 当前章节高亮显示

#### 追问对话

- 基于 RAG 思路：论文内容 + 对话历史作为上下文
- 流式输出，实时显示回答
- 对话历史持久化存储

## 用户配置

### 配置方式

1. **环境变量**（默认值）：
   ```
   AI_BASE_URL=https://api.openai.com/v1
   AI_API_KEY=sk-xxx
   AI_MODEL=gpt-4o
   AI_VISION_MODEL=gpt-4o
   ```

2. **设置页面**：
   - 用户可在界面配置，覆盖环境变量
   - 配置保存到 config/settings.json

### API 调用格式

兼容 OpenAI Chat Completions API：

```typescript
const response = await fetch(`${baseUrl}/chat/completions`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: model,
    messages: [...],
    stream: true,
  }),
});
```

## 部署方式

本地部署运行：

```bash
# 安装依赖
npm install

# 配置环境变量（可选）
cp .env.example .env

# 安装 Python 依赖（Marker）
pip install marker-pdf

# 启动开发服务器
npm run dev
```

## 未来扩展

可能的后续功能：

- [ ] 支持多篇论文对比
- [ ] 导出解读报告（PDF/Markdown）
- [ ] 论文收藏和标签管理
- [ ] 支持更多文档格式（Word、LaTeX）