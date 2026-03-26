import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { getOrCreateUser } from '@/lib/auth'
import { apiError, apiSuccess } from '@/lib/api-response'
import { db, contract, contractVersion } from '@/lib/db'

const createVersionSchema = z.object({
  versionNumber: z.number().int().positive(),
  label: z.string().optional().nullable(),
  validFrom: z.string().optional().nullable(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getOrCreateUser()
    if (!user) return apiError('Niet ingelogd', 401)

    const { id } = await params
    const contractId = z.string().uuid().parse(id)
    const body = await req.json()
    const parsed = createVersionSchema.safeParse(body)
    if (!parsed.success) return apiError(parsed.error.flatten().formErrors.join(', ') || 'Ongeldige input', 400)

    const [existing] = await db.select().from(contract).where(eq(contract.id, contractId))
    if (!existing) return apiError('Contract niet gevonden', 404)

    const created = await db.transaction(async (tx) => {
      await tx
        .update(contractVersion)
        .set({ isCurrent: false })
        .where(eq(contractVersion.contractId, contractId))

      const [row] = await tx
        .insert(contractVersion)
        .values({
          contractId,
          versionNumber: parsed.data.versionNumber,
          label: parsed.data.label ?? null,
          validFrom: parsed.data.validFrom ?? null,
          isCurrent: true,
        })
        .returning()

      return row
    })

    return apiSuccess(created, 201)
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return apiError('Ongeldige input', 400)
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return apiError(message, 500)
  }
}
