'use client'

import ReactMarkdown from 'react-markdown'

export function MarkdownBody({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed text-slate-800 space-y-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_p]:mt-1">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
