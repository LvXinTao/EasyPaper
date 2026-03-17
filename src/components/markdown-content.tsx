'use client';

import ReactMarkdown from 'react-markdown';

export function MarkdownContent({ content, className }: { content: string; className?: string }) {
  return (
    <div className={`prose max-w-none ${className || ''}`} style={{ fontSize: '13px', lineHeight: 1.7 }}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h3 className="text-base font-bold mt-3 mb-1" style={{ color: 'var(--text-primary)' }}>{children}</h3>
          ),
          h2: ({ children }) => (
            <h3 className="text-base font-bold mt-3 mb-1" style={{ color: 'var(--text-primary)' }}>{children}</h3>
          ),
          h3: ({ children }) => (
            <h4 className="text-sm font-bold mt-2 mb-1" style={{ color: 'var(--text-primary)' }}>{children}</h4>
          ),
          p: ({ children }) => <p className="mb-2 last:mb-0" style={{ fontSize: '13px' }}>{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li style={{ fontSize: '13px' }}>{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ children, href }) => (
            <a href={href} style={{ color: 'var(--accent)' }} className="underline underline-offset-2">{children}</a>
          ),
          code: ({ children, className: codeClassName }) => {
            const isBlock = codeClassName?.startsWith('language-');
            if (isBlock) {
              return (
                <pre
                  className="rounded-lg p-3 my-2 overflow-x-auto text-xs"
                  style={{ background: 'var(--bg-deep)', color: 'var(--text-primary)' }}
                >
                  <code>{children}</code>
                </pre>
              );
            }
            return (
              <code
                className="px-1 py-0.5 rounded text-xs"
                style={{ background: 'var(--bg-deep)', color: 'var(--text-primary)' }}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          blockquote: ({ children }) => (
            <blockquote
              className="border-l-2 pl-3 my-2 italic"
              style={{ borderColor: 'var(--accent)', color: 'var(--text-secondary)', fontSize: '13px' }}
            >
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
