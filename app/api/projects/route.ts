import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db, projects } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { ensureDefaultProjectForOrg } from '@/lib/org'
import { canManageProjects } from '@/lib/permissions'

export async function GET() {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    await ensureDefaultProjectForOrg(user.orgId)

    const list = await db.query.projects.findMany({
      where: eq(projects.orgId, user.orgId),
      orderBy: (p, { asc }) => [asc(p.name)],
    })

    return NextResponse.json(list)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canManageProjects(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })

    const body = await req.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'Naam is verplicht' }, { status: 400 })
    const description = typeof body.description === 'string' ? body.description.trim() || null : null

    const [row] = await db
      .insert(projects)
      .values({ orgId: user.orgId, name, description })
      .returning()

    return NextResponse.json(row)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
