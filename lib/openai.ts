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
    maxTokens: 8192,
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
  type: 'contract' | 'contractstuk' | 'addendum' | 'url'
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

export function sanitizeFollowUpQuestions(questions: unknown, originalQuestion: string): string[] {
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
    'motivering',
  ]
  const hasComplexSignal = complexSignals.some((signal) => q.includes(signal))
  if (question.length > 280 || sourceCount >= 5 || hasComplexSignal) return 'complex'
  return 'simple'
}

async function determineQuestionComplexity(
  question: string,
  contextBlocks: { kind: 'contract' | 'contractstuk' | 'addendum' | 'url'; title: string; detail: string; text: string }[],
  orgId: string
): Promise<QaComplexity> {
  const totalChars = contextBlocks.reduce((sum, block) => sum + block.text.length, 0)
  const sourceKinds = contextBlocks.reduce(
    (acc, block) => {
      acc[block.kind] += 1
      return acc
    },
    { contract: 0, contractstuk: 0, addendum: 0, url: 0 }
  )

  const heuristicComplexity = estimateQuestionComplexityHeuristically(question, contextBlocks.length)
  const qTrim = question.trim()
  const qLen = qTrim.length

  /**
   * Snel pad: direct het snelle antwoordmodel (Haiku) zonder classifier-call.
   */
  if (
    heuristicComplexity === 'simple' &&
    qLen > 0 &&
    qLen <= 420 &&
    contextBlocks.length <= 5 &&
    totalChars <= 300_000
  ) {
    return 'simple'
  }

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
Bronnen: totaal=${contextBlocks.length}, hoofdcontract=${sourceKinds.contract}, contractstukken=${sourceKinds.contractstuk}, addenda=${sourceKinds.addendum}, urls=${sourceKinds.url}, chars=${totalChars}
Heuristische voorinschatting: ${heuristicComplexity}`,
    })
    return parsed.complexity === 'complex' ? 'complex' : 'simple'
  } catch {
    return heuristicComplexity
  }
}

async function buildStreamModelCandidates(preferredModel: string): Promise<string[]> {
  const configuredCandidates = Array.from(
    new Set(
      [preferredModel, ...CLAUDE_MODELS.fallbacks, CLAUDE_MODELS.complexAnswer, CLAUDE_MODELS.simpleAnswer].filter(
        Boolean
      )
    )
  )
  const availableModels = await getAvailableAnthropicModels()
  if (availableModels.length) {
    return orderAvailableModelsByIntent(availableModels, preferredModel)
  }
  return configuredCandidates
}

function buildContractQaSourceSections(
  contextBlocks: { kind: 'contract' | 'contractstuk' | 'addendum' | 'url'; title: string; detail: string; text: string }[]
) {
  const parts = contextBlocks.map((b, i) => {
    let label: string
    if (b.kind === 'contract') label = `Hoofdcontract: ${b.title} (${b.detail})`
    else if (b.kind === 'contractstuk') label = `Extra contractstuk: ${b.title} (${b.detail})`
    else if (b.kind === 'addendum') label = `Addendum / wijziging: ${b.title} (${b.detail})`
    else label = `Externe bron: ${b.title}`
    return `--- bron ${i + 1}: ${label} ---\n${b.text}`
  })
  return parts.join('\n\n').slice(0, 100_000)
}

/** Opties voor contract-QA: expliciete contractkeuze in de UI. */
export type ContractQaCallOptions = {
  /**
   * Contract-id('s) die de gebruiker heeft aangevinkt. Zet dit om het model te dwingen
   * uitsluitend in die dossiers te redeneren (geen impliciete portefeuille).
   */
  scopedContractIds?: string[]
}

function buildContractQaUserMessage(
  question: string,
  orgId: string,
  joinedSources: string,
  options?: ContractQaCallOptions
): string {
  const body = `Organisatie: org_${orgId}\nVraag:\n${question}\n\n--- Bronnen ---\n${joinedSources}`
  const ids = options?.scopedContractIds?.filter(Boolean) ?? []
  if (ids.length === 0) return body

  const idList = ids.join(', ')
  const scopePreamble =
    ids.length === 1
      ? `SCOPE (strikt) — De gebruiker heeft precies één contract gekozen (contract-id: ${idList}). Er zijn geen andere contracten beschikbaar in deze vraag: gebruik uitsluitend de onderstaande bronteksten van dit dossier (hoofdcontract, stukken, addenda) en eventuele apart gemelde URL-bronnen. Verzin geen clausules of feiten uit andere contracten. Als iets niet in deze bron staat, zeg dat expliciet.\n\n`
      : `SCOPE (strikt) — De gebruiker heeft ${ids.length} contracten gekozen (contract-ids: ${idList}). Gebruik uitsluitend de onderstaande bronnen die bij deze dossiers horen, plus eventuele apart gemelde URL-bronnen. Geen informatie uit niet-geselecteerde contracten. Als de vraag iets vraagt buiten deze selectie, leg dat uit.\n\n`
  return scopePreamble + body
}

const CONTRACT_QA_HTML_SYSTEM = `Je bent een senior contractjurist en adviseur. Beantwoord de vraag uitsluitend op basis van de meegeleverde bronnen.
Regels:
- Antwoord in het Nederlands, als geldige HTML-fragmenten (geen <html>, <head>, <body>, geen <script> of <style>).
- Gebruik semantische opmaak: <h2> voor hoofdsecties, <h3> voor subsecties, <p> voor alinea's, <ul>/<ol>/<li> voor lijsten, <table>, <thead>, <tbody>, <tr>, <th>, <td> voor tabellen (met kopregel in <th>), <strong> en <em> waar nuttig, <blockquote> voor citaten.
- Begin het antwoord direct met een eerste <h2> of <p> (geen inleidende woorden buiten HTML).
- Volgorde inhoudelijk: eerst hoofdcontract(en), dan extra contractstukken, daarna addenda; het laatst genoemde addendum wint bij tegenstrijdigheid tussen addenda.
- Verwijs in de lopende tekst concreet naar de bron (titel of bestandsnaam).
- Geen feiten verzinnen; als de bronnen iets niet zeggen, zeg dat eerlijk.
- Als de vraag begint met een SCOPE (strikt)-blok: de gebruiker heeft een expliciete contractkeuze gemaakt — gebruik dan alleen die dossiers, nooit impliciet andere contracten uit de organisatie.
- Lever alleen de antwoord-HTML. Geen JSON, geen markdown, geen omhullend <pre> of codeblok rond het hele antwoord.`

/**
 * Streamt het antwoord token-voor-token (Claude text deltas) voor live weergave in de UI.
 */
export async function* streamAnswerContractQuestionHtml(
  question: string,
  contextBlocks: { kind: 'contract' | 'contractstuk' | 'addendum' | 'url'; title: string; detail: string; text: string }[],
  orgId: string,
  options?: ContractQaCallOptions
): AsyncGenerator<string, void, undefined> {
  const complexity = await determineQuestionComplexity(question, contextBlocks, orgId)
  const preferredModel = complexity === 'complex' ? QA_ROUTING_MODELS.complexAnswer : QA_ROUTING_MODELS.simpleAnswer
  const joined = buildContractQaSourceSections(contextBlocks)
  const user = buildContractQaUserMessage(question, orgId, joined, options)

  const candidates = await buildStreamModelCandidates(preferredModel)
  let lastErr: unknown = null
  for (const model of candidates) {
    try {
      const stream = anthropic.messages.stream({
        model,
        max_tokens: 4096,
        system: CONTRACT_QA_HTML_SYSTEM,
        messages: [{ role: 'user', content: user }],
      })
      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta' &&
          typeof event.delta.text === 'string'
        ) {
          yield event.delta.text
        }
      }
      return
    } catch (err) {
      lastErr = err
      if (!isModelNotFoundError(err)) throw err
    }
  }
  throw lastErr ?? new Error('Geen geldig Claude model beschikbaar')
}

/** @deprecated Gebruik streamAnswerContractQuestionHtml. */
export const streamAnswerContractQuestionMarkdown = streamAnswerContractQuestionHtml

function normalizeExtractedSourceType(t: unknown): QaSourceRef['type'] {
  const s = String(t ?? '').toLowerCase().trim()
  if (s === 'contract' || s === 'contractstuk' || s === 'addendum' || s === 'url') return s
  return 'contract'
}

/** Na streaming: compacte Haiku-call voor bronnen, beperkingen en vervolgvragen. */
export async function extractContractAskStructuredFields(
  question: string,
  answerHtml: string,
  contextBlocks: { kind: 'contract' | 'contractstuk' | 'addendum' | 'url'; title: string; detail: string }[],
  orgId: string,
  options?: ContractQaCallOptions
): Promise<Pick<ContractQuestionAnswer, 'sources' | 'limitations' | 'followUpQuestions'>> {
  const summaries = contextBlocks.map((b, i) => ({
    bron: i + 1,
    type: b.kind,
    title: b.title,
    detail: b.detail.slice(0, 400),
  }))
  const scopeNote =
    options?.scopedContractIds && options.scopedContractIds.length > 0
      ? `\nLet op: de gebruiker beperkte de zoekopdracht tot contract-id(s): ${options.scopedContractIds.join(', ')}. Vermeld geen bronnen die niet tot deze dossiers (of de gegeven URL-bronnen) behoren.\n`
      : ''
  type Raw = {
    sources?: { type?: string; title?: string; detail?: string; relevance?: string }[]
    limitations?: string | null
    followUpQuestions?: string[]
  }
  const raw = await createClaudeJsonCompletion<Raw>({
    model: QA_ROUTING_MODELS.simpleAnswer,
    maxTokens: 2048,
    system: `Je vult metadata bij een contractantwoord. Antwoord ALLEEN met JSON:
{
  "sources": [ { "type": "contract"|"contractstuk"|"addendum"|"url", "title": string, "detail": string, "relevance": string } ],
  "limitations": string|null,
  "followUpQuestions": [string]
}
Gebruik uitsluitend bronnen uit de meegeleverde lijst die het antwoord ondersteunen. title en detail moeten bij de lijst horen.`,
    user: `Organisatie: org_${orgId}
Vraag: ${question}
${scopeNote}
Antwoord (HTML):
${answerHtml.slice(0, 24_000)}

Bronnen-metadata:
${JSON.stringify(summaries).slice(0, 20_000)}`,
  })
  const sources: QaSourceRef[] = Array.isArray(raw.sources)
    ? raw.sources
        .map((s) => {
          const rel = typeof s?.relevance === 'string' ? s.relevance.trim() : ''
          return {
            type: normalizeExtractedSourceType(s?.type),
            title: typeof s?.title === 'string' ? s.title : '',
            detail: typeof s?.detail === 'string' ? s.detail : '',
            relevance: rel.length > 0 ? rel : 'Zie het antwoord.',
          }
        })
        .filter((s) => s.title.length > 0)
    : []
  const limitations =
    raw.limitations === null ? null : typeof raw.limitations === 'string' ? raw.limitations : null
  const followUpQuestions = Array.isArray(raw.followUpQuestions)
    ? raw.followUpQuestions.filter((x): x is string => typeof x === 'string')
    : []
  return { sources, limitations, followUpQuestions }
}

export async function answerContractQuestion(
  question: string,
  contextBlocks: { kind: 'contract' | 'contractstuk' | 'addendum' | 'url'; title: string; detail: string; text: string }[],
  orgId: string,
  options?: ContractQaCallOptions
): Promise<ContractQuestionAnswer> {
  const complexity = await determineQuestionComplexity(question, contextBlocks, orgId)
  const answerModel = complexity === 'complex' ? QA_ROUTING_MODELS.complexAnswer : QA_ROUTING_MODELS.simpleAnswer

  const joined = buildContractQaSourceSections(contextBlocks)
  const userContent = buildContractQaUserMessage(question, orgId, joined, options)

  const result = await createClaudeJsonCompletion<ContractQuestionAnswer>({
    model: answerModel,
    system: `Je bent een senior contractjurist en adviseur. Beantwoord de vraag van de gebruiker uitsluitend op basis van de meegeleverde bronnen.
Regels:
- Antwoord in het Nederlands als geldige HTML-fragmenten (geen <html>/<body>, geen script/style): gebruik <h2>, <h3>, <p>, lijsten, tabellen met <table>/<thead>/<tbody>/<tr>/<th>/<td>, <strong>, <em>, <blockquote> waar passend.
- **Volgorde en voorrang:** eerst hoofdcontract(en), dan **extra contractstukken** (bijlagen zonder wijzigingskarakter), daarna **addenda**. Addenda gaan voor op hoofdcontract en extra contractstukken waar ze afwijken. Tussen addenda wint **het laatst in deze lijst genoemde addendum** (nieuwste) bij tegenstrijdigheid met oudere addenda.
- Citeer concreet: verwijs naar welke bron (contracttitel, bestandsnaam addendum, of URL-host) en parafraseer of kort citeer waar relevant.
- Als de bronnen de vraag niet volledig beantwoorden, zeg dat expliciet en wat er wél in de bronnen staat.
- Geen aannames over feiten die niet in de tekst staan.
- Als de gebruikersvraag begint met SCOPE (strikt): er is een expliciete contractkeuze — gebruik alleen die dossiers, geen kennis uit andere contracten van de organisatie.
- Antwoord ALLEEN als JSON:
{
  "answer": string (geldige HTML-fragmenten, geen markdown),
  "sources": [
    {
      "type": "contract"|"contractstuk"|"addendum"|"url",
      "title": string,
      "detail": string (bestandsnaam of URL),
      "relevance": string (kort: waarom deze bron bij de vraag hoort)
    }
  ],
  "limitations": string|null (bijv. ontbrekende clausule, of alleen in bron 2)
  "followUpQuestions": [string] (2-4 korte, concrete vervolgvraag-suggesties in het Nederlands die logisch aansluiten op dit antwoord)
}`,
    user: userContent.slice(0, 120_000),
  })
  return {
    ...result,
    followUpQuestions: sanitizeFollowUpQuestions(result.followUpQuestions, question),
  }
}
