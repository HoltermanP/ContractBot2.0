import { NextRequest } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getOrCreateUser } from '@/lib/auth'
import { apiError, apiSuccess } from '@/lib/api-response'
import { db, contractVersion, contractDocumentNode } from '@/lib/db'

const createDocumentSchema = z.object({
  docType: z.string().min(1),
  title: z.string().min(1),
  sortOrder: z.number().int().optional().default(0),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  try {
    const user = await getOrCreateUser()
    if (!user) return apiError('Niet ingelogd', 401)

    const { id, versionId } = await params
    const contractId = z.string().uuid().parse(id)
    const parsedVersionId = z.string().uuid().parse(versionId)

    const [version] = await db
      .select()
      .from(contractVersion)
      .where(and(eq(contractVersion.id, parsedVersionId), eq(contractVersion.contractId, contractId)))
    if (!version) return apiError('Versie niet gevonden', 404)

    const docs = await db
      .select()
      .from(contractDocumentNode)
      .where(eq(contractDocumentNode.contractVersionId, parsedVersionId))

    return apiSuccess(docs)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return apiError('Ongeldige input', 400)
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return apiError(message, 500)
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  try {
    const user = await getOrCreateUser()
    if (!user) return apiError('Niet ingelogd', 401)

    const { id, versionId } = await params
    const contractId = z.string().uuid().parse(id)
    const parsedVersionId = z.string().uuid().parse(versionId)

    const [version] = await db
      .select()
      .from(contractVersion)
      .where(and(eq(contractVersion.id, parsedVersionId), eq(contractVersion.contractId, contractId)))
    if (!version) return apiError('Versie niet gevonden', 404)

    const body = await req.json()
    const parsed = createDocumentSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.flatten().formErrors.join(', ') || 'Ongeldige input', 400)

    const [created] = await db
      .insert(contractDocumentNode)
      .values({
        contractVersionId: parsedVersionId,
        docType: parsed.data.docType,
        title: parsed.data.title,
        sortOrder: parsed.data.sortOrder,
      })
      .returning()

    return apiSuccess(created, 201)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return apiError('Ongeldige input', 400)
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return apiError(message, 500)
  }
}
