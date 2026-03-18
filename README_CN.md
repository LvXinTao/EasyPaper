[English](./README.md)

# EasyPaper

[![npm version](https://img.shields.io/npm/v/@lvxintao/easypaper)](https://www.npmjs.com/package/@lvxintao/easypaper)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org)

上传学术 PDF，获取 AI 驱动的分析，并就内容进行对话 —— 一站式完成。

<!-- 在此添加截图 -->
<!-- ![EasyPaper 截图](docs/images/screenshot.png) -->

## 快速体验

无需安装，直接运行：

```bash
npx @lvxintao/easypaper
```

打开 [http://localhost:3000](http://localhost:3000)，进入**设置**页面配置 AI 服务，即可开始上传论文。

> **前置条件：** [Node.js](https://nodejs.org) 18+ 和 Python 3，需安装 [`marker-pdf`](https://github.com/VikParuchuri/marker)（`pip install marker-pdf`）

## 功能特性

- **PDF 上传与阅读** — 拖拽上传，内置 PDF 阅读器（缩放、翻页、文本选择）
- **AI 分析** — 自动提取摘要、核心贡献、研究方法和结论，并附带页码引用
- **智能对话** — 基于论文全文上下文，对论文内容进行追问
- **引用跳转** — 点击分析中的引用可跳转到 PDF 对应页面并高亮文本
- **流式响应** — 实时流式输出 AI 回复，带打字机效果
- **灵活的 AI 后端** — 支持任何 OpenAI 兼容 API（OpenAI、Ollama、LM Studio 等）
- **本地存储** — 所有数据存储在本地，无需外部数据库

## 安装方式

### 方式一：npx（免安装）

```bash
npx @lvxintao/easypaper
```

### 方式二：全局安装

```bash
npm install -g @lvxintao/easypaper
easypaper
```

### 方式三：从源码运行

```bash
git clone https://github.com/lvxintao/EasyPaper.git
cd EasyPaper
npm install
cp .env.example .env.local   # 编辑填入你的 AI 服务配置
npm run dev
```

## 配置

在应用的**设置**页面配置 AI 服务，或通过环境变量配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `AI_BASE_URL` | API 端点 | `https://api.openai.com/v1` |
| `AI_API_KEY` | API 密钥 | — |
| `AI_MODEL` | 对话模型 | `gpt-4o` |
| `AI_VISION_MODEL` | 视觉模型 | `gpt-4o` |

- **npm 安装：** 将 `.env` 文件放在 `~/.easypaper/.env`
- **源码运行：** 将 `.env.example` 复制为 `.env.local`

## 使用方式

1. **上传** — 在首页上传 PDF（拖拽或点击选择文件）
2. **打开** — 进入论文详情页，左侧为 PDF 阅读器，右侧为分析面板
3. **分析** — 对论文进行结构化分析，生成带页码引用的解读
4. **对话** — 就论文内容提出具体问题

## CLI 参数

```
easypaper [选项]

  -p, --port <端口号>  指定运行端口（默认: 3000）
  -h, --help           显示帮助信息
  -v, --version        显示版本号
```

数据存储在 `~/.easypaper/` 目录。

## 技术栈

- [Next.js](https://nextjs.org) 16 (App Router) + React 19 + TypeScript
- [Tailwind CSS](https://tailwindcss.com) 4
- [pdfjs-dist](https://github.com/nicedoc/pdfjs-dist) 用于 PDF 渲染
- [marker-pdf](https://github.com/VikParuchuri/marker) 用于 PDF 转 Markdown 解析

## 许可证

MIT
