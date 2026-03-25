import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contracts } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { logAudit } from '@/lib/audit'
import { canArchiveOrUnarchiveContract } from '@/lib/permissions'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canArchiveOrUnarchiveContract(user.role)) {
      return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })
    }

    const existing = await db.query.contracts.findFirst({
      where: and(eq(contracts.id, id), eq(contracts.orgId, user.orgId)),
    })
    if (!existing) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    await db.update(contracts).set({
      status: 'gearchiveerd',
      archivedAt: new Date(),
      archivedBy: user.id,
      updatedAt: new Date(),
    }).where(eq(contracts.id, id))

    await logAudit({
      user,
      contractId: id,
      action: 'contract.gearchiveerd',
      oldValue: { status: existing.status },
      newValue: { status: 'gearchiveerd' },
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
