import { getOrCreateUser } from '@/lib/auth'
import { db, organisation } from '@/lib/db'
import { apiError, apiSuccess } from '@/lib/api-response'

export async function GET() {
  try {
    const user = await getOrCreateUser()
    if (!user) return apiError('Niet ingelogd', 401)

    const rows = await db.select().from(organisation)

    return apiSuccess(rows)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return apiError(message, 500)
  }
}
