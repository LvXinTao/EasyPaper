# Bilingual README Design Spec

## Goal

Provide Chinese and English versions of the project README with cross-links for easy switching.

## Approach: Dual-File

The standard open-source convention (used by Vue.js, Ant Design, etc.):

- **README.md** — English (primary). Add `[中文文档](./README_CN.md)` link at the top before the title.
- **README_CN.md** — Chinese translation. Add `[English](./README.md)` link at the top before the title.

## Changes

### 1. README.md (edit)

Insert a language switch link as the first line, before the `# EasyPaper` heading:

```markdown
[中文文档](./README_CN.md)

# EasyPaper
...existing content unchanged...
```

### 2. README_CN.md (new file)

- First line: `[English](./README.md)`
- Content: Full Chinese translation of README.md
- Structure: Identical sections and headings mirroring the English version
- Translation rules:
  - Technical terms (Next.js, TypeScript, marker-pdf, pdfjs-dist, etc.) stay in English
  - Code blocks and commands are not translated; only inline comments are translated
  - URLs and links remain the same
  - Markdown structure preserved exactly

## Sections to Translate

1. Title + tagline
2. Features (7 bullet points)
3. Quick Start (Prerequisites, Setup, Run)
4. Usage (4-step guide)
5. Tech Stack
6. License
