import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { getLatestTurnForCluster, type ContractAskResponsePayload } from '@/lib/contract-ask-persist'

function isPayload(v: unknown): v is ContractAskResponsePayload {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return typeof o.answer === 'string' && Array.isArray(o.sources)
}

export async function GET(_req: NextRequest, context: { params: Promise<{ clusterId: string }> }) {
  const user = await getOrCreateUser()
  if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

  const { clusterId } = await context.params
  if (!clusterId || typeof clusterId !== 'string') {
    return NextResponse.json({ error: 'Ongeldige cluster' }, { status: 400 })
  }

  const turn = await getLatestTurnForCluster(user.orgId, clusterId)
  if (!turn) {
    return NextResponse.json({ error: 'Geen opgeslagen antwoord' }, { status: 404 })
  }

  const raw = turn.responsePayload
  if (!isPayload(raw)) {
    return NextResponse.json({ error: 'Ongeldige data' }, { status: 500 })
  }

  return NextResponse.json({
    questionText: turn.questionRaw,
    response: raw,
  })
}
