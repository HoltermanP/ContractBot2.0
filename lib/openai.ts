import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const DEFAULT_CLAUDE_FAST_MODEL = 'claude-3-5-haiku-latest'
const DEFAULT_CLAUDE_COMPLEX_MODEL = 'claude-3-5-sonnet-latest'
const DEFAULT_CLAUDE_FALLBACKS = [
  'claude-3-5-haiku-latest',
  'claude-3-5-haiku-20241022',
  'claude-3-haiku-20240307',
  'claude-3-5-sonnet-latest',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-sonnet-20240620',
] as const

function parseModelList(value?: string): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export const CLAUDE_MODELS = {
  classifier: process.env.ANTHROPIC_MODEL_CLASSIFIER ?? process.env.ANTHROPIC_MODEL_FAST ?? DEFAULT_CLAUDE_FAST_MODEL,
  simpleAnswer: process.env.ANTHROPIC_MODEL_SIMPLE ?? process.env.ANTHROPIC_MODEL_FAST ?? DEFAULT_CLAUDE_FAST_MODEL,
  complexAnswer: process.env.ANTHROPIC_MODEL_COMPLEX ?? DEFAULT_CLAUDE_COMPLEX_MODEL,
  fallbacks: [
    ...parseModelList(process.env.ANTHROPIC_MODEL_FALLBACKS),
    ...DEFAULT_CLAUDE_FALLBACKS,
  ],
} as const

let cachedAnthropicModels: string[] | null = null

async function getAvailableAnthropicModels(): Promise<string[]> {
  if (cachedAnthropicModels) return cachedAnthropicModels
  try {
    const page = await anthropic.models.list({ limit: 100 })
    const models = page.data.map((m) => m.id).filter(Boolean)
    if (models.length > 0) {
      cachedAnthropicModels = models
      return models
    }
  } catch {
    // Ignore list failures: we still try configured fallback IDs.
  }
  cachedAnthropicModels = []
  return []
}

function orderAvailableModelsByIntent(models: string[], preferredModel: string): string[] {
  const prefersHaiku = preferredModel.toLowerCase().includes('haiku')
  const scored = models.map((id) => {
    const lower = id.toLowerCase()
    let score = 0
    if (lower === preferredModel.toLowerCase()) score += 100
    if (prefersHaiku && lower.includes('haiku')) score += 20
    if (!prefersHaiku && lower.includes('sonnet')) score += 20
    if (lower.includes('latest')) score += 5
    return { id, score }
  })
  return scored.sort((a, b) => b.score - a.score).map((entry) => entry.id)
}

function isModelNotFoundError(err: unknown): boolean {
  const candidate = err as { message?: string; error?: { type?: string; message?: string }; type?: string }
  const message = String(candidate?.message ?? candidate?.error?.message ?? '')
  return (
    candidate?.type === 'not_found_error' ||
    candidate?.error?.type === 'not_found_error' ||
    message.includes('not_found_error') ||
    message.includes('model:')
  )
}

function extractTextContentFromAnthropic(
  content: Anthropic.Messages.Message['content']
): string | null {
  const textParts = content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim()
  return textParts.length > 0 ? textParts : null
}

function parseJsonFromModelText(raw: string) {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  return JSON.parse(cleaned)
}

export async function createClaudeJsonCompletion<T>({
  model,
  system,
  user,
  maxTokens = 4096,
}: {
  model: string
  system: string
  user: string
  maxTokens?: number
}): Promise<T> {
  const configuredCandidates = Array.from(
    new Set([model, ...CLAUDE_MODELS.fallbacks, CLAUDE_MODELS.complexAnswer, CLAUDE_MODELS.simpleAnswer].filter(Boolean))
  )
  const availableModels = await getAvailableAnthropicModels()
  const modelCandidates = availableModels.length
    ? orderAvailableModelsByIntent(availableModels, model)
    : configuredCandidates

  let lastErr: unknown = null
  for (const currentModel of modelCandidates) {
    try {
      const response = await anthropic.messages.create({
        model: currentModel,
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: user }],
      })
      const content = extractTextContentFromAnthropic(response.content)
      if (!content) throw new Error('Geen respons van Claude')
      return parseJsonFromModelText(content) as T
    } catch (err) {
      lastErr = err
      if (!isModelNotFoundError(err)) throw err
    }
  }

  throw lastErr ?? new Error('Geen geldig Claude model beschikbaar')
}

