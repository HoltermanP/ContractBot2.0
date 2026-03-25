import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notificationRules } from '@/lib/db/schema'
import { canMutateContractData } from '@/lib/permissions'

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canMutateContractData(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })

    const body = await req.json()
    const [rule] = await db.insert(notificationRules).values({
      contractId: body.contractId,
      triggerType: body.triggerType,
      triggerValue: body.triggerValue ?? null,
      recipientsJson: body.recipientsJson ?? [],
      channel: body.channel ?? 'both',
      active: true,
    }).returning()

    return NextResponse.json(rule)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
