'use client';

import Link from 'next/link';
import type { PaperListItem } from '@/types';

interface PaperCardProps {
  paper: PaperListItem;
  onDelete?: (id: string) => void;
}

const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  pending: { text: 'Pending', color: 'bg-amber-50 text-amber-700 border border-amber-200' },
  parsing: { text: 'Parsing', color: 'bg-sky-50 text-sky-700 border border-sky-200' },
  analyzing: { text: 'Analyzing', color: 'bg-violet-50 text-violet-700 border border-violet-200' },
  analyzed: { text: 'Analyzed', color: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  error: { text: 'Error', color: 'bg-rose-50 text-rose-700 border border-rose-200' },
};

export function PaperCard({ paper, onDelete }: PaperCardProps) {
  const status = STATUS_LABELS[paper.status] || STATUS_LABELS.pending;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-lg hover:border-indigo-200 transition-all group">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/paper/${paper.id}`}
          className="text-base font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors flex-1 leading-snug"
        >
          {paper.title}
        </Link>
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap ${status.color}`}>
          {status.text}
        </span>
      </div>
      <div className="flex items-center justify-between mt-4 text-sm">
        <span className="text-slate-400">{new Date(paper.createdAt).toLocaleDateString()}</span>
        {onDelete && (
          <button
            onClick={() => onDelete(paper.id)}
            className="text-slate-300 hover:text-rose-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
