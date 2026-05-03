import Link from 'next/link'
import { ChevronRight, FolderKanban } from 'lucide-react'
import { formatDate } from '@/lib/utils'

function splitProjectName(fullName: string): { code: string | null; title: string } {
  const parts = fullName.split(/\s—\s/)
  if (parts.length >= 2) {
    return { code: parts[0]!.trim(), title: parts.slice(1).join(' — ') }
  }
  return { code: null, title: fullName }
}

type DescBlock =
  | { kind: 'kv'; key: string; value: string }
  | { kind: 'text'; text: string }

function parseDescriptionBlocks(text: string): DescBlock[] {
  const rawLines = text.split('\n')
  const blocks: DescBlock[] = []
  let textBuffer: string[] = []

  const flushText = () => {
    if (textBuffer.length === 0) return
    const t = textBuffer.join('\n').trim()
    if (t) blocks.push({ kind: 'text', text: t })
    textBuffer = []
  }

  for (const line of rawLines) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushText()
      continue
    }
    const colon = trimmed.indexOf(':')
    if (colon > 0 && colon < 80) {
      const key = trimmed.slice(0, colon).trim()
      const value = trimmed.slice(colon + 1).trim()
      const keyLooksLikeLabel = /^[\p{L}\d\s\-().]+$/u.test(key) && key.length <= 64
      if (keyLooksLikeLabel && value.length > 0) {
        flushText()
        blocks.push({ kind: 'kv', key, value })
        continue
      }
    }
    textBuffer.push(line)
  }
  flushText()
  return blocks
}

function MetaValue({ value }: { value: string }) {
  const segments = value.split(/\s*\|\s*/).map((s) => s.trim()).filter(Boolean)
  if (segments.length <= 1) {
    return <span className="text-zinc-800">{value}</span>
  }
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-1 text-zinc-800">
      {segments.map((seg, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 && <span className="select-none text-zinc-300" aria-hidden="true">|</span>}
          <span>{seg}</span>
        </span>
      ))}
    </span>
  )
}

export function ProjectListRow({
  id,
  name,
  description,
  createdAt,
}: {
  id: string
  name: string
  description: string | null
  createdAt: Date
}) {
  const { code, title } = splitProjectName(name)
  const created = formatDate(createdAt)
  const iso = createdAt instanceof Date ? createdAt.toISOString() : String(createdAt)
  const blocks = description ? parseDescriptionBlocks(description) : []

  return (
    <li className="list-none">
      <Link
        href={`/projects/${id}`}
        className="group flex gap-3 px-4 py-4 transition-colors hover:bg-zinc-50/90 active:bg-zinc-100/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 sm:gap-4 sm:px-6 sm:py-5"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 transition-colors group-hover:bg-zinc-200/90">
          <FolderKanban className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {code ? (
                <p className="text-sm font-medium leading-snug text-zinc-900">
                  <span className="mr-2 font-mono text-xs font-normal tracking-tight text-zinc-500">{code}</span>
                  <span className="font-semibold group-hover:text-blue-700">{title}</span>
                </p>
              ) : (
                <p className="text-sm font-semibold leading-snug text-zinc-900 group-hover:text-blue-700">{title}</p>
              )}
            </div>
            <span className="flex shrink-0 flex-col items-end gap-1 sm:pt-0.5">
              <time
                dateTime={iso}
                className="text-xs font-medium tabular-nums text-zinc-600 sm:text-sm"
                title={`Aangemaakt ${created}`}
              >
                {created}
              </time>
              <ChevronRight
                className="h-4 w-4 text-zinc-300 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                aria-hidden
              />
            </span>
          </div>
          {blocks.length > 0 && (
            <div className="space-y-3 border-t border-zinc-100 pt-3 text-sm">
              {blocks.map((b, i) =>
                b.kind === 'text' ? (
                  <p key={i} className="whitespace-pre-wrap leading-relaxed text-zinc-700">
                    {b.text}
                  </p>
                ) : (
                  <dl
                    key={i}
                    className="m-0 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[minmax(7rem,10rem)_1fr] sm:items-baseline"
                  >
                    <dt className="font-medium text-zinc-600">{b.key}</dt>
                    <dd className="m-0 min-w-0">
                      <MetaValue value={b.value} />
                    </dd>
                  </dl>
                )
              )}
            </div>
          )}
        </div>
      </Link>
    </li>
  )
}
