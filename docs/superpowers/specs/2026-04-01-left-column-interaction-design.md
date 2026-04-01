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
3. 弹出自定义确认弹窗（见 `ConfirmModal` 组件）
4. 确认后批量调用现有 DELETE API，更新树形视图

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

## 组件结构与接口定义

### 新增/修改组件

```
src/components/
├── paper-tree.tsx          # 新增：树形视图组件（替代左栏 Papers 列表）
├── paper-tree-item.tsx     # 新增：论文树节点（含复选框）
├── batch-action-toolbar.tsx # 新增：批量操作工具栏
├── context-menu.tsx        # 新增：右键菜单组件
├── confirm-modal.tsx       # 新增：确认弹窗组件
├── filter-panel.tsx        # 新增：筛选面板（替代中间栏论文列表）
├── paper-tree-folder.tsx   # 新增：文件夹树节点（复用现有 FolderTree 逻辑）
├── folder-tree.tsx         # 保留：继续用于详情页侧边栏
└── preview-panel.tsx       # 修改：支持多选状态显示
```

### TypeScript 接口定义

#### PaperTreeProps
```tsx
interface PaperTreeProps {
  papers: PaperListItem[];
  folders: Folder[];
  selectedPaperId: string | null;         // 单选预览用的论文 ID
  selectedPaperIds: Set<string>;          // 多选批量操作用的论文 ID 集合
  statusFilter: 'all' | 'analyzed' | 'pending' | 'error';
  starredOnly: boolean;
  searchQuery: string;
  sortMode: 'recent' | 'name' | 'starred';
  onPaperClick: (paperId: string) => void;     // 单击文字 → 预览
  onCheckboxToggle: (paperId: string) => void; // 点击复选框 → 多选
  onBatchDelete: (paperIds: string[]) => void;
  onBatchMove: (paperIds: string[], folderId: string | null) => void;
  onBatchStar: (paperIds: string[], starred: boolean) => void;
  onMovePaper: (paperId: string, folderId: string | null) => void;  // 拖拽移动
  onClearSelection: () => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
}
```

#### PaperTreeItemProps
```tsx
interface PaperTreeItemProps {
  paper: PaperListItem;
  isSelected: boolean;      // 是否在 selectedPaperIds 中
  isChecked: boolean;       // 复选框是否选中
  depth: number;            // 树深度（用于缩进）
  onClick: () => void;      // 点击文字 → 预览
  onCheckboxToggle: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDrop: (targetFolderId: string | null) => void;
}
```

#### BatchActionToolbarProps
```tsx
interface BatchActionToolbarProps {
  selectedCount: number;
  onDelete: () => void;
  onMove: () => void;
  onStar: () => void;
  onClear: () => void;
}
```

#### ContextMenuProps
```tsx
interface ContextMenuProps {
  x: number;
  y: number;
  selectedCount: number;
  onClose: () => void;
  onDelete: () => void;
  onMove: () => void;
  onStar: () => void;
  onUnstar: () => void;
  onClear: () => void;
}
```

#### ConfirmModalProps
```tsx
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;         // 是否为危险操作（红色按钮）
  onConfirm: () => void;
  onCancel: () => void;
}
```

#### FilterPanelProps
```tsx
interface FilterPanelProps {
  statusFilter: 'all' | 'analyzed' | 'pending' | 'error';
  starredOnly: boolean;
  sortMode: 'recent' | 'name' | 'starred';
  stats: {
    total: number;
    analyzed: number;
    pending: number;
    error: number;
    starred: number;
  };
  onStatusFilterChange: (filter: 'all' | 'analyzed' | 'pending' | 'error') => void;
  onStarredOnlyChange: (value: boolean) => void;
  onSortModeChange: (mode: 'recent' | 'name' | 'starred') => void;
}
```

