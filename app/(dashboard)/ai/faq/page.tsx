'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, HelpCircle, Bot, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'

type FaqCluster = { id: string; label: string; askCount: number }

type AskResponse = {
  answer: string
  sources: { type: string; title: string; detail: string; relevance: string; href?: string | null }[]
  limitations: string | null
  followUpQuestions?: string[]
}

type LoadedAnswer = { questionText: string; response: AskResponse }

export default function FaqPage() {
  const [clusters, setClusters] = useState<FaqCluster[]>([])
  const [loadingClusters, setLoadingClusters] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, LoadedAnswer | 'loading' | 'error'>>({})

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/ai/ask/faq?limit=10')
        if (!res.ok) return
        const data = await res.json()
        if (Array.isArray(data)) setClusters(data as FaqCluster[])
      } catch {
        /* ignore */
      } finally {
        setLoadingClusters(false)
      }
    })()
  }, [])

  async function toggleCluster(clusterId: string) {
    if (expandedId === clusterId) {
      setExpandedId(null)
      return
    }
    setExpandedId(clusterId)
    if (answers[clusterId]) return

    setAnswers((prev) => ({ ...prev, [clusterId]: 'loading' }))
    try {
      const res = await fetch(`/api/ai/ask/faq/${encodeURIComponent(clusterId)}`)
      const data = await res.json()
      if (!res.ok || typeof data.response?.answer !== 'string') {
        setAnswers((prev) => ({ ...prev, [clusterId]: 'error' }))
        return
      }
      setAnswers((prev) => ({
        ...prev,
        [clusterId]: { questionText: data.questionText ?? '', response: data.response as AskResponse },
      }))
    } catch {
      setAnswers((prev) => ({ ...prev, [clusterId]: 'error' }))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <HelpCircle className="h-7 w-7 text-purple-600" />
            Veelgestelde vragen
          </h1>
          <p className="text-muted-foreground mt-1">
            De 10 meestgestelde vragen over uw contracten, automatisch gegroepeerd door de AI. Klik op een vraag voor het
            opgeslagen antwoord.
          </p>
        </div>
        <Link
          href="/ai/ask"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 shrink-0"
        >
          <Bot className="h-4 w-4" />
          Stel een nieuwe vraag
        </Link>
      </div>

      {loadingClusters ? (
        <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
          <Loader2 className="h-5 w-5 animate-spin" />
          Veelgestelde vragen laden…
        </div>
      ) : clusters.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <HelpCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground font-medium">Nog geen veelgestelde vragen</p>
            <p className="text-xs text-muted-foreground mt-1">
              Zodra u vragen stelt via de Contractagent, verschijnen hier de meestgestelde onderwerpen.
            </p>
            <Link
              href="/ai/ask"
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Bot className="h-4 w-4" />
              Open Contractagent
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {clusters.map((cluster, index) => {
            const isExpanded = expandedId === cluster.id
            const answerState = answers[cluster.id]

            return (
              <Card
                key={cluster.id}
                className={`transition-all ${isExpanded ? 'border-blue-300 shadow-sm' : 'hover:border-slate-300'}`}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => toggleCluster(cluster.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                          {index + 1}
                        </span>
                        <CardTitle className="text-sm font-medium leading-relaxed text-slate-900">
                          {cluster.label}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {cluster.askCount > 1 && (
                          <Badge variant="secondary" className="text-[10px]">
                            {cluster.askCount}× gevraagd
                          </Badge>
                        )}
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </button>

                {isExpanded && (
                  <CardContent className="pt-0 border-t">
                    {answerState === 'loading' ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Antwoord laden…
                      </div>
                    ) : answerState === 'error' ? (
                      <p className="py-4 text-sm text-red-600">Antwoord kon niet worden geladen.</p>
                    ) : answerState ? (
                      <div className="py-3 space-y-4">
                        <div className="prose prose-slate prose-sm max-w-none">
                          <ReactMarkdown>{answerState.response.answer}</ReactMarkdown>
                        </div>

                        {answerState.response.limitations && (
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            {answerState.response.limitations}
                          </div>
                        )}

                        {answerState.response.sources?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Bronnen</p>
                            <ul className="space-y-1.5 text-xs text-muted-foreground">
                              {answerState.response.sources.map((s, i) => (
                                <li key={i} className="border-l-2 border-blue-200 pl-3">
                                  <span className="font-medium text-slate-700">{s.title}</span>
                                  {s.detail && <span className="ml-1">— {s.detail}</span>}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t">
                          <p className="text-xs text-muted-foreground">Opgeslagen antwoord — geen nieuwe AI-aanroep</p>
                          <Button
                            size="sm"
                            variant="outline"
                            asChild
                            className="h-7 text-xs"
                          >
                            <Link href={`/ai/ask`}>
                              Doorvragen
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
