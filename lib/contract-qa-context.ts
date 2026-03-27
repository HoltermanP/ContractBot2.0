import { db } from '@/lib/db'
import { contracts, contractDocuments } from '@/lib/db/schema'
import { eq, and, asc, sql } from 'drizzle-orm'
import { getEmbedding } from '@/lib/openai'
import { parseDocumentFromStoredFile, loadContractCorpusParts } from '@/lib/contract-corpus'

export type QaContextBlock = {
  kind: 'contract' | 'addendum' | 'url'
  /** Contract-id (niet document-id) */
  id: string
  /** Rij-id in contract_documents; alleen voor contract/addendum */
  documentId: string | null
  fileType: string | null
  title: string
  detail: string
  text: string
}

const MAX_CHARS_MAIN = 14_000
const MAX_CHARS_PER_ADDENDUM = 8_000

export async function loadContractTextBlocks(
  orgId: string,
  contractIds: string[],
  options?: { hideArchivedForReader?: boolean }
): Promise<QaContextBlock[]> {
  const blocks: QaContextBlock[] = []
  for (const contractId of contractIds) {
    const contract = await db.query.contracts.findFirst({
      where: and(eq(contracts.id, contractId), eq(contracts.orgId, orgId)),
    })
    if (!contract) continue
    if (options?.hideArchivedForReader && contract.status === 'gearchiveerd') continue

    const { mainDocuments, addenda } = await loadContractCorpusParts(contractId)
    if (mainDocuments.length === 0 && addenda.length === 0) continue

    try {
      const sortedAddenda = [...addenda].sort(
        (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
      )

      // Eerst hoofdcontractdocumenten, daarna addenda (nieuw → oud) zodat wijzigingen prioriteit krijgen.
      for (const main of mainDocuments) {
        const text = await parseDocumentFromStoredFile(main)
        blocks.push({
          kind: 'contract',
          id: contract.id,
          documentId: main.id,
          fileType: main.fileType ?? null,
          title: contract.title,
          detail: main.filename,
          text: text.slice(0, MAX_CHARS_MAIN),
        })
      }

      for (const ad of sortedAddenda) {
        const text = await parseDocumentFromStoredFile(ad)
        blocks.push({
          kind: 'addendum',
          id: contract.id,
          documentId: ad.id,
          fileType: ad.fileType ?? null,
          title: contract.title,
          detail: ad.filename,
          text: text.slice(0, MAX_CHARS_PER_ADDENDUM),
        })
      }
    } catch {
      // skip unreadable
    }
  }
  return blocks
}

const readerStatusClause = (readerMode?: boolean) =>
  readerMode ? sql`AND c.status IN ('actief', 'concept', 'verlopen')` : sql`AND c.status != 'verwijderd'`

const readerStatusClauseContracts = (readerMode?: boolean) =>
  readerMode ? sql`AND status IN ('actief', 'concept', 'verlopen')` : sql`AND status != 'verwijderd'`

/**
 * Als er geen embeddings zijn (bijv. na seed), toch contracten met PDF/DOCX-bronnen kiezen
 * voor portfolio-chat. Meest recent bijgewerkte eerst.
 */
export async function contractIdsWithDocumentsFallback(
  orgId: string,
  limit: number,
  options?: { readerMode?: boolean }
): Promise<string[]> {
  const rs = readerStatusClause(options?.readerMode)
  const results = await db.execute(sql`
    SELECT c.id
    FROM contracts c
    WHERE c.org_id = ${orgId}
      ${rs}
      AND EXISTS (
        SELECT 1 FROM contract_documents d
        WHERE d.contract_id = c.id AND d.is_current = true
      )
    ORDER BY c.updated_at DESC NULLS LAST
    LIMIT ${limit}
  `)
  return (results.rows as { id: string }[]).map((r) => r.id)
}

/** Semantisch de meest relevante contract-id's voor een vraag (vereist embeddings). */
export async function semanticTopContractIds(
  orgId: string,
  question: string,
  limit: number,
  options?: { readerMode?: boolean }
): Promise<string[]> {
  const readerClause = readerStatusClauseContracts(options?.readerMode)
  const anyIndexed = await db.execute(sql`
    SELECT id FROM contracts
    WHERE org_id = ${orgId}
      AND content_embedding IS NOT NULL
      ${readerClause}
    LIMIT 1
  `)
  if ((anyIndexed.rows as { id: string }[]).length === 0) {
    return []
  }

  const embedding = await getEmbedding(question)
  const results = await db.execute(sql`
    SELECT id
    FROM contracts
    WHERE org_id = ${orgId}
      AND content_embedding IS NOT NULL
      ${readerClause}
    ORDER BY content_embedding <=> ${JSON.stringify(embedding)}::vector
    LIMIT ${limit}
  `)
  return (results.rows as { id: string }[]).map((r) => r.id)
}
