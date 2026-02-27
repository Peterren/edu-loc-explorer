"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = { content: string; className?: string };

export default function MarkdownContent({ content, className = "" }: Props) {
  return (
    <div className={`prose prose-invert prose-sm max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre: ({ ...props }) => (
            <pre
              className="overflow-x-auto rounded-lg bg-white/10 p-3 text-sm"
              {...props}
            />
          ),
          code: ({ className, ...props }) => {
            const isInline = !className;
            return isInline ? (
              <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-sm" {...props} />
            ) : (
              <code className={className} {...props} />
            );
          },
          a: ({ ...props }) => (
            <a target="_blank" rel="noopener noreferrer" className="text-blue-400 underline hover:text-blue-300" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
