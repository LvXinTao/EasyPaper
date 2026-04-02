'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ZoteroCollection, ZoteroItem, ZoteroImportResult, Folder } from '@/types';

interface ZoteroImportProps {
  folders: Folder[];
  onImportComplete: () => void;
  onClose: () => void;
}

type ImportState = 'idle' | 'importing' | 'done';

export function ZoteroImport({ folders, onImportComplete, onClose }: ZoteroImportProps) {
  const [collections, setCollections] = useState<ZoteroCollection[]>([]);
  const [totalPapers, setTotalPapers] = useState(0);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
  const [items, setItems] = useState<ZoteroItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [targetFolderId, setTargetFolderId] = useState<string>('');
  const [loadingCollections, setLoadingCollections] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [importState, setImportState] = useState<ImportState>('idle');
  const [importResults, setImportResults] = useState<ZoteroImportResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  // Load collections on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/zotero/collections');
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error?.message || 'Failed to load collections');
        }
        const data = await res.json();
        setCollections(data.collections);
        setTotalPapers(data.totalPapers);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to connect to Zotero');
      } finally {
        setLoadingCollections(false);
      }
    }
    load();
  }, []);

  // Load items when collection changes
  const loadItems = useCallback(async (collectionId: number | null) => {
    setSelectedCollectionId(collectionId);
    setLoadingItems(true);
    setSelectedKeys(new Set());
    try {
      const url = collectionId
        ? `/api/zotero/items?collectionId=${collectionId}`
        : '/api/zotero/items';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to load items');
      const data = await res.json();
      setItems(data.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load items');
    } finally {
      setLoadingItems(false);
    }
  }, []);

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const importableItems = items.filter((i) => !i.alreadyImported);
    if (selectedKeys.size === importableItems.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(importableItems.map((i) => i.key)));
    }
  };

  const handleImport = async () => {
    const selectedItems = items
      .filter((i) => selectedKeys.has(i.key))
      .map(({ key, title, attachmentKey, pdfFilename }) => ({ key, title, attachmentKey, pdfFilename }));

    if (selectedItems.length === 0) return;

    setImportState('importing');
    try {
      const res = await fetch('/api/zotero/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: selectedItems, folderId: targetFolderId || undefined }),
      });
      const data = await res.json();
      setImportResults(data.results);
      setImportState('done');

      const successCount = data.results.filter((r: ZoteroImportResult) => r.status === 'success').length;
      if (successCount > 0) {
        window.dispatchEvent(new CustomEvent('paperUploaded'));
        setTimeout(() => {
          onImportComplete();
          if (data.results.every((r: ZoteroImportResult) => r.status === 'success')) {
            onClose();
          }
        }, 2000);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
      setImportState('idle');
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Render collection tree recursively
  function renderCollection(col: ZoteroCollection, depth: number = 0) {
    const hasChildren = col.children.length > 0;
    const isExpanded = expandedIds.has(col.id);
    const isSelected = selectedCollectionId === col.id;

    return (
      <div key={col.id}>
        <button
          onClick={() => {
            if (hasChildren) toggleExpand(col.id);
            loadItems(col.id);
          }}
          className="w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors"
          style={{
            paddingLeft: `${8 + depth * 16}px`,
            background: isSelected ? 'var(--glass)' : 'transparent',
            color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
          }}
        >
          {hasChildren && (
            <span style={{ display: 'inline-block', width: '16px', fontSize: '10px' }}>
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
          {!hasChildren && <span style={{ display: 'inline-block', width: '16px' }} />}
          {col.name}
        </button>
        {hasChildren && isExpanded && col.children.map((c) => renderCollection(c, depth + 1))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>{error}</p>
        <p style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
          Please configure the Zotero data directory in <a href="/settings" style={{ color: 'var(--text-primary)', textDecoration: 'underline' }}>Settings</a>.
        </p>
      </div>
    );
  }

  if (loadingCollections) {
    return (
      <div className="flex items-center justify-center py-12">
        <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Loading Zotero library...</p>
      </div>
    );
  }

  if (importState === 'done') {
    const successCount = importResults.filter((r) => r.status === 'success').length;
    const failCount = importResults.filter((r) => r.status === 'error').length;
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>
          Import Complete
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          {successCount} imported successfully{failCount > 0 ? `, ${failCount} failed` : ''}
        </p>
        {failCount > 0 && (
          <div className="mt-4 text-left w-full max-w-md">
            {importResults.filter((r) => r.status === 'error').map((r) => (
              <p key={r.key} style={{ color: 'var(--rose)', fontSize: '12px' }}>
                {r.key}: {r.error}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: '400px' }}>
      <div className="flex flex-1 min-h-0">
        {/* Left: Collection tree */}
        <div className="overflow-y-auto pr-2" style={{ width: '200px', borderRight: '1px solid var(--border)' }}>
          <button
            onClick={() => loadItems(null)}
            className="w-full text-left px-2 py-1.5 rounded-lg text-sm transition-colors"
            style={{
              background: selectedCollectionId === null ? 'var(--glass)' : 'transparent',
              color: selectedCollectionId === null ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: 500,
            }}
          >
            All Papers ({totalPapers})
          </button>
          {collections.map((c) => renderCollection(c))}
        </div>

        {/* Right: Item list */}
        <div className="flex-1 overflow-y-auto pl-3">
          {loadingItems ? (
            <div className="flex items-center justify-center py-8">
              <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>Loading...</p>
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
                {selectedCollectionId === null && !loadingItems
                  ? 'Select a collection to browse papers'
                  : 'No papers with PDF attachments'}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-2">
                <button
                  onClick={toggleSelectAll}
                  className="text-xs px-2 py-1 rounded"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  {selectedKeys.size === items.filter((i) => !i.alreadyImported).length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              {items.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors"
                  style={{ opacity: item.alreadyImported ? 0.5 : 1 }}
                >
                  <input
                    type="checkbox"
                    checked={selectedKeys.has(item.key)}
                    onChange={() => toggleSelect(item.key)}
                    style={{ accentColor: 'var(--text-primary)' }}
                  />
                  <span className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                    {item.title}
                  </span>
                  {item.alreadyImported && (
                    <span
                      className="text-xs px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ color: 'var(--text-tertiary)', background: 'var(--glass)', border: '1px solid var(--glass-border)' }}
                    >
                      Imported
                    </span>
                  )}
                </label>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        className="flex items-center justify-between pt-3 mt-3"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <span style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
            {selectedKeys.size} selected
          </span>
          {folders.length > 0 && (
            <select
              value={targetFolderId}
              onChange={(e) => setTargetFolderId(e.target.value)}
              className="text-sm px-2 py-1 rounded-lg"
              style={{ background: 'var(--glass)', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}
            >
              <option value="">No folder</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl"
            style={{ color: 'var(--text-secondary)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={selectedKeys.size === 0 || importState === 'importing'}
            className="px-4 py-2 text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors"
            style={{ background: 'var(--text-primary)', color: 'var(--bg)' }}
          >
            {importState === 'importing' ? 'Importing...' : `Import ${selectedKeys.size} Papers`}
          </button>
        </div>
      </div>
    </div>
  );
}
