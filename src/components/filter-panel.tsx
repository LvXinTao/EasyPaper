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