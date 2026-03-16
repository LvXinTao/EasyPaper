'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Folder, PaperListItem } from '@/types';
import { formatRelativeTime } from '@/lib/format';

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Pending' },
  parsing: { bg: 'bg-sky-100', text: 'text-sky-700', label: 'Parsing' },
  analyzing: { bg: 'bg-violet-100', text: 'text-violet-700', label: 'Analyzing' },
  analyzed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Analyzed' },
  error: { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Error' },
};

interface FolderTreeProps {
  folders: Folder[];
  papers: PaperListItem[];
  currentPaperId: string;
  searchQuery: string;
  onClose: () => void;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onRenameFolder: (folderId: string, name: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onMovePaper: (paperId: string, folderId: string | null) => Promise<void>;
  onDeletePaper: (paperId: string) => Promise<void>;
}

function PaperRow({
  paper,
  isCurrent,
  depth,
  onClose,
  onMovePaper,
  onDeletePaper,
  folders,
}: {
  paper: PaperListItem;
  isCurrent: boolean;
  depth: number;
  onClose: () => void;
  onMovePaper: (paperId: string, folderId: string | null) => Promise<void>;
  onDeletePaper: (paperId: string) => Promise<void>;
  folders: Folder[];
}) {
  const router = useRouter();
  const status = STATUS_COLORS[paper.status] || STATUS_COLORS.pending;
  const relTime = formatRelativeTime(paper.createdAt);
  const [showMenu, setShowMenu] = useState(false);
  const [showMovePicker, setShowMovePicker] = useState(false);

  return (
    <div className="relative">
      <div
        onClick={() => {
          if (!isCurrent) {
            router.push(`/paper/${paper.id}`);
            onClose();
          }
        }}
        className={`flex items-start gap-2 px-3 py-2 cursor-pointer text-sm transition-colors ${
          isCurrent
            ? 'bg-indigo-50 border-l-2 border-indigo-500'
            : 'hover:bg-slate-50 border-l-2 border-transparent'
        }`}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        <span className="text-slate-400 mt-0.5 flex-shrink-0">📄</span>
        <div className="flex-1 min-w-0">
          <div className={`truncate ${isCurrent ? 'font-semibold text-indigo-700' : 'text-slate-700'}`}>
            {paper.title}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${status.bg} ${status.text}`}>
              {status.label}
            </span>
            {relTime && <span className="text-[11px] text-slate-400">{relTime}</span>}
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
          className="text-slate-300 hover:text-slate-500 flex-shrink-0 p-0.5"
        >
          ⋯
        </button>
      </div>

      {showMenu && (
        <div className="absolute right-2 top-full z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-40">
          <button
            onClick={() => { setShowMenu(false); setShowMovePicker(true); }}
            className="w-full text-left px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            📂 Move to...
          </button>
          <button
            onClick={() => {
              setShowMenu(false);
              if (confirm('Delete this paper? This cannot be undone.')) {
                onDeletePaper(paper.id);
              }
            }}
            className="w-full text-left px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50"
          >
            🗑️ Delete
          </button>
        </div>
      )}

      {showMovePicker && (
        <MoveToPicker
          folders={folders}
          currentFolderId={paper.folderId ?? null}
          onSelect={(folderId) => { setShowMovePicker(false); onMovePaper(paper.id, folderId); }}
          onClose={() => setShowMovePicker(false)}
        />
      )}
    </div>
  );
}

function MoveToPicker({
  folders,
  currentFolderId,
  onSelect,
  onClose,
}: {
  folders: Folder[];
  currentFolderId: string | null;
  onSelect: (folderId: string | null) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(currentFolderId);

  const rootFolders = folders.filter((f) => !f.parentId);

  function renderFolderOption(folder: Folder, depth: number): React.ReactNode {
    const children = folders.filter((f) => f.parentId === folder.id);
    return (
      <div key={folder.id}>
        <label
          className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer"
          style={{ paddingLeft: `${12 + depth * 16}px` }}
        >
          <input
            type="radio"
            name="moveTarget"
            checked={selected === folder.id}
            onChange={() => setSelected(folder.id)}
            className="accent-indigo-500"
          />
          <span className="text-sm text-slate-700">📁 {folder.name}</span>
        </label>
        {children.map((c) => renderFolderOption(c, depth + 1))}
      </div>
    );
  }

  return (
    <div className="absolute right-0 top-full z-50 bg-white border border-slate-200 rounded-lg shadow-lg w-56 py-2">
      <div className="px-3 py-1 text-xs font-medium text-slate-400 uppercase">Move to</div>
      <label className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
        <input
          type="radio"
          name="moveTarget"
          checked={selected === null}
          onChange={() => setSelected(null)}
          className="accent-indigo-500"
        />
        <span className="text-sm text-slate-700">📁 Root (no folder)</span>
      </label>
      {rootFolders.map((f) => renderFolderOption(f, 0))}
      <div className="flex justify-end gap-2 px-3 pt-2 mt-1 border-t border-slate-100">
        <button onClick={onClose} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
        <button
          onClick={() => onSelect(selected)}
          className="text-xs text-white bg-indigo-500 px-2.5 py-1 rounded hover:bg-indigo-600"
        >
          Move
        </button>
      </div>
    </div>
  );
}

function FolderRow({
  folder,
  depth,
  papers,
  folders,
  currentPaperId,
  searchQuery,
  onClose,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onMovePaper,
  onDeletePaper,
}: {
  folder: Folder;
  depth: number;
  papers: PaperListItem[];
  folders: Folder[];
  currentPaperId: string;
  searchQuery: string;
  onClose: () => void;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onRenameFolder: (folderId: string, name: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onMovePaper: (paperId: string, folderId: string | null) => Promise<void>;
  onDeletePaper: (paperId: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [isCreatingChild, setIsCreatingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');

  const childFolders = folders.filter((f) => f.parentId === folder.id).sort((a, b) => a.name.localeCompare(b.name));
  const folderPapers = papers
    .filter((p) => p.folderId === folder.id)
    .filter((p) => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Count all papers in this folder and descendants
  const allDescendantIds = new Set<string>([folder.id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const f of folders) {
      if (f.parentId && allDescendantIds.has(f.parentId) && !allDescendantIds.has(f.id)) {
        allDescendantIds.add(f.id);
        changed = true;
      }
    }
  }
  const totalPapers = papers.filter((p) => p.folderId && allDescendantIds.has(p.folderId)).length;

  const handleRename = async () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== folder.name) {
      await onRenameFolder(folder.id, trimmed);
    }
    setIsRenaming(false);
  };

  const handleCreateChild = async () => {
    const trimmed = newChildName.trim();
    if (trimmed) {
      await onCreateFolder(trimmed, folder.id);
      setNewChildName('');
    }
    setIsCreatingChild(false);
  };

  return (
    <div>
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-slate-50 cursor-pointer group"
        style={{ paddingLeft: `${8 + depth * 20}px` }}
      >
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[11px] text-slate-400 w-4 flex-shrink-0"
        >
          {expanded ? '▼' : '▶'}
        </button>
        <span className="flex-shrink-0">📁</span>

        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') { setRenameValue(folder.name); setIsRenaming(false); }
            }}
            className="text-sm font-medium border border-indigo-400 rounded px-1 py-0.5 outline-none flex-1 min-w-0"
            maxLength={100}
          />
        ) : (
          <span
            onClick={() => setExpanded(!expanded)}
            className="text-sm font-medium text-slate-800 truncate flex-1"
          >
            {folder.name}
          </span>
        )}

        <span className="text-[11px] text-slate-400 flex-shrink-0">{totalPapers}</span>
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
            className="text-slate-300 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
          >
            ⋯
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-44">
              <button
                onClick={() => { setShowMenu(false); setIsCreatingChild(true); setExpanded(true); }}
                className="w-full text-left px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                📁 New sub-folder
              </button>
              <button
                onClick={() => { setShowMenu(false); setIsRenaming(true); setRenameValue(folder.name); }}
                className="w-full text-left px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                ✏️ Rename
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  if (confirm(`Delete folder "${folder.name}" and all sub-folders? Papers will be moved to the parent.`)) {
                    onDeleteFolder(folder.id);
                  }
                }}
                className="w-full text-left px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50"
              >
                🗑️ Delete folder
              </button>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className={depth > 0 ? 'border-l border-slate-200' : ''} style={{ marginLeft: `${20 + depth * 20}px` }}>
          {isCreatingChild && (
            <div className="flex items-center gap-2 px-3 py-1.5">
              <span>📁</span>
              <input
                autoFocus
                placeholder="Folder name"
                value={newChildName}
                onChange={(e) => setNewChildName(e.target.value)}
                onBlur={handleCreateChild}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateChild();
                  if (e.key === 'Escape') setIsCreatingChild(false);
                }}
                className="text-sm border border-indigo-400 rounded px-1 py-0.5 outline-none flex-1"
                maxLength={100}
              />
            </div>
          )}
          {childFolders.map((child) => (
            <FolderRow
              key={child.id}
              folder={child}
              depth={depth + 1}
              papers={papers}
              folders={folders}
              currentPaperId={currentPaperId}
              searchQuery={searchQuery}
              onClose={onClose}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onMovePaper={onMovePaper}
              onDeletePaper={onDeletePaper}
            />
          ))}
          {folderPapers.map((paper) => (
            <PaperRow
              key={paper.id}
              paper={paper}
              isCurrent={paper.id === currentPaperId}
              depth={depth + 1}
              onClose={onClose}
              onMovePaper={onMovePaper}
              onDeletePaper={onDeletePaper}
              folders={folders}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderTree(props: FolderTreeProps) {
  const { folders, papers, currentPaperId, searchQuery, onClose, onCreateFolder, onRenameFolder, onDeleteFolder, onMovePaper, onDeletePaper } = props;

  const rootFolders = useMemo(
    () => folders.filter((f) => !f.parentId).sort((a, b) => a.name.localeCompare(b.name)),
    [folders]
  );

  const rootPapers = useMemo(
    () => papers
      .filter((p) => !p.folderId)
      .filter((p) => !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [papers, searchQuery]
  );

  return (
    <div>
      {rootFolders.map((folder) => (
        <FolderRow
          key={folder.id}
          folder={folder}
          depth={0}
          papers={papers}
          folders={folders}
          currentPaperId={currentPaperId}
          searchQuery={searchQuery}
          onClose={onClose}
          onCreateFolder={onCreateFolder}
          onRenameFolder={onRenameFolder}
          onDeleteFolder={onDeleteFolder}
          onMovePaper={onMovePaper}
          onDeletePaper={onDeletePaper}
        />
      ))}
      {rootPapers.map((paper) => (
        <PaperRow
          key={paper.id}
          paper={paper}
          isCurrent={paper.id === currentPaperId}
          depth={0}
          onClose={onClose}
          onMovePaper={onMovePaper}
          onDeletePaper={onDeletePaper}
          folders={folders}
        />
      ))}
    </div>
  );
}
