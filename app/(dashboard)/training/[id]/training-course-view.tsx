'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MarkdownBody } from '@/components/training/markdown-body'
import { Label } from '@/components/ui/label'
import {
  ArrowLeft,
  Loader2,
  Presentation,
  Trash2,
  CheckCircle2,
  Circle,
  Send,
} from 'lucide-react'

type QuizQ = { question: string; options: string[]; correctIndex: number }

type Module = {
  id: string
  title: string
  bodyMarkdown: string
  quizJson: { questions: QuizQ[] } | null
  estimatedMinutes: number | null
  sortOrder: number
}

type CoursePayload = {
  id: string
  title: string
  description: string | null
  status: 'draft' | 'published'
  gammaGenerationId: string | null
  gammaUrl: string | null
  gammaExportUrl: string | null
  gammaStatus: string | null
  modules: Module[]
  completedModuleIds: string[]
}

export function TrainingCourseView({ courseId, canManage }: { courseId: string; canManage: boolean }) {
  const router = useRouter()
  const [data, setData] = useState<CoursePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [gammaBusy, setGammaBusy] = useState(false)
  const [quizAnswers, setQuizAnswers] = useState<Record<string, Record<number, number>>>({})

  const load = useCallback(async () => {
    const res = await fetch(`/api/training/courses/${courseId}`)
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Laden mislukt')
    setData(json)
  }, [courseId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await load()
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Fout')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [load])

  useEffect(() => {
    if (!data?.gammaGenerationId || data.gammaStatus === 'completed' || data.gammaStatus === 'failed') return
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/training/courses/${courseId}/gamma/poll`, { method: 'POST' })
        const json = await res.json()
        if (res.ok && (json.status === 'completed' || json.status === 'failed')) {
          await load()
          clearInterval(t)
        }
      } catch {
        /* ignore */
      }
    }, 5000)
    return () => clearInterval(t)
  }, [courseId, data?.gammaGenerationId, data?.gammaStatus, load])

  async function markComplete(moduleId: string) {
    const res = await fetch('/api/training/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moduleId }),
    })
    if (res.ok) await load()
  }

  async function publish() {
    const res = await fetch(`/api/training/courses/${courseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published' }),
    })
    if (res.ok) await load()
  }

  async function startGamma() {
    setGammaBusy(true)
    try {
      const res = await fetch(`/api/training/courses/${courseId}/gamma`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numCards: 14, textMode: 'preserve', exportAs: 'pdf' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Gamma-start mislukt')
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Gamma-fout')
    } finally {
      setGammaBusy(false)
    }
  }

  async function removeCourse() {
    if (!confirm('Deze training definitief verwijderen?')) return
    const res = await fetch(`/api/training/courses/${courseId}`, { method: 'DELETE' })
    if (res.ok) router.push('/training')
  }

  if (loading) {
    return (
      <div className="p-12 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <p className="text-red-600">{error ?? 'Niet gevonden'}</p>
        <Button variant="outline" asChild className="mt-4">
          <Link href="/training">Terug naar overzicht</Link>
        </Button>
      </div>
    )
  }

  const total = data.modules.length
  const done = data.completedModuleIds.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/training">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Alle trainingen
        </Link>
      </Button>

      <div className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold text-slate-900">{data.title}</h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant={data.status === 'published' ? 'default' : 'secondary'}>
              {data.status === 'published' ? 'Gepubliceerd' : 'Concept'}
            </Badge>
          </div>
        </div>
        {data.description && <p className="text-slate-600 whitespace-pre-wrap">{data.description}</p>}
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span>Voortgang: {done}/{total} module(s)</span>
          <div className="flex-1 max-w-xs h-2 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Beheer</CardTitle>
            <CardDescription>Publiceren, Gamma-presentatie, verwijderen.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {data.status === 'draft' && (
              <Button type="button" variant="secondary" onClick={() => void publish()}>
                <Send className="h-4 w-4 mr-2" />
                Publiceren
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => void startGamma()} disabled={gammaBusy || total === 0}>
              {gammaBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Presentation className="h-4 w-4 mr-2" />}
              Presentatie (Gamma)
            </Button>
            <Button type="button" variant="destructive" onClick={() => void removeCourse()}>
              <Trash2 className="h-4 w-4 mr-2" />
              Verwijderen
            </Button>
          </CardContent>
          {(data.gammaStatus === 'pending' || (data.gammaGenerationId && !data.gammaUrl)) && (
            <CardContent className="pt-0 text-sm text-slate-600 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Gamma genereert uw presentatie… (dit kan een minuut duren)
            </CardContent>
          )}
          {data.gammaUrl && (
            <CardContent className="pt-0 flex flex-wrap gap-3 text-sm">
              <a
                href={data.gammaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline font-medium"
              >
                Open presentatie in Gamma
              </a>
              {data.gammaExportUrl && (
                <a
                  href={data.gammaExportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Download export
                </a>
              )}
            </CardContent>
          )}
        </Card>
      )}

      <div className="space-y-6">
        {data.modules
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((m, idx) => {
            const completed = data.completedModuleIds.includes(m.id)
            const questions = m.quizJson?.questions ?? []
            const answers = quizAnswers[m.id] ?? {}
            return (
              <Card key={m.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">
                        Module {idx + 1}: {m.title}
                      </CardTitle>
                      {m.estimatedMinutes != null && (
                        <CardDescription>Ca. {m.estimatedMinutes} min lezen</CardDescription>
                      )}
                    </div>
                    {completed ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
                    ) : (
                      <Circle className="h-6 w-6 text-slate-300 shrink-0" />
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <MarkdownBody content={m.bodyMarkdown} />
                  {questions.length > 0 && (
                    <div className="border-t pt-4 space-y-4">
                      <p className="text-sm font-medium text-slate-800">Kenniscontrole</p>
                      {questions.map((q, qi) => (
                        <div key={qi} className="space-y-2">
                          <p className="text-sm">{q.question}</p>
                          <div className="space-y-1">
                            {q.options.map((opt, oi) => (
                              <label key={oi} className="flex items-center gap-2 text-sm cursor-pointer">
                                <input
                                  type="radio"
                                  name={`quiz-${m.id}-${qi}`}
                                  checked={answers[qi] === oi}
                                  onChange={() =>
                                    setQuizAnswers((prev) => ({
                                      ...prev,
                                      [m.id]: { ...(prev[m.id] ?? {}), [qi]: oi },
                                    }))
                                  }
                                  className="border-slate-300"
                                />
                                {opt}
                              </label>
                            ))}
                          </div>
                          {answers[qi] !== undefined && (
                            <p
                              className={`text-xs ${answers[qi] === q.correctIndex ? 'text-green-700' : 'text-amber-800'}`}
                            >
                              {answers[qi] === q.correctIndex ? 'Juist.' : 'Niet juist; bekijk de module nog eens.'}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    type="button"
                    variant={completed ? 'outline' : 'default'}
                    size="sm"
                    onClick={() => void markComplete(m.id)}
                    disabled={completed}
                  >
                    {completed ? 'Voltooid' : 'Markeer als voltooid'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
      </div>
    </div>
  )
}
