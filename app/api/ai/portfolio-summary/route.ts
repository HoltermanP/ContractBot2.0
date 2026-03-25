import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contracts, contractObligations } from '@/lib/db/schema'
import { eq, and, lt, gte } from 'drizzle-orm'
import { openai } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const { period } = await req.json() // 'q1', 'q2', 'q3', 'q4', 'year', or 'current'

    const now = new Date()
    const allContracts = await db.query.contracts.findMany({
      where: eq(contracts.orgId, user.orgId),
      with: {
        supplier: { columns: { name: true } },
        obligations: true,
      },
    })

    const activeContracts = allContracts.filter(c => c.status === 'actief')
    const in90 = new Date(now.getTime() + 90 * 86400000)
    const expiringContracts = activeContracts.filter(c => c.endDate && new Date(c.endDate) <= in90)

    const allObligations = allContracts.flatMap(c => (c as any).obligations ?? [])
    const nonCompliant = allObligations.filter((o: any) => o.status === 'non_compliant')
    const open = allObligations.filter((o: any) => o.status === 'open')

    const totalValue = activeContracts.reduce((sum, c) => sum + Number(c.valueAnnual ?? 0), 0)

    const portfolioData = {
      totaalContracten: allContracts.length,
      actieveContracten: activeContracts.length,
      verlopen: allContracts.filter(c => c.status === 'verlopen').length,
      gearchiveerd: allContracts.filter(c => c.status === 'gearchiveerd').length,
      verlooptBinnenkort: expiringContracts.length,
      totaleJaarwaarde: totalValue,
      nietConformeVerplichtingen: nonCompliant.length,
      openVerplichtingen: open.length,
      expiringList: expiringContracts.slice(0, 5).map(c => ({
        naam: c.title,
        einddatum: c.endDate ? new Date(c.endDate).toLocaleDateString('nl-NL') : 'onbekend',
        leverancier: (c as any).supplier?.name ?? 'onbekend',
      })),
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      user: `org_${user.orgId}`,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Je bent een contractmanagement consultant. Maak een managementsamenvatting van het contractportfolio op basis van de aangeleverde statistieken.
Antwoord in het Nederlands als JSON:
{
  "samenvatting": string (3-5 zinnen managementsamenvatting),
  "hoogtepunten": [string] (max 5 positieve punten),
  "aandachtspunten": [string] (max 5 risico's of actiepunten),
  "aanbevelingen": [string] (max 3 concrete aanbevelingen),
  "risicoprofiel": "laag"|"middel"|"hoog"
}`,
        },
        {
          role: 'user',
          content: `Maak een samenvatting van dit contractportfolio:\n${JSON.stringify(portfolioData, null, 2)}`,
        },
      ],
    })

    const content = response.choices[0]?.message?.content
    if (!content) throw new Error('Geen respons van AI')
    const summary = JSON.parse(content)
    return NextResponse.json({ ...summary, stats: portfolioData })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
