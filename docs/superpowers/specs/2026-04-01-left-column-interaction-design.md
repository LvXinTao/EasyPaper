---
name: left-column-interaction-improvement
description: Improve homepage left column interaction - tree view with multi-select and batch operations
type: project
---

# 左栏交互改进设计文档

## 背景

当前首页采用三栏布局：
- **Column 1 (左栏)**: Library + Folders + Papers 列表
- **Column 2 (中间栏)**: 论文详情列表（带筛选）
- **Column 3 (右栏)**: 预览面板

**存在的问题**：
1. 左栏底部的 Papers 列表与中间栏重复，用户需理解两处区别
2. 左栏论文列表只显示标题截断，无状态标识
3. 点击左栏论文会重置中间栏筛选条件，交互出乎意料
4. 左栏论文可拖动但不能选中，缺乏批量操作功能

## 设计目标

将左栏改为树形视图，统一展示文件夹和论文，并支持多选和批量操作。

## 设计决策

### 1. 结构变更

**决策**: 合并左栏为树形视图

- 文件夹和论文在同一棵树中显示
- 中间栏从"论文列表"改为"筛选与统计面板"
- 筛选条件影响左栏树形视图的显示（隐藏不符合条件的论文）

**Why**: 减少重复信息，提供类似 Finder/文件管理器的直觉体验。

### 2. 选中行为

**决策**: 单选 → 预览；多选 → 批量操作模式

- 单击论文文字 → 右侧预览面板显示内容
- 多选论文时 → 底部显示批量操作工具栏，预览面板显示"已选中 N 项"

**Why**: 用户习惯单选查看详情，多选进行批量管理。

### 3. 多选触发方式

**决策**: 仅复选框方式

- 每个论文项左侧显示复选框（☐/☑）
- 点击复选框 → 选中/取消选中
- 点击论文文字 → 预览（不影响选中状态）

**Why**: 复选框直观明确，降低学习成本。

### 4. 批量操作触发

**决策**: 右键菜单 + 底部工具栏

**右键菜单内容**:
- 删除选中项 (N)
- 移动到文件夹...
- 添加星标
- 移除星标
- 取消选择

**底部工具栏**:
- 已选中 N 项提示
- 删除按钮（红色风格）
- 移动按钮
- 标记星标按钮

**Why**: 右键菜单是批量操作的常见入口，底部工具栏提供可见的操作提示。

### 5. 批量删除流程

1. 用户通过复选框选中多个论文
2. 右键点击 → 选择"删除选中项 (N)"
3. 弹出确认弹窗："确定删除选中的 N 篇论文？此操作不可撤销"
4. 确认后批量调用 DELETE API，更新树形视图

## 视觉设计规范

**重要约束**: 所有新增 UI 元素必须与现有设计风格保持一致。

### 复选框样式
- 未选中: `border: 1px solid var(--glass-border)`, `background: transparent`
- 已选中: `border: 1px solid var(--accent)`, `background: var(--accent-subtle)`
- 尺寸: 14px × 14px, `border-radius: 3px`

### 状态图标
沿用现有配色：
- 已分析: `color: var(--green)`, 图标 `✓`
- 处理中: `color: var(--amber)`, 图标 `⋯`
- 错误: `color: var(--rose)`, 图标 `✗`

### 右键菜单
与 `folder-tree.tsx` 现有下拉菜单风格一致：
- `background: var(--bg)`
- `border: 1px solid var(--glass-border)`
- `box-shadow: 0 8px 24px rgba(0,0,0,0.15)`
- `border-radius: 8px`
- 项目内边距: `padding: 6px 12px`
- 文字大小: `font-size: 11px`

### 批量操作工具栏
- `background: var(--glass)`
- `border: 1px solid var(--accent)`
- 删除按钮: `background: rgba(var(--rose-rgb), 0.15)`, `color: var(--rose)`
- 其他按钮: `background: var(--glass)`, `border: 1px solid var(--glass-border)`

