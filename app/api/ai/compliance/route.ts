import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contracts } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { openai } from '@/lib/openai'
import { loadContractCorpusPlainTextForAnalysis } from '@/lib/contract-corpus'

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const { contractId } = await req.json()
    if (!contractId) return NextResponse.json({ error: 'contractId verplicht' }, { status: 400 })

    const contract = await db.query.contracts.findFirst({
      where: and(eq(contracts.id, contractId), eq(contracts.orgId, user.orgId)),
    })
    if (!contract) return NextResponse.json({ error: 'Contract niet gevonden' }, { status: 404 })

    const text = await loadContractCorpusPlainTextForAnalysis(contractId)
    if (!text.trim()) return NextResponse.json({ error: 'Geen document beschikbaar voor analyse' }, { status: 400 })

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      user: `org_${user.orgId}`,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Je bent een compliance-expert gespecialiseerd in ISO 27001, AVG/GDPR en duurzaamheidsregelgeving voor overheidscontracten.
Analyseer het contract op naleving van relevante wet- en regelgeving. Antwoord ALLEEN in het Nederlands als JSON:
{
  "overallCompliance": "voldoet"|"gedeeltelijk"|"voldoet_niet"|"niet_van_toepassing",
  "score": number (0-100),
  "frameworks": [
    {
      "name": string,
      "status": "voldoet"|"gedeeltelijk"|"voldoet_niet"|"niet_van_toepassing",
      "score": number (0-100),
      "findings": [
        {
          "requirement": string,
          "status": "aanwezig"|"ontbreekt"|"onduidelijk",
          "description": string,
          "recommendation": string|null
        }
      ]
    }
  ],
  "summary": string,
  "criticalGaps": [string]
}

Evalueer minimaal de volgende frameworks indien relevant:
- AVG/GDPR (gegevensbescherming, verwerkersovereenkomst, bewaartermijnen)
- ISO 27001 (informatiebeveiliging, toegangscontrole, incidentbeheer)
- Duurzaamheid/MVO (CO2-reductie, sociale voorwaarden, circulair inkopen)`,
        },
        {
          role: 'user',
          content: `Analyseer dit contract op compliance:\n\nType: ${contract.contractType ?? 'onbekend'}\n\n${text.slice(0, 30000)}`,
        },
      ],
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('Geen respons van AI')
    return NextResponse.json(JSON.parse(content))
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
