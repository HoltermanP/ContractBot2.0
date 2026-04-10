import { NextRequest } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db, project, projects } from '@/lib/db'
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

    const organisationId = req.nextUrl.searchParams.get('organisationId')
    const programmeId = req.nextUrl.searchParams.get('programmeId')

    if (organisationId ?? programmeId) {
      const parsed = querySchema.safeParse({
        organisationId: organisationId ?? undefined,
        programmeId: programmeId ?? undefined,
      })
      if (!parsed.success) return apiError(parsed.error.flatten().formErrors.join(', ') || 'Ongeldige query', 400)

      const { organisationId: oId, programmeId: pId } = parsed.data
      const whereClauses = []
      if (oId) whereClauses.push(eq(project.organisationId, oId))
      if (pId) whereClauses.push(eq(project.programmeId, pId))

      const list = await db
        .select()
        .from(project)
        .where(whereClauses.length ? and(...whereClauses) : undefined)

      return apiSuccess(list)
    }

    const list = await db.query.projects.findMany({
      where: eq(projects.orgId, user.orgId),
      orderBy: (p, { asc: ascFn }) => [ascFn(p.name)],
    })

    return apiSuccess(list)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fout'
    return apiError(message, 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return apiError('Niet ingelogd', 401)

    const body = await req.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return apiError('Projectnaam is verplicht', 400)
    const description = typeof body.description === 'string' ? body.description.trim() : null

    const [created] = await db
      .insert(projects)
      .values({ orgId: user.orgId, name, description: description || null })
      .returning()

    return apiSuccess(created)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fout'
    return apiError(message, 500)
  }
}
