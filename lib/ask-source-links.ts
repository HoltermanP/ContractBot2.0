import type { QaSourceRef } from '@/lib/openai'
import type { QaContextBlock } from '@/lib/contract-qa-context'

export type AskSourceWithLink = QaSourceRef & {
  /** Relatieve API-URL of absolute http(s)-URL */
  href: string | null
  /** True als de browser het type normaal in-tab kan tonen (pdf, html, afbeelding, platte tekst) */
  openInBrowser: boolean
}

function normalizeDetail(s: string) {
  return s.trim().toLowerCase()
}

function mimeViewableInline(mime: string | null | undefined): boolean {
  if (!mime) return false
  const m = mime.toLowerCase()
  return (
    m === 'application/pdf' ||
    m.startsWith('text/html') ||
    m.startsWith('image/') ||
    m === 'text/plain' ||
    m === 'text/markdown'
  )
}

function isHttpUrl(s: string) {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Koppelt AI-bronregels aan de geladen contextblokken en bouwt klikbare hrefs.
 */
function normalizeSourceType(t: string): 'contract' | 'addendum' | 'url' {
  const x = t.trim().toLowerCase()
  if (x === 'addendum' || x === 'url' || x === 'contract') return x
  return 'contract'
}

export function enrichAskSources(
  sources: QaSourceRef[],
  blocks: QaContextBlock[]
): AskSourceWithLink[] {
  const contractBlocks = blocks.filter((b) => b.kind === 'contract' || b.kind === 'addendum')
  const urlBlocks = blocks.filter((b) => b.kind === 'url')

  return sources.map((source) => {
    const base: AskSourceWithLink = { ...source, href: null, openInBrowser: false }
    const sourceKind = normalizeSourceType(source.type)

    if (sourceKind === 'url') {
      const url = source.detail.trim()
      if (isHttpUrl(url)) {
        return { ...base, href: url, openInBrowser: true }
      }
      const fromBlock = urlBlocks.find((b) => normalizeDetail(b.detail) === normalizeDetail(url))
      if (fromBlock && isHttpUrl(fromBlock.detail)) {
        return { ...base, href: fromBlock.detail, openInBrowser: true }
      }
      return base
    }

    const wantKind = sourceKind === 'addendum' ? 'addendum' : 'contract'
    let candidates = contractBlocks.filter((b) => b.kind === wantKind)

    const exactAnyKind = contractBlocks.find(
      (b) => normalizeDetail(b.detail) === normalizeDetail(source.detail)
    )
    let match = exactAnyKind

    if (!match) {
      const byDetail = candidates.find((b) => normalizeDetail(b.detail) === normalizeDetail(source.detail))
      match = byDetail
    }

    if (!match) {
      match = candidates.find(
        (b) =>
          normalizeDetail(b.detail).includes(normalizeDetail(source.detail)) ||
          normalizeFilenameLoose(b.detail, source.detail)
      )
    }

    if (!match) {
      match = contractBlocks.find(
        (b) =>
          normalizeDetail(b.detail).includes(normalizeDetail(source.detail)) ||
          normalizeFilenameLoose(b.detail, source.detail)
      )
    }

    if (!match) {
      const sameTitle = contractBlocks.filter(
        (b) => b.title.trim().toLowerCase() === source.title.trim().toLowerCase()
      )
      if (sameTitle.length === 1) match = sameTitle[0]
      else if (sameTitle.length > 1) {
        match =
          sameTitle.find((b) => normalizeDetail(b.detail) === normalizeDetail(source.detail)) ??
          sameTitle.find((b) => b.kind === wantKind) ??
          sameTitle[0]
      }
    }

    if (!match?.documentId) {
      return base
    }

    const inline = mimeViewableInline(match.fileType)
    const href = `/api/contract-documents/${encodeURIComponent(match.documentId)}/download${inline ? '?inline=1' : ''}`
    return {
      ...base,
      href,
      openInBrowser: inline,
    }
  })
}

function normalizeFilenameLoose(a: string, b: string) {
  const x = normalizeDetail(a).replace(/\s+/g, '')
  const y = normalizeDetail(b).replace(/\s+/g, '')
  return x.includes(y) || y.includes(x)
}
