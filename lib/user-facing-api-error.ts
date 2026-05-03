/**
 * Vertaalt technische driver-fouten naar korte gebruikerstekst voor JSON API’s.
 */
export function userFacingApiError(err: unknown): string {
  if (!(err instanceof Error)) return 'Onbekende fout'
  const m = err.message
  if (/fetch failed/i.test(m)) {
    return 'Databaseverbinding mislukt. Controleer DATABASE_URL op de server; bij Neon serverless vaak oplossen door channel_binding uit de connection string te halen.'
  }
  return m
}
