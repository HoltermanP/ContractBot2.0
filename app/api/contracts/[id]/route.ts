import { NextRequest } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db, contracts, projects } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { apiError, apiSuccess } from '@/lib/api-response'

const uuidLike = z.string().uuid()

function parseDateInput(v: unknown): Date | null {
  if (v == null || v === '') return null
  const s = String(v)
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

const updateBodySchema = z.object({
  reference: z.string().min(1).optional(),
  contractType: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  startDate: z.union([z.string(), z.null()]).optional(),
  endDate: z.union([z.string(), z.null()]).optional(),
  projectIds: z.array(z.string().uuid()).min(1).optional(),
  role: z.string().optional().default('lead'),
  title: z.string().optional(),
  contractNumber: z.string().optional(),
  projectId: z.string().uuid().optional(),
  supplierId: z.string().optional(),
  ownerUserId: z.string().optional(),
  optionDate: z.union([z.string(), z.null()]).optional(),
  noticePeriodDays: z.string().optional(),
  valueTotal: z.string().optional(),
  valueAnnual: z.string().optional(),
  currency: z.string().optional(),
  autoRenewal: z.boolean().optional(),
  autoRenewalTerms: z.string().optional(),
  retentionYears: z.string().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getOrCreateUser()
    if (!user) return apiError('Niet ingelogd', 401)

    const idParsed = uuidLike.safeParse(id)
    if (!idParsed.success) return apiError('Ongeldig contract-id', 400)

    const row = await db.query.contracts.findFirst({
      where: and(eq(contracts.id, idParsed.data), eq(contracts.orgId, user.orgId)),
      with: { project: true },
    })
    if (!row) return apiError('Niet gevonden', 404)

    const links = row.project
      ? [{ projectId: row.project.id, projectName: row.project.name, role: 'lead' as const }]
      : []

    return apiSuccess({
      ...row,
      reference: row.contractNumber?.trim() || row.title,
      projects: links,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return apiError(message, 500)
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getOrCreateUser()
    if (!user) return apiError('Niet ingelogd', 401)

    const { id } = await params
    const contractId = uuidLike.parse(id)
    const body = await req.json()
    const parsed = updateBodySchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.flatten().formErrors.join(', ') || 'Ongeldige input', 400)

    const existing = await db.query.contracts.findFirst({
      where: and(eq(contracts.id, contractId), eq(contracts.orgId, user.orgId)),
    })
    if (!existing) return apiError('Niet gevonden', 404)

    const d = parsed.data
    const nextProjectId = d.projectIds?.[0] ?? d.projectId
    if (nextProjectId) {
      const proj = await db.query.projects.findFirst({
        where: and(eq(projects.id, nextProjectId), eq(projects.orgId, user.orgId)),
      })
      if (!proj) return apiError('Project niet gevonden', 400)
    }

    const titleNext = d.title !== undefined ? d.title : existing.title
    const contractNumberNext = d.contractNumber !== undefined ? (d.contractNumber || null) : existing.contractNumber

    const notice =
      d.noticePeriodDays !== undefined
        ? d.noticePeriodDays.trim() === ''
          ? null
          : parseInt(d.noticePeriodDays, 10)
        : undefined
    const retention =
      d.retentionYears !== undefined
        ? d.retentionYears.trim() === ''
          ? null
          : parseInt(d.retentionYears, 10)
        : undefined

    const [updated] = await db
      .update(contracts)
      .set({
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.contractNumber !== undefined ? { contractNumber: d.contractNumber || null } : {}),
        ...(d.contractType !== undefined ? { contractType: d.contractType } : {}),
        ...(d.status !== undefined ? { status: d.status as (typeof contracts.$inferInsert)['status'] } : {}),
        ...(d.startDate !== undefined ? { startDate: parseDateInput(d.startDate) } : {}),
        ...(d.endDate !== undefined ? { endDate: parseDateInput(d.endDate) } : {}),
        ...(d.optionDate !== undefined ? { optionDate: parseDateInput(d.optionDate) } : {}),
        ...(notice !== undefined ? { noticePeriodDays: Number.isFinite(notice) ? notice : null } : {}),
        ...(d.valueTotal !== undefined ? { valueTotal: d.valueTotal.trim() === '' ? null : d.valueTotal } : {}),
        ...(d.valueAnnual !== undefined ? { valueAnnual: d.valueAnnual.trim() === '' ? null : d.valueAnnual } : {}),
        ...(d.currency !== undefined ? { currency: d.currency } : {}),
        ...(d.autoRenewal !== undefined ? { autoRenewal: d.autoRenewal } : {}),
        ...(d.autoRenewalTerms !== undefined ? { autoRenewalTerms: d.autoRenewalTerms || null } : {}),
        ...(retention !== undefined ? { retentionYears: Number.isFinite(retention) ? retention : null } : {}),
        ...(nextProjectId ? { projectId: nextProjectId } : {}),
        ...(d.supplierId !== undefined ? { supplierId: d.supplierId || null } : {}),
        ...(d.ownerUserId !== undefined ? { ownerUserId: d.ownerUserId || null } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(contracts.id, contractId), eq(contracts.orgId, user.orgId)))
      .returning()

    if (!updated) return apiError('Niet gevonden', 404)

    const withProject = await db.query.contracts.findFirst({
      where: eq(contracts.id, contractId),
      with: { project: true },
    })

    return apiSuccess({
      ...updated,
      title: titleNext,
      contractNumber: contractNumberNext,
      reference: contractNumberNext?.trim() || titleNext,
      projects: withProject?.project
        ? [{ projectId: withProject.project.id, projectName: withProject.project.name, role: 'lead' as const }]
        : [],
    })
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return apiError('Ongeldige input', 400)
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return apiError(message, 500)
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getOrCreateUser()
    if (!user) return apiError('Niet ingelogd', 401)

    const { id } = await params
    const contractId = uuidLike.parse(id)

    const [deleted] = await db
      .delete(contracts)
      .where(and(eq(contracts.id, contractId), eq(contracts.orgId, user.orgId)))
      .returning()
    if (!deleted) return apiError('Niet gevonden', 404)
    return apiSuccess(deleted)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return apiError('Ongeldige input', 400)
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return apiError(message, 500)
  }
}
