'use client';

import Link from 'next/link';
import type { PaperListItem } from '@/types';

interface PaperCardProps {
  paper: PaperListItem;
  onDelete?: (id: string) => void;
}

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  pending: { text: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  parsing: { text: 'Parsing', color: 'bg-blue-100 text-blue-700' },
  analyzing: { text: 'Analyzing', color: 'bg-purple-100 text-purple-700' },
  analyzed: { text: 'Analyzed', color: 'bg-green-100 text-green-700' },
  error: { text: 'Error', color: 'bg-red-100 text-red-700' },
};

export function PaperCard({ paper, onDelete }: PaperCardProps) {
  const status = STATUS_LABELS[paper.status] || STATUS_LABELS.pending;

  return (
    <div className="border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <Link
          href={`/paper/${paper.id}`}
          className="text-lg font-medium text-gray-800 hover:text-blue-600 flex-1"
        >
          {paper.title}
        </Link>
        <span className={`text-xs px-2 py-1 rounded-full ${status.color}`}>
          {status.text}
        </span>
      </div>
      <div className="flex items-center justify-between mt-3 text-sm text-gray-400">
        <span>{new Date(paper.createdAt).toLocaleDateString()}</span>
        {onDelete && (
          <button
            onClick={() => onDelete(paper.id)}
            className="text-red-400 hover:text-red-600"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
