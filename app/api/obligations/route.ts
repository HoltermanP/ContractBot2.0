import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contractObligations } from '@/lib/db/schema'
import { canMutateContractData } from '@/lib/permissions'

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canMutateContractData(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })

    const body = await req.json()
    const [obl] = await db.insert(contractObligations).values({
      contractId: body.contractId,
      description: body.description,
      category: body.category ?? 'other',
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      recurring: body.recurring ?? false,
      status: 'open',
      extractedByAi: false,
    }).returning()

    return NextResponse.json(obl)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
