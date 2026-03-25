'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Loader2, MessageCircleQuestion, Sparkles, Link2 } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type ContractRow = { id: string; title: string; contractNumber: string | null; status: string }

type AskResponse = {
  answer: string
  sources: { type: string; title: string; detail: string; relevance: string }[]
  limitations: string | null
  contextSummary?: {
    contractsUsed: { id: string; title: string; detail: string }[]
    urlsUsed: { url: string }[]
  }
}

const FREQUENT_QUESTIONS = [
  'Wat is de opzegtermijn in dit contract?',
  'Geldt er een automatische verlenging en onder welke voorwaarden?',
  'Welke aansprakelijkheidsbeperkingen staan in dit contract?',
  'Wat zijn de betalingsvoorwaarden en betaaltermijnen?',
  'Welke belangrijkste verplichtingen hebben wij volgens dit contract?',
]

export default function ContractAskPage() {
  const searchParams = useSearchParams()
  const contractIdFromUrl = searchParams.get('contractId')
  const [question, setQuestion] = useState('')
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [scopeMode, setScopeMode] = useState<'auto' | 'single'>('auto')
  const [selectedContractId, setSelectedContractId] = useState('')
  const [referenceUrls, setReferenceUrls] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AskResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [faqAnswers, setFaqAnswers] = useState<Record<string, string>>({})
  const [faqLoading, setFaqLoading] = useState<Record<string, boolean>>({})
  const [faqErrors, setFaqErrors] = useState<Record<string, string>>({})
  const [openFaqItem, setOpenFaqItem] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/contracts')
        const data = await res.json()
        if (!cancelled && Array.isArray(data)) {
          setContracts(
            data.map((c: ContractRow) => ({
              id: c.id,
              title: c.title,
              contractNumber: c.contractNumber,
              status: c.status,
            }))
          )
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const selectedContract = useMemo(
    () => contracts.find((contract) => contract.id === selectedContractId) ?? null,
    [contracts, selectedContractId]
  )

  useEffect(() => {
    if (!contractIdFromUrl || contracts.length === 0) return
    const exists = contracts.some((contract) => contract.id === contractIdFromUrl)
    if (exists) {
      setScopeMode('single')
      setSelectedContractId(contractIdFromUrl)
    }
  }, [contractIdFromUrl, contracts])

  useEffect(() => {
    setOpenFaqItem('')
  }, [selectedContractId])

  function faqKey(questionText: string) {
    return `${selectedContractId}::${questionText}`
  }

  async function loadFaqAnswer(questionText: string) {
    if (!selectedContractId) return
    const key = faqKey(questionText)
    if (faqAnswers[key] || faqLoading[key]) return

    setFaqLoading((prev) => ({ ...prev, [key]: true }))
    setFaqErrors((prev) => ({ ...prev, [key]: '' }))

    try {
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionText,
          contractIds: [selectedContractId],
          portfolioMode: false,
          referenceUrls: [],
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFaqErrors((prev) => ({ ...prev, [key]: data.error ?? 'Er ging iets mis' }))
        return
      }

      setFaqAnswers((prev) => ({ ...prev, [key]: (data as AskResponse).answer }))
    } catch {
      setFaqErrors((prev) => ({ ...prev, [key]: 'Netwerkfout' }))
    } finally {
      setFaqLoading((prev) => ({ ...prev, [key]: false }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = question.trim()
    if (!q) return
    if (scopeMode === 'single' && !selectedContractId) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const contractIds = scopeMode === 'single' ? [selectedContractId] : []
      const urls = referenceUrls
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean)

      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          contractIds,
          portfolioMode: scopeMode === 'auto',
          referenceUrls: urls,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Er ging iets mis')
        return
      }
      setResult(data as AskResponse)
    } catch {
      setError('Netwerkfout')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <MessageCircleQuestion className="h-7 w-7 text-blue-600" />
          Contractvragen
        </h1>
        <p className="text-muted-foreground mt-1">
          Stel een vraag over uw contracten. Het antwoord wordt onderbouwd met de contractdocumenten en optioneel met
          door u opgegeven webpagina&apos;s (URL&apos;s).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-blue-100 bg-blue-50/40">
          <CardHeader>
            <CardTitle className="text-lg">1. Kies contractcontext</CardTitle>
            <CardDescription>
              Maak eerst een keuze: automatisch relevante contracten, of een specifiek contract.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="scope"
                checked={scopeMode === 'auto'}
                onChange={() => setScopeMode('auto')}
                disabled={loading}
              />
              <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
              Automatisch de meest relevante contracten kiezen
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="scope"
                checked={scopeMode === 'single'}
                onChange={() => setScopeMode('single')}
                disabled={loading}
              />
              Ik kies een specifiek contract
            </label>
            {scopeMode === 'single' && (
              <div className="space-y-2">
                <Label htmlFor="contract-select">Contract</Label>
                <select
                  id="contract-select"
                  value={selectedContractId}
                  onChange={(e) => setSelectedContractId(e.target.value)}
                  disabled={loading || contracts.length === 0}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecteer een contract</option>
                  {contracts.map((contract) => (
                    <option key={contract.id} value={contract.id}>
                      {contract.title}
                      {contract.contractNumber ? ` (#${contract.contractNumber})` : ''}
                    </option>
                  ))}
                </select>
                {selectedContract && (
                  <p className="text-xs text-muted-foreground">
                    Geselecteerd: <span className="font-medium text-slate-800">{selectedContract.title}</span>{' '}
                    <Badge variant="outline" className="text-[10px] ml-1">
                      {selectedContract.status}
                    </Badge>
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">2. Stel uw vraag</CardTitle>
            <CardDescription>Bijvoorbeeld: wat is de opzegtermijn, of hoe zit het met aansprakelijkheid?</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Typ uw vraag…"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="min-h-[120px] text-base"
              disabled={loading}
            />

            {scopeMode === 'single' && selectedContractId && (
              <div className="space-y-2">
                <Label className="text-base">Veelgestelde vragen</Label>
                <p className="text-xs text-muted-foreground">
                  Klik op een vraag om direct een antwoord voor{' '}
                  <span className="font-medium text-slate-800">{selectedContract?.title ?? 'dit contract'}</span> op
                  te halen.
                </p>
                <div className="flex flex-wrap gap-2">
                  {FREQUENT_QUESTIONS.map((faq, index) => {
                    const value = `faq-${index}`
                    const key = faqKey(faq)
                    const isActive = openFaqItem === value
                    return (
                      <Button
                        key={`chip-${faq}`}
                        type="button"
                        variant={isActive ? 'default' : 'outline'}
                        size="sm"
                        className="h-auto py-1.5 text-xs text-left whitespace-normal"
                        onClick={() => {
                          setOpenFaqItem(value)
                          void loadFaqAnswer(faq)
                        }}
                      >
                        {faqLoading[key] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        {faq}
                      </Button>
                    )
                  })}
                </div>
                <Accordion
                  type="single"
                  collapsible
                  value={openFaqItem}
                  className="w-full rounded-md border bg-white"
                  onValueChange={(value) => {
                    if (!value) {
                      setOpenFaqItem('')
                      return
                    }
                    setOpenFaqItem(value)
                    const index = Number(value.replace('faq-', ''))
                    if (Number.isNaN(index) || !FREQUENT_QUESTIONS[index]) return
                    void loadFaqAnswer(FREQUENT_QUESTIONS[index])
                  }}
                >
                  {FREQUENT_QUESTIONS.map((faq, index) => {
                    const key = faqKey(faq)
                    return (
                      <AccordionItem key={faq} value={`faq-${index}`} className="px-3">
                        <AccordionTrigger className="text-left text-sm">{faq}</AccordionTrigger>
                        <AccordionContent className="text-sm">
                          {faqLoading[key] ? (
                            <span className="inline-flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Antwoord ophalen...
                            </span>
                          ) : faqErrors[key] ? (
                            <span className="text-red-700">{faqErrors[key]}</span>
                          ) : faqAnswers[key] ? (
                            <span className="whitespace-pre-wrap text-muted-foreground">{faqAnswers[key]}</span>
                          ) : (
                            <span className="italic text-muted-foreground">Klik om het antwoord te laden.</span>
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="urls" className="flex items-center gap-2 text-base">
                <Link2 className="h-4 w-4" />
                Extra referentie-URL&apos;s (optioneel)
              </Label>
              <Textarea
                id="urls"
                placeholder={'Eén URL per regel, bijv.\nhttps://example.org/wetgeving/…'}
                value={referenceUrls}
                onChange={(e) => setReferenceUrls(e.target.value)}
                className="min-h-[72px] font-mono text-sm"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Publieke pagina&apos;s worden als platte tekst ingelezen (max. enkele honderden KB per URL).
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading || !question.trim() || (scopeMode === 'single' && !selectedContractId)}
              className="w-full sm:w-auto"
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Antwoord genereren
            </Button>
          </CardContent>
        </Card>
      </form>

      {error && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-6 text-sm text-red-800">{error}</CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Antwoord</CardTitle>
            {result.limitations && (
              <CardDescription className="text-amber-800">{result.limitations}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="prose prose-slate max-w-none">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{result.answer}</div>
            </div>

            {result.sources?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">Gebruikte bronnen</h3>
                <ul className="space-y-2 text-sm">
                  {result.sources.map((s, i) => (
                    <li key={i} className="border-l-2 border-blue-200 pl-3">
                      <div className="font-medium">
                        {s.type === 'contract' ? 'Contract' : 'URL'}: {s.title}
                      </div>
                      <div className="text-muted-foreground text-xs">{s.detail}</div>
                      <div className="mt-0.5">{s.relevance}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.contextSummary && (
              <div className="text-xs text-muted-foreground border-t pt-4 space-y-1">
                {result.contextSummary.contractsUsed.length > 0 && (
                  <p>
                    Documenten:{' '}
                    {result.contextSummary.contractsUsed.map((c) => (
                      <Link key={c.id} href={`/contracts/${c.id}`} className="text-blue-600 hover:underline mr-2">
                        {c.title}
                      </Link>
                    ))}
                  </p>
                )}
                {result.contextSummary.urlsUsed.length > 0 && (
                  <p>
                    Web:{' '}
                    {result.contextSummary.urlsUsed.map((u) => (
                      <a
                        key={u.url}
                        href={u.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline mr-2"
                      >
                        {u.url}
                      </a>
                    ))}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
