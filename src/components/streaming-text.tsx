'use client';

interface StreamingTextProps {
  content: string;
  isStreaming?: boolean;
}

export function StreamingText({ content, isStreaming }: StreamingTextProps) {
  return (
    <div className="prose prose-sm max-w-none">
      <div className="whitespace-pre-wrap">{content}</div>
      {isStreaming && (
        <span
          className="inline-block w-2 h-4 animate-pulse ml-1"
          style={{ background: 'var(--accent)' }}
        />
      )}
    </div>
  );
}
