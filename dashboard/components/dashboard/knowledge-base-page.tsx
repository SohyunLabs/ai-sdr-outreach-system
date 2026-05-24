"use client";

import ReactMarkdown from "react-markdown";

interface KnowledgeBasePageProps {
  content: string;
}

export function KnowledgeBasePage({ content }: KnowledgeBasePageProps) {
  return (
    <div className="max-w-4xl">
      <h2 className="text-xl font-semibold mb-6">Knowledge Base</h2>
      <div className="rounded-lg border bg-card p-8">
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className="text-2xl font-bold mb-4 text-foreground">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-lg font-semibold mt-8 mb-3 text-foreground border-b border-border pb-2">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-sm font-semibold mt-5 mb-2 text-foreground">{children}</h3>
            ),
            p: ({ children }) => (
              <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside space-y-1 mb-3">{children}</ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside space-y-1 mb-3">{children}</ol>
            ),
            li: ({ children }) => (
              <li className="text-sm text-muted-foreground">{children}</li>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-foreground">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="italic text-muted-foreground">{children}</em>
            ),
            table: ({ children }) => (
              <div className="overflow-x-auto mb-4">
                <table className="w-full border-collapse text-sm">{children}</table>
              </div>
            ),
            thead: ({ children }) => <thead>{children}</thead>,
            tbody: ({ children }) => <tbody>{children}</tbody>,
            tr: ({ children }) => <tr className="border-b border-border">{children}</tr>,
            th: ({ children }) => (
              <th className="border border-border px-3 py-2 text-left text-xs font-semibold bg-muted text-foreground">
                {children}
              </th>
            ),
            td: ({ children }) => (
              <td className="border border-border px-3 py-2 text-sm text-muted-foreground">
                {children}
              </td>
            ),
            hr: () => <hr className="my-6 border-border" />,
            code: ({ children }) => (
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">
                {children}
              </code>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-border pl-4 my-3 text-sm text-muted-foreground italic">
                {children}
              </blockquote>
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
