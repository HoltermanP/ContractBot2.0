import { NextRequest, NextResponse } from 'next/server'
import { ensureOrgMembership, getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { organizationMembers, organizations, users } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json()
    const orgId = typeof body.orgId === 'string' ? body.orgId : ''
    if (!orgId) return NextResponse.json({ error: 'orgId ontbreekt' }, { status: 400 })

    let membership = await db.query.organizationMembers.findFirst({
      where: and(eq(organizationMembers.userId, user.id), eq(organizationMembers.orgId, orgId)),
    })

    if (!membership) {
      if (user.role !== 'admin') {
        return NextResponse.json({ error: 'Geen lidmaatschap voor deze organisatie' }, { status: 403 })
      }
      const org = await db.query.organizations.findFirst({
        where: eq(organizations.id, orgId),
      })
      if (!org) {
        return NextResponse.json({ error: 'Organisatie niet gevonden' }, { status: 404 })
      }
      await ensureOrgMembership(user.id, orgId, 'admin')
      membership = await db.query.organizationMembers.findFirst({
        where: and(eq(organizationMembers.userId, user.id), eq(organizationMembers.orgId, orgId)),
      })
      if (!membership) {
        return NextResponse.json({ error: 'Lidmaatschap aanmaken mislukt' }, { status: 500 })
      }
    }

    await db
      .update(users)
      .set({ orgId: membership.orgId, role: membership.role })
      .where(eq(users.id, user.id))

    return NextResponse.json({ ok: true, orgId: membership.orgId, role: membership.role })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
