import { NextRequest } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db, project } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { apiError, apiSuccess } from '@/lib/api-response'

const querySchema = z.object({
  organisationId: z.string().uuid().optional(),
  programmeId: z.string().uuid().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return apiError('Niet ingelogd', 401)

    const parsed = querySchema.safeParse({
      organisationId: req.nextUrl.searchParams.get('organisationId') ?? undefined,
      programmeId: req.nextUrl.searchParams.get('programmeId') ?? undefined,
    })
    if (!parsed.success) return apiError(parsed.error.flatten().formErrors.join(', ') || 'Ongeldige query', 400)

    const { organisationId, programmeId } = parsed.data
    const whereClauses = []
    if (organisationId) whereClauses.push(eq(project.organisationId, organisationId))
    if (programmeId) whereClauses.push(eq(project.programmeId, programmeId))

    const list = await db
      .select()
      .from(project)
      .where(whereClauses.length ? and(...whereClauses) : undefined)

    return apiSuccess(list)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fout'
    return apiError(message, 500)
  }
}
