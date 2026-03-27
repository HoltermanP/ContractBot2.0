import { NextRequest } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db, contracts, projects } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { apiError, apiSuccess } from '@/lib/api-response'

const getQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
})

function parseDateInput(v: unknown): Date | null {
  if (v == null || v === '') return null
  const s = String(v)
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

const createBodySchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1),
  contractNumber: z.string().optional(),
  status: z.string().optional().default('concept'),
  contractType: z.string().optional(),
  supplierId: z.string().optional(),
  ownerUserId: z.string().optional(),
  startDate: z.union([z.string(), z.null()]).optional(),
  endDate: z.union([z.string(), z.null()]).optional(),
  optionDate: z.union([z.string(), z.null()]).optional(),
  noticePeriodDays: z.string().optional(),
  valueTotal: z.string().optional(),
  valueAnnual: z.string().optional(),
  currency: z.string().optional(),
  autoRenewal: z.boolean().optional(),
  autoRenewalTerms: z.string().optional(),
  retentionYears: z.string().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return apiError('Niet ingelogd', 401)

    const parsed = getQuerySchema.safeParse({
      projectId: req.nextUrl.searchParams.get('projectId') ?? undefined,
    })
    if (!parsed.success) return apiError(parsed.error.flatten().formErrors.join(', ') || 'Ongeldige query', 400)

    const whereClause = parsed.data.projectId
      ? and(eq(contracts.orgId, user.orgId), eq(contracts.projectId, parsed.data.projectId))
      : eq(contracts.orgId, user.orgId)

    const rows = await db.query.contracts.findMany({
      where: whereClause,
      with: { project: true },
      orderBy: (c, { desc }) => [desc(c.updatedAt)],
    })

    return apiSuccess(rows)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return apiError(message, 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return apiError('Niet ingelogd', 401)

    const body = await req.json()
    const parsed = createBodySchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.flatten().formErrors.join(', ') || 'Ongeldige input', 400)

    const d = parsed.data

    const proj = await db.query.projects.findFirst({
      where: and(eq(projects.id, d.projectId), eq(projects.orgId, user.orgId)),
    })
    if (!proj) return apiError('Project niet gevonden', 400)

    const notice =
      d.noticePeriodDays && d.noticePeriodDays.trim() !== '' ? parseInt(d.noticePeriodDays, 10) : null
    const retention =
      d.retentionYears && d.retentionYears.trim() !== '' ? parseInt(d.retentionYears, 10) : 7

    const [created] = await db
      .insert(contracts)
      .values({
        orgId: user.orgId,
        projectId: d.projectId,
        title: d.title,
        contractNumber: d.contractNumber?.trim() || null,
        status: (d.status ?? 'concept') as (typeof contracts.$inferInsert)['status'],
        contractType: d.contractType?.trim() || null,
        supplierId: d.supplierId?.trim() || null,
        ownerUserId: d.ownerUserId?.trim() || user.id,
        startDate: parseDateInput(d.startDate),
        endDate: parseDateInput(d.endDate),
        optionDate: parseDateInput(d.optionDate),
        noticePeriodDays: Number.isFinite(notice) ? notice : null,
        valueTotal: d.valueTotal?.trim() || null,
        valueAnnual: d.valueAnnual?.trim() || null,
        currency: d.currency?.trim() || 'EUR',
        autoRenewal: d.autoRenewal ?? false,
        autoRenewalTerms: d.autoRenewalTerms?.trim() || null,
        retentionYears: Number.isFinite(retention) ? retention : 7,
        createdBy: user.id,
        updatedAt: new Date(),
      })
      .returning()

    return apiSuccess(created, 201)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return apiError(message, 500)
  }
}
