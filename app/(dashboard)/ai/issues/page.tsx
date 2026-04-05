'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, ShieldAlert, FileText, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Info, Clock } from 'lucide-react'
import type { ContractIssuesResult, ContractIssue, SavedIssuesAnalysis } from '@/app/api/ai/issues/route'

type ContractRow = { id: string; title: string; status: string; projectId: string | null }

type IssueState = ContractIssuesResult | 'loading' | { error: string } | null

const SEVERITY_CONFIG = {
  hoog: { label: 'Hoog', className: 'bg-red-100 text-red-800 border-red-200' },
  middel: { label: 'Middel', className: 'bg-orange-100 text-orange-800 border-orange-200' },
  laag: { label: 'Laag', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
}
const TYPE_CONFIG = {
  onduidelijkheid: { label: 'Onduidelijkheid', icon: '?' },
  tegenstrijdigheid: { label: 'Tegenstrijdigheid', icon: '⚡' },
  vaagheid: { label: 'Vaagheid', icon: '~' },
  leemte: { label: 'Leemte', icon: '○' },
}

function IssueCard({ issue }: { issue: ContractIssue }) {
  const [expanded, setExpanded] = useState(false)
  const severity = SEVERITY_CONFIG[issue.severity] ?? SEVERITY_CONFIG.laag
  const typeInfo = TYPE_CONFIG[issue.type] ?? { label: issue.type, icon: '!' }
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <button type="button" className="w-full text-left px-4 py-3" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 min-w-0">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-100 text-xs font-bold text-slate-600 mt-0.5">{typeInfo.icon}</span>
            <div className="min-w-0">
              <p className="font-medium text-sm text-slate-900">{issue.title}</p>
              <div className="flex flex-wrap gap-1.5 mt-1">
                <Badge variant="outline" className={`text-[10px] border ${severity.className}`}>{severity.label}</Badge>
                <Badge variant="outline" className="text-[10px]">{typeInfo.label}</Badge>
                {issue.articleRef && <Badge variant="secondary" className="text-[10px]">{issue.articleRef}</Badge>}
              </div>
            </div>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />}
        </div>
      </button>
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          <p className="text-sm text-slate-700 leading-relaxed">{issue.description}</p>
          {issue.excerpt && (
            <blockquote className="border-l-4 border-slate-300 bg-slate-50 pl-3 py-2 text-xs text-slate-600 italic">&ldquo;{issue.excerpt}&rdquo;</blockquote>
          )}
          {issue.suggestion && (
            <div className="rounded-md bg-green-50 border border-green-100 px-3 py-2">
              <p className="text-xs font-semibold text-green-800 mb-1">Aanbeveling</p>
              <p className="text-xs text-green-900 leading-relaxed">{issue.suggestion}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function IssueResultContent({ result }: { result: ContractIssuesResult | SavedIssuesAnalysis }) {
  const highCount = result.issues.filter((i) => i.severity === 'hoog').length
  const midCount = result.issues.filter((i) => i.severity === 'middel').length
  const lowCount = result.issues.filter((i) => i.severity === 'laag').length
  return (
    <div className="space-y-4">
      <Card className="border-slate-200">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className="rounded-lg p-2 bg-blue-50 shrink-0"><Info className="h-5 w-5 text-blue-600" /></div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm text-slate-900 mb-1">Kwaliteitsoordeel — {result.contractTitle}</h3>
              <p className="text-sm text-slate-700 leading-relaxed">{result.summary}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                {highCount > 0 && <Badge className="bg-red-100 text-red-800 border border-red-200 font-medium">{highCount} hoog risico</Badge>}
                {midCount > 0 && <Badge className="bg-orange-100 text-orange-800 border border-orange-200 font-medium">{midCount} middel risico</Badge>}
                {lowCount > 0 && <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-200 font-medium">{lowCount} laag risico</Badge>}
                {result.issues.length === 0 && <Badge className="bg-green-100 text-green-800 border border-green-200 font-medium">Geen problemen gevonden</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {result.issues.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" />Gevonden problemen ({result.issues.length})
          </h3>
          <div className="space-y-2">
            {[...result.issues]
              .sort((a, b) => ({ hoog: 0, middel: 1, laag: 2 }[a.severity] ?? 2) - ({ hoog: 0, middel: 1, laag: 2 }[b.severity] ?? 2))
              .map((issue, i) => <IssueCard key={i} issue={issue} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function SavedCard({ analysis }: { analysis: SavedIssuesAnalysis }) {
  const [open, setOpen] = useState(false)
  const high = analysis.issues.filter((i) => i.severity === 'hoog').length
  return (
    <Card className={`transition-all ${open ? 'border-red-300' : 'hover:border-slate-300'}`}>
      <button type="button" className="w-full text-left" onClick={() => setOpen(!open)}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <div>
                <CardTitle className="text-sm font-medium text-slate-900">{analysis.contractTitle}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px]">{analysis.issueCount} problemen</Badge>
                  {high > 0 && <Badge className="text-[10px] bg-red-100 text-red-800 border border-red-200">{high} hoog</Badge>}
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />{new Date(analysis.createdAt).toLocaleDateString('nl-NL')}
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
          <IssueResultContent result={analysis} />
        </CardContent>
      )}
    </Card>
  )
}

export default function IssuesPage() {
  const [contractList, setContractList] = useState<ContractRow[]>([])
  const [savedList, setSavedList] = useState<SavedIssuesAnalysis[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [issueState, setIssueState] = useState<IssueState>(null)

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/issues')
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data?.contracts)) setContractList(data.contracts)
      if (Array.isArray(data?.saved)) setSavedList(data.saved)
    } catch { /* ignore */ }
    finally { setLoadingData(false) }
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  async function analyzeContract(contractId: string) {
    if (!contractId) return
    setIssueState('loading')
    try {
      const res = await fetch('/api/ai/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractId }),
      })
      const data = await res.json()
      if (!res.ok) { setIssueState({ error: data.error ?? 'Fout bij analyseren' }); return }
      setIssueState(data as ContractIssuesResult)
      void loadData()
    } catch {
      setIssueState({ error: 'Netwerkfout' })
    }
  }

  const isLoading = issueState === 'loading'
  const isError = issueState != null && issueState !== 'loading' && typeof issueState === 'object' && 'error' in issueState
  const result = issueState != null && issueState !== 'loading' && typeof issueState === 'object' && !('error' in issueState)
    ? (issueState as ContractIssuesResult) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldAlert className="h-7 w-7 text-red-500" />
          Contractkwaliteit
        </h1>
        <p className="text-muted-foreground mt-1">
          De AI analyseert een contract op onduidelijkheden, tegenstrijdigheden, vaagheden en juridische leemten. Analyses worden opgeslagen.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nieuw analyseren</CardTitle>
          <CardDescription>Kies het contract dat u wilt laten analyseren op contractkwaliteit.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              {loadingData ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Laden…</div>
              ) : (
                <select
                  value={selectedId}
                  onChange={(e) => { setSelectedId(e.target.value); setIssueState(null) }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  disabled={isLoading}
                >
                  <option value="">Selecteer een contract…</option>
                  {contractList.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}{c.status !== 'actief' ? ` (${c.status})` : ''}</option>
                  ))}
                </select>
              )}
            </div>
            <Button onClick={() => analyzeContract(selectedId)} disabled={!selectedId || isLoading} className="sm:w-auto w-full gap-2">
              {isLoading ? <><Loader2 className="h-4 w-4 animate-spin" />Analyseren…</> : <><ShieldAlert className="h-4 w-4" />Analyseer contract</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
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
                <p className="text-sm text-red-600 mt-0.5">{(issueState as { error: string }).error}</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => analyzeContract(selectedId)}>Opnieuw proberen</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="border-red-200">
          <CardContent className="pt-5">
            <div className="flex justify-end mb-3">
              <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => analyzeContract(selectedId)} disabled={isLoading}>
                <RefreshCw className="h-3 w-3" />Hergenereer
              </Button>
            </div>
            <IssueResultContent result={result} />
            <p className="text-xs text-muted-foreground mt-4">Gegenereerd op {new Date(result.generatedAt).toLocaleString('nl-NL')}</p>
          </CardContent>
        </Card>
      )}

      {savedList.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Clock className="h-4 w-4" />Opgeslagen analyses ({savedList.length})
          </h2>
          {savedList.map((a) => <SavedCard key={a.id} analysis={a} />)}
        </div>
      )}
    </div>
  )
}
