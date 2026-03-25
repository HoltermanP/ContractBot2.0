import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contracts, contractDocuments, notificationRules } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { openai } from '@/lib/openai'
import { pickDocumentWithAiExtract } from '@/lib/pick-contract-document'

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const { contractId } = await req.json()

    const contract = await db.query.contracts.findFirst({
      where: and(eq(contracts.id, contractId), eq(contracts.orgId, user.orgId)),
      with: { documents: true },
    })
    if (!contract) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    const doc = pickDocumentWithAiExtract((contract as any).documents)
    const extraction = doc?.aiExtractedDataJson

    if (!extraction) return NextResponse.json({ error: 'Geen AI-extractie beschikbaar' }, { status: 400 })

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      user: `org_${user.orgId}`,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Genereer notificatieregels op basis van contractgegevens. Antwoord in het Nederlands als JSON:
{
  "rules": [
    {
      "triggerType": "days_before_end"|"days_before_option"|"obligation_due"|"budget_threshold",
      "triggerValue": number,
      "channel": "both",
      "reason": string
    }
  ]
}`,
        },
        {
          role: 'user',
          content: `Contract: ${JSON.stringify({
            title: contract.title,
            end_date: contract.endDate,
            option_date: contract.optionDate,
            auto_renewal: contract.autoRenewal,
            notice_period_days: contract.noticePeriodDays,
            obligations: extraction.obligations?.length ?? 0,
            implicit_renewal_warning: extraction.implicit_renewal_warning,
          })}`,
        },
      ],
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('Geen respons')
    const { rules } = JSON.parse(content)

    let created = 0
    for (const rule of rules ?? []) {
      await db.insert(notificationRules).values({
        contractId,
        triggerType: rule.triggerType,
        triggerValue: rule.triggerValue,
        recipientsJson: [] as any,
        channel: rule.channel ?? 'both',
        active: true,
      })
      created++
    }

    return NextResponse.json({ created })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
