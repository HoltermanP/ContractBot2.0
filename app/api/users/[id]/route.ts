import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { users, organizationMembers } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { logAudit } from '@/lib/audit'
import { canManageUsers } from '@/lib/permissions'
import type { UserRole } from '@/lib/auth'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canManageUsers(user.role)) return NextResponse.json({ error: 'Alleen admins' }, { status: 403 })

    const membership = await db.query.organizationMembers.findFirst({
      where: and(eq(organizationMembers.userId, id), eq(organizationMembers.orgId, user.orgId)),
    })
    if (!membership) return NextResponse.json({ error: 'Gebruiker niet in deze organisatie' }, { status: 404 })

    const body = await req.json()
    const newRole = body.role as UserRole

    await db
      .update(organizationMembers)
      .set({ role: newRole })
      .where(eq(organizationMembers.id, membership.id))

    const target = await db.query.users.findFirst({ where: eq(users.id, id) })
    const patch: { name: string; role?: UserRole } = { name: body.name }
    if (target?.orgId === user.orgId) patch.role = newRole

    const [updated] = await db.update(users).set(patch).where(eq(users.id, id)).returning()

    await logAudit({
      user,
      action: 'gebruiker.rol_gewijzigd',
      newValue: { userId: id, role: newRole, orgId: user.orgId },
    })

    return NextResponse.json(updated)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
