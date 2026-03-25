import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { compareContracts } from '@/lib/openai'
import { loadContractCorpusPlainTextForAnalysis } from '@/lib/contract-corpus'

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const { contractId1, contractId2 } = await req.json()

    async function getCorpusText(contractId: string): Promise<string> {
      const text = await loadContractCorpusPlainTextForAnalysis(contractId)
      if (!text.trim()) throw new Error(`Geen document voor contract ${contractId}`)
      return text
    }

    const [text1, text2] = await Promise.all([getCorpusText(contractId1), getCorpusText(contractId2)])
    const comparison = await compareContracts(text1, text2, user.orgId)

    return NextResponse.json(comparison)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
