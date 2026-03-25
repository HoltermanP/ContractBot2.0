/** Haalt publieke http(s)-pagina's op als platte tekst (basis SSRF-bescherming). */

const MAX_BYTES = 512_000

function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.localhost')) return true
  if (h === '0.0.0.0') return true
  // IPv4 private ranges (rudimentair)
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    if (a === 10) return true
    if (a === 127) return true
    if (a === 169 && b === 254) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
  }
  return false
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function fetchReferenceUrlAsText(rawUrl: string): Promise<{ title: string; text: string }> {
  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    throw new Error('Ongeldige URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Alleen http(s)-URL\'s zijn toegestaan')
  }
  if (isBlockedHost(url.hostname)) throw new Error('Deze host is niet toegestaan')

  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), 25_000)
  try {
    const res = await fetch(url.toString(), {
      signal: ac.signal,
      headers: {
        'User-Agent': 'Contractbot-QA/1.0',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
      },
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = await res.arrayBuffer()
    if (buf.byteLength > MAX_BYTES) throw new Error('Pagina is te groot')
    const ct = res.headers.get('content-type') ?? ''
    const body = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buf))

    if (ct.includes('text/plain')) {
      return { title: url.hostname, text: body.slice(0, 48_000) }
    }
    // HTML of onbekend: strip tags
    const text = stripHtml(body).slice(0, 48_000)
    return { title: url.hostname, text }
  } finally {
    clearTimeout(t)
  }
}
