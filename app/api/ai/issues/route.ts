import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contracts, contractIssuesAnalyses } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { loadContractTextBlocks } from '@/lib/contract-qa-context'
import { createClaudeJsonCompletion, CLAUDE_MODELS } from '@/lib/openai'

export type ContractIssue = {
  type: 'onduidelijkheid' | 'tegenstrijdigheid' | 'vaagheid' | 'leemte'
  severity: 'hoog' | 'middel' | 'laag'
  title: string
  description: string
  excerpt?: string
  articleRef?: string
  suggestion?: string
}

export type ContractIssuesResult = {
  contractId: string
  contractTitle: string
  issues: ContractIssue[]
  summary: string
  generatedAt: string
}

export type SavedIssuesAnalysis = {
  id: string
  contractId: string
  contractTitle: string
  issues: ContractIssue[]
  summary: string
  issueCount: number
  createdAt: string
}

const SYSTEM_PROMPT = `Je bent een gespecialiseerde contractjurist die contracten beoordeelt op juridische kwaliteit.
Analyseer de aangeleverde contracttekst op de volgende problemen:

1. **Onduidelijkheden** – zinnen of bepalingen die op meerdere manieren uitgelegd kunnen worden
2. **Tegenstrijdigheden** – clausules die conflicteren met andere bepalingen in het contract
3. **Vaagheden** – onvoldoende specifieke of meetbare verplichtingen ("redelijke termijn", "naar behoren", etc.)
4. **Leemten** – ontbrekende maar juridisch noodzakelijke bepalingen (bijv. geen geschillenregeling, geen aansprakelijkheidslimiet)

Voor elk gevonden probleem geef je:
- Type (onduidelijkheid/tegenstrijdigheid/vaagheid/leemte)
- Ernst (hoog/middel/laag)
- Een korte titel (max 8 woorden)
- Een beschrijving van het probleem (2-3 zinnen)
- Optioneel: een letterlijk tekstfragment als voorbeeld (excerpt)
- Optioneel: verwijzing naar artikel/clausule
- Een concrete suggestie voor verbetering

Geef ook een korte samenvatting van de algehele contractkwaliteit (2-3 zinnen).

Retourneer uitsluitend geldig JSON in dit formaat:
{
  "summary": "Algehele beoordeling van de contractkwaliteit",
  "issues": [
    {
      "type": "onduidelijkheid",
      "severity": "hoog",
      "title": "Titel van het probleem",
      "description": "Beschrijving van het probleem",
      "excerpt": "Letterlijk citaat uit het contract (optioneel)",
      "articleRef": "Art. 3.1 (optioneel)",
      "suggestion": "Aanbeveling voor verbetering"
    }
  ]
}`

/** GET: contractenlijst + opgeslagen analyses */
export async function GET() {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const [contractRows, savedRows] = await Promise.all([
      db
        .select({ id: contracts.id, title: contracts.title, status: contracts.status, projectId: contracts.projectId })
        .from(contracts)
        .where(eq(contracts.orgId, user.orgId))
        .orderBy(contracts.title),

      db
        .select()
        .from(contractIssuesAnalyses)
        .where(eq(contractIssuesAnalyses.orgId, user.orgId))
        .orderBy(desc(contractIssuesAnalyses.createdAt))
        .limit(50),
    ])

    const saved: SavedIssuesAnalysis[] = savedRows.map((r) => {
      const json = r.resultJson as { summary?: string; issues?: ContractIssue[] }
      return {
        id: r.id,
        contractId: r.contractId,
        contractTitle: r.contractTitle,
        issues: json?.issues ?? [],
        summary: json?.summary ?? '',
        issueCount: r.issueCount,
        createdAt: r.createdAt.toISOString(),
      }
    })

    return NextResponse.json({
      contracts: contractRows.filter((c) => c.status !== 'verwijderd'),
      saved,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** POST: genereer en sla op */
export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json()
    const contractId = typeof body.contractId === 'string' ? body.contractId.trim() : null
    if (!contractId) return NextResponse.json({ error: 'contractId vereist' }, { status: 400 })

    const contract = await db.query.contracts.findFirst({
      where: and(eq(contracts.id, contractId), eq(contracts.orgId, user.orgId)),
    })
    if (!contract) return NextResponse.json({ error: 'Contract niet gevonden' }, { status: 404 })

    const blocks = await loadContractTextBlocks(user.orgId, [contractId])
    if (blocks.length === 0) {
      return NextResponse.json(
        { error: 'Geen contractdocumenten gevonden. Upload eerst PDF- of DOCX-bestanden bij dit contract.' },
        { status: 400 }
      )
    }

    const contextText = blocks
      .map((b) => `--- ${b.kind === 'addendum' ? 'Addendum' : 'Contract'}: ${b.title} (${b.detail}) ---\n${b.text}`)
      .join('\n\n')

    const result = await createClaudeJsonCompletion<{ summary: string; issues: ContractIssue[] }>({
      model: CLAUDE_MODELS.complexAnswer,
      system: SYSTEM_PROMPT,
      user: `Analyseer het volgende contract op juridische kwaliteitsproblemen:\n\nContract: "${contract.title}"\n\n${contextText.slice(0, 30_000)}`,
      maxTokens: 8192,
    })

    const issues = Array.isArray(result.issues) ? result.issues : []
    const summary = typeof result.summary === 'string' ? result.summary : ''

    // Sla op in database
    const [saved] = await db
      .insert(contractIssuesAnalyses)
      .values({
        orgId: user.orgId,
        contractId,
        contractTitle: contract.title,
        resultJson: { summary, issues },
        issueCount: issues.length,
        createdBy: user.id,
      })
      .returning()

    const payload: ContractIssuesResult & { savedId: string } = {
      savedId: saved.id,
      contractId,
      contractTitle: contract.title,
      issues,
      summary,
      generatedAt: saved.createdAt.toISOString(),
    }

    return NextResponse.json(payload)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