export interface ContractExtraction {
  parties: { name: string; role: string; kvk?: string }[]
  start_date: string | null
  end_date: string | null
  option_date: string | null
  notice_period_days: number | null
  auto_renewal: boolean
  auto_renewal_terms: string | null
  contract_value: { total: number | null; annual: number | null; currency: string }
  contract_type: string
  obligations: { description: string; category: string; due_date?: string }[]
  risk_indicators: { clause: string; risk_level: 'low' | 'medium' | 'high'; explanation: string }[]
  sustainability_clauses: string[]
  it_security_clauses: string[]
  privacy_clauses: string[]
  summary_short: string
  summary_management: string
  implicit_renewal_warning: string | null
}

export async function extractContractData(text: string, orgId: string): Promise<ContractExtraction> {
  return createClaudeJsonCompletion<ContractExtraction>({
    model: CLAUDE_MODELS.complexAnswer,
    system: `Je bent een expert contractanalist. Analyseer het opgegeven contract en extraheer gestructureerde data als JSON.
Antwoord ALLEEN in het Nederlands. Gebruik het volgende JSON schema exact:
{
  "parties": [{"name": string, "role": string, "kvk": string|null}],
  "start_date": "YYYY-MM-DD"|null,
  "end_date": "YYYY-MM-DD"|null,
  "option_date": "YYYY-MM-DD"|null,
  "notice_period_days": number|null,
  "auto_renewal": boolean,
  "auto_renewal_terms": string|null,
  "contract_value": {"total": number|null, "annual": number|null, "currency": string},
  "contract_type": string,
  "obligations": [{"description": string, "category": "it_security"|"privacy"|"financial"|"sustainability"|"other", "due_date": "YYYY-MM-DD"|null}],
  "risk_indicators": [{"clause": string, "risk_level": "low"|"medium"|"high", "explanation": string}],
  "sustainability_clauses": [string],
  "it_security_clauses": [string],
  "privacy_clauses": [string],
  "summary_short": string,
  "summary_management": string,
  "implicit_renewal_warning": string|null
}`,
    user: `Organisatie: org_${orgId}\nAnalyseer dit contract:\n\n${text.slice(0, 30000)}`,
  })
}

export async function analyzeContractRisk(text: string, orgId: string) {
  return createClaudeJsonCompletion({
    model: CLAUDE_MODELS.complexAnswer,
    system: `Je bent een juridisch risico-analist gespecialiseerd in contracten. Analyseer dit contract op risico's en ontbrekende clausules.
Antwoord in het Nederlands als JSON:
{
  "riskScore": number (0-100),
  "findings": [
    {
      "title": string,
      "description": string,
      "severity": "low"|"medium"|"high",
      "suggestion": string
    }
  ],
  "missingClauses": [string],
  "summary": string
}`,
    user: `Organisatie: org_${orgId}\nAnalyseer dit contract:\n\n${text.slice(0, 30000)}`,
  })
}

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000),
  })
  return response.data[0]?.embedding ?? []
}

export interface QaSourceRef {
  type: 'contract' | 'addendum' | 'url'
  title: string
  detail: string
  relevance: string
}

export interface ContractQuestionAnswer {
  answer: string
  sources: QaSourceRef[]
  limitations: string | null
  followUpQuestions: string[]
}

type QaComplexity = 'simple' | 'complex'

function sanitizeFollowUpQuestions(questions: unknown, originalQuestion: string): string[] {
  if (!Array.isArray(questions)) return []
  const original = originalQuestion.trim().toLowerCase()
  const unique = new Set<string>()
  for (const q of questions) {
    if (typeof q !== 'string') continue
    const cleaned = q.trim().replace(/\s+/g, ' ')
    if (cleaned.length < 8 || cleaned.length > 180) continue
    if (cleaned.toLowerCase() === original) continue
    unique.add(cleaned)
    if (unique.size >= 4) break
  }
  return [...unique]
}

const QA_ROUTING_MODELS = {
  classifier: CLAUDE_MODELS.classifier,
  simpleAnswer: CLAUDE_MODELS.simpleAnswer,
  complexAnswer: CLAUDE_MODELS.complexAnswer,
} as const

function estimateQuestionComplexityHeuristically(question: string, sourceCount: number): QaComplexity {
  const q = question.toLowerCase()
  const complexSignals = [
    'vergelijk',
    'verschil',
    'analyse',
    'risico',
    'onderhandel',
    'juridisch',
    'impact',
    'samenvatten',
    'scenario',
    'strategie',
    'tegenstrijd',
    'uitzondering',
    'wanprestatie',
    'aansprakelijkheid',
    'avg',
    'privacy',
  ]
  const hasComplexSignal = complexSignals.some((signal) => q.includes(signal))
  if (question.length > 280 || sourceCount >= 5 || hasComplexSignal) return 'complex'
  return 'simple'
}