#### PaperTreeFolderProps
```tsx
interface PaperTreeFolderProps {
  folder: Folder;
  depth: number;
  isExpanded: boolean;
  isSelected: boolean;      // 是否为当前选中的文件夹筛选
  paperCount: number;       // 该文件夹及子文件夹下的论文总数
  childrenFolders: Folder[];
  childrenPapers: PaperListItem[];
  onToggleExpand: () => void;
  onClick: () => void;      // 点击文件夹 → 篮选该文件夹内容
  onCreateChildFolder: (name: string) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onDropPaper: (paperId: string) => void;
}
```

## 数据流

### 状态管理（完整版）
```tsx
// src/app/page.tsx

// 单选预览状态
const [selectedPaperId, setSelectedPaperId] = useState<string | null>(null);

// 多选批量操作状态
const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());

// 筛选状态
const [statusFilter, setStatusFilter] = useState<'all' | 'analyzed' | 'pending' | 'error'>('all');
const [starredOnly, setStarredOnly] = useState(false);
const [sortMode, setSortMode] = useState<'recent' | 'name' | 'starred'>('recent');
const [searchQuery, setSearchQuery] = useState('');

// 确认弹窗状态
const [confirmModal, setConfirmModal] = useState<{
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

// 右键菜单状态
const [contextMenu, setContextMenu] = useState<{
  isOpen: boolean;
  x: number;
  y: number;
}>({ isOpen: false, x: 0, y: 0 });

// 统计数据计算
const stats = useMemo(() => ({
  total: papers.length,
  analyzed: papers.filter(p => p.status === 'analyzed').length,
  pending: papers.filter(p => ['pending', 'parsing', 'analyzing'].includes(p.status)).length,
  error: papers.filter(p => p.status === 'error').length,
  starred: papers.filter(p => p.starred).length,
}), [papers]);

// 单击论文文字 → 预览
const handlePaperClick = (paperId: string) => {
  setSelectedPaperId(paperId);
};

// 点击复选框 → 多选
const handleCheckboxToggle = (paperId: string) => {
  const newSet = new Set(selectedPaperIds);
  if (newSet.has(paperId)) {
    newSet.delete(paperId);
  } else {
    newSet.add(paperId);
  }
  setSelectedPaperIds(newSet);
};

// 清除多选
const handleClearSelection = () => {
  setSelectedPaperIds(new Set());
};

// 批量删除
const handleBatchDelete = (paperIds: string[]) => {
  setConfirmModal({
    isOpen: true,
    title: '批量删除确认',
    message: `确定删除选中的 ${paperIds.length} 篇论文？此操作不可撤销。`,
    onConfirm: async () => {
      setConfirmModal({ ...confirmModal, isOpen: false });
      await executeBatchDelete(paperIds);
    },
  });
};

// 执行批量删除（使用现有单删 API）
const executeBatchDelete = async (paperIds: string[]) => {
  const results = await Promise.allSettled(
    paperIds.map(id => fetch(`/api/paper/${id}`, { method: 'DELETE' }))
  );
  
  // 检查部分失败情况
  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length > 0) {
    // 显示部分失败提示
    showToast(`删除完成，${failed.length} 篇失败`, 'warning');
  }
  
  // 更新论文列表
  const succeededIds = paperIds.filter((id, i) => results[i].status === 'fulfilled');
  setPapers(prev => prev.filter(p => !succeededIds.includes(p.id)));
  setSelectedPaperIds(new Set());
};

// 批量移动
const handleBatchMove = (paperIds: string[], folderId: string | null) => {
  setConfirmModal({
    isOpen: true,
    title: '批量移动确认',
    message: `确定将 ${paperIds.length} 篇论文移动到${folderId ? '指定文件夹' : '根目录'}？`,
    onConfirm: async () => {
      setConfirmModal({ ...confirmModal, isOpen: false });
      await executeBatchMove(paperIds, folderId);
    },
  });
};

// 执行批量移动
const executeBatchMove = async (paperIds: string[], folderId: string | null) => {
  const results = await Promise.allSettled(
    paperIds.map(id =>
      fetch(`/api/paper/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      })
    )
  );
  
  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length > 0) {
    showToast(`移动完成，${failed.length} 篇失败`, 'warning');
  }
  
  await fetchPapers(); // 刷新论文列表
  setSelectedPaperIds(new Set());
};

