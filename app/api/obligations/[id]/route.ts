import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contractObligations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { canMutateContractData } from '@/lib/permissions'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canMutateContractData(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })

    const body = await req.json()
    const updates: Record<string, unknown> = {}
    if (body.status) updates.status = body.status
    if (body.description) updates.description = body.description
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate ? new Date(body.dueDate) : null

    const [updated] = await db.update(contractObligations).set(updates as any).where(eq(contractObligations.id, id)).returning()
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
    if (!canMutateContractData(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })

    await db.delete(contractObligations).where(eq(contractObligations.id, id))
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
