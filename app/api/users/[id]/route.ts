import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { users, organizationMembers } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { logAudit } from '@/lib/audit'
import { canManageUsers, canAssignSuperAdmin } from '@/lib/permissions'
import { APP_USER_ROLES, type UserRole } from '@/lib/auth'

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

    const targetUser = await db.query.users.findFirst({ where: eq(users.id, id) })
    if (targetUser?.role === 'super_admin' && !canAssignSuperAdmin(user.role)) {
      return NextResponse.json({ error: 'Alleen super-admin kan een super-admin wijzigen' }, { status: 403 })
    }

    const body = await req.json()
    const newRole = body.role as UserRole

    if (!APP_USER_ROLES.includes(newRole)) {
      return NextResponse.json({ error: 'Ongeldige rol' }, { status: 400 })
    }
    if (newRole === 'super_admin' && !canAssignSuperAdmin(user.role)) {
      return NextResponse.json({ error: 'Alleen super-admin kan deze rol toekennen' }, { status: 403 })
    }

    await db
      .update(organizationMembers)
      .set({ role: newRole })
      .where(eq(organizationMembers.id, membership.id))

    const patch: { name: string; role?: UserRole } = { name: body.name }
    if (targetUser?.orgId === user.orgId) patch.role = newRole

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
