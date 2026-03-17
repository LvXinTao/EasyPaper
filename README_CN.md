[English](./README.md)

# EasyPaper

上传学术 PDF，获取 AI 驱动的分析，并就内容进行对话 —— 一站式完成。

## 功能特性

- **PDF 上传与阅读** —— 拖拽上传，内置 PDF 阅读器（缩放、翻页、文本选择）
- **AI 分析** —— 自动提取摘要、核心贡献、研究方法和结论，并附带页码引用
- **智能对话** —— 基于论文全文上下文，对论文内容进行追问
- **引用跳转** —— 点击分析中的引用可跳转到 PDF 对应页面并高亮文本
- **流式响应** —— 实时流式输出 AI 回复，带打字机效果
- **灵活的 AI 后端** —— 支持任何 OpenAI 兼容 API（OpenAI、Ollama、LM Studio 等）
- **本地存储** —— 所有数据存储在本地，无需外部数据库

## 快速开始

### 前置条件

- **Node.js** 18+
- **Python 3**，需安装 [`marker-pdf`](https://github.com/VikParuchuri/marker)（`pip install marker-pdf`）

### 配置

```bash
# 安装依赖
npm install

# 配置 AI 服务
cp .env.example .env.local
```

编辑 `.env.local` 填入你的配置：

```env
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-your-key-here
AI_MODEL=gpt-4o
AI_VISION_MODEL=gpt-4o
```

> 你也可以在应用的设置页面中配置这些选项。

### 运行

```bash
npm run dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000)。

## 使用方式

1. **上传** —— 在首页上传 PDF（拖拽或点击选择文件）
2. **打开** —— 进入论文详情页，左侧为 PDF 阅读器，右侧为分析面板
3. **分析** —— 对论文进行结构化分析，生成带页码引用的解读
4. **对话** —— 就论文内容提出具体问题

## 技术栈

- [Next.js](https://nextjs.org) 16 (App Router) + React 19 + TypeScript
- [Tailwind CSS](https://tailwindcss.com) 4
- [pdfjs-dist](https://github.com/nicedoc/pdfjs-dist) 用于 PDF 渲染
- [marker-pdf](https://github.com/VikParuchuri/marker) 用于 PDF 转 Markdown 解析

## 许可证

MIT
