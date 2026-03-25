import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db, projects } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { canManageProjects } from '@/lib/permissions'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const row = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.orgId, user.orgId)),
      with: {
        contracts: {
          orderBy: (c, { desc }) => [desc(c.updatedAt)],
          with: { supplier: true, owner: true },
        },
      },
    })

    if (!row) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    return NextResponse.json(row)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canManageProjects(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })

    const existing = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.orgId, user.orgId)),
    })
    if (!existing) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    const body = await req.json()
    const name = typeof body.name === 'string' ? body.name.trim() : undefined
    const description =
      body.description === undefined
        ? undefined
        : typeof body.description === 'string'
          ? body.description.trim() || null
          : null

    const [updated] = await db
      .update(projects)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
      })
      .where(eq(projects.id, id))
      .returning()

    return NextResponse.json(updated)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
