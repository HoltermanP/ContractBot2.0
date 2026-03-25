import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser, requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { contractAccess, contracts, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { logAudit } from '@/lib/audit'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    // Verify contract belongs to org
    const contract = await db.query.contracts.findFirst({
      where: and(eq(contracts.id, id), eq(contracts.orgId, user.orgId)),
      columns: { id: true },
    })
    if (!contract) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    const rules = await db.query.contractAccess.findMany({
      where: eq(contractAccess.contractId, id),
    })

    // Enrich with user names
    const userIds = rules.map(r => r.userId).filter(Boolean) as string[]
    let userMap: Record<string, string> = {}
    if (userIds.length > 0) {
      const dbUsers = await db.query.users.findMany({
        where: eq(users.orgId, user.orgId),
        columns: { id: true, name: true, email: true },
      })
      for (const u of dbUsers) userMap[u.id] = u.name
    }

    return NextResponse.json({
      rules: rules.map(r => ({
        ...r,
        userName: r.userId ? userMap[r.userId] : null,
      })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await requireRole('admin')

    const { userId, role, accessType } = await req.json()
    if (!userId && !role) return NextResponse.json({ error: 'userId of role verplicht' }, { status: 400 })

    const contract = await db.query.contracts.findFirst({
      where: and(eq(contracts.id, id), eq(contracts.orgId, user.orgId)),
      columns: { id: true },
    })
    if (!contract) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    const [rule] = await db.insert(contractAccess).values({
      orgId: user.orgId,
      contractId: id,
      userId: userId || null,
      role: role || null,
      accessType: accessType ?? 'allow',
      grantedBy: user.id,
    }).returning()

    await logAudit({ user, contractId: id, action: 'Toegangsregel aangemaakt', newValue: rule })

    return NextResponse.json(rule)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await requireRole('admin')
    const { ruleId } = await req.json()

    await db.delete(contractAccess).where(
      and(eq(contractAccess.id, ruleId), eq(contractAccess.orgId, user.orgId))
    )

    await logAudit({ user, contractId: id, action: 'Toegangsregel verwijderd', newValue: { ruleId } })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
