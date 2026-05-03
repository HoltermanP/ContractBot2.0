'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  Bot,
  Link2,
  Copy,
  Check,
  FolderOpen,
  Building2,
  FileText,
  Send,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import DOMPurify from 'dompurify'
import ReactMarkdown from 'react-markdown'

type ContractRow = {
  id: string
  title: string
  contractNumber: string | null
  status: string
  projectId: string | null
  projectName: string | null
}

type ProjectRow = { id: string; name: string }

type AskResponse = {
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
    projectScope?: { id: string; name: string }
  }
}

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  response?: AskResponse
  isError?: boolean
}

type FaqCluster = { id: string; label: string; askCount: number }

type ScopeMode = 'org' | 'project' | 'single'

export default function ContractAskClient() {
  const searchParams = useSearchParams()
  const contractIdFromUrl = searchParams.get('contractId')
  const projectIdFromUrl = searchParams.get('projectId')
  const [question, setQuestion] = useState('')
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [scopeMode, setScopeMode] = useState<ScopeMode>('org')
  const [selectedScopeProjectId, setSelectedScopeProjectId] = useState('')
  const [contractSearch, setContractSearch] = useState('')
  const [selectedContractId, setSelectedContractId] = useState('')
  const [referenceUrls, setReferenceUrls] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [faqClusters, setFaqClusters] = useState<FaqCluster[]>([])
  const chatScrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/contracts')
        const json = await res.json()
        const data = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : []
        if (!cancelled && data.length >= 0) {
          setContracts(
            data.map((c: ContractRow & { project?: { id: string; name: string } | null }) => ({
              id: c.id,
              title: c.title,
              contractNumber: c.contractNumber,
              status: c.status,
              projectId: c.projectId ?? c.project?.id ?? null,
              projectName: c.project?.name ?? null,
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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/projects')
        const json = await res.json()
        const data = Array.isArray(json) ? json : Array.isArray(json?.data) ? json.data : []
        if (
          !cancelled &&
          Array.isArray(data) &&
          data.every((row: unknown) => row && typeof row === 'object' && typeof (row as ProjectRow).id === 'string')
        ) {
          setProjects(
            (data as ProjectRow[]).map((p) => ({
              id: p.id,
              name: p.name,
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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/ai/ask/faq')
        if (!res.ok) return
        const data = await res.json()
        if (
          cancelled ||
          !Array.isArray(data) ||
          !data.every(
            (row: unknown) =>
              row &&
              typeof row === 'object' &&
              typeof (row as FaqCluster).id === 'string' &&
              typeof (row as FaqCluster).label === 'string'
          )
        ) {
          return
        }
        setFaqClusters(data as FaqCluster[])
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function refreshFaqClusters() {
    try {
      const res = await fetch('/api/ai/ask/faq')
      if (!res.ok) return
      const data = await res.json()
      if (
        Array.isArray(data) &&
        data.every(
          (row: unknown) =>
            row &&
            typeof row === 'object' &&
            typeof (row as FaqCluster).id === 'string' &&
            typeof (row as FaqCluster).label === 'string'
        )
      ) {
        setFaqClusters(data as FaqCluster[])
      }
    } catch {
      /* ignore */
    }
  }

  const selectedContract = useMemo(
    () => contracts.find((contract) => contract.id === selectedContractId) ?? null,
    [contracts, selectedContractId]
  )

  const overviewGroups = useMemo(() => {
    const q = contractSearch.trim().toLowerCase()
    const projectIds = new Set(projects.map((p) => p.id))

    function contractMatches(c: ContractRow) {
      if (!q) return true
      return (
        c.title.toLowerCase().includes(q) ||
        Boolean(c.contractNumber?.toLowerCase().includes(q)) ||
        Boolean(c.projectName?.toLowerCase().includes(q))
      )
    }

    function projectMatches(p: ProjectRow) {
      if (!q) return true
      return p.name.toLowerCase().includes(q)
    }

    const byTitle = (a: ContractRow, b: ContractRow) => a.title.localeCompare(b.title, 'nl', { sensitivity: 'base' })

    const groups: { project: ProjectRow | null; contracts: ContractRow[] }[] = []

    for (const p of projects) {
      let projectContracts = contracts.filter((c) => c.projectId === p.id)
      if (q) {
        projectContracts = projectContracts.filter(contractMatches)
        if (projectContracts.length === 0 && !projectMatches(p)) continue
      }
      groups.push({
        project: p,
        contracts: [...projectContracts].sort(byTitle),
      })
    }

    const orphanIds = new Set<string>()
    for (const c of contracts) {
      if (c.projectId && !projectIds.has(c.projectId)) {
        orphanIds.add(c.projectId)
      }
    }
    for (const pid of orphanIds) {
      let list = contracts.filter((c) => c.projectId === pid)
      const name = list.find((c) => c.projectName)?.projectName?.trim() || 'Onbekend project'
      if (q) {
        list = list.filter(contractMatches)
        const nameMatch = name.toLowerCase().includes(q)
        if (list.length === 0 && !nameMatch) continue
      }
      groups.push({
        project: { id: pid, name },
        contracts: [...list].sort(byTitle),
      })
    }

    const unassigned = contracts.filter((c) => !c.projectId)
    if (unassigned.length > 0) {
      let list = q ? unassigned.filter(contractMatches) : unassigned
      if (list.length > 0) {
        groups.push({
          project: null,
          contracts: [...list].sort(byTitle),
        })
      }
    }

    return groups
  }, [contracts, projects, contractSearch])

  const selectedScopeProject = useMemo(
    () => projects.find((p) => p.id === selectedScopeProjectId) ?? null,
    [projects, selectedScopeProjectId]
  )

  useEffect(() => {
    if (contracts.length === 0) return
    if (contractIdFromUrl) {
      const exists = contracts.some((contract) => contract.id === contractIdFromUrl)
      if (exists) {
        setScopeMode('single')
        setSelectedContractId(contractIdFromUrl)
      }
      return
    }
    if (projectIdFromUrl && projects.some((p) => p.id === projectIdFromUrl)) {
      setScopeMode('project')
      setSelectedScopeProjectId(projectIdFromUrl)
    }
  }, [contractIdFromUrl, projectIdFromUrl, contracts, projects])

  /** Zorg dat project-modus niet op een lege projectkeuze blijft hangen (dan blijft Verstuur uitgeschakeld). */
  useEffect(() => {
    if (scopeMode !== 'project') return
    if (selectedScopeProjectId) return
    if (projects.length === 0) return
    setSelectedScopeProjectId(projects[0].id)
  }, [scopeMode, selectedScopeProjectId, projects])

  function scrollChatToBottom() {
    const el = chatScrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    })
  }

  /** Na layout: voorkomt dat scrollHeight nog 0 is na nieuwe berichten (minder “haperend” scrollen). */
  useLayoutEffect(() => {
    scrollChatToBottom()
  }, [chatMessages])

  /** Direct tonen: geen “typewriter” — die veroorzaakte honderden re-renders en een trage UI. */
  function applyAssistantAnswer(messageId: string, response: AskResponse) {
    const fullAnswer = response.answer ?? ''
    setChatMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, content: fullAnswer, response } : msg
      )
    )
  }

  async function submitQuestion(rawQuestion: string) {
    const q = rawQuestion.trim()
    if (!q) return
    if (scopeMode === 'single' && !selectedContractId) return
    if (scopeMode === 'project' && !selectedScopeProjectId) return

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: q,
    }
    const assistantMessageId = `assistant-${Date.now()}`
    setChatMessages((prev) => [...prev, userMessage, { id: assistantMessageId, role: 'assistant', content: '' }])
    setQuestion('')
    setLoading(true)
    setError(null)

    try {
      const contractIds = scopeMode === 'single' ? [selectedContractId] : []
      const urls = referenceUrls
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean)

      const payload: Record<string, unknown> = {
        question: q,
        contractIds,
        portfolioMode: scopeMode !== 'single',
        referenceUrls: urls,
      }
      if (scopeMode === 'project' && selectedScopeProjectId) {
        payload.projectId = selectedScopeProjectId
      }

      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const raw = await res.text()
      let data: { error?: string } & Partial<AskResponse> = {}
      try {
        data = raw ? (JSON.parse(raw) as typeof data) : {}
      } catch {
        const errMessage = raw?.slice(0, 200) || 'Ongeldig antwoord van de server'
        setError(errMessage)
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId ? { ...msg, content: errMessage, isError: true } : msg
          )
        )
        return
      }
      if (!res.ok) {
        const errMessage = typeof data.error === 'string' ? data.error : 'Er ging iets mis'
        setError(errMessage)
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId ? { ...msg, content: errMessage, isError: true } : msg
          )
        )
        return
      }
      applyAssistantAnswer(assistantMessageId, data as AskResponse)
      void refreshFaqClusters()
    } catch {
      const errMessage = 'Netwerkfout'
      setError(errMessage)
      setChatMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId ? { ...msg, content: errMessage, isError: true } : msg
        )
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await submitQuestion(question)
  }

  async function handleFollowUpQuestionClick(suggestedQuestion: string) {
    if (loading) return
    await submitQuestion(suggestedQuestion)
  }

  async function handleFaqClusterClick(clusterId: string) {
    if (loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ai/ask/faq/${encodeURIComponent(clusterId)}`)
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Kon opgeslagen antwoord niet laden')
        return
      }
      const questionText = typeof data.questionText === 'string' ? data.questionText : ''
      const response = data.response as AskResponse | undefined
      if (!response || typeof response.answer !== 'string') {
        setError('Ongeldig opgeslagen antwoord')
        return
      }
      const ts = Date.now()
      setChatMessages((prev) => [
        ...prev,
        { id: `user-faq-${ts}`, role: 'user', content: questionText },
        {
          id: `assistant-faq-${ts}`,
          role: 'assistant',
          content: response.answer,
          response,
        },
      ])
    } catch {
      setError('Netwerkfout bij laden FAQ-antwoord')
    } finally {
      setLoading(false)
    }
  }

  function handleQuestionKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    if (
      loading ||
      !question.trim() ||
      (scopeMode === 'single' && !selectedContractId) ||
      (scopeMode === 'project' && !selectedScopeProjectId)
    ) {
      return
    }
    e.preventDefault()
    void submitQuestion(question)
  }

  function sanitizeAssistantHtml(html: string) {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p',
        'br',
        'strong',
        'em',
        'u',
        'ul',
        'ol',
        'li',
        'h1',
        'h2',
        'h3',
        'h4',
        'blockquote',
        'code',
        'pre',
        'a',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
      ],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
    })
  }

  function contentLooksLikeHtml(content: string) {
    return /<\/?[a-z][\s\S]*>/i.test(content)
  }

  const assistantContentClassName =
    'prose prose-zinc prose-sm max-w-none leading-7 text-[15px] prose-headings:scroll-m-20 prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-zinc-900 prose-h1:mt-1 prose-h1:mb-3 prose-h1:text-xl prose-h2:mt-6 prose-h2:mb-2 prose-h2:text-lg prose-h3:mt-5 prose-h3:mb-2 prose-h3:text-base prose-p:my-3 prose-p:text-zinc-800 prose-strong:text-zinc-900 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-blockquote:my-4 prose-blockquote:border-l-[3px] prose-blockquote:border-zinc-300 prose-blockquote:bg-zinc-100/80 prose-blockquote:py-2 prose-blockquote:px-3 prose-blockquote:italic prose-code:rounded-md prose-code:bg-zinc-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-pre:my-4 prose-pre:rounded-xl prose-pre:border prose-pre:border-zinc-200 prose-pre:bg-zinc-950 prose-pre:text-zinc-100 prose-a:font-medium prose-a:text-zinc-800 prose-a:underline-offset-4 hover:prose-a:underline prose-table:my-4 prose-table:w-full prose-th:border prose-th:border-zinc-200 prose-th:bg-zinc-100 prose-th:px-2 prose-th:py-1.5 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-td:border prose-td:border-zinc-200 prose-td:px-2 prose-td:py-1.5'

  async function handleCopyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopiedMessageId(message.id)
      setTimeout(() => setCopiedMessageId((prev) => (prev === message.id ? null : prev)), 1500)
    } catch {
      /* ignore clipboard errors */
    }
  }

  const canSubmit =
    !loading &&
    question.trim().length > 0 &&
    (scopeMode !== 'single' || Boolean(selectedContractId)) &&
    (scopeMode !== 'project' || Boolean(selectedScopeProjectId))

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-[1400px] flex-col pb-6',
        /* Op desktop: vaste hoogte zodat alleen het gesprek scrollt (geen dubbele page-scroll + flex-1 groeit niet eindeloos). */
        'lg:min-h-0 lg:h-[calc(100dvh-9rem)] lg:overflow-hidden'
      )}
    >
      {/* Compacte kop — vergelijkbaar met een chat-product */}
      <header className="flex shrink-0 flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">Contractagent</h1>
          <p className="mt-0.5 max-w-xl text-sm text-zinc-500">
            Vragen over uw contracten, met bronnen uit documenten en optioneel uit eigen URL&apos;s.
          </p>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400 sm:mt-0">
          <MessageSquare className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Eén doorlopend gesprek</span>
          <span className="sm:hidden">Gesprek rechts</span>
        </div>
      </header>

      <div className="mt-6 flex min-h-0 flex-1 flex-col gap-6 overflow-hidden lg:flex-row lg:items-stretch lg:gap-8">
        {/* Linkerpaneel: eigen scroll binnen vaste layout (geen sticky + page-scroll conflict) */}
        <aside
          className="w-full space-y-4 lg:min-h-0 lg:w-[min(100%,380px)] lg:shrink-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1 xl:w-[400px]"
          aria-label="Zoekbereik en vraag"
        >
      {/* Zoekbereik: segment-knoppen i.p.v. losse kaart */}
      <section
        className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm"
        aria-label="Zoekbereik"
      >
        <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-400">Zoekbereik</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => setScopeMode('org')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm',
              scopeMode === 'org'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'bg-zinc-100/80 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            )}
          >
            <Building2 className="h-3.5 w-3.5 shrink-0 opacity-90" />
            Organisatie
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => setScopeMode('project')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm',
              scopeMode === 'project'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'bg-zinc-100/80 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            )}
          >
            <FolderOpen className="h-3.5 w-3.5 shrink-0 opacity-90" />
            Project
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => setScopeMode('single')}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm',
              scopeMode === 'single'
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'bg-zinc-100/80 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
            )}
          >
            <FileText className="h-3.5 w-3.5 shrink-0 opacity-90" />
            Eén contract
          </button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-zinc-500">
          Bij organisatie of project kiest de agent zelf relevante documenten. Bij één contract wordt alleen dat dossier
          gebruikt. Kies hieronder een project (hele map) of een enkel contract.
        </p>
      </section>

      <section
        className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm"
        aria-label="Projecten en contracten"
      >
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-400">Projecten &amp; contracten</p>
        <p className="mb-3 text-xs leading-relaxed text-zinc-500">
          Klik op een <span className="font-medium text-zinc-700">project</span> voor vragen over die map, of op een{' '}
          <span className="font-medium text-zinc-700">contract</span> voor één dossier.
        </p>
        <div className="space-y-2">
          <Label htmlFor="contract-search" className="text-xs text-zinc-600">
            Zoeken
          </Label>
          <Input
            id="contract-search"
            placeholder="Project- of contractnaam, nummer…"
            value={contractSearch}
            onChange={(e) => setContractSearch(e.target.value)}
            disabled={loading}
            className="rounded-xl border-zinc-200 text-sm"
          />
        </div>

        <div className="mt-3 max-h-[min(42vh,340px)] overflow-y-auto overscroll-contain rounded-xl border border-zinc-100 bg-zinc-50/40">
          {contracts.length === 0 ? (
            <p className="p-4 text-xs leading-relaxed text-zinc-500">
              Nog geen contracten. Voeg er een toe onder{' '}
              <Link href="/contracts" className="font-medium text-zinc-800 underline-offset-2 hover:underline">
                Contracten
              </Link>
              .
            </p>
          ) : overviewGroups.length === 0 ? (
            <p className="p-4 text-xs text-zinc-500">Geen resultaten voor deze zoekopdracht.</p>
          ) : (
            <ul className="divide-y divide-zinc-100/90 p-1">
              {overviewGroups.map((group) => {
                const p = group.project
                const projectSelected = Boolean(p && scopeMode === 'project' && selectedScopeProjectId === p.id)
                return (
                  <li key={p ? p.id : 'unassigned'} className="py-1">
                    {p ? (
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          setScopeMode('project')
                          setSelectedScopeProjectId(p.id)
                          setSelectedContractId('')
                        }}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors',
                          projectSelected
                            ? 'bg-zinc-900 text-white shadow-sm'
                            : 'text-zinc-800 hover:bg-white hover:shadow-sm'
                        )}
                      >
                        <span className="min-w-0 truncate">{p.name}</span>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium tabular-nums sm:text-[11px]',
                            projectSelected ? 'bg-white/15 text-white' : 'bg-zinc-200/80 text-zinc-600'
                          )}
                        >
                          {group.contracts.length}
                        </span>
                      </button>
                    ) : (
                      <p className="px-2.5 py-2 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                        Zonder project
                      </p>
                    )}
                    <ul className="mt-0.5 space-y-0.5 pb-1 pl-1 sm:pl-2" role="list">
                      {group.contracts.map((c) => {
                        const contractSelected = scopeMode === 'single' && selectedContractId === c.id
                        return (
                          <li key={c.id}>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => {
                                setScopeMode('single')
                                setSelectedContractId(c.id)
                              }}
                              className={cn(
                                'flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors sm:text-[13px]',
                                contractSelected
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : 'text-zinc-700 hover:bg-white hover:shadow-sm'
                              )}
                            >
                              <FileText
                                className={cn(
                                  'mt-0.5 h-3.5 w-3.5 shrink-0 opacity-80',
                                  contractSelected ? 'text-white' : 'text-zinc-400'
                                )}
                                aria-hidden
                              />
                              <span className="min-w-0 flex-1 leading-snug">
                                <span className="line-clamp-2 font-medium">{c.title}</span>
                                {c.contractNumber ? (
                                  <span
                                    className={cn(
                                      'mt-0.5 block text-[11px] tabular-nums',
                                      contractSelected ? 'text-blue-100' : 'text-zinc-500'
                                    )}
                                  >
                                    #{c.contractNumber}
                                  </span>
                                ) : null}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {scopeMode === 'project' && selectedScopeProject ? (
          <p className="mt-3 text-xs text-zinc-500">
            Actief: project{' '}
            <span className="font-medium text-zinc-800">{selectedScopeProject.name}</span> — de agent kiest relevante
            documenten (beperkt aantal per rondgang).
          </p>
        ) : null}
        {scopeMode === 'single' && selectedContract ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
            <span>
              Actief: <span className="font-medium text-zinc-800">{selectedContract.title}</span>
            </span>
            <Badge variant="secondary" className="text-[10px] font-normal">
              {selectedContract.status}
            </Badge>
          </div>
        ) : null}
      </section>

      <details className="group rounded-2xl border border-dashed border-zinc-200/90 bg-zinc-50/50 px-4 py-3 text-sm text-zinc-600 open:border-zinc-300 open:bg-white">
        <summary className="cursor-pointer list-none font-medium text-zinc-700 outline-none marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <span className="text-zinc-400 transition-transform group-open:rotate-90">▸</span>
            Aan de slag (projecten &amp; documenten)
          </span>
        </summary>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-zinc-600 sm:text-sm">
          <li>
            Maak een project onder <Link href="/projects" className="font-medium text-zinc-800 underline-offset-2 hover:underline">Projecten</Link> (het project &quot;Algemeen&quot; bestaat al).
          </li>
          <li>
            Voeg contracten toe met PDF- of DOCX-documenten zodat de agent de tekst kan gebruiken.
          </li>
          <li>Kies het zoekbereik hierboven; bronnen en beperkingen staan bij elk antwoord.</li>
        </ol>
      </details>

          <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] sm:p-5"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">Uw vraag</p>
            <details className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2 text-left">
              <summary className="cursor-pointer select-none text-xs font-medium text-zinc-500 outline-none [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                  Referentie-URL&apos;s (optioneel)
                </span>
              </summary>
              <Label htmlFor="urls" className="sr-only">
                Extra referentie-URL&apos;s
              </Label>
              <Textarea
                id="urls"
                placeholder={'Eén URL per regel\nhttps://…'}
                value={referenceUrls}
                onChange={(e) => setReferenceUrls(e.target.value)}
                className="mt-2 min-h-[56px] resize-y border-zinc-200 bg-white font-mono text-xs"
                disabled={loading}
              />
            </details>

            <div className="flex items-end gap-2 rounded-2xl border border-zinc-200/90 bg-white px-2 py-2 shadow-[0_2px_12px_rgba(0,0,0,0.04)] focus-within:border-zinc-300 focus-within:ring-2 focus-within:ring-zinc-200/80 sm:gap-3 sm:px-3 sm:py-2.5">
              <Textarea
                id="chat-input"
                placeholder="Stel een vraag…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleQuestionKeyDown}
                rows={3}
                disabled={loading}
                className="max-h-[220px] min-h-[5.5rem] flex-1 resize-y border-0 bg-transparent px-1 py-2 text-[15px] leading-relaxed text-zinc-900 shadow-none placeholder:text-zinc-400 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!canSubmit}
                className="h-10 w-10 shrink-0 rounded-xl sm:h-11 sm:w-11"
                aria-label={loading ? 'Bezig…' : 'Verstuur vraag'}
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                ) : (
                  <Send className="h-5 w-5" aria-hidden />
                )}
              </Button>
            </div>
            <p className="text-center text-[11px] text-zinc-400">
              Enter om te versturen · Shift+Enter voor nieuwe regel
            </p>
            {!loading &&
            question.trim() &&
            ((scopeMode === 'project' && !selectedScopeProjectId) ||
              (scopeMode === 'single' && !selectedContractId)) ? (
              <p className="text-center text-xs text-amber-800/90" role="status">
                {scopeMode === 'project' && !selectedScopeProjectId ? (
                  projects.length === 0 ? (
                    <>
                      Geen projecten beschikbaar. Maak eerst een project aan onder <Link href="/projects" className="underline">Projecten</Link>.
                    </>
                  ) : (
                    <>Kies een project in de lijst &quot;Projecten &amp; contracten&quot;.</>
                  )
                ) : scopeMode === 'single' && !selectedContractId ? (
                  contracts.length === 0 ? (
                    <>
                      Geen contracten gevonden. Voeg een contract toe onder{' '}
                      <Link href="/contracts" className="underline">Contracten</Link>.
                    </>
                  ) : (
                    <>Klik op een contract in de lijst hierboven (of kies eerst &quot;Project&quot; voor een hele map).</>
                  )
                ) : null}
              </p>
            ) : null}
          </form>
        </aside>

        {/* Rechterkolom: alleen gesprek — min-h-0 nodig zodat flex-kind kan krimpen en overflow-y werkt */}
        <div className="flex min-h-[min(52dvh,520px)] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-zinc-50/90 shadow-[0_1px_0_rgba(0,0,0,0.04)] lg:min-h-0">
        {faqClusters.length > 0 ? (
          <div className="shrink-0 space-y-2 border-b border-zinc-200/80 bg-white/60 px-4 py-3 sm:px-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400">Vaak gevraagd</p>
            <p className="text-xs text-zinc-500">
              Tik voor een eerder opgeslagen antwoord (zonder nieuwe AI-rondgang).
            </p>
            <div className="flex flex-wrap gap-2">
              {faqClusters.map((c) => (
                <Button
                  key={c.id}
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={loading}
                  className="h-auto max-w-full rounded-full border-0 bg-zinc-100/90 px-3 py-1.5 text-left text-xs font-normal text-zinc-800 hover:bg-zinc-200/90 sm:text-sm"
                  onClick={() => handleFaqClusterClick(c.id)}
                >
                  <span className="line-clamp-2">{c.label}</span>
                  {c.askCount > 1 ? (
                    <Badge variant="outline" className="ml-2 shrink-0 border-zinc-200 text-[10px] text-zinc-600">
                      ×{c.askCount}
                    </Badge>
                  ) : null}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        <div
          ref={chatScrollRef}
          className="min-h-0 flex-1 space-y-6 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-6 [scrollbar-gutter:stable] sm:px-6"
        >
          {error ? (
            <div className="rounded-xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-sm text-red-900">{error}</div>
          ) : null}

          {chatMessages.length === 0 && (
            <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 px-2 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-zinc-200/80">
                <Bot className="h-6 w-6 text-zinc-500" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-800">Waar kan ik u mee helpen?</p>
                <p className="mt-1 max-w-sm text-sm leading-relaxed text-zinc-500">
                  <span className="lg:hidden">Stel uw vraag in het veld hierboven. </span>
                  <span className="hidden lg:inline">Stel uw vraag in het linkerpaneel. </span>
                  Antwoorden bevatten bronvermelding en kunnen vervolgsuggesties tonen.
                </p>
              </div>
            </div>
          )}

          {chatMessages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex w-full',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  message.role === 'user'
                    ? 'max-w-[min(100%,85%)] rounded-[1.15rem] bg-zinc-200/90 px-4 py-2.5 text-[15px] leading-relaxed text-zinc-900 shadow-sm'
                    : cn(
                        'max-w-[min(100%,100%)] text-[15px] leading-relaxed text-zinc-900',
                        message.isError
                          ? 'rounded-[1.15rem] border border-red-200 bg-red-50/90 px-4 py-3 text-red-900'
                          : 'rounded-[1.15rem] border border-zinc-200/60 bg-white px-4 py-3 shadow-sm'
                      )
                )}
              >
                  {message.role === 'assistant' && !message.isError && message.response ? (
                    contentLooksLikeHtml(message.content) ? (
                      <div className={`${assistantContentClassName} [&_table]:overflow-hidden [&_table]:rounded-lg`} dangerouslySetInnerHTML={{ __html: sanitizeAssistantHtml(message.content) }} />
                    ) : (
                      <div className={assistantContentClassName}>
                        <ReactMarkdown
                          components={{
                            table: ({ children }) => (
                              <div className="my-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white">
                                <table className="w-full text-sm">{children}</table>
                              </div>
                            ),
                            a: ({ href, children }) => (
                              <a href={href} target="_blank" rel="noopener noreferrer">
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                    )
                  ) : (
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {message.content}
                      {loading && message.role === 'assistant' && !message.content && !message.isError ? (
                        <Loader2 className="inline-block ml-2 h-4 w-4 animate-spin align-text-bottom" />
                      ) : null}
                    </div>
                  )}

                  {message.role === 'assistant' && message.content && !message.isError && (
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyMessage(message)}
                        className="h-8 gap-1.5 rounded-full text-zinc-600 hover:text-zinc-900"
                      >
                        {copiedMessageId === message.id ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Gekopieerd
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            Kopieer
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {message.role === 'assistant' && message.response && (
                    <div className="mt-4 space-y-4">
                      {message.response.contextSummary?.projectScope && (
                        <div className="rounded-md border border-blue-200 bg-blue-50/90 px-3 py-2 text-xs text-slate-800">
                          <span className="font-semibold">Zoekbereik: </span>
                          Project{' '}
                          <span className="font-medium">{message.response.contextSummary.projectScope.name}</span>
                          <Link
                            href={`/projects/${message.response.contextSummary.projectScope.id}`}
                            className="ml-2 text-blue-700 underline-offset-2 hover:underline"
                          >
                            Open project
                          </Link>
                        </div>
                      )}

                      {message.response.limitations && (
                        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          {message.response.limitations}
                        </div>
                      )}

                      {message.response.followUpQuestions && message.response.followUpQuestions.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide text-muted-foreground">
                            Vervolgvraag suggesties
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {message.response.followUpQuestions.map((suggestion, i) => (
                              <Button
                                key={`${message.id}-follow-up-${i}`}
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={loading}
                                className="h-auto rounded-full border-zinc-200 bg-white whitespace-normal text-left font-normal text-zinc-800 hover:bg-zinc-50"
                                onClick={() => handleFollowUpQuestionClick(suggestion)}
                              >
                                {suggestion}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {message.response.sources?.length > 0 && (
                        <div>
                          <h3 className="text-xs font-semibold mb-2 uppercase tracking-wide text-muted-foreground">
                            Gebruikte bronnen
                          </h3>
                          <ul className="space-y-2 text-sm">
                            {message.response.sources.map((s, i) => {
                              const label =
                                s.type === 'contract'
                                  ? 'Contract'
                                  : s.type === 'contractstuk'
                                    ? 'Extra contractstuk'
                                    : s.type === 'addendum'
                                      ? 'Addendum'
                                      : s.type === 'url'
                                        ? 'URL'
                                        : s.type
                              const titleLine = `${label}: ${s.title}`
                              return (
                                <li key={i} className="border-l-2 border-blue-200 pl-3">
                                  <div className="font-medium">
                                    {s.href ? (
                                      <a
                                        href={s.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-700 underline-offset-4 hover:underline"
                                      >
                                        {titleLine}
                                      </a>
                                    ) : (
                                      titleLine
                                    )}
                                  </div>
                                  <div className="text-muted-foreground text-xs break-words">
                                    {s.href ? (
                                      <a
                                        href={s.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 underline-offset-2 hover:underline break-all"
                                      >
                                        {s.detail}
                                      </a>
                                    ) : (
                                      s.detail
                                    )}
                                  </div>
                                  <div className="mt-0.5 text-slate-800">{s.relevance}</div>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}

                      {message.response.contextSummary && (
                        <div className="text-xs text-muted-foreground border-t pt-3 space-y-1">
                          {message.response.contextSummary.contractsUsed.length > 0 && (
                            <p>
                              Gebruikte contracten in deze rondgang:{' '}
                              {[...new Map(message.response.contextSummary.contractsUsed.map((c) => [c.id, c])).values()].map((c) => (
                                <Link key={c.id} href={`/contracts/${c.id}`} className="text-blue-600 hover:underline mr-2">
                                  {c.title}
                                </Link>
                              ))}
                            </p>
                          )}
                          {message.response.contextSummary.urlsUsed.length > 0 && (
                            <p>
                              Web:{' '}
                              {message.response.contextSummary.urlsUsed.map((u) => (
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
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
