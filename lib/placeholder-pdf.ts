/**
 * Één pagina, geldig PDF 1.4 (geen netwerk of bestandssysteem nodig).
 * Fallback als externe placeholder-URL niet bereikbaar is (Vercel / firewall).
 */
const MINIMAL_PDF_UTF8 = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/MediaBox[0 0 200 200]/Parent 2 0 R>>endobj
xref
0 4
0000000000 65535 f 
0000000009 00000 n 
0000000052 00000 n 
0000000101 00000 n 
trailer<</Size 4/Root 1 0 R>>
startxref
164
%%EOF`

let _cached: Buffer | null = null

export function getPlaceholderPdfBuffer(): Buffer {
  if (!_cached) {
    _cached = Buffer.from(MINIMAL_PDF_UTF8, 'utf8')
  }
  return _cached
}
