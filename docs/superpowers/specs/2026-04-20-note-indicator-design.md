# 笔记指示器从气泡改为彩色圆点

## 背景

当前 PDF 上的笔记以气泡形式展示（`annotation-bubble.tsx`），每个笔记占用约 180px 宽的面板，显示标题和 tag 标签。这在笔记较多时遮挡 PDF 内容较多，影响阅读体验。

本设计将气泡替换为彩色圆点指示器，大幅减少视觉占用，hover 时显示预览，点击后打开编辑器。

## 需求

- 将 PDF 上的笔记标注从长条气泡改为小型彩色圆点
- 圆点颜色由笔记的第一个 tag 决定
- hover 时显示笔记预览（tag + 标题 + 内容摘要）
- 点击圆点打开笔记编辑器
- 多笔记时圆点水平排列

## 视觉设计

### 圆点规格
- **直径**：8px
- **形状**：实心圆，`border-radius: 50%`
- **颜色**：取自 `note.tags[0]` 对应的 tag 颜色；无 tag 时使用 `#9ca3af`
- **多笔记排列**：水平排列，间隔 4px

### Tag 颜色映射
| Tag | 颜色 |
|-----|------|
| important | `#ef4444` |
| question | `#f59e0b` |
| todo | `#3b82f6` |
| idea | `#10b981` |
| summary | `#8b5cf6` |

### 位置
- 放置在高亮区域的右边缘，和现有气泡相同的定位逻辑
- 通过 `ResizeObserver` 在页面缩放时重新计算位置

## 交互设计

### Hover
- 鼠标悬停在圆点上时，在圆点左侧弹出预览气泡
- 预览内容：tag 标签（彩色）+ 笔记标题 + 内容前两行（截断，最多 80 字符）
- 黑色半透明背景，白色文字
- 悬停在哪个圆点就显示哪个笔记的预览
- 多笔记同时 hover 不叠加，只显示当前悬停的
- Tooltip 位置：默认在圆点左侧；若圆点靠近页面左边缘（圆点 x < 200px），则改为在圆点右侧弹出，避免溢出屏幕

### 点击
- 点击圆点打开内联笔记编辑器（`InlineNoteEditor`），编辑模式
- 编辑器的打开逻辑与现在点击气泡完全一致

### 页面变化
- 翻页时圆点随页面内容重新渲染
- 缩放时 `ResizeObserver` 触发位置重新计算

## 代码变更

### 新增文件

**`src/components/note-indicator.tsx`**
- 导出 `NoteIndicator` 组件
- Props：`note: Note`、`position: { x: number; y: number }`、`onClick: () => void`
- 内部维护 hover 状态的 tooltip 显示
- 圆点点击时调用 `onClick`
- `TAG_COLORS` 映射内联在此文件中（从 `annotation-bubble.tsx` 复制，删除原文件后不再依赖）
- 添加 `tabIndex={0}`、`role="button"`、`aria-label` 支持键盘焦点和屏幕阅读器
- hover 时圆点有轻微 `scale(1.2)` 放大效果提示可交互

### 删除文件

**`src/components/annotation-bubble.tsx`** — 完全删除，功能被 `NoteIndicator` 替代（经 grep 确认仅 `pdf-viewer.tsx` 导入，无其他消费者）

### 修改文件

**`src/components/pdf-viewer.tsx`**
- 导入 `NoteIndicator` 替换 `AnnotationBubble`
- JSX 渲染部分将 `AnnotationBubble` 替换为 `NoteIndicator`
- 移除 `bubblePositions` 的 `useEffect` 位置计算逻辑中不必要的 DOM 查询（圆点定位逻辑更简单）
- `handleAnnotationClick` 重命名为 `handleNoteIndicatorClick`

### 不变的文件

- `src/components/selection-toolbar.tsx`
- `src/components/inline-note-editor.tsx`
- `src/components/notes-list.tsx`
- `src/types/index.ts`
- 所有 API 路由

## 测试

- 验证圆点在高亮区域右侧正确显示
- 验证 hover 时 tooltip 正确出现且内容完整
- 验证点击圆点打开编辑器
- 验证多笔记水平排列不重叠
- 验证缩放/翻页时圆点位置正确重算
- 验证无 tag 的笔记显示默认灰色圆点

## 回滚

如果新方案有问题，`annotation-bubble.tsx` 的删除操作可以通过 git 恢复，`pdf-viewer.tsx` 的 import 和渲染部分改回 `AnnotationBubble` 即可。
