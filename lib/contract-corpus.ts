import { db } from '@/lib/db'
import { contractDocuments, contracts } from '@/lib/db/schema'
import { eq, and, asc, desc } from 'drizzle-orm'
import { parseDocument } from '@/lib/parse-document'
import { getEmbedding } from '@/lib/openai'

export async function parseDocumentFromStoredFile(doc: { fileUrl: string; fileType: string }): Promise<string> {
  const res = await fetch(doc.fileUrl)
  const buf = Buffer.from(await res.arrayBuffer())
  return parseDocument(buf, doc.fileType)
}

export async function loadContractCorpusParts(contractId: string) {
  const current = await db.query.contractDocuments.findMany({
    where: and(eq(contractDocuments.contractId, contractId), eq(contractDocuments.isCurrent, true)),
    orderBy: [asc(contractDocuments.uploadedAt)],
  })
  const main = current.find((d) => d.documentKind === 'hoofdcontract') ?? null
  const addenda = current.filter((d) => d.documentKind === 'addendum')
  return { main, addenda }
}

/** Volledige tekst voor risico-/compliance-analyse: hoofdcontract eerst, daarna addenda (oud → nieuw). */
export async function loadContractCorpusPlainTextForAnalysis(contractId: string): Promise<string> {
  const { main, addenda } = await loadContractCorpusParts(contractId)
  const parts: string[] = []
  if (main) {
    const text = await parseDocumentFromStoredFile(main)
    parts.push(`=== HOOFDCONTRACT (${main.filename}) ===\n${text}`)
  }
  for (const a of addenda) {
    const text = await parseDocumentFromStoredFile(a)
    parts.push(`=== ADDENDUM / WIJZIGING (${a.filename}) ===\n${text}`)
  }
  if (parts.length === 0) return ''
  return (
    'Let op: addenda en wijzigingen hebben voorrang op het hoofdcontract waar zij daarvan afwijken; ' +
      'nieuwere addenda gaan voor op oudere addenda.\n\n' +
    parts.join('\n\n')
  )
}

/**
 * Tekst voor embedding (zoekindex): addenda eerst zodat trefwoorden uit wijzigingen zwaarder meewegen
 * in de eerste ~8000 tekens van het embedding-model.
 */
export async function loadContractCorpusPlainTextForEmbedding(contractId: string): Promise<string> {
  const { main, addenda } = await loadContractCorpusParts(contractId)
  const parts: string[] = []
  for (const a of addenda) {
    const text = await parseDocumentFromStoredFile(a)
    parts.push(`Addendum (${a.filename}):\n${text}`)
  }
  if (main) {
    const text = await parseDocumentFromStoredFile(main)
    parts.push(`Hoofdcontract (${main.filename}):\n${text}`)
  }
  return parts.join('\n\n---\n\n')
}

export async function refreshContractContentEmbedding(contractId: string, orgId: string): Promise<void> {
  const corpus = await loadContractCorpusPlainTextForEmbedding(contractId)
  if (!corpus.trim()) return
  const embedding = await getEmbedding(corpus)
  if (embedding.length === 0) return
  await db
    .update(contracts)
    .set({ contentEmbedding: embedding as any, updatedAt: new Date() })
    .where(and(eq(contracts.id, contractId), eq(contracts.orgId, orgId)))
}

export async function hasCurrentHoofdcontract(contractId: string): Promise<boolean> {
  const row = await db.query.contractDocuments.findFirst({
    where: and(
      eq(contractDocuments.contractId, contractId),
      eq(contractDocuments.isCurrent, true),
      eq(contractDocuments.documentKind, 'hoofdcontract')
    ),
  })
  return !!row
}

export async function nextDocumentVersionNumber(contractId: string): Promise<number> {
  const row = await db.query.contractDocuments.findFirst({
    where: eq(contractDocuments.contractId, contractId),
    orderBy: [desc(contractDocuments.versionNumber)],
  })
  return (row?.versionNumber ?? 0) + 1
}
