import OpenAI from 'openai'

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    user: `org_${orgId}`,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Je bent een expert contractanalist. Analyseer het opgegeven contract en extraheer gestructureerde data als JSON.
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
      },
      { role: 'user', content: `Analyseer dit contract:\n\n${text.slice(0, 30000)}` },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('Geen respons van OpenAI')
  return JSON.parse(content) as ContractExtraction
}

export async function analyzeContractRisk(text: string, orgId: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    user: `org_${orgId}`,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Je bent een juridisch risico-analist gespecialiseerd in contracten. Analyseer dit contract op risico's en ontbrekende clausules.
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
      },
      { role: 'user', content: `Analyseer dit contract:\n\n${text.slice(0, 30000)}` },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('Geen respons van OpenAI')
  return JSON.parse(content)
}

export async function compareContracts(text1: string, text2: string, orgId: string) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    user: `org_${orgId}`,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Vergelijk twee contractversies inhoudelijk. Focus op betekenisverschillen, niet tekstdiff. Antwoord in het Nederlands als JSON:
{
  "differences": [
    {
      "section": string,
      "type": "new_obligation"|"changed_amount"|"changed_duration"|"risk_change"|"other",
      "description": string,
      "severity": "low"|"medium"|"high",
      "version1_text": string|null,
      "version2_text": string|null
    }
  ],
  "summary": string
}`,
      },
      {
        role: 'user',
        content: `Versie 1:\n${text1.slice(0, 15000)}\n\n---\nVersie 2:\n${text2.slice(0, 15000)}`,
      },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('Geen respons van OpenAI')
  return JSON.parse(content)
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
}

export async function answerContractQuestion(
  question: string,
  contextBlocks: { kind: 'contract' | 'addendum' | 'url'; title: string; detail: string; text: string }[],
  orgId: string
): Promise<ContractQuestionAnswer> {
  const parts = contextBlocks.map((b, i) => {
    let label: string
    if (b.kind === 'contract') label = `Hoofdcontract: ${b.title} (${b.detail})`
    else if (b.kind === 'addendum') label = `Addendum / wijziging: ${b.title} (${b.detail})`
    else label = `Externe bron: ${b.title}`
    return `--- bron ${i + 1}: ${label} ---\n${b.text}`
  })
  const joined = parts.join('\n\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    user: `org_${orgId}`,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `Je bent een senior contractjurist en adviseur. Beantwoord de vraag van de gebruiker uitsluitend op basis van de meegeleverde bronnen.
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
}`,
      },
      {
        role: 'user',
        content: `Vraag:\n${question}\n\n--- Bronnen ---\n${joined.slice(0, 100_000)}`,
      },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (!content) throw new Error('Geen respons van OpenAI')
  return JSON.parse(content) as ContractQuestionAnswer
}
