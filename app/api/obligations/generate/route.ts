import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contractObligations } from '@/lib/db/schema'

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const { contractId, obligations } = await req.json()

    const created = []
    for (const obl of obligations ?? []) {
      const [row] = await db.insert(contractObligations).values({
        contractId,
        description: obl.description,
        category: obl.category ?? 'other',
        dueDate: obl.due_date ? new Date(obl.due_date) : null,
        status: 'open',
        extractedByAi: true,
      }).returning()
      created.push(row)
    }

    return NextResponse.json({ created: created.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