### 多选高亮
- 选中行: `background: var(--accent-subtle)`, `border: 1px solid var(--accent)`

## 组件结构

### 新增/修改组件

```
src/components/
├── paper-tree.tsx          # 新增：树形视图组件（替代左栏 Papers 列表）
├── paper-tree-item.tsx     # 新增：论文树节点（含复选框）
├── batch-action-toolbar.tsx # 新增：批量操作工具栏
├── context-menu.tsx        # 新增：右键菜单组件
├── filter-panel.tsx        # 新增：筛选面板（替代中间栏论文列表）
├── folder-tree.tsx         # 修改：整合到树形视图
└── preview-panel.tsx       # 修改：支持多选状态显示
```

### 页面结构变更

```tsx
// src/app/page.tsx 新布局
<div className="flex">
  {/* Column 1: Tree View */}
  <PaperTree
    papers={papers}
    folders={folders}
    selectedPaperIds={selectedPaperIds}
    onSelect={handleSelect}
    onMultiSelect={handleMultiSelect}
    onBatchDelete={handleBatchDelete}
    onBatchMove={handleBatchMove}
  />
  
  {/* Column 2: Filter Panel */}
  <FilterPanel
    statusFilter={statusFilter}
    sortMode={sortMode}
    starredOnly={starredOnly}
    stats={stats}
  />
  
  {/* Column 3: Preview */}
  <PreviewPanel
    paper={selectedPaper}
    multiSelectCount={selectedPaperIds.length}
  />
</div>
```

## 数据流

### 选中状态管理
```tsx
const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());

// 单选预览
const handlePaperClick = (paperId: string) => {
  setSelectedPaperId(paperId); // 预览用的单选
};

// 复选框多选
const handleCheckboxToggle = (paperId: string) => {
  const newSet = new Set(selectedPaperIds);
  if (newSet.has(paperId)) {
    newSet.delete(paperId);
  } else {
    newSet.add(paperId);
  }
  setSelectedPaperIds(newSet);
};
```

### 批量删除 API
```tsx
// 新增 API 或复用现有单删 API
const handleBatchDelete = async (paperIds: string[]) => {
  if (!confirm(`确定删除选中的 ${paperIds.length} 篇论文？此操作不可撤销`)) return;
  
  await Promise.all(paperIds.map(id => 
    fetch(`/api/paper/${id}`, { method: 'DELETE' })
  ));
  
  setPapers(prev => prev.filter(p => !paperIds.includes(p.id)));
  setSelectedPaperIds(new Set());
};
```

### 篮选联动
筛选面板的条件变化时，树形视图隐藏不符合条件的论文：
```tsx
const visiblePapers = papers.filter(p => {
  if (statusFilter === 'analyzed' && p.status !== 'analyzed') return false;
  if (statusFilter === 'pending' && !['pending', 'parsing', 'analyzing'].includes(p.status)) return false;
  if (statusFilter === 'error' && p.status !== 'error') return false;
  if (starredOnly && !p.starred) return false;
  return true;
});
```

## 实现优先级

1. **P0 - 核心功能**
   - 树形视图基础结构
   - 复选框多选
   - 右键菜单（删除/移动）
   - 批量删除确认弹窗

2. **P1 - 增强功能**
   - 批量操作工具栏
   - 篮选面板
   - 多选状态预览提示

3. **P2 - 优化**
   - 拖拽移动保留
   - 状态图标显示
   - 搜索框在树形视图顶部

## 兼容性考虑

- 保留现有的拖拽排序功能（在树形视图中）
- 保留现有的文件夹 CRUD 操作
- 中间栏筛选面板可折叠（为小屏幕预留）

## 测试要点

1. 多选后右键删除，确认弹窗正确显示数量
2. 批量删除后，树形视图和状态同步更新
3. 篮选条件变化，树形视图正确隐藏/显示论文
4. 复选框与文字点击行为分离
5. 视觉风格与现有 UI 一致（CSS 变量使用正确）