import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contracts } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { analyzeContractRisk } from '@/lib/openai'
import { loadContractCorpusPlainTextForAnalysis } from '@/lib/contract-corpus'

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const { contractId } = await req.json()

    const contract = await db.query.contracts.findFirst({
      where: and(eq(contracts.id, contractId), eq(contracts.orgId, user.orgId)),
    })
    if (!contract) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    const text = await loadContractCorpusPlainTextForAnalysis(contractId)
    if (!text.trim()) return NextResponse.json({ error: 'Geen document gevonden' }, { status: 404 })

    const analysis = await analyzeContractRisk(text, user.orgId)
    return NextResponse.json(analysis)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
