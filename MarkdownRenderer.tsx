import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="prose prose-invert prose-p:leading-relaxed prose-pre:p-0 prose-pre:bg-transparent max-w-none break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match && !String(children).includes('\n');
            
            if (isInline) {
               return (
                <code className="bg-gray-700 text-gray-200 px-1 py-0.5 rounded text-sm" {...props}>
                  {children}
                </code>
              );
            }

            return (
              <div className="rounded-md bg-[#1e1e1e] my-4 overflow-hidden border border-gray-700/50">
                <div className="flex items-center justify-between px-4 py-2 bg-[#2d2d35] border-b border-gray-700/50">
                   <span className="text-xs text-gray-400 lowercase">{match?.[1] || 'code'}</span>
                </div>
                <div className="p-4 overflow-x-auto">
                  <code className={`${className} text-sm font-mono`} {...props}>
                    {children}
                  </code>
                </div>
              </div>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-4 border border-gray-700 rounded-lg">
                <table className="min-w-full divide-y divide-gray-700 text-sm">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="bg-gray-800">{children}</thead>;
          },
          th({ children }) {
            return <th className="px-4 py-3 text-left font-medium text-gray-300">{children}</th>;
          },
          td({ children }) {
            return <td className="px-4 py-3 border-t border-gray-700 text-gray-300">{children}</td>;
          },
          ul({ children }) {
            return <ul className="list-disc pl-6 my-2 space-y-1">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal pl-6 my-2 space-y-1">{children}</ol>;
          },
          a({ children, href }) {
             return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{children}</a>
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default React.memo(MarkdownRenderer);
