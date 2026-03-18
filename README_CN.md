[English](./README.md)

# EasyPaper

[![npm version](https://img.shields.io/npm/v/@lvxintao/easypaper)](https://www.npmjs.com/package/@lvxintao/easypaper)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org)

上传论文PDF，使用AI进行解读，并就内容进行对话，记下你的所思所想。完全自定义API。

<img src="docs/images/screenshot.png" alt="EasyPaper 截图" width="1000"/>



## 功能特性

- **PDF 上传与阅读** — 拖拽上传，内置 PDF 阅读器（缩放、翻页、文本选择）。
- **AI 解读** — 通过MLLM（如GPT-4o）自动提取摘要、核心贡献、研究方法和结论，可自定义Prompt。
- **AI 对话** — 基于论文全文上下文，对论文内容进行追问。
- **笔记功能** - 可对论文内容进行笔记，支持Markdown格式，支持标签管理。
- **灵活的 AI 后端** — 支持任何 OpenAI 兼容 API（OpenAI、OpenRouter等）。
- **本地存储** — 所有数据存储在本地，无需外部数据库。

## 快速安装

### 方式一：npx（免安装）

```bash
npx @lvxintao/easypaper
```

### 方式二：全局安装

```bash
npm i -g @lvxintao/easypaper
easypaper
```

### 方式三：从源码运行

```bash
git clone https://github.com/lvxintao/EasyPaper.git
cd EasyPaper
npm install
```

### 方式四：已安装，需要更新

```bash
npm i -g @lvxintao/easypaper@latest
```

## 使用


```bash
# npm安装
easypaper # 默认端口3000，可选--port <端口号>
-----------
# 源码安装
cd EasyPaper
npm run start
```
打开 [本地部署Web App](http://localhost:3000) 即可使用。

## 配置

在应用的**设置**页面配置 AI 服务，或通过环境变量配置：

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `AI_BASE_URL` | API 端点 | `https://api.openai.com/v1` |
| `AI_API_KEY` | API 密钥 | — |
| `AI_MODEL` | 对话模型 | `gpt-4o` |
| `AI_VISION_MODEL` | pdf解析模型 | `gpt-4o` |

- **环境变量设置：** 也可在`~/.easypaper/.env`中设置，优先级小于UI设置。

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

数据完全存储在本地，位于 `~/.easypaper/` 目录。

## 技术栈

- [Next.js](https://nextjs.org) 16 (App Router) + React 19 + TypeScript
- [Tailwind CSS](https://tailwindcss.com) 4
- [mupdf](https://github.com/ArtifexSoftware/mupdf) 用于 PDF 渲染

## 许可证

MIT License
