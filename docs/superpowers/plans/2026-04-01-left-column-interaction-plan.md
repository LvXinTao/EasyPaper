# Left Column Interaction Improvement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the homepage left column from a redundant paper list into a unified tree view with multi-select and batch operations.

**Architecture:** Create new tree-based components (`PaperTree`, `PaperTreeItem`, `PaperTreeFolder`) that combine folder and paper display. Add multi-select via checkboxes, right-click context menu, and batch operation toolbar. Refactor middle column to be a filter/stats panel.

**Tech Stack:** Next.js 16, React 19, TypeScript, Jest + React Testing Library

**Spec Reference:** `docs/superpowers/specs/2026-04-01-left-column-interaction-design.md`

**Scope Note:** This plan covers P0 (core functionality) from the spec. P1/P2 features (keyboard navigation, folder picker modal, analysis warning, empty folder prompt) are deferred and noted where relevant.

---

## File Structure

### New Files
| File | Responsibility |
|------|----------------|
| `src/components/paper-tree.tsx` | Main tree view container - renders folders and papers as a unified tree |
| `src/components/paper-tree-item.tsx` | Individual paper node with checkbox, drag support, context menu trigger |
| `src/components/paper-tree-folder.tsx` | Folder node with expand/collapse, paper count, drop target |
| `src/components/context-menu.tsx` | Right-click menu for batch operations |
| `src/components/confirm-modal.tsx` | Custom confirmation dialog (replaces native confirm) |
| `src/components/batch-action-toolbar.tsx` | Bottom toolbar shown when papers are multi-selected |
| `src/components/filter-panel.tsx` | Middle column filter UI (status, starred, sort) with stats |
| `src/components/toast.tsx` | Toast notification component for operation feedback |
| `src/components/folder-picker-modal.tsx` | Modal for selecting target folder in batch move |
| `src/hooks/use-toast.ts` | Hook for toast state management |
| `__tests__/components/paper-tree-item.test.tsx` | Tests for paper tree item |
| `__tests__/components/context-menu.test.tsx` | Tests for context menu |
| `__tests__/components/confirm-modal.test.tsx` | Tests for confirm modal |

### Modified Files
| File | Changes |
|------|---------|
| `src/app/page.tsx` | Replace left column with PaperTree, middle column with FilterPanel; add multi-select state management |
| `src/components/preview-panel.tsx` | Add multiSelectCount prop, show "N items selected" message |
| `src/types/index.ts` | Add ToastMessage type |
| `jest.config.ts` | Add jsdom test environment for component tests |

---

## Chunk 1: Base Components

### Task 1: ConfirmModal Component

**Files:**
- Create: `src/components/confirm-modal.tsx`
- Create: `__tests__/components/confirm-modal.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/confirm-modal.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmModal } from '@/components/confirm-modal';

describe('ConfirmModal', () => {
  it('renders nothing when isOpen is false', () => {
    render(
      <ConfirmModal
        isOpen={false}
        title="Delete"
        message="Are you sure?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('renders modal when isOpen is true', () => {
    render(
      <ConfirmModal
        isOpen={true}
        title="Delete Papers"
        message="Delete 3 papers?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );
    expect(screen.getByText('Delete Papers')).toBeInTheDocument();
    expect(screen.getByText('Delete 3 papers?')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmModal
        isOpen={true}
        title="Test"
        message="Message"
        confirmLabel="OK"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button or backdrop clicked', () => {
    const onCancel = jest.fn();
    render(
      <ConfirmModal
        isOpen={true}
        title="Test"
        message="Message"
        confirmLabel="OK"
        cancelLabel="Cancel"
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />
    );
    // Click backdrop
    fireEvent.click(screen.getByText('Test').parentElement?.parentElement!);
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/confirm-modal.test.tsx --env=jsdom`
Expected: FAIL with "Cannot find module '@/components/confirm-modal'"

- [ ] **Step 3: Write minimal implementation**

```tsx
'use client';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel,
  danger,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: '12px',
          padding: '24px',
          minWidth: '320px',
          maxWidth: '400px',
          border: '1px solid var(--glass-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600, margin: 0 }}>
          {title}
        </h3>
        <p style={{ color: 'var(--text-secondary)', marginTop: '12px', fontSize: '13px', lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              background: 'var(--glass)',
              color: 'var(--text-secondary)',
              borderRadius: '6px',
              border: '1px solid var(--glass-border)',
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px',
              background: danger ? 'var(--rose)' : 'var(--accent)',
              color: 'var(--bg)',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/components/confirm-modal.test.tsx --env=jsdom`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/confirm-modal.tsx __tests__/components/confirm-modal.test.tsx
git commit -m "feat: add ConfirmModal component for batch operation confirmations"
```

---

### Task 2: Toast Component and Hook

**Files:**
- Create: `src/components/toast.tsx`
- Create: `src/hooks/use-toast.ts`
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add ToastMessage type to types**

Add to `src/types/index.ts`:

```typescript
export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'warning' | 'error' | 'info';
}
```

- [ ] **Step 2: Write useToast hook**

```tsx
'use client';

import { useState, useCallback } from 'react';
import type { ToastMessage } from '@/types';

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    const id = `toast-${++toastId}`;
    const newToast: ToastMessage = { id, message, type };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, dismissToast };
}
```

- [ ] **Step 3: Write Toast component**

```tsx
'use client';

