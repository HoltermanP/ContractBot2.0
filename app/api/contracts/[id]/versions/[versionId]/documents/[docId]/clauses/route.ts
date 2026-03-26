import { NextRequest } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getOrCreateUser } from '@/lib/auth'
import { apiError, apiSuccess } from '@/lib/api-response'
import { db, contractVersion, contractDocumentNode, contractClause } from '@/lib/db'

const createClauseSchema = z.object({
  clauseType: z.string().min(1),
  ownerParty: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  status: z.string().optional().default('open'),
  content: z.string().optional().nullable(),
  aiLabel: z.string().optional().nullable(),
  aiRiskScore: z.number().int().min(0).max(100).optional().nullable(),
})

async function validatePath(id: string, versionId: string, docId: string) {
  const contractId = z.string().uuid().parse(id)
  const parsedVersionId = z.string().uuid().parse(versionId)
  const parsedDocId = z.string().uuid().parse(docId)

  const [version] = await db
    .select()
    .from(contractVersion)
    .where(and(eq(contractVersion.id, parsedVersionId), eq(contractVersion.contractId, contractId)))
  if (!version) return null

  const [doc] = await db
    .select()
    .from(contractDocumentNode)
    .where(and(eq(contractDocumentNode.id, parsedDocId), eq(contractDocumentNode.contractVersionId, parsedVersionId)))
  if (!doc) return null

  return { docId: parsedDocId }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string; docId: string }> }
) {
  try {
    const user = await getOrCreateUser()
    if (!user) return apiError('Niet ingelogd', 401)
    const { id, versionId, docId } = await params
    const validated = await validatePath(id, versionId, docId)
    if (!validated) return apiError('Pad niet gevonden', 404)

    const rows = await db.select().from(contractClause).where(eq(contractClause.contractDocumentId, validated.docId))
    return apiSuccess(rows)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return apiError('Ongeldige input', 400)
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return apiError(message, 500)
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string; docId: string }> }
) {
  try {
    const user = await getOrCreateUser()
    if (!user) return apiError('Niet ingelogd', 401)
    const { id, versionId, docId } = await params
    const validated = await validatePath(id, versionId, docId)
    if (!validated) return apiError('Pad niet gevonden', 404)

    const body = await req.json()
    const parsed = createClauseSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.flatten().formErrors.join(', ') || 'Ongeldige input', 400)

    const [created] = await db
      .insert(contractClause)
      .values({
        contractDocumentId: validated.docId,
        clauseType: parsed.data.clauseType,
        ownerParty: parsed.data.ownerParty ?? null,
        dueDate: parsed.data.dueDate ?? null,
        status: parsed.data.status,
        content: parsed.data.content ?? null,
        aiLabel: parsed.data.aiLabel ?? null,
        aiRiskScore: parsed.data.aiRiskScore ?? null,
      })
      .returning()

    return apiSuccess(created, 201)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return apiError('Ongeldige input', 400)
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return apiError(message, 500)
  }
}
