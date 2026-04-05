'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Lightbulb, RefreshCw, AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import type { ContractInsights, SavedInsightsAnalysis } from '@/app/api/ai/insights/route'

type ContractRow = { id: string; title: string; status: string; projectId: string | null; projectName: string | null }

type AnalysisState = ContractInsights | 'loading' | { error: string } | null

function InsightResult({ result, onRegenerate, loading }: {
  result: ContractInsights
  onRegenerate: () => void
  loading: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{result.contractTitle}</h2>
          {result.projectName && (
            <p className="text-xs text-muted-foreground mt-0.5">Project: {result.projectName}</p>
          )}
        </div>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" onClick={onRegenerate} disabled={loading}>
          <RefreshCw className="h-3 w-3" />
          Hergenereer
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {result.points.map((point, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm text-slate-900">{point.title}</h3>
              {point.articleRef && <Badge variant="outline" className="text-[10px] shrink-0">{point.articleRef}</Badge>}
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{point.explanation}</p>
            <div className="rounded-md bg-amber-50 border border-amber-100 px-3 py-2">
              <p className="text-xs font-semibold text-amber-800 mb-1">Praktijkvoorbeeld</p>
              <p className="text-xs text-amber-900 leading-relaxed">{point.example}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Gegenereerd op {new Date(result.generatedAt).toLocaleString('nl-NL')}</p>
    </div>
  )
}

function SavedCard({ analysis }: { analysis: SavedInsightsAnalysis }) {
  const [open, setOpen] = useState(false)
  return (
    <Card className={`transition-all ${open ? 'border-amber-300' : 'hover:border-slate-300'}`}>
      <button type="button" className="w-full text-left" onClick={() => setOpen(!open)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <CardTitle className="text-sm font-medium text-slate-900">{analysis.contractTitle}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  {analysis.projectName && <Badge variant="secondary" className="text-[10px]">{analysis.projectName}</Badge>}
                  <Badge variant="outline" className="text-[10px]">{analysis.points.length} punten</Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(analysis.createdAt).toLocaleDateString('nl-NL')}
                  </span>
                </div>
              </div>
            </div>
            {open ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
          </div>
        </CardHeader>
      </button>
      {open && (
        <CardContent className="border-t pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {analysis.points.map((point, i) => (
              <div key={i} className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm text-slate-900">{point.title}</h3>
                  {point.articleRef && <Badge variant="outline" className="text-[10px] shrink-0">{point.articleRef}</Badge>}
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">{point.explanation}</p>
                <div className="rounded-md bg-amber-50 border border-amber-100 px-3 py-2">
                  <p className="text-xs font-semibold text-amber-800 mb-1">Praktijkvoorbeeld</p>
                  <p className="text-xs text-amber-900 leading-relaxed">{point.example}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export default function InsightsPage() {
  const [contractList, setContractList] = useState<ContractRow[]>([])
  const [savedList, setSavedList] = useState<SavedInsightsAnalysis[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [analysisState, setAnalysisState] = useState<AnalysisState>(null)

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/insights')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data?.contracts)) setContractList(data.contracts)
      if (Array.isArray(data?.saved)) setSavedList(data.saved)
    } catch { /* ignore */ }
    finally { setLoadingData(false) }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  async function generateInsights(contractId: string) {
    if (!contractId) return
    setAnalysisState('loading')
    try {
      const res = await fetch('/api/ai/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId }),
      })
      const data = await res.json()
      if (!res.ok) { setAnalysisState({ error: data.error ?? 'Fout bij genereren' }); return }
      setAnalysisState(data as ContractInsights)
      // Refresh saved list
      void loadData()
    } catch {
      setAnalysisState({ error: 'Netwerkfout' })
    }
  }

  const isLoading = analysisState === 'loading'
  const isError = analysisState != null && analysisState !== 'loading' && typeof analysisState === 'object' && 'error' in analysisState
  const result = analysisState != null && analysisState !== 'loading' && typeof analysisState === 'object' && !('error' in analysisState)
    ? (analysisState as ContractInsights) : null

  const byProject: Record<string, ContractRow[]> = {}
  const noProject: ContractRow[] = []
  for (const c of contractList) {
    if (c.projectName) {
      if (!byProject[c.projectName]) byProject[c.projectName] = []
      byProject[c.projectName].push(c)
    } else { noProject.push(c) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Lightbulb className="h-7 w-7 text-amber-500" />
          Praktijkpunten per contract
        </h1>
        <p className="text-muted-foreground mt-1">
          De AI analyseert een contract en toont de meest praktijkgerichte punten — inclusief uitgewerkte voorbeelden. Analyses worden opgeslagen.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nieuw analyseren</CardTitle>
          <CardDescription>Contracten zijn gegroepeerd per project.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              {loadingData ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />Laden…
                </div>
              ) : (
                <select
                  value={selectedId}
                  onChange={(e) => { setSelectedId(e.target.value); setAnalysisState(null) }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={isLoading}
                >
                  <option value="">Selecteer een contract…</option>
                  {Object.entries(byProject).map(([projectName, cs]) => (
                    <optgroup key={projectName} label={projectName}>
                      {cs.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}{c.status !== 'actief' ? ` (${c.status})` : ''}</option>
                      ))}
                    </optgroup>
                  ))}
                  {noProject.length > 0 && (
                    <optgroup label="Geen project">
                      {noProject.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}{c.status !== 'actief' ? ` (${c.status})` : ''}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}
            </div>
            <Button onClick={() => generateInsights(selectedId)} disabled={!selectedId || isLoading} className="sm:w-auto w-full gap-2">
              {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Analyseren…</> : <><Lightbulb className="h-4 w-4" />Analyseer contract</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500 mx-auto mb-4" />
            <p className="text-sm font-medium text-slate-700">Contract wordt geanalyseerd…</p>
            <p className="text-xs text-muted-foreground mt-1">Dit kan 20–40 seconden duren.</p>
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card className="border-red-200">
          <CardContent className="py-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Analyse mislukt</p>
                <p className="text-sm text-red-600 mt-0.5">{(analysisState as { error: string }).error}</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => generateInsights(selectedId)}>Opnieuw proberen</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="border-amber-200">
          <CardContent className="pt-5">
            <InsightResult result={result} onRegenerate={() => generateInsights(selectedId)} loading={isLoading} />
          </CardContent>
        </Card>
      )}

      {savedList.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Opgeslagen analyses ({savedList.length})
          </h2>
          {savedList.map((a) => <SavedCard key={a.id} analysis={a} />)}
        </div>
      )}
    </div>
  )
}
