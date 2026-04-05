import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contracts, projects, contractInsightsAnalyses } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { loadContractTextBlocks } from '@/lib/contract-qa-context'
import { createClaudeJsonCompletion, CLAUDE_MODELS } from '@/lib/openai'

export type InsightPoint = {
  title: string
  explanation: string
  example: string
  articleRef?: string
}

export type ContractInsights = {
  contractId: string
  contractTitle: string
  projectName: string | null
  points: InsightPoint[]
  generatedAt: string
}

export type SavedInsightsAnalysis = {
  id: string
  contractId: string
  contractTitle: string
  projectName: string | null
  points: InsightPoint[]
  createdAt: string
}

const SYSTEM_PROMPT = `Je bent een gespecialiseerde contractjurist die praktijkgerichte uitleg geeft over contracten.
Analyseer de aangeleverde contracttekst en extraheer de 5 tot 8 meest praktijkgerichte en inhoudelijk belangrijkste punten.

Voor elk punt geef je:
- Een korte, duidelijke titel (max 8 woorden)
- Een heldere uitleg in gewone taal (2-4 zinnen), zonder juridisch jargon
- Een concreet, uitgewerkt praktijkvoorbeeld (situatie + wat dit in de praktijk betekent)
- Optioneel: een verwijzing naar het specifieke artikel of clausule in het contract

Focus op punten die direct praktische gevolgen hebben voor de dagelijkse uitvoering: betalingstermijnen,
aansprakelijkheid, opzegging, verplichtingen, boeteclausules, levering, garanties, etc.

Retourneer uitsluitend geldig JSON in dit formaat:
{
  "points": [
    {
      "title": "Titel van het punt",
      "explanation": "Uitleg in gewone taal",
      "example": "Concreet praktijkvoorbeeld",
      "articleRef": "Art. 5.2 (optioneel)"
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
        .select({
          id: contracts.id,
          title: contracts.title,
          status: contracts.status,
          projectId: contracts.projectId,
          projectName: projects.name,
        })
        .from(contracts)
        .leftJoin(projects, eq(contracts.projectId, projects.id))
        .where(eq(contracts.orgId, user.orgId))
        .orderBy(projects.name, contracts.title),

      db
        .select()
        .from(contractInsightsAnalyses)
        .where(eq(contractInsightsAnalyses.orgId, user.orgId))
        .orderBy(desc(contractInsightsAnalyses.createdAt))
        .limit(50),
    ])

    const saved: SavedInsightsAnalysis[] = savedRows.map((r) => ({
      id: r.id,
      contractId: r.contractId,
      contractTitle: r.contractTitle,
      projectName: r.projectName ?? null,
      points: (r.resultJson as { points?: InsightPoint[] })?.points ?? [],
      createdAt: r.createdAt.toISOString(),
    }))

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

    let projectName: string | null = null
    if (contract.projectId) {
      const proj = await db.query.projects.findFirst({ where: eq(projects.id, contract.projectId) })
      projectName = proj?.name ?? null
    }

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

    const result = await createClaudeJsonCompletion<{ points: InsightPoint[] }>({
      model: CLAUDE_MODELS.complexAnswer,
      system: SYSTEM_PROMPT,
      user: `Analyseer het volgende contract op praktijkgerichte punten:\n\nContract: "${contract.title}"${projectName ? ` (project: ${projectName})` : ''}\n\n${contextText.slice(0, 30_000)}`,
      maxTokens: 8192,
    })

    const points = Array.isArray(result.points) ? result.points : []

    // Sla op in database
    const [saved] = await db
      .insert(contractInsightsAnalyses)
      .values({
        orgId: user.orgId,
        contractId,
        contractTitle: contract.title,
        projectName,
        resultJson: { points },
        createdBy: user.id,
      })
      .returning()

    const payload: ContractInsights & { savedId: string } = {
      savedId: saved.id,
      contractId,
      contractTitle: contract.title,
      projectName,
      points,
      generatedAt: saved.createdAt.toISOString(),
    }

    return NextResponse.json(payload)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