import type { ToastMessage } from '@/types';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const typeStyles: Record<ToastMessage['type'], { bg: string; color: string }> = {
  success: { bg: 'rgba(34, 197, 94, 0.15)', color: 'var(--green)' },
  warning: { bg: 'rgba(251, 191, 36, 0.15)', color: 'var(--amber)' },
  error: { bg: 'rgba(239, 68, 68, 0.15)', color: 'var(--rose)' },
  info: { bg: 'var(--glass)', color: 'var(--text-secondary)' },
};

export function Toast({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        zIndex: 200,
      }}
    >
      {toasts.map((toast) => {
        const styles = typeStyles[toast.type];
        return (
          <div
            key={toast.id}
            onClick={() => onDismiss(toast.id)}
            style={{
              padding: '12px 16px',
              borderRadius: '8px',
              background: styles.bg,
              color: styles.color,
              fontSize: '13px',
              cursor: 'pointer',
              border: `1px solid ${styles.color}`,
              maxWidth: '300px',
            }}
          >
            {toast.message}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/toast.tsx src/hooks/use-toast.ts src/types/index.ts
git commit -m "feat: add Toast component and useToast hook for operation feedback"
```

---

### Task 3: ContextMenu Component

**Files:**
- Create: `src/components/context-menu.tsx`
- Create: `__tests__/components/context-menu.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/context-menu.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ContextMenu } from '@/components/context-menu';

describe('ContextMenu', () => {
  const defaultProps = {
    x: 100,
    y: 100,
    selectedCount: 3,
    onClose: jest.fn(),
    onDelete: jest.fn(),
    onMove: jest.fn(),
    onStar: jest.fn(),
    onUnstar: jest.fn(),
    onClear: jest.fn(),
  };

  it('renders all menu items with correct labels', () => {
    render(<ContextMenu {...defaultProps} />);
    expect(screen.getByText('删除选中项 (3)')).toBeInTheDocument();
    expect(screen.getByText('移动到文件夹...')).toBeInTheDocument();
  });

  it('calls onDelete when delete item clicked', () => {
    const onDelete = jest.fn();
    render(<ContextMenu {...defaultProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByText('删除选中项 (3)'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/context-menu.test.tsx --env=jsdom`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```tsx
'use client';

import { useEffect, useRef } from 'react';

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

export function ContextMenu({
  x, y, selectedCount, onClose, onDelete, onMove, onStar, onUnstar, onClear,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        background: 'var(--bg)',
        border: '1px solid var(--glass-border)',
        borderRadius: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        padding: '4px 0',
        minWidth: '160px',
        zIndex: 100,
      }}
    >
      <button onClick={() => { onDelete(); onClose(); }} style={menuItemStyle('var(--rose)')}>
        删除选中项 ({selectedCount})
      </button>
      <button onClick={() => { onMove(); onClose(); }} style={menuItemStyle()}>
        移动到文件夹...
      </button>
      <button onClick={() => { onStar(); onClose(); }} style={menuItemStyle()}>
        添加星标
      </button>
      <button onClick={() => { onUnstar(); onClose(); }} style={menuItemStyle()}>
        移除星标
      </button>
      <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
      <button onClick={() => { onClear(); onClose(); }} style={menuItemStyle('var(--text-tertiary)')}>
        取消选择
      </button>
    </div>
  );
}

const menuItemStyle = (color = 'var(--text-secondary)'): React.CSSProperties => ({
  width: '100%',
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: '12px',
  color,
  background: 'none',
  border: 'none',
  cursor: 'pointer',
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/components/context-menu.test.tsx --env=jsdom`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/context-menu.tsx __tests__/components/context-menu.test.tsx
git commit -m "feat: add ContextMenu component for batch operations"
```

---

## Chunk 2: Tree View Components

### Task 4: PaperTreeItem Component

**Files:**
- Create: `src/components/paper-tree-item.tsx`
- Create: `__tests__/components/paper-tree-item.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// __tests__/components/paper-tree-item.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { PaperTreeItem } from '@/components/paper-tree-item';
import type { PaperListItem } from '@/types';

const mockPaper: PaperListItem = {
  id: 'paper-1',
  title: 'Test Paper Title',
  createdAt: '2024-01-01T00:00:00Z',
  status: 'analyzed',
};

describe('PaperTreeItem', () => {
  const defaultProps = {
    paper: mockPaper,
    isSelected: false,
    isChecked: false,
    depth: 0,
    onClick: jest.fn(),
    onCheckboxToggle: jest.fn(),
    onContextMenu: jest.fn(),
  };

  it('renders paper title', () => {
    render(<PaperTreeItem {...defaultProps} />);
    expect(screen.getByText('Test Paper Title')).toBeInTheDocument();
  });

  it('calls onCheckboxToggle when checkbox clicked', () => {
    const onCheckboxToggle = jest.fn();
    render(<PaperTreeItem {...defaultProps} onCheckboxToggle={onCheckboxToggle} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onCheckboxToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onClick when title clicked', () => {
    const onClick = jest.fn();
    render(<PaperTreeItem {...defaultProps} onClick={onClick} />);
    fireEvent.click(screen.getByText('Test Paper Title'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows analyzed status indicator', () => {
    render(<PaperTreeItem {...defaultProps} paper={{ ...mockPaper, status: 'analyzed' }} />);
    expect(screen.getByText('✓')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/paper-tree-item.test.tsx --env=jsdom`
Expected: FAIL

- [ ] **Step 3: Write implementation**

```tsx
'use client';

import type { PaperListItem, PaperStatus } from '@/types';

interface PaperTreeItemProps {
  paper: PaperListItem;
  isSelected: boolean;
  isChecked: boolean;
  depth: number;
  onClick: () => void;
  onCheckboxToggle: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

const statusConfig: Record<PaperStatus, { icon: string; color: string }> = {
  analyzed: { icon: '✓', color: 'var(--green)' },
  pending: { icon: '⋯', color: 'var(--amber)' },
  queued: { icon: '⋯', color: 'var(--amber)' },
  parsing: { icon: '⋯', color: 'var(--amber)' },
  analyzing: { icon: '⋯', color: 'var(--amber)' },
  error: { icon: '✗', color: 'var(--rose)' },
};

export function PaperTreeItem({
  paper,
  isSelected,
  isChecked,
  depth,
  onClick,
  onCheckboxToggle,
  onContextMenu,
}: PaperTreeItemProps) {
  const status = statusConfig[paper.status] || statusConfig.pending;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '3px 6px',
        paddingLeft: `${10 + depth * 14}px`,
        background: isSelected ? 'var(--accent-subtle)' : 'transparent',
        border: isSelected ? '1px solid var(--accent)' : '1px solid transparent',
        borderRadius: '4px',
        cursor: 'pointer',
        gap: '4px',
      }}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={(e) => { e.stopPropagation(); onCheckboxToggle(); }}
        onClick={(e) => e.stopPropagation()}
        style={{ width: '14px', height: '14px', accentColor: 'var(--accent)', cursor: 'pointer' }}
      />
      <span style={{ fontSize: '11px', opacity: 0.6 }}>📄</span>
      <span style={{ flex: 1, fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={paper.title}>
        {paper.title}
      </span>
      <span style={{ fontSize: '10px', color: status.color }}>{status.icon}</span>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest __tests__/components/paper-tree-item.test.tsx --env=jsdom`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/paper-tree-item.tsx __tests__/components/paper-tree-item.test.tsx
git commit -m "feat: add PaperTreeItem component with checkbox and status indicator"
```

---

### Task 5: FolderPickerModal Component

**Files:**
- Create: `src/components/folder-picker-modal.tsx`

- [ ] **Step 1: Write implementation**

```tsx
'use client';

import type { Folder } from '@/types';

interface FolderPickerModalProps {
  isOpen: boolean;
  folders: Folder[];
  selectedFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  onCancel: () => void;
}

export function FolderPickerModal({
  isOpen,
  folders,
  selectedFolderId,
  onSelect,
  onCancel,
}: FolderPickerModalProps) {
  if (!isOpen) return null;

  const rootFolders = folders.filter(f => !f.parentId);

  const renderFolderOption = (folder: Folder, depth: number): React.ReactNode => {
    const children = folders.filter(f => f.parentId === folder.id);
    return (
      <div key={folder.id}>
        <button
          onClick={() => onSelect(folder.id)}
          style={{
            width: '100%',
            textAlign: 'left',
            padding: '8px 12px',
            paddingLeft: `${12 + depth * 16}px`,
            fontSize: '12px',
            color: selectedFolderId === folder.id ? 'var(--accent)' : 'var(--text-secondary)',
            background: selectedFolderId === folder.id ? 'var(--accent-subtle)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          📁 {folder.name}
        </button>
        {children.map(c => renderFolderOption(c, depth + 1))}
      </div>
    );
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }} onClick={onCancel}>
      <div style={{ background: 'var(--surface)', borderRadius: '12px', padding: '16px', minWidth: '280px', border: '1px solid var(--glass-border)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, margin: '0 0 12px' }}>移动到文件夹</h3>
        <div style={{ maxHeight: '300px', overflow: 'auto' }}>
          <button
            onClick={() => onSelect(null)}
            style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '12px', color: selectedFolderId === null ? 'var(--accent)' : 'var(--text-secondary)', background: selectedFolderId === null ? 'var(--accent-subtle)' : 'transparent', border: 'none', cursor: 'pointer' }}
          >
            📁 根目录（无文件夹）
          </button>
          {rootFolders.map(f => renderFolderOption(f, 0))}
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--glass)', color: 'var(--text-secondary)', borderRadius: '6px', border: '1px solid var(--glass-border)', cursor: 'pointer' }}>取消</button>
          <button onClick={() => onSelect(selectedFolderId)} style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--accent)', color: 'var(--bg)', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>移动</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/folder-picker-modal.tsx
git commit -m "feat: add FolderPickerModal for batch move operations"
```

---

### Task 6: BatchActionToolbar Component

**Files:**
- Create: `src/components/batch-action-toolbar.tsx`

- [ ] **Step 1: Write implementation**

```tsx
'use client';

interface BatchActionToolbarProps {
  selectedCount: number;
  onDelete: () => void;
  onMove: () => void;
  onStar: () => void;
  onClear: () => void;
}

export function BatchActionToolbar({
  selectedCount,
  onDelete,
  onMove,
  onStar,
  onClear,
}: BatchActionToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div style={{ padding: '8px 10px', background: 'var(--glass)', border: '1px solid var(--accent)', borderRadius: '8px', marginTop: '8px' }}>
      <div style={{ fontSize: '10px', color: 'var(--accent)', marginBottom: '6px' }}>已选中 {selectedCount} 项</div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={onDelete} style={{ fontSize: '11px', padding: '4px 8px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--rose)', borderRadius: '4px', border: 'none', cursor: 'pointer' }}>🗑️ 删除</button>
        <button onClick={onMove} style={{ fontSize: '11px', padding: '4px 8px', background: 'var(--glass)', color: 'var(--text-secondary)', borderRadius: '4px', border: '1px solid var(--glass-border)', cursor: 'pointer' }}>📁 移动</button>
        <button onClick={onStar} style={{ fontSize: '11px', padding: '4px 8px', background: 'var(--glass)', color: 'var(--text-secondary)', borderRadius: '4px', border: '1px solid var(--glass-border)', cursor: 'pointer' }}>★ 星标</button>
        <button onClick={onClear} style={{ fontSize: '11px', padding: '4px 8px', background: 'transparent', color: 'var(--text-tertiary)', borderRadius: '4px', border: '1px solid var(--glass-border)', cursor: 'pointer', marginLeft: 'auto' }}>取消</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/batch-action-toolbar.tsx
git commit -m "feat: add BatchActionToolbar component for multi-select operations"
```

---

### Task 7: FilterPanel Component

**Files:**
- Create: `src/components/filter-panel.tsx`

- [ ] **Step 1: Write implementation**

```tsx
'use client';

interface FilterPanelProps {
  statusFilter: 'all' | 'analyzed' | 'pending' | 'error';
  starredOnly: boolean;
  sortMode: 'recent' | 'name' | 'starred';
  stats: { total: number; analyzed: number; pending: number; error: number; starred: number };
  onStatusFilterChange: (filter: 'all' | 'analyzed' | 'pending' | 'error') => void;
  onStarredOnlyChange: (value: boolean) => void;
  onSortModeChange: (mode: 'recent' | 'name' | 'starred') => void;
}

export function FilterPanel({
  statusFilter,
  starredOnly,
  sortMode,
  stats,
  onStatusFilterChange,
  onStarredOnlyChange,
  onSortModeChange,
}: FilterPanelProps) {
  const statusFilters = [
    { key: 'all' as const, label: '全部', count: stats.total },
    { key: 'analyzed' as const, label: '已分析', count: stats.analyzed },
    { key: 'pending' as const, label: '处理中', count: stats.pending },
    { key: 'error' as const, label: '错误', count: stats.error },
  ];

  return (
    <div style={{ width: '100%', height: '100%', padding: '14px', background: 'rgba(255,255,255,0.006)', display: 'flex', flexDirection: 'column' }}>
      <div className="uppercase" style={{ fontSize: '9px', letterSpacing: '1.2px', color: 'var(--text-tertiary)', fontWeight: 600, marginBottom: '12px' }}>筛选与统计</div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>状态筛选</div>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {statusFilters.map(f => (
            <button key={f.key} onClick={() => onStatusFilterChange(f.key)} style={{
              padding: '4px 8px', fontSize: '10px', borderRadius: '12px',
              border: statusFilter === f.key ? 'none' : '1px solid var(--glass-border)',
              background: statusFilter === f.key ? 'var(--text-primary)' : 'var(--glass)',
              color: statusFilter === f.key ? 'var(--bg)' : 'var(--text-tertiary)', cursor: 'pointer',
            }}>
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: starredOnly ? 'var(--amber)' : 'var(--text-secondary)', cursor: 'pointer' }}>
          <input type="checkbox" checked={starredOnly} onChange={e => onStarredOnlyChange(e.target.checked)} style={{ accentColor: 'var(--amber)' }} />
          ★ 仅显示星标 ({stats.starred})
        </label>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '6px' }}>排序方式</div>
        <select value={sortMode} onChange={e => onSortModeChange(e.target.value as 'recent' | 'name' | 'starred')} style={{
          width: '100%', padding: '6px 8px', fontSize: '11px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', borderRadius: '6px', cursor: 'pointer',
        }}>
          <option value="recent">最近上传</option>
          <option value="name">按名称</option>
          <option value="starred">按星标</option>
        </select>
      </div>

      <div style={{ marginTop: 'auto', padding: '12px', background: 'var(--glass)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>统计概览</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div><div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.total}</div><div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>总论文数</div></div>
          <div><div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--green)' }}>{stats.analyzed}</div><div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>已分析</div></div>
          <div><div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--amber)' }}>{stats.pending}</div><div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>处理中</div></div>
          <div><div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--rose)' }}>{stats.error}</div><div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>错误</div></div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/filter-panel.tsx
git commit -m "feat: add FilterPanel component for paper filtering and stats display"
```

---

## Chunk 3: Main Components and Page Integration

### Task 8: PaperTree and PaperTreeFolder Components

**Files:**
- Create: `src/components/paper-tree-folder.tsx`
- Create: `src/components/paper-tree.tsx`

- [ ] **Step 1: Write PaperTreeFolder implementation**

```tsx
'use client';

import { useState } from 'react';
import type { Folder, PaperListItem } from '@/types';
import { PaperTreeItem } from './paper-tree-item';

interface PaperTreeFolderProps {
  folder: Folder;
  depth: number;
  papers: PaperListItem[];
  allFolders: Folder[];
  selectedPaperIds: Set<string>;
  selectedPaperId: string | null;
  onPaperClick: (paperId: string) => void;
  onPaperCheckboxToggle: (paperId: string) => void;
  onPaperContextMenu: (e: React.MouseEvent, paperId: string) => void;
  onDropPaper: (paperId: string, folderId: string) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onCreateChildFolder: (name: string, parentId: string) => void;
}

export function PaperTreeFolder({
  folder,
  depth,
  papers,
  allFolders,
  selectedPaperIds,
  selectedPaperId,
  onPaperClick,
  onPaperCheckboxToggle,
  onPaperContextMenu,
  onDropPaper,
  onRenameFolder,
  onDeleteFolder,
  onCreateChildFolder,
}: PaperTreeFolderProps) {
  const [expanded, setExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [isCreatingChild, setIsCreatingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);

  const childFolders = allFolders.filter(f => f.parentId === folder.id);
  const folderPapers = papers.filter(p => p.folderId === folder.id);
  const totalPapers = papers.filter(p => {
    const checkFolder = (fid: string | null): boolean => {
      if (fid === folder.id) return true;
      const parent = allFolders.find(f => f.id === fid);
      return parent ? checkFolder(parent.parentId) : false;
    };
    return checkFolder(p.folderId);
  }).length;

  const handleRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== folder.name) onRenameFolder(folder.id, trimmed);
    setIsRenaming(false);
  };

  const handleCreateChild = () => {
    const trimmed = newChildName.trim();
    if (trimmed) { onCreateChildFolder(trimmed, folder.id); setNewChildName(''); }
    setIsCreatingChild(false);
  };

  return (
    <div>
      <div
        style={{ display: 'flex', alignItems: 'center', padding: '4px 6px', paddingLeft: `${6 + depth * 14}px`,
          background: isDragOver ? 'var(--accent-subtle)' : 'transparent',
          outline: isDragOver ? '2px solid var(--accent)' : undefined, outlineOffset: '-2px',
          borderRadius: '4px', cursor: 'pointer', gap: '4px' }}
        onClick={() => setExpanded(!expanded)}
        onDragOver={e => { if (e.dataTransfer.types.includes('application/x-paper-id')) { e.preventDefault(); setIsDragOver(true); } }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={e => { e.preventDefault(); setIsDragOver(false); const paperId = e.dataTransfer.getData('application/x-paper-id'); if (paperId) onDropPaper(paperId, folder.id); }}
      >
        <button onClick={e => { e.stopPropagation(); setExpanded(!expanded); }} style={{ width: '12px', fontSize: '9px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>{expanded ? '▼' : '▶'}</button>
        <span style={{ fontSize: '11px' }}>📁</span>
        {isRenaming ? (
          <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)} onBlur={handleRename} onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setRenameValue(folder.name); setIsRenaming(false); } }} style={{ flex: 1, fontSize: '11px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-primary)', borderRadius: '4px', padding: '2px 4px' }} onClick={e => e.stopPropagation()} />
        ) : (
          <span style={{ flex: 1, fontSize: '11px', fontWeight: 500, color: 'var(--text-primary)' }}>{folder.name}</span>
        )}
        <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{totalPapers}</span>
        <button onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }} style={{ fontSize: '12px', color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>⋯</button>
        {showMenu && (
          <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', width: '160px', borderRadius: '8px', padding: '4px 0', background: 'var(--bg)', border: '1px solid var(--glass-border)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 50 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => { setShowMenu(false); setIsCreatingChild(true); setExpanded(true); }} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>📁 新建子文件夹</button>
            <button onClick={() => { setShowMenu(false); setIsRenaming(true); }} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '11px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer' }}>✏️ 重命名</button>
            <button onClick={() => { setShowMenu(false); onDeleteFolder(folder.id); }} style={{ width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: '11px', color: 'var(--rose)', background: 'none', border: 'none', cursor: 'pointer' }}>🗑️ 删除文件夹</button>
          </div>
        )}
      </div>

      {expanded && (
        <div style={{ marginLeft: `${14 + depth * 14}px`, borderLeft: depth > 0 ? '1px solid var(--border)' : undefined }}>
          {isCreatingChild && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 6px' }}>
              <span style={{ fontSize: '11px' }}>📁</span>
              <input autoFocus placeholder="文件夹名称" value={newChildName} onChange={e => setNewChildName(e.target.value)} onBlur={handleCreateChild} onKeyDown={e => { if (e.key === 'Enter') handleCreateChild(); if (e.key === 'Escape') setIsCreatingChild(false); }} style={{ flex: 1, fontSize: '11px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-primary)', borderRadius: '4px', padding: '2px 4px' }} />
            </div>
          )}
          {childFolders.map(child => (
            <PaperTreeFolder key={child.id} folder={child} depth={depth + 1} papers={papers} allFolders={allFolders} selectedPaperIds={selectedPaperIds} selectedPaperId={selectedPaperId} onPaperClick={onPaperClick} onPaperCheckboxToggle={onPaperCheckboxToggle} onPaperContextMenu={onPaperContextMenu} onDropPaper={onDropPaper} onRenameFolder={onRenameFolder} onDeleteFolder={onDeleteFolder} onCreateChildFolder={onCreateChildFolder} />
          ))}
          {folderPapers.map(paper => (
            <div key={paper.id} draggable onDragStart={e => e.dataTransfer.setData('application/x-paper-id', paper.id)}>
              <PaperTreeItem paper={paper} isSelected={paper.id === selectedPaperId} isChecked={selectedPaperIds.has(paper.id)} depth={depth + 1} onClick={() => onPaperClick(paper.id)} onCheckboxToggle={() => onPaperCheckboxToggle(paper.id)} onContextMenu={e => onPaperContextMenu(e, paper.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/paper-tree-folder.tsx
git commit -m "feat: add PaperTreeFolder with expand/collapse and paper rendering"
```

- [ ] **Step 3: Write PaperTree main container**

```tsx
'use client';

import { useState, useMemo } from 'react';
import type { Folder, PaperListItem } from '@/types';
import { PaperTreeItem } from './paper-tree-item';
import { PaperTreeFolder } from './paper-tree-folder';
import { BatchActionToolbar } from './batch-action-toolbar';

interface PaperTreeProps {
  papers: PaperListItem[];
  folders: Folder[];
  selectedPaperId: string | null;
  selectedPaperIds: Set<string>;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onPaperClick: (paperId: string) => void;
  onCheckboxToggle: (paperId: string) => void;
  onBatchDelete: (paperIds: string[]) => void;
  onBatchMove: (paperIds: string[], folderId: string | null) => void;
  onBatchStar: (paperIds: string[], starred: boolean) => void;
  onMovePaper: (paperId: string, folderId: string | null) => void;
  onClearSelection: () => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onRenameFolder: (folderId: string, name: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onContextMenuOpen: (e: React.MouseEvent, paperId: string) => void;
}

export function PaperTree({
  papers,
  folders,
  selectedPaperId,
  selectedPaperIds,
  searchQuery,
  onSearchQueryChange,
  onPaperClick,
  onCheckboxToggle,
  onBatchDelete,
  onBatchMove,
  onBatchStar,
  onMovePaper,
  onClearSelection,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onContextMenuOpen,
}: PaperTreeProps) {
  const [isCreatingRoot, setIsCreatingRoot] = useState(false);
  const [newRootName, setNewRootName] = useState('');

  const filteredPapers = useMemo(() => papers.filter(p => {
    if (searchQuery && !p.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }), [papers, searchQuery]);

  const rootFolders = useMemo(() => folders.filter(f => !f.parentId), [folders]);
  const rootPapers = useMemo(() => filteredPapers.filter(p => !p.folderId), [filteredPapers]);

  const handleCreateRoot = () => {
    const trimmed = newRootName.trim();
    if (trimmed) { onCreateFolder(trimmed, null); setNewRootName(''); }
    setIsCreatingRoot(false);
  };

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '10px', overflow: 'hidden' }}>
      <div style={{ marginBottom: '8px' }}>
        <input type="text" placeholder="搜索论文..." value={searchQuery} onChange={e => onSearchQueryChange(e.target.value)} style={{ width: '100%', padding: '6px 8px', fontSize: '11px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-primary)', borderRadius: '6px' }} />
      </div>

      <div className="uppercase" style={{ fontSize: '9px', letterSpacing: '1.2px', color: 'var(--text-tertiary)', fontWeight: 600, padding: '8px 6px 4px' }}>LIBRARY</div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {rootFolders.map(folder => (
          <PaperTreeFolder key={folder.id} folder={folder} depth={0} papers={filteredPapers} allFolders={folders} selectedPaperIds={selectedPaperIds} selectedPaperId={selectedPaperId} onPaperClick={onPaperClick} onPaperCheckboxToggle={onCheckboxToggle} onPaperContextMenu={onContextMenuOpen} onDropPaper={(paperId, folderId) => onMovePaper(paperId, folderId)} onRenameFolder={onRenameFolder} onDeleteFolder={onDeleteFolder} onCreateChildFolder={(name, parentId) => onCreateFolder(name, parentId)} />
        ))}

        {isCreatingRoot && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 6px' }}>
            <span style={{ fontSize: '11px' }}>📁</span>
            <input autoFocus placeholder="文件夹名称" value={newRootName} onChange={e => setNewRootName(e.target.value)} onBlur={handleCreateRoot} onKeyDown={e => { if (e.key === 'Enter') handleCreateRoot(); if (e.key === 'Escape') setIsCreatingRoot(false); }} style={{ flex: 1, fontSize: '11px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text-primary)', borderRadius: '4px', padding: '2px 4px' }} />
          </div>
        )}

        {rootPapers.map(paper => (
          <div key={paper.id} draggable onDragStart={e => e.dataTransfer.setData('application/x-paper-id', paper.id)}>
            <PaperTreeItem paper={paper} isSelected={paper.id === selectedPaperId} isChecked={selectedPaperIds.has(paper.id)} depth={0} onClick={() => onPaperClick(paper.id)} onCheckboxToggle={() => onCheckboxToggle(paper.id)} onContextMenu={e => onContextMenuOpen(e, paper.id)} />
          </div>
        ))}
      </div>

      <button onClick={() => setIsCreatingRoot(true)} style={{ marginTop: '8px', padding: '6px 10px', fontSize: '11px', background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)', borderRadius: '6px', cursor: 'pointer', width: '100%' }}>+ 新建文件夹</button>

      <BatchActionToolbar
        selectedCount={selectedPaperIds.size}
        onDelete={() => onBatchDelete(Array.from(selectedPaperIds))}
        onMove={() => onBatchMove(Array.from(selectedPaperIds), null)}
        onStar={() => onBatchStar(Array.from(selectedPaperIds), true)}
        onClear={onClearSelection}
      />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/paper-tree.tsx
git commit -m "feat: add PaperTree main container component"
```

---

### Task 9: Integrate into Homepage (page.tsx)

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/preview-panel.tsx`

- [ ] **Step 1: Modify preview-panel.tsx to support multi-select**

Update the interface at the top of the file:

```tsx
interface PreviewPanelProps {
  paper: PaperListItem | null;
  multiSelectCount?: number;  // Add this line
  onDelete?: (id: string) => void;
  onAnalyze?: (id: string) => void;
  onMovePaper?: (paperId: string, folderId: string | null) => void;
  onRename?: (id: string, title: string) => Promise<void>;
  onToggleStar?: (id: string) => void;
  folders?: { id: string; name: string }[];
}

export function PreviewPanel({ paper, multiSelectCount, onDelete, onAnalyze, onMovePaper, onRename, onToggleStar, folders }: PreviewPanelProps) {
```

Add the multi-select message after the state declarations and before the `if (!paper)` check:

```tsx
  // Add this block BEFORE the existing `if (!paper)` check
  if (multiSelectCount && multiSelectCount > 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3" style={{ color: 'var(--text-tertiary)' }}>
        <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>已选中 {multiSelectCount} 项</div>
        <div style={{ fontSize: '11px' }}>使用右键菜单或底部工具栏进行批量操作</div>
      </div>
    );
  }

  if (!paper) {
    // ... existing empty state
  }
```

- [ ] **Step 2: Rewrite page.tsx with new layout and state management**

The complete page.tsx rewrite with:
- Replace Column 1 with PaperTree
- Replace Column 2 with FilterPanel
- Add state for multi-select (selectedPaperIds)
- Add state for context menu
- Add state for confirm modal
- Add state for folder picker modal
- Add handlers for batch operations
- Add keyboard shortcuts

Key state additions:

```tsx
// New state variables
const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());
const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; x: number; y: number; paperId: string | null }>({ isOpen: false, x: 0, y: 0, paperId: null });
const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
const [folderPickerModal, setFolderPickerModal] = useState<{ isOpen: boolean; paperIds: string[] }>({ isOpen: false, paperIds: [] });
const [statusFilter, setStatusFilter] = useState<'all' | 'analyzed' | 'pending' | 'error'>('all');
const [starredOnly, setStarredOnly] = useState(false);
const [sortMode, setSortMode] = useState<'recent' | 'name' | 'starred'>('recent');
const { toasts, showToast, dismissToast } = useToast();

// Stats computation
const stats = useMemo(() => ({
  total: papers.length,
  analyzed: papers.filter(p => p.status === 'analyzed').length,
  pending: papers.filter(p => ['pending', 'parsing', 'analyzing', 'queued'].includes(p.status)).length,
  error: papers.filter(p => p.status === 'error').length,
  starred: papers.filter(p => p.starred).length,
}), [papers]);

// Visible papers (filtered and sorted)
const visiblePapers = useMemo(() => papers.filter(p => {
  if (statusFilter === 'analyzed' && p.status !== 'analyzed') return false;
  if (statusFilter === 'pending' && !['pending', 'parsing', 'analyzing', 'queued'].includes(p.status)) return false;
  if (statusFilter === 'error' && p.status !== 'error') return false;
  if (starredOnly && !p.starred) return false;
  return true;
}).sort((a, b) => {
  if (sortMode === 'name') return a.title.localeCompare(b.title);
  if (sortMode === 'starred') return (b.starred ? 1 : 0) - (a.starred ? 1 : 0);
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}), [papers, statusFilter, starredOnly, sortMode]);

// Batch delete handler
const handleBatchDelete = (paperIds: string[]) => {
  setConfirmModal({
    isOpen: true,
    title: '批量删除确认',
    message: `确定删除选中的 ${paperIds.length} 篇论文？此操作不可撤销。`,
    onConfirm: async () => {
      setConfirmModal({ ...confirmModal, isOpen: false });
      const results = await Promise.allSettled(paperIds.map(id => fetch(`/api/paper/${id}`, { method: 'DELETE' })));
      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) showToast(`删除完成：${succeeded} 篇成功，${failed} 篇失败`, 'warning');
      else showToast(`已删除 ${succeeded} 篇论文`, 'success');
      await fetchPapers();
      setSelectedPaperIds(new Set());
    },
  });
};

// Batch move handler
const handleBatchMove = (paperIds: string[], folderId: string | null) => {
  if (paperIds.length > 0 && folderId === null) {
    setFolderPickerModal({ isOpen: true, paperIds });
    return;
  }
  // Execute move
  (async () => {
    const results = await Promise.allSettled(paperIds.map(id =>
      fetch(`/api/paper/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folderId }) })
    ));
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) showToast(`移动完成，${failed} 篇失败`, 'warning');
    else showToast(`已移动 ${paperIds.length} 篇论文`, 'success');
    await fetchPapers();
    setSelectedPaperIds(new Set());
    setFolderPickerModal({ isOpen: false, paperIds: [] });
  })();
};

// Batch star handler
const handleBatchStar = async (paperIds: string[], starred: boolean) => {
  const results = await Promise.allSettled(paperIds.map(id =>
    fetch(`/api/paper/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ starred }) })
  ));
  const failed = results.filter(r => r.status === 'rejected').length;
  if (failed > 0) showToast(`标记完成，${failed} 篇失败`, 'warning');
  setPapers(prev => prev.map(p => paperIds.includes(p.id) ? { ...p, starred } : p));
};

// Keyboard shortcuts
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && selectedPaperIds.size >= 0) {
      e.preventDefault();
      setSelectedPaperIds(new Set(visiblePapers.map(p => p.id)));
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPaperIds.size > 0) {
      e.preventDefault();
      handleBatchDelete(Array.from(selectedPaperIds));
    }
    if (e.key === 'Escape') {
      setSelectedPaperIds(new Set());
      setContextMenu(prev => ({ ...prev, isOpen: false }));
      setConfirmModal(prev => ({ ...prev, isOpen: false }));
    }
  };
  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [selectedPaperIds, visiblePapers]);
```

Complete JSX return statement for the three-column layout:

```tsx
return (
  <div className="flex" style={{ height: 'calc(100vh - 44px)' }}>
    {/* Column 1: Paper Tree */}
    <div style={{ width: '20%', minWidth: '200px', borderRight: '1px solid var(--border)' }}>
      <PaperTree
        papers={visiblePapers}
        folders={folders}
        selectedPaperId={selectedPaperId}
        selectedPaperIds={selectedPaperIds}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onPaperClick={(id) => setSelectedPaperId(id)}
        onCheckboxToggle={(id) => {
          const newSet = new Set(selectedPaperIds);
          if (newSet.has(id)) newSet.delete(id);
          else newSet.add(id);
          setSelectedPaperIds(newSet);
        }}
        onBatchDelete={handleBatchDelete}
        onBatchMove={handleBatchMove}
        onBatchStar={handleBatchStar}
        onMovePaper={handleMovePaper}
        onClearSelection={() => setSelectedPaperIds(new Set())}
        onCreateFolder={handleCreateFolder}
        onRenameFolder={handleRenameFolder}
        onDeleteFolder={handleDeleteFolder}
        onContextMenuOpen={(e, paperId) => {
          e.preventDefault();
          setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, paperId });
        }}
      />
    </div>

    {/* Column 2: Filter Panel */}
    <div style={{ width: '18%', minWidth: '180px', borderRight: '1px solid var(--border)' }}>
      <FilterPanel
        statusFilter={statusFilter}
        starredOnly={starredOnly}
        sortMode={sortMode}
        stats={stats}
        onStatusFilterChange={setStatusFilter}
        onStarredOnlyChange={setStarredOnly}
        onSortModeChange={setSortMode}
      />
    </div>

    {/* Column 3: Preview Panel */}
    <div className="flex-1 flex flex-col overflow-hidden">
      <PreviewPanel
        paper={selectedPaper}
        multiSelectCount={selectedPaperIds.size}
        onDelete={handleDelete}
        onMovePaper={handleMovePaper}
        onRename={handleRename}
        onToggleStar={handleToggleStar}
        folders={folders}
      />
    </div>

    {/* Context Menu */}
    {contextMenu.isOpen && (
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        selectedCount={selectedPaperIds.size}
        onClose={() => setContextMenu(prev => ({ ...prev, isOpen: false }))}
        onDelete={() => handleBatchDelete(Array.from(selectedPaperIds))}
        onMove={() => setFolderPickerModal({ isOpen: true, paperIds: Array.from(selectedPaperIds) })}
        onStar={() => handleBatchStar(Array.from(selectedPaperIds), true)}
        onUnstar={() => handleBatchStar(Array.from(selectedPaperIds), false)}
        onClear={() => setSelectedPaperIds(new Set())}
      />
    )}

    {/* Confirm Modal */}
    <ConfirmModal
      isOpen={confirmModal.isOpen}
      title={confirmModal.title}
      message={confirmModal.message}
      confirmLabel="删除"
      cancelLabel="取消"
      danger
      onConfirm={confirmModal.onConfirm}
      onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
    />

    {/* Folder Picker Modal */}
    <FolderPickerModal
      isOpen={folderPickerModal.isOpen}
      folders={folders}
      selectedFolderId={null}
      onSelect={(folderId) => handleBatchMove(folderPickerModal.paperIds, folderId)}
      onCancel={() => setFolderPickerModal({ isOpen: false, paperIds: [] })}
    />

    {/* Toast Notifications */}
    <Toast toasts={toasts} onDismiss={dismissToast} />

    {/* Upload Modal (keep existing) */}
    <UploadModal
      isOpen={uploadOpen}
      onClose={() => { setUploadOpen(false); setDroppedFiles(null); }}
      onUploadComplete={handleUploadComplete}
      initialFiles={droppedFiles}
    />
  </div>
);
```

- [ ] **Step 3: Test the integration manually**

Run: `npm run dev`
Navigate to: `http://localhost:3000`
Test checklist:
- [ ] PaperTree shows folders and papers correctly
- [ ] Checkbox multi-select works
- [ ] Right-click context menu appears
- [ ] Batch delete shows confirmation modal
- [ ] Filter panel filters papers correctly
- [ ] Keyboard shortcuts work

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/components/preview-panel.tsx
git commit -m "feat: integrate PaperTree, FilterPanel, and batch operations into homepage"
```

---

## Chunk 4: Polish

### Task 10: Update Jest Config

**Files:**
- Modify: `jest.config.ts`

- [ ] **Step 1: Add jsdom support for component tests**

```typescript
import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-markdown$': '<rootDir>/__mocks__/react-markdown.tsx',
  },
};

export default createJestConfig(config);
```

- [ ] **Step 2: Commit**

```bash
git add jest.config.ts
git commit -m "chore: update jest config for component tests"
```

---

### Task 11: Final Verification

- [ ] **Step 1: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Manual QA checklist**

- [ ] Multi-select with checkbox works
- [ ] Right-click context menu appears at correct position
- [ ] Batch delete shows confirmation modal
- [ ] Batch delete updates tree view immediately
- [ ] Filter panel correctly filters papers in tree
- [ ] Keyboard shortcuts work (Ctrl+A, Delete, Escape)
- [ ] Drag-and-drop to folders still works
- [ ] Visual styling matches existing UI

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete left column interaction improvement

- Add unified tree view for folders and papers
- Implement checkbox-based multi-select
- Add right-click context menu for batch operations
- Add confirmation modal for dangerous actions
- Add batch action toolbar for selected items
- Replace middle column with filter/stats panel
- Add keyboard shortcuts (Ctrl+A, Delete, Escape)
- Add toast notifications for operation feedback"
```

---

## Summary

This plan implements P0 core functionality:

1. **Tree View**: Folders and papers in a single hierarchy
2. **Multi-select**: Checkbox-based selection with visual feedback
3. **Batch Operations**: Right-click menu and toolbar for delete/move/star
4. **Filter Panel**: Middle column repurposed for filtering and stats
5. **Confirmation Modal**: Custom modal replacing native confirm()
6. **Toast Notifications**: Feedback for batch operations
7. **Keyboard Shortcuts**: Ctrl+A, Delete, Escape support

**Deferred to P1/P2** (see spec):
- Keyboard navigation (↑↓ arrows, Enter to open)
- Empty folder prompt ("此文件夹无论文")
- Analysis warning in delete confirmation
- Full-select button in toolbar