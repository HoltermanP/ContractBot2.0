import { NextRequest } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db, contract, contractProject, project } from '@/lib/db'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { apiError, apiSuccess } from '@/lib/api-response'

const getQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
})

const createContractSchema = z.object({
  reference: z.string().min(1),
  contractType: z.string().min(1),
  status: z.string().optional().default('concept'),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  projectIds: z.array(z.string().uuid()).min(1),
  role: z.string().optional().default('lead'),
})

const legacyCreateContractSchema = z.object({
  title: z.string().optional(),
  contractNumber: z.string().optional(),
  contractType: z.string().optional(),
  status: z.string().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  projectId: z.string().uuid().optional(),
})

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return apiError('Niet ingelogd', 401)

    const parsed = getQuerySchema.safeParse({
      projectId: req.nextUrl.searchParams.get('projectId') ?? undefined,
    })
    if (!parsed.success) return apiError(parsed.error.flatten().formErrors.join(', ') || 'Ongeldige query', 400)

    if (parsed.data.projectId) {
      const rows = await db
        .select({
          contract,
          projectId: contractProject.projectId,
          role: contractProject.role,
        })
        .from(contractProject)
        .innerJoin(contract, eq(contract.id, contractProject.contractId))
        .where(eq(contractProject.projectId, parsed.data.projectId))
      return apiSuccess(rows)
    }

    const rows = await db.select().from(contract)
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
    let payload: z.infer<typeof createContractSchema>
    const parsedNew = createContractSchema.safeParse(body)
    if (parsedNew.success) {
      payload = parsedNew.data
    } else {
      const parsedLegacy = legacyCreateContractSchema.safeParse(body)
      if (!parsedLegacy.success) {
        return apiError(
          parsedNew.error.flatten().formErrors.join(', ') ||
            parsedLegacy.error.flatten().formErrors.join(', ') ||
            'Ongeldige input',
          400
        )
      }

      const legacy = parsedLegacy.data
      const legacyProjectIds = legacy.projectId ? [legacy.projectId] : []
      if (legacyProjectIds.length === 0) return apiError('projectId ontbreekt', 400)

      payload = {
        reference: (legacy.contractNumber?.trim() || legacy.title?.trim() || `legacy-${crypto.randomUUID().slice(0, 8)}`)!,
        contractType: (legacy.contractType?.trim() || 'legacy')!,
        status: legacy.status?.trim() || 'concept',
        startDate: legacy.startDate ?? null,
        endDate: legacy.endDate ?? null,
        projectIds: legacyProjectIds,
        role: 'lead',
      }
    }

    const uniqueProjectIds = [...new Set(payload.projectIds)]
    const linkedProjects = await db.select({ id: project.id }).from(project).where(inArray(project.id, uniqueProjectIds))
    const linkedProjectSet = new Set(linkedProjects.map((row) => row.id))
    const missingProjects = uniqueProjectIds.filter((id) => !linkedProjectSet.has(id))
    if (missingProjects.length > 0) return apiError('Een of meer projecten bestaan niet', 400)

    const [newContract] = await db
      .insert(contract)
      .values({
        reference: payload.reference,
        contractType: payload.contractType,
        status: payload.status,
        startDate: payload.startDate ?? null,
        endDate: payload.endDate ?? null,
      })
      .returning()

    await db.insert(contractProject).values(
      uniqueProjectIds.map((projectId) => ({
        contractId: newContract.id,
        projectId,
        role: payload.role,
      }))
    )

    return apiSuccess(newContract, 201)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return apiError(message, 500)
  }
}
