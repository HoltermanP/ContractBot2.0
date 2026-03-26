import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db, project, contractProject, contract } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { canManageProjects } from '@/lib/permissions'
import { z } from 'zod'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const orgId = z.string().uuid().safeParse(user.orgId)
    if (!orgId.success) return NextResponse.json({ error: 'Ongeldige organisatiecontext' }, { status: 400 })

    const row = await db.query.project.findFirst({
      where: and(eq(project.id, id), eq(project.organisationId, orgId.data)),
    })

    if (!row) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    const links = await db
      .select({ role: contractProject.role, contract })
      .from(contractProject)
      .innerJoin(contract, eq(contract.id, contractProject.contractId))
      .where(eq(contractProject.projectId, row.id))

    return NextResponse.json({ ...row, contracts: links })
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
    const orgId = z.string().uuid().safeParse(user.orgId)
    if (!orgId.success) return NextResponse.json({ error: 'Ongeldige organisatiecontext' }, { status: 400 })

    const existing = await db.query.project.findFirst({
      where: and(eq(project.id, id), eq(project.organisationId, orgId.data)),
    })
    if (!existing) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    const body = await req.json()
    const name = typeof body.name === 'string' ? body.name.trim() : undefined
    const status = typeof body.status === 'string' && body.status.trim() ? body.status.trim() : undefined

    const [updated] = await db
      .update(project)
      .set({
        ...(name !== undefined ? { name } : {}),
        ...(status !== undefined ? { status } : {}),
      })
      .where(eq(project.id, id))
      .returning()

    return NextResponse.json(updated)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
