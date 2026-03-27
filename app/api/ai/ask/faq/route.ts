import { NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { getTopAskClusters } from '@/lib/contract-ask-persist'

const DEFAULT_LIMIT = 5

export async function GET() {
  const user = await getOrCreateUser()
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const rows = await getTopAskClusters(user.orgId, DEFAULT_LIMIT)
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      label: r.canonicalQuestion,
      askCount: r.askCount,
    }))
  )
}
