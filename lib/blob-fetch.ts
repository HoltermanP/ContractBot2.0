import { get } from '@vercel/blob'
import { getPlaceholderPdfBuffer } from '@/lib/placeholder-pdf'

/** Publieke fallback als embedded placeholder niet gewenst is (bijv. tests). */
const FALLBACK_PUBLIC_PDF =
  'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'

async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
      total += value.byteLength
    }
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    merged.set(c, offset)
    offset += c.byteLength
  }
  return Buffer.from(merged)
}

function looksLikeVercelBlobUrl(url: string): boolean {
  return url.includes('.blob.vercel-storage.com/')
}

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim())
}

/** Ongeldige of placeholder-scheme URL’s (niet te fetchen). */
function needsPublicFallback(url: string): boolean {
  const u = url.trim()
  if (!u) return true
  if (/^demo:\/\//i.test(u)) return true
  if (!isHttpUrl(u)) return true
  return false
}

async function fetchHttpToBuffer(href: string): Promise<Buffer> {
  try {
    const r = await fetch(href, { redirect: 'follow' })
    if (!r.ok) throw new Error(`Download mislukt (${r.status})`)
    return Buffer.from(await r.arrayBuffer())
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/fetch failed|network|ECONNREFUSED|ETIMEDOUT/i.test(msg)) {
      throw new Error(`Download mislukt (netwerk): ${msg}`)
    }
    throw e
  }
}

/**
 * Downloads a file as Buffer.
 * - For Vercel Blob private stores we use the SDK `get()` so auth works.
 * - For other URLs we fall back to plain fetch.
 * - `demo://` of niet-http(s) → publieke placeholder-PDF (demodata / legacy seeds).
 */
export async function downloadFileToBuffer(url: string): Promise<Buffer> {
  const trimmed = url.trim()

  if (looksLikeVercelBlobUrl(trimmed)) {
    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim()
    if (!token) {
      const r = await fetch(trimmed)
      if (r.ok) return Buffer.from(await r.arrayBuffer())
      throw new Error('BLOB_READ_WRITE_TOKEN ontbreekt (nodig voor private Vercel Blob-downloads)')
    }
    const res = await get(trimmed, { access: 'private', token })
    if (!res) throw new Error('Blob niet gevonden')
    if (res.statusCode === 304 || !res.stream) throw new Error('Blob niet beschikbaar')
    return await streamToBuffer(res.stream)
  }

  if (needsPublicFallback(trimmed)) {
    try {
      return await fetchHttpToBuffer(FALLBACK_PUBLIC_PDF)
    } catch {
      return getPlaceholderPdfBuffer()
    }
  }

  return fetchHttpToBuffer(trimmed)
}

