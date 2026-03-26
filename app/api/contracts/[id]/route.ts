import { NextRequest } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db, contract, contractProject, project } from '@/lib/db'
import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { apiError, apiSuccess } from '@/lib/api-response'

const updateContractSchema = z.object({
  reference: z.string().min(1).optional(),
  contractType: z.string().min(1).optional(),
  status: z.string().min(1).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  projectIds: z.array(z.string().uuid()).min(1).optional(),
  role: z.string().optional().default('lead'),
  // Legacy compatibility
  title: z.string().optional(),
  contractNumber: z.string().optional(),
  projectId: z.string().uuid().optional(),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getOrCreateUser()
    if (!user) return apiError('Niet ingelogd', 401)

    const idParsed = z.string().uuid().safeParse(id)
    if (!idParsed.success) return apiError('Ongeldig contract-id', 400)

    const [row] = await db.select().from(contract).where(eq(contract.id, idParsed.data))
    if (!row) return apiError('Niet gevonden', 404)

    const links = await db
      .select()
      .from(contractProject)
      .where(eq(contractProject.contractId, row.id))

    return apiSuccess({ ...row, projects: links })
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
    const contractId = z.string().uuid().parse(id)
    const body = await req.json()
    const parsed = updateContractSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.flatten().formErrors.join(', ') || 'Ongeldige input', 400)

    const [existing] = await db.select().from(contract).where(eq(contract.id, contractId))
    if (!existing) return apiError('Niet gevonden', 404)

    const nextReference = parsed.data.reference ?? parsed.data.contractNumber ?? parsed.data.title
    const nextProjectIds = parsed.data.projectIds ?? (parsed.data.projectId ? [parsed.data.projectId] : undefined)

    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(contract)
        .set({
          ...(nextReference !== undefined ? { reference: nextReference } : {}),
          ...(parsed.data.contractType !== undefined ? { contractType: parsed.data.contractType } : {}),
          ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
          ...(parsed.data.startDate !== undefined ? { startDate: parsed.data.startDate } : {}),
          ...(parsed.data.endDate !== undefined ? { endDate: parsed.data.endDate } : {}),
        })
        .where(eq(contract.id, contractId))
        .returning()

      if (nextProjectIds && nextProjectIds.length > 0) {
        const uniqueProjectIds = [...new Set(nextProjectIds)]
        const existingProjects = await tx.select({ id: project.id }).from(project).where(inArray(project.id, uniqueProjectIds))
        if (existingProjects.length !== uniqueProjectIds.length) throw new Error('Een of meer projecten bestaan niet')

        await tx.delete(contractProject).where(eq(contractProject.contractId, contractId))
        await tx.insert(contractProject).values(
          uniqueProjectIds.map((projectId) => ({
            contractId,
            projectId,
            role: parsed.data.role ?? 'lead',
          }))
        )
      }

      return [row]
    })

    return apiSuccess(updated)
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
    const contractId = z.string().uuid().parse(id)

    const [deleted] = await db.delete(contract).where(eq(contract.id, contractId)).returning()
    if (!deleted) return apiError('Niet gevonden', 404)
    return apiSuccess(deleted)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return apiError('Ongeldige input', 400)
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return apiError(message, 500)
  }
}
