import { and, desc, eq, sql } from 'drizzle-orm'
import { db, contractAskClusters, contractAskTurns } from '@/lib/db'
import { createClaudeJsonCompletion, CLAUDE_MODELS } from '@/lib/openai'

/** Volledige API-response zoals opgeslagen en teruggegeven aan de client */
export type ContractAskResponsePayload = {
  answer: string
  sources: {
    type: string
    title: string
    detail: string
    relevance: string
    href?: string | null
    openInBrowser?: boolean
  }[]
  limitations: string | null
  followUpQuestions?: string[]
  contextSummary?: {
    contractsUsed: { id: string; title: string; detail: string }[]
    urlsUsed: { url: string }[]
  }
}

const MAX_CLUSTERS_FOR_AI = 100

type ClusterMatchAi = {
  matchedClusterId: string | null
  newClusterCanonicalQuestion: string | null
  refinedCanonicalQuestion?: string | null
}

function truncate(s: string, max: number) {
  const t = s.trim()
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`
}

export async function loadClustersForMatching(orgId: string) {
  return db
    .select({
      id: contractAskClusters.id,
      canonicalQuestion: contractAskClusters.canonicalQuestion,
      askCount: contractAskClusters.askCount,
    })
    .from(contractAskClusters)
    .where(eq(contractAskClusters.orgId, orgId))
    .orderBy(desc(contractAskClusters.askCount))
    .limit(MAX_CLUSTERS_FOR_AI)
}

async function matchQuestionToClusterWithAi(
  orgId: string,
  questionRaw: string,
  clusters: { id: string; canonicalQuestion: string }[]
): Promise<ClusterMatchAi> {
  if (clusters.length === 0) {
    return {
      matchedClusterId: null,
      newClusterCanonicalQuestion: truncate(questionRaw, 280),
      refinedCanonicalQuestion: null,
    }
  }

  const lines = clusters.map((c) => `- id: ${c.id}\n  label: ${c.canonicalQuestion}`).join('\n')

  const parsed = await createClaudeJsonCompletion<ClusterMatchAi>({
    model: CLAUDE_MODELS.classifier,
    maxTokens: 1024,
    system: `Je groepeert contractvragen van dezelfde organisatie. Bepaal of de nieuwe vraag dezelfde bedoeling heeft als één van de bestaande clusters (andere formulering mag).
Regels:
- Kies alleen matchedClusterId als de vraag inhoudelijk hetzelfde vraagstuk raakt als die cluster; kleine taalverschillen en herschrijvingen tellen mee.
- Kies matchedClusterId null als het een nieuw onderwerp is of een duidelijk andere vraag.
- newClusterCanonicalQuestion: verplicht als matchedClusterId null is — korte, duidelijke FAQ-titel in het Nederlands (max ~120 tekens), geen aanhalingstekens.
- refinedCanonicalQuestion: alleen als je matchedClusterId invult en de bestaande label tekst duidelijk slechter is; anders null.
Antwoord ALLEEN als JSON:
{
  "matchedClusterId": string|null,
  "newClusterCanonicalQuestion": string|null,
  "refinedCanonicalQuestion": string|null
}`,
    user: `Organisatie-id: ${orgId}

Nieuwe vraag van gebruiker:
${questionRaw}

Bestaande clusters (id + label):
${lines}`,
  })

  const validIds = new Set(clusters.map((c) => c.id))
  let matchedClusterId =
    typeof parsed.matchedClusterId === 'string' && validIds.has(parsed.matchedClusterId)
      ? parsed.matchedClusterId
      : null

  let newClusterCanonicalQuestion =
    typeof parsed.newClusterCanonicalQuestion === 'string'
      ? truncate(parsed.newClusterCanonicalQuestion, 280)
      : null

  if (!matchedClusterId && (!newClusterCanonicalQuestion || newClusterCanonicalQuestion.length < 4)) {
    newClusterCanonicalQuestion = truncate(questionRaw, 280)
  }

  const refined =
    typeof parsed.refinedCanonicalQuestion === 'string'
      ? truncate(parsed.refinedCanonicalQuestion, 280)
      : null

  return {
    matchedClusterId,
    newClusterCanonicalQuestion: matchedClusterId ? null : newClusterCanonicalQuestion,
    refinedCanonicalQuestion: matchedClusterId ? refined : null,
  }
}

export async function persistContractAskTurn(params: {
  orgId: string
  userId: string | null
  questionRaw: string
  portfolioMode: boolean
  contractIds: string[]
  referenceUrls: string[]
  response: ContractAskResponsePayload
}): Promise<void> {
  const { orgId, userId, questionRaw, portfolioMode, contractIds, referenceUrls, response } = params

  const clusters = await loadClustersForMatching(orgId)
  let clusterId: string
  let match: ClusterMatchAi

  try {
    match = await matchQuestionToClusterWithAi(
      orgId,
      questionRaw,
      clusters.map((c) => ({ id: c.id, canonicalQuestion: c.canonicalQuestion }))
    )
  } catch {
    match = {
      matchedClusterId: null,
      newClusterCanonicalQuestion: truncate(questionRaw, 280),
      refinedCanonicalQuestion: null,
    }
  }

  const now = new Date()

  if (match.matchedClusterId) {
    clusterId = match.matchedClusterId
    await db
      .update(contractAskClusters)
      .set({
        askCount: sql`${contractAskClusters.askCount} + 1`,
        updatedAt: now,
        ...(match.refinedCanonicalQuestion && match.refinedCanonicalQuestion.length >= 8
          ? { canonicalQuestion: match.refinedCanonicalQuestion }
          : {}),
      })
      .where(and(eq(contractAskClusters.id, clusterId), eq(contractAskClusters.orgId, orgId)))
  } else {
    const canonical = match.newClusterCanonicalQuestion ?? truncate(questionRaw, 280)
    const [row] = await db
      .insert(contractAskClusters)
      .values({
        orgId,
        canonicalQuestion: canonical,
        askCount: 1,
        updatedAt: now,
        createdAt: now,
      })
      .returning({ id: contractAskClusters.id })
    clusterId = row!.id
  }

  await db.insert(contractAskTurns).values({
    orgId,
    userId,
    clusterId,
    questionRaw,
    portfolioMode,
    contractIds,
    referenceUrls,
    responsePayload: response,
    createdAt: now,
  })
}

export async function getTopAskClusters(orgId: string, limit: number) {
  return db
    .select({
      id: contractAskClusters.id,
      canonicalQuestion: contractAskClusters.canonicalQuestion,
      askCount: contractAskClusters.askCount,
    })
    .from(contractAskClusters)
    .where(eq(contractAskClusters.orgId, orgId))
    .orderBy(desc(contractAskClusters.askCount), desc(contractAskClusters.updatedAt))
    .limit(limit)
}

export async function getLatestTurnForCluster(orgId: string, clusterId: string) {
  return db.query.contractAskTurns.findFirst({
    where: and(eq(contractAskTurns.orgId, orgId), eq(contractAskTurns.clusterId, clusterId)),
    orderBy: [desc(contractAskTurns.createdAt)],
  })
}
