import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { organizationMembers, users } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json()
    const orgId = typeof body.orgId === 'string' ? body.orgId : ''
    if (!orgId) return NextResponse.json({ error: 'orgId ontbreekt' }, { status: 400 })

    const membership = await db.query.organizationMembers.findFirst({
      where: and(eq(organizationMembers.userId, user.id), eq(organizationMembers.orgId, orgId)),
    })
    if (!membership) {
      return NextResponse.json({ error: 'Geen lidmaatschap voor deze organisatie' }, { status: 403 })
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
