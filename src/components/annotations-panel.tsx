'use client';

import type { Annotation } from '@/types';
import { HIGHLIGHT_COLORS } from '@/lib/pdf-annotations';

interface AnnotationsPanelProps {
  annotations: Annotation[];
  onAnnotationClick: (annotation: Annotation) => void;
  onAnnotationDelete: (annotationId: string) => void;
}

export function AnnotationsPanel({ annotations, onAnnotationClick, onAnnotationDelete }: AnnotationsPanelProps) {
  if (annotations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-slate-500">
        <svg className="w-12 h-12 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
        <p className="text-sm">No annotations yet.</p>
        <p className="text-xs text-slate-400 mt-1">Select text on the PDF to add highlights and comments.</p>
      </div>
    );
  }

  const sorted = [...annotations].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return a.createdAt.localeCompare(b.createdAt);
  });

  return (
    <div className="flex flex-col gap-2 p-3">
      {sorted.map((annotation) => {
        const colorDef = HIGHLIGHT_COLORS[annotation.color];
        const truncatedText = annotation.text.length > 80
          ? annotation.text.slice(0, 80) + '...'
          : annotation.text;

        return (
          <div
            key={annotation.id}
            className="bg-white/5 rounded-md p-2.5 cursor-pointer hover:bg-white/10 transition-colors"
            style={{ borderLeft: `3px solid ${colorDef.solid}` }}
            onClick={() => onAnnotationClick(annotation)}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-slate-400">Page {annotation.page}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAnnotationDelete(annotation.id);
                }}
                className="text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                title="Delete annotation"
              >
                🗑️
              </button>
            </div>
            <div className="text-[11px] text-slate-300 mb-1 overflow-hidden text-ellipsis whitespace-nowrap">
              &ldquo;{truncatedText}&rdquo;
            </div>
            {annotation.comment ? (
              <div className="text-[11px] text-slate-400 italic">
                💬 {annotation.comment.length > 60 ? annotation.comment.slice(0, 60) + '...' : annotation.comment}
              </div>
            ) : (
              <div className="text-[11px] text-slate-600 italic">(No comment)</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
