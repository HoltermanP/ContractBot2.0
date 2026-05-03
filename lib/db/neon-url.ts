/**
 * Neon serverless / `neon-http` gebruikt fetch naar de Neon API.
 * Query-opties zoals `channel_binding=require` (libpq) veroorzaken hier vaak
 * een generieke `TypeError: fetch failed` zonder verdere uitleg.
 */
export function normalizeDatabaseUrlForNeonHttp(raw: string | undefined): string {
  if (!raw) return ''
  let u = raw.trim()
  if ((u.startsWith("'") && u.endsWith("'")) || (u.startsWith('"') && u.endsWith('"'))) {
    u = u.slice(1, -1)
  }
  try {
    const parsed = new URL(u)
    parsed.searchParams.delete('channel_binding')
    return parsed.toString()
  } catch {
    return u
  }
}
