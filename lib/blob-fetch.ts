import { get } from '@vercel/blob'

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

/**
 * Downloads a file as Buffer.
 * - For Vercel Blob private stores we use the SDK `get()` so auth works.
 * - For other URLs we fall back to plain fetch.
 */
export async function downloadFileToBuffer(url: string): Promise<Buffer> {
  if (looksLikeVercelBlobUrl(url)) {
    const res = await get(url, { access: 'private', token: process.env.BLOB_READ_WRITE_TOKEN })
    if (!res) throw new Error('Blob niet gevonden')
    if (res.statusCode === 304 || !res.stream) throw new Error('Blob niet beschikbaar')
    return await streamToBuffer(res.stream)
  }

  const r = await fetch(url)
  if (!r.ok) throw new Error(`Download mislukt (${r.status})`)
  return Buffer.from(await r.arrayBuffer())
}

