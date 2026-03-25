import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { organizationMembers, users } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import type { UserRole } from '@/lib/auth'
import { canManageUsers } from '@/lib/permissions'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (user.orgId !== orgId) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    if (!canManageUsers(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })

    const rows = await db.query.organizationMembers.findMany({
      where: eq(organizationMembers.orgId, orgId),
      with: { user: true },
      orderBy: (m, { asc }) => [asc(m.createdAt)],
    })

    return NextResponse.json(
      rows.map((r) => ({
        membershipId: r.id,
        userId: r.userId,
        role: r.role,
        name: r.user?.name ?? '',
        email: r.user?.email ?? '',
        createdAt: r.createdAt,
      }))
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ orgId: string }> }) {
  try {
    const { orgId } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (user.orgId !== orgId) return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    if (!canManageUsers(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })

    const body = await req.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const role = body.role as UserRole
    const validRoles: UserRole[] = ['admin', 'manager', 'registrator', 'compliance', 'reader']
    if (!email || !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Geldig e-mailadres en rol zijn verplicht' }, { status: 400 })
    }

    const target = await db.query.users.findFirst({ where: eq(users.email, email) })
    if (!target) {
      return NextResponse.json(
        { error: 'Geen gebruiker met dit e-mailadres. De persoon moet eerst eenmaal inloggen.' },
        { status: 404 }
      )
    }

    const existing = await db.query.organizationMembers.findFirst({
      where: and(eq(organizationMembers.userId, target.id), eq(organizationMembers.orgId, orgId)),
    })
    if (existing) {
      return NextResponse.json({ error: 'Gebruiker is al lid van deze organisatie' }, { status: 409 })
    }

    await db.insert(organizationMembers).values({ userId: target.id, orgId, role })

    if (target.orgId === orgId) {
      await db.update(users).set({ role }).where(eq(users.id, target.id))
    }

    return NextResponse.json({ ok: true, userId: target.id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