// 批量星标
const handleBatchStar = async (paperIds: string[], starred: boolean) => {
  const results = await Promise.allSettled(
    paperIds.map(id =>
      fetch(`/api/paper/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ starred }),
      })
    )
  );
  
  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length > 0) {
    showToast(`标记完成，${failed.length} 篇失败`, 'warning');
  }
  
  // 乐观更新
  setPapers(prev => prev.map(p =>
    paperIds.includes(p.id) ? { ...p, starred } : p
  ));
};
```

### 篮选联动
筛选面板的条件变化时，树形视图隐藏不符合条件的论文：
```tsx
const visiblePapers = useMemo(() => {
  return papers.filter(p => {
    if (statusFilter === 'analyzed' && p.status !== 'analyzed') return false;
    if (statusFilter === 'pending' && !['pending', 'parsing', 'analyzing'].includes(p.status)) return false;
    if (statusFilter === 'error' && p.status !== 'error') return false;
    if (starredOnly && !p.starred) return false;
    if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    if (sortMode === 'name') return a.title.localeCompare(b.title);
    if (sortMode === 'starred') return (b.starred ? 1 : 0) - (a.starred ? 1 : 0);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}, [papers, statusFilter, starredOnly, searchQuery, sortMode]);
```

## 错误处理与边界情况

### 批量操作部分失败
使用 `Promise.allSettled` 而非 `Promise.all`，确保部分失败不会中断整个操作：

```tsx
const results = await Promise.allSettled(
  paperIds.map(id => fetch(`/api/paper/${id}`, { method: 'DELETE' }))
);

const succeeded = results.filter(r => r.status === 'fulfilled').length;
const failed = results.filter(r => r.status === 'rejected').length;

if (failed > 0) {
  showToast(`删除完成：${succeeded} 篇成功，${failed} 篇失败`, 'warning');
} else {
  showToast(`已删除 ${succeeded} 篇论文`, 'success');
}
```

### 网络超时与 API 错误
- 所有 API 调用添加 try-catch 包装
- 超时或网络错误时显示 Toast 提示："网络错误，请稍后重试"
- 失败的论文 ID 保留在选中状态，允许用户重试

### 边界情况处理

| 场景 | 处理方式 |
|------|----------|
| **空文件夹** | 显示灰色提示："此文件夹无论文"，折叠按钮禁用 |
| **分析中的论文删除** | 弹窗额外提示："选中的论文中 N 篇正在分析，删除将中断分析进程" |
| **跨文件夹多选** | 允许，右键菜单"移动到"需选择目标文件夹 |
| **全选当前视图** | 工具栏提供"全选"按钮，仅选中当前筛选后的可见论文 |
| **取消选择** | 右键菜单最后一项，清除所有选中 |
| **单选时右键** | 若点击的是已选中项，保持选中；若点击未选中项，清除旧选中并仅选中当前 |
| **拖拽与多选冲突** | 拖拽开始时清除多选状态，拖拽完成后只移动单个论文 |

## 键盘操作与可访问性

| 操作 | 快捷键 | 说明 |
|------|--------|------|
| 全选当前视图 | Ctrl/Cmd + A | 选中所有筛选后的可见论文 |
| 删除选中项 | Delete / Backspace | 触发确认弹窗 |
| 取消选择 | Escape | 清除所有选中，关闭右键菜单/弹窗 |
| 上下导航 | ↑ / ↓ | 在树形视图中移动焦点 |
| 打开论文 | Enter | 焦点在论文项上时，打开预览 |

## 确认弹窗设计

使用自定义 `ConfirmModal` 组件替代原生 `confirm()`：

```tsx
// 确认弹窗样式与现有模态框一致
<div style={{
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
}}>
  <div style={{
    background: 'var(--surface)',
    borderRadius: '12px',
    padding: '24px',
    minWidth: '320px',
    border: '1px solid var(--glass-border)',
  }}>
    <h3 style={{ color: 'var(--text-primary)' }}>{title}</h3>
    <p style={{ color: 'var(--text-secondary)', marginTop: '12px' }}>{message}</p>
    <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
      <button onClick={onCancel} style={{
        padding: '8px 16px',
        background: 'var(--glass)',
        color: 'var(--text-secondary)',
        borderRadius: '6px',
      }}>{cancelLabel}</button>
      <button onClick={onConfirm} style={{
        padding: '8px 16px',
        background: danger ? 'var(--rose)' : 'var(--accent)',
        color: 'var(--bg)',
        borderRadius: '6px',
      }}>{confirmLabel}</button>
    </div>
  </div>
</div>
```

## 拖拽功能整合

### 拖拽与复选框共存规则
1. **拖拽触发区域**: 论文标题文字区域可拖拽，复选框区域不可拖拽
2. **拖拽开始时**: 清除多选状态（`selectedPaperIds`），仅携带当前拖拽的论文 ID
3. **拖拽完成时**: 目标文件夹接收单个论文，执行移动操作
4. **多选拖拽**: 不支持，需通过右键菜单/工具栏"移动到"按钮批量移动

### 拖拽视觉反馈
- 拖拽时论文项半透明（`opacity: 0.4`）
- 目标文件夹高亮（`background: var(--accent-subtle)`，`outline: 2px solid var(--accent)`）
- 拖拽指示线显示插入位置（仅用于排序，跨文件夹移动无指示线）

## 实现优先级

### P0 - 核心功能（必须实现）
1. 树形视图基础结构（`PaperTree`、`PaperTreeItem`、`PaperTreeFolder`）
2. 复选框多选（`selectedPaperIds` 状态管理）
3. 右键菜单（`ContextMenu` 组件）
4. 确认弹窗（`ConfirmModal` 组件）
5. 批量删除流程

### P1 - 增强功能（推荐实现）
1. 批量操作工具栏（`BatchActionToolbar` 组件）
2. 篮选面板（`FilterPanel` 组件）
3. 多选状态预览提示
4. 键盘快捷键支持
5. 错误处理与 Toast 提示

### P2 - 优化（可延后）
1. 拖拽排序功能保留
2. 搜索框整合到树形视图顶部
3. 文件夹展开/折叠动画
4. 状态图标精细显示

## 兼容性考虑

- 保留现有的拖拽排序功能（在树形视图中）
- 保留现有的文件夹 CRUD 操作
- `folder-tree.tsx` 组件保留，用于论文详情页侧边栏（不受此改动影响）
- 中间栏筛选面板可折叠（为小屏幕预留）

## 测试要点

### 功能测试
1. 多选后右键删除，确认弹窗正确显示数量
2. 批量删除后，树形视图和状态同步更新
3. 篮选条件变化，树形视图正确隐藏/显示论文
4. 复选框与文字点击行为分离
5. 批量操作部分失败时，Toast 正确显示成功/失败数量

### 边界测试
1. 空文件夹显示正确提示
2. 分析中论文删除有额外警告
3. 跨文件夹多选后移动正常工作
4. 全选仅选中当前筛选后的可见论文
5. 拖拽开始清除多选状态

### 可访问性测试
1. Ctrl+A 全选快捷键
2. Delete 删除快捷键
3. Escape 取消选择/关闭弹窗
4. ↑↓ 键盘导航焦点
5. Enter 打开论文预览

### 视觉一致性测试
1. 复选框样式与现有 UI 一致（CSS 变量）
2. 右键菜单与现有下拉菜单风格一致
3. 确认弹窗与现有模态框风格一致
4. 状态图标颜色正确（green/amber/rose）
5. 多选高亮边框与 accent 颜色一致