import { db, contracts, contractDocuments } from '@/lib/db'
import { eq, and, inArray, desc } from 'drizzle-orm'
import { parseDocument } from '@/lib/parse-document'
import { downloadFileToBuffer } from '@/lib/blob-fetch'

const MAX_DOC_BYTES = 20 * 1024 * 1024
const FETCH_TIMEOUT_MS = 90_000

export type ResolvedTrainingSource = {
  contractId: string
  contractTitle: string
  documentId: string
  filename: string
  fileUrl: string
  fileType: string
  text: string
}

function mimeForParse(fileType: string, filename: string): string {
  const ft = fileType.toLowerCase()
  const fn = filename.toLowerCase()
  if (ft.includes('pdf') || fn.endsWith('.pdf')) return 'application/pdf'
  if (ft.includes('word') || fn.endsWith('.docx')) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
  return fileType || 'application/octet-stream'
}

export async function fetchDocumentPlainText(fileUrl: string, fileType: string, filename: string): Promise<string> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS)
  try {
    // Note: `downloadFileToBuffer` uses the Blob SDK for private stores.
    // AbortController isn't wired through to Blob SDK yet; we keep the timeout for fetch fallback.
    const buf = await downloadFileToBuffer(fileUrl)
    if (buf.length > MAX_DOC_BYTES) throw new Error('Bestand is te groot om te verwerken')
    const mime = mimeForParse(fileType, filename)
    return await parseDocument(buf, mime)
  } finally {
    clearTimeout(t)
  }
}

/**
 * Bepaalt welke documenten worden gebruikt: expliciete documentIds, anders alle huidige documenten van de gekozen contracten.
 */
export async function resolveTrainingSources(
  orgId: string,
  contractIds: string[],
  documentIds: string[]
): Promise<ResolvedTrainingSource[]> {
  if (documentIds.length > 0) {
    const rows = await db.query.contractDocuments.findMany({
      where: inArray(contractDocuments.id, documentIds),
      with: { contract: true },
    })
    const invalid = rows.filter((r) => r.contract?.orgId !== orgId)
    if (invalid.length > 0) throw new Error('Een of meer documenten horen niet bij uw organisatie')
    const out: ResolvedTrainingSource[] = []
    for (const row of rows) {
      if (!row.contract) continue
      const text = await fetchDocumentPlainText(row.fileUrl, row.fileType, row.filename)
      out.push({
        contractId: row.contractId,
        contractTitle: row.contract.title,
        documentId: row.id,
        filename: row.filename,
        fileUrl: row.fileUrl,
        fileType: row.fileType,
        text,
      })
    }
    return out
  }

  if (contractIds.length === 0) return []

  const contractRows = await db.query.contracts.findMany({
    where: and(inArray(contracts.id, contractIds), eq(contracts.orgId, orgId)),
  })
  if (contractRows.length !== contractIds.length) {
    throw new Error('Een of meer contracten zijn niet gevonden')
  }

  const docs = await db.query.contractDocuments.findMany({
    where: and(inArray(contractDocuments.contractId, contractIds), eq(contractDocuments.isCurrent, true)),
    orderBy: [desc(contractDocuments.uploadedAt)],
  })

  const out: ResolvedTrainingSource[] = []
  for (const row of docs) {
    const c = contractRows.find((x) => x.id === row.contractId)
    if (!c) continue
    const text = await fetchDocumentPlainText(row.fileUrl, row.fileType, row.filename)
    out.push({
      contractId: row.contractId,
      contractTitle: c.title,
      documentId: row.id,
      filename: row.filename,
      fileUrl: row.fileUrl,
      fileType: row.fileType,
      text,
    })
  }
  return out
}

const MAX_TOTAL_CHARS = 100_000

export function trimSourcesForModel(sources: ResolvedTrainingSource[]): { label: string; text: string }[] {
  const labeled = sources.map((s) => ({
    label: `${s.contractTitle} — ${s.filename}`,
    text: s.text,
  }))
  let total = labeled.reduce((a, x) => a + x.text.length, 0)
  if (total <= MAX_TOTAL_CHARS) return labeled
  const ratio = MAX_TOTAL_CHARS / total
  return labeled.map((x) => ({
    label: x.label,
    text: x.text.slice(0, Math.max(500, Math.floor(x.text.length * ratio))),
  }))
}
