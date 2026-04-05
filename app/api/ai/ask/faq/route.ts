import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { getTopAskClusters } from '@/lib/contract-ask-persist'

const DEFAULT_LIMIT = 5
const MAX_LIMIT = 10

export async function GET(req: NextRequest) {
  const user = await getOrCreateUser()
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const limitParam = req.nextUrl.searchParams.get('limit')
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(limitParam ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT))

  const rows = await getTopAskClusters(user.orgId, limit)
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      label: r.canonicalQuestion,
      askCount: r.askCount,
    }))
  )
}
