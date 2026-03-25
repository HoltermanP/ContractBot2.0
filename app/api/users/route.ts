import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { organizationMembers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { canManageUsers } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canManageUsers(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })

    const rows = await db.query.organizationMembers.findMany({
      where: eq(organizationMembers.orgId, user.orgId!),
      with: { user: true },
      orderBy: (m, { asc }) => [asc(m.createdAt)],
    })
    const all = rows
      .map((r) => (r.user ? { ...r.user, role: r.role } : null))
      .filter(Boolean)
    return NextResponse.json(all)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