async function determineQuestionComplexity(
  question: string,
  contextBlocks: { kind: 'contract' | 'addendum' | 'url'; title: string; detail: string; text: string }[],
  orgId: string
): Promise<QaComplexity> {
  const totalChars = contextBlocks.reduce((sum, block) => sum + block.text.length, 0)
  const sourceKinds = contextBlocks.reduce(
    (acc, block) => {
      acc[block.kind] += 1
      return acc
    },
    { contract: 0, addendum: 0, url: 0 }
  )

  const heuristicComplexity = estimateQuestionComplexityHeuristically(question, contextBlocks.length)

  try {
    const parsed = await createClaudeJsonCompletion<{ complexity?: QaComplexity }>({
      model: QA_ROUTING_MODELS.classifier,
      system: `Classificeer de vraagcomplexiteit voor contract-QA routing.
Geef ALLEEN JSON terug:
{
  "complexity": "simple" | "complex"
}
Kies "complex" bij meerdere bronnen, interpretatie, tegenstrijdigheden, risico-inschatting, juridische nuance, of lange/open vragen.
Kies "simple" bij feitelijke opzoekvragen met direct antwoord in 1-2 bronnen.`,
      user: `Organisatie: org_${orgId}
Vraag: ${question}
Bronnen: totaal=${contextBlocks.length}, contracts=${sourceKinds.contract}, addenda=${sourceKinds.addendum}, urls=${sourceKinds.url}, chars=${totalChars}
Heuristische voorinschatting: ${heuristicComplexity}`,
    })
    return parsed.complexity === 'complex' ? 'complex' : 'simple'
  } catch {
    return heuristicComplexity
  }
}

export async function answerContractQuestion(
  question: string,
  contextBlocks: { kind: 'contract' | 'addendum' | 'url'; title: string; detail: string; text: string }[],
  orgId: string
): Promise<ContractQuestionAnswer> {
  const complexity = await determineQuestionComplexity(question, contextBlocks, orgId)
  const answerModel = complexity === 'complex' ? QA_ROUTING_MODELS.complexAnswer : QA_ROUTING_MODELS.simpleAnswer

  const parts = contextBlocks.map((b, i) => {
    let label: string
    if (b.kind === 'contract') label = `Hoofdcontract: ${b.title} (${b.detail})`
    else if (b.kind === 'addendum') label = `Addendum / wijziging: ${b.title} (${b.detail})`
    else label = `Externe bron: ${b.title}`
    return `--- bron ${i + 1}: ${label} ---\n${b.text}`
  })
  const joined = parts.join('\n\n')

  const result = await createClaudeJsonCompletion<ContractQuestionAnswer>({
    model: answerModel,
    system: `Je bent een senior contractjurist en adviseur. Beantwoord de vraag van de gebruiker uitsluitend op basis van de meegeleverde bronnen.
Regels:
- Antwoord in het Nederlands, helder en gestructureerd (kopjes waar nuttig).
- **Addenda en wijzigingen gaan voor op het hoofdcontract** waar ze van elkaar verschillen. Bronnen staan in volgorde: eerst het hoofdcontract, daarna addenda van oud naar nieuw — **het laatst genoemde addendum wint bij tegenstrijdigheid met eerdere addenda of met het hoofdcontract**.
- Citeer concreet: verwijs naar welke bron (contracttitel, bestandsnaam addendum, of URL-host) en parafraseer of kort citeer waar relevant.
- Als de bronnen de vraag niet volledig beantwoorden, zeg dat expliciet en wat er wél in de bronnen staat.
- Geen aannames over feiten die niet in de tekst staan.
- Antwoord ALLEEN als JSON:
{
  "answer": string (Markdown toegestaan),
  "sources": [
    {
      "type": "contract"|"addendum"|"url",
      "title": string,
      "detail": string (bestandsnaam of URL),
      "relevance": string (kort: waarom deze bron bij de vraag hoort)
    }
  ],
  "limitations": string|null (bijv. ontbrekende clausule, of alleen in bron 2)
  "followUpQuestions": [string] (2-4 korte, concrete vervolgvraag-suggesties in het Nederlands die logisch aansluiten op dit antwoord)
}`,
    user: `Organisatie: org_${orgId}\nVraag:\n${question}\n\n--- Bronnen ---\n${joined.slice(0, 100_000)}`,
  })
  return {
    ...result,
    followUpQuestions: sanitizeFollowUpQuestions(result.followUpQuestions, question),
  }
}
