import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contracts } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { logAudit } from '@/lib/audit'
import { ensureDefaultProjectForOrg, requireProjectInOrg } from '@/lib/org'
import { canMutateContractData } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const all = await db.query.contracts.findMany({
      where: eq(contracts.orgId, user.orgId),
      orderBy: [desc(contracts.updatedAt)],
      with: { supplier: true, owner: true, project: true },
    })

    return NextResponse.json(all)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canMutateContractData(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })

    const body = await req.json()

    let projectId: string | null =
      typeof body.projectId === 'string' && body.projectId ? body.projectId : null
    if (!projectId) {
      projectId = await ensureDefaultProjectForOrg(user.orgId)
    } else {
      await requireProjectInOrg(projectId, user.orgId)
    }

    const [contract] = await db.insert(contracts).values({
      orgId: user.orgId,
      projectId,
      title: body.title,
      contractNumber: body.contractNumber || null,
      status: body.status ?? 'concept',
      contractType: body.contractType || null,
      supplierId: body.supplierId || null,
      ownerUserId: body.ownerUserId || user.id,
      startDate: body.startDate ? new Date(body.startDate) : null,
      endDate: body.endDate ? new Date(body.endDate) : null,
      optionDate: body.optionDate ? new Date(body.optionDate) : null,
      noticePeriodDays: body.noticePeriodDays ? parseInt(body.noticePeriodDays) : null,
      valueTotal: body.valueTotal || null,
      valueAnnual: body.valueAnnual || null,
      currency: body.currency ?? 'EUR',
      autoRenewal: body.autoRenewal ?? false,
      autoRenewalTerms: body.autoRenewalTerms || null,
      retentionYears: body.retentionYears ? parseInt(body.retentionYears) : null,
      createdBy: user.id,
      updatedAt: new Date(),
    }).returning()

    await logAudit({
      user,
      contractId: contract.id,
      action: 'contract.aangemaakt',
      newValue: { title: contract.title, status: contract.status },
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
    })

    // Also calculate destruction date if retention set
    if (contract.retentionYears && contract.endDate) {
      const destructionDate = new Date(contract.endDate)
      destructionDate.setFullYear(destructionDate.getFullYear() + contract.retentionYears)
      await db.update(contracts)
        .set({ destructionDate })
        .where(eq(contracts.id, contract.id))
    }

    return NextResponse.json(contract)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
