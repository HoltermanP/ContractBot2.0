import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contracts } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { logAudit } from '@/lib/audit'
import { requireProjectInOrg } from '@/lib/org'
import { canDeleteContract, canMutateContractData, canViewArchivedContracts } from '@/lib/permissions'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const contract = await db.query.contracts.findFirst({
      where: and(eq(contracts.id, id), eq(contracts.orgId, user.orgId)),
      with: { supplier: true, owner: true, documents: true, obligations: true, project: true },
    })

    if (!contract) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    if (!canViewArchivedContracts(user.role) && contract.status === 'gearchiveerd') {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    return NextResponse.json(contract)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canMutateContractData(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })

    const existing = await db.query.contracts.findFirst({
      where: and(eq(contracts.id, id), eq(contracts.orgId, user.orgId)),
    })
    if (!existing) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    const body = await req.json()
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (body.title !== undefined) updates.title = body.title
    if (body.contractNumber !== undefined) updates.contractNumber = body.contractNumber || null
    if (body.status !== undefined) updates.status = body.status
    if (body.contractType !== undefined) updates.contractType = body.contractType || null
    if (body.supplierId !== undefined) updates.supplierId = body.supplierId || null
    if (body.ownerUserId !== undefined) updates.ownerUserId = body.ownerUserId || null
    if (body.startDate !== undefined) updates.startDate = body.startDate ? new Date(body.startDate) : null
    if (body.endDate !== undefined) updates.endDate = body.endDate ? new Date(body.endDate) : null
    if (body.optionDate !== undefined) updates.optionDate = body.optionDate ? new Date(body.optionDate) : null
    if (body.noticePeriodDays !== undefined) updates.noticePeriodDays = body.noticePeriodDays ? parseInt(body.noticePeriodDays) : null
    if (body.valueTotal !== undefined) updates.valueTotal = body.valueTotal || null
    if (body.valueAnnual !== undefined) updates.valueAnnual = body.valueAnnual || null
    if (body.currency !== undefined) updates.currency = body.currency
    if (body.autoRenewal !== undefined) updates.autoRenewal = body.autoRenewal
    if (body.autoRenewalTerms !== undefined) updates.autoRenewalTerms = body.autoRenewalTerms || null
    if (body.retentionYears !== undefined) updates.retentionYears = body.retentionYears ? parseInt(body.retentionYears) : null
    if (body.projectId !== undefined) {
      if (body.projectId === null || body.projectId === '') {
        updates.projectId = null
      } else if (typeof body.projectId === 'string') {
        await requireProjectInOrg(body.projectId, user.orgId)
        updates.projectId = body.projectId
      }
    }

    const [updated] = await db.update(contracts).set(updates as any).where(eq(contracts.id, id)).returning()

    await logAudit({
      user,
      contractId: id,
      action: 'contract.bijgewerkt',
      oldValue: existing,
      newValue: updates,
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json(updated)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canDeleteContract(user.role)) return NextResponse.json({ error: 'Alleen admins kunnen verwijderen' }, { status: 403 })

    const existing = await db.query.contracts.findFirst({
      where: and(eq(contracts.id, id), eq(contracts.orgId, user.orgId)),
    })
    if (!existing) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    await db.update(contracts).set({ status: 'verwijderd', updatedAt: new Date() }).where(eq(contracts.id, id))

    await logAudit({
      user,
      contractId: id,
      action: 'contract.verwijderd',
      oldValue: { title: existing.title, status: existing.status },
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
