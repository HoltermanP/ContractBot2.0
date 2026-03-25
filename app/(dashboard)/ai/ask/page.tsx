'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, MessageCircleQuestion, Sparkles, Link2 } from 'lucide-react'
import Link from 'next/link'

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

export default function ContractAskPage() {
  const [question, setQuestion] = useState('')
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [portfolioAuto, setPortfolioAuto] = useState(true)
  const [referenceUrls, setReferenceUrls] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AskResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  function toggleContract(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = question.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const contractIds = portfolioAuto ? [] : Object.keys(selected).filter((id) => selected[id])
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
          portfolioMode: portfolioAuto,
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
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Uw vraag</CardTitle>
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

            <div className="space-y-2">
              <Label className="text-base">Bronnen — contracten</Label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={portfolioAuto}
                  onChange={() => setPortfolioAuto(true)}
                  disabled={loading}
                />
                <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                Automatisch de meest relevante contracten kiezen (semantisch)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={!portfolioAuto}
                  onChange={() => setPortfolioAuto(false)}
                  disabled={loading}
                />
                Zelf contracten aanvinken
              </label>
              {!portfolioAuto && (
                <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2 bg-slate-50/80">
                  {contracts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Geen contracten geladen.</p>
                  ) : (
                    contracts.map((c) => (
                      <label key={c.id} className="flex items-start gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!selected[c.id]}
                          onChange={() => toggleContract(c.id)}
                          disabled={loading}
                          className="mt-0.5 rounded"
                        />
                        <span>
                          <span className="font-medium">{c.title}</span>
                          {c.contractNumber && (
                            <span className="text-muted-foreground"> · #{c.contractNumber}</span>
                          )}{' '}
                          <Badge variant="outline" className="text-[10px] ml-1">
                            {c.status}
                          </Badge>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>

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

            <Button type="submit" disabled={loading || !question.trim()} className="w-full sm:w-auto">
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
