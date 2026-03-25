import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notificationRules } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { canMutateContractData } from '@/lib/permissions'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canMutateContractData(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })

    const body = await req.json()
    const [updated] = await db.update(notificationRules).set({
      triggerValue: body.triggerValue,
      recipientsJson: body.recipientsJson,
      channel: body.channel,
      active: body.active,
    }).where(eq(notificationRules.id, id)).returning()

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

    await db.delete(notificationRules).where(eq(notificationRules.id, id))
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
