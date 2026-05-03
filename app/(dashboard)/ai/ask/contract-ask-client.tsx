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
  ChevronDown,
} from 'lucide-react'
import { cn, formatDate, STATUS_LABELS } from '@/lib/utils'
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
  endDate: string | null
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

type ScopeMode = 'org' | 'project'

/** Lijstfilter: leeg = alle projecten; anders project-id; __unassigned__ = contracten zonder project */
const LIST_FILTER_UNASSIGNED = '__unassigned__'

/** Gelijk aan server-side MAX_CONTEXT_CONTRACTS voor beheerbare context */
const MAX_SELECTED_CONTRACTS = 5

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
  /** Filter op project voor de contractlijst in de balk bovenaan. */
  const [listFilterProjectId, setListFilterProjectId] = useState('')
  /** Meerdere contracten: AI gebruikt uitsluitend deze dossiers. Leeg = brede portfolio-zoekslag (of heel project). */
  const [selectedContractIds, setSelectedContractIds] = useState<string[]>([])
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
            data.map((c: ContractRow & { project?: { id: string; name: string } | null; endDate?: unknown }) => {
              let endDate: string | null = null
              const raw = (c as { endDate?: unknown }).endDate
              if (raw != null) {
                endDate = typeof raw === 'string' ? raw : raw instanceof Date ? raw.toISOString() : null
              }
              return {
                id: c.id,
                title: c.title,
                contractNumber: c.contractNumber,
                status: c.status,
                projectId: c.projectId ?? c.project?.id ?? null,
                projectName: c.project?.name ?? null,
                endDate,
              }
            })
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

  const projectFilterOptions = useMemo(() => {
    const knownIds = new Set(projects.map((p) => p.id))
    const opts: { id: string; label: string; count: number }[] = projects.map((p) => ({
      id: p.id,
      label: p.name,
      count: contracts.filter((c) => c.projectId === p.id).length,
    }))
    const orphanIds = new Set<string>()
    for (const c of contracts) {
      if (c.projectId && !knownIds.has(c.projectId)) orphanIds.add(c.projectId)
    }
    for (const pid of orphanIds) {
      const list = contracts.filter((c) => c.projectId === pid)
      const name = list.find((c) => c.projectName)?.projectName?.trim() || 'Onbekend project'
      opts.push({ id: pid, label: name, count: list.length })
    }
    opts.sort((a, b) => a.label.localeCompare(b.label, 'nl', { sensitivity: 'base' }))
    const unassignedCount = contracts.filter((c) => !c.projectId).length
    return { opts, unassignedCount }
  }, [projects, contracts])

  const filteredContractsForList = useMemo(() => {
    let list: ContractRow[]
    if (listFilterProjectId === LIST_FILTER_UNASSIGNED) {
      list = contracts.filter((c) => !c.projectId)
    } else if (listFilterProjectId) {
      list = contracts.filter((c) => c.projectId === listFilterProjectId)
    } else {
      list = [...contracts]
    }
    const q = contractSearch.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          Boolean(c.contractNumber?.toLowerCase().includes(q)) ||
          Boolean(c.projectName?.toLowerCase().includes(q))
      )
    }
    return [...list].sort((a, b) => a.title.localeCompare(b.title, 'nl', { sensitivity: 'base' }))
  }, [contracts, listFilterProjectId, contractSearch])

  const selectedScopeProject = useMemo(
    () => projects.find((p) => p.id === selectedScopeProjectId) ?? null,
    [projects, selectedScopeProjectId]
  )

  useEffect(() => {
    if (contracts.length === 0) return
    if (contractIdFromUrl) {
      const exists = contracts.some((contract) => contract.id === contractIdFromUrl)
      if (exists) {
        setScopeMode('org')
        setSelectedScopeProjectId('')
        setSelectedContractIds([contractIdFromUrl])
      }
      return
    }
    if (projectIdFromUrl && projects.some((p) => p.id === projectIdFromUrl)) {
      setScopeMode('project')
      setSelectedScopeProjectId(projectIdFromUrl)
      setListFilterProjectId(projectIdFromUrl)
      setSelectedContractIds([])
    }
  }, [contractIdFromUrl, projectIdFromUrl, contracts, projects])

  useEffect(() => {
    setSelectedContractIds((prev) =>
      prev.filter((id) => {
        const c = contracts.find((x) => x.id === id)
        if (!c) return false
        if (listFilterProjectId === LIST_FILTER_UNASSIGNED) return !c.projectId
        if (listFilterProjectId && listFilterProjectId !== LIST_FILTER_UNASSIGNED) {
          return c.projectId === listFilterProjectId
        }
        return true
      })
    )
  }, [listFilterProjectId, contracts])

  /** Lijstfilter gelijk trekken bij projectmodus (contracten van dat project tonen). */
  useEffect(() => {
    if (scopeMode === 'project' && selectedScopeProjectId) {
      setListFilterProjectId(selectedScopeProjectId)
    }
  }, [scopeMode, selectedScopeProjectId])

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
      const urls = referenceUrls
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean)

      const explicitIds = [...new Set(selectedContractIds)].slice(0, MAX_SELECTED_CONTRACTS)
      const wholeProject =
        scopeMode === 'project' && Boolean(selectedScopeProjectId) && explicitIds.length === 0

      const payload: Record<string, unknown> = {
        question: q,
        contractIds: explicitIds,
        portfolioMode: explicitIds.length === 0,
        referenceUrls: urls,
      }
      if (wholeProject) {
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

  const bronnenSummary = useMemo(() => {
    if (scopeMode === 'project' && selectedScopeProject && selectedContractIds.length === 0) {
      return `Heel project: ${selectedScopeProject.name}`
    }
    if (selectedContractIds.length === 1) {
      const c = contracts.find((x) => x.id === selectedContractIds[0])
      return c ? `Alleen: ${c.title}` : '1 contract geselecteerd'
    }
    if (selectedContractIds.length > 1) {
      return `Alleen: ${selectedContractIds.length} contracten (max. ${MAX_SELECTED_CONTRACTS})`
    }
    return 'Geen dossierkeuze — brede zoekslag over alle contracten'
  }, [scopeMode, selectedScopeProject, selectedContractIds, contracts])

  function toggleContractSelection(contractId: string) {
    setScopeMode('org')
    setSelectedScopeProjectId('')
    setSelectedContractIds((prev) => {
      if (prev.includes(contractId)) return prev.filter((id) => id !== contractId)
      if (prev.length >= MAX_SELECTED_CONTRACTS) return prev
      return [...prev, contractId]
    })
  }

  const canSubmit =
    !loading &&
    question.trim().length > 0 &&
    !(scopeMode === 'project' && !selectedScopeProjectId)

  function handleQuestionKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return
    if (e.key !== 'Enter' || e.shiftKey) return
    // Enter = versturen (geen nieuwe regel); Shift+Enter = standaard gedrag (nieuwe regel).
    e.preventDefault()
    if (!canSubmit) return
    void submitQuestion(question)
  }

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
            Zonder gekozen contract(en) zoekt de agent breed; met selectie alleen in die dossiers (meerdere mogelijk, tot{' '}
            {MAX_SELECTED_CONTRACTS}).
          </p>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-zinc-400 sm:mt-0">
          <MessageSquare className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Eén doorlopend gesprek</span>
          <span className="sm:hidden">Antwoord rechts</span>
        </div>
      </header>

      {/* Inklapbare bronkeuze — standaard één regel, chat krijgt de ruimte */}
      <section id="contractagent-bronnen-hub" className="mt-2 shrink-0" aria-label="Bronnen kiezen">
        <details className="group rounded-lg border border-zinc-200/90 bg-white shadow-sm">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 text-left marker:content-none [&::-webkit-details-marker]:hidden">
            <ChevronDown
              className="h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform group-open:rotate-180"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-semibold text-zinc-800">Bronnen</span>
              <span className="mt-0.5 block truncate text-[10px] leading-snug text-zinc-500">{bronnenSummary}</span>
            </div>
          </summary>
          <div className="border-t border-zinc-100 px-2 pb-2 pt-1">
            <div id="contractagent-project-strip" className="flex flex-wrap items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-wide text-blue-700">Project</span>
              {listFilterProjectId && listFilterProjectId !== LIST_FILTER_UNASSIGNED ? (
                <Button
                  type="button"
                  disabled={loading}
                  size="sm"
                  variant="secondary"
                  className="h-6 rounded-md px-2 text-[10px] font-semibold"
                  onClick={() => {
                    setScopeMode('project')
                    setSelectedScopeProjectId(listFilterProjectId)
                    setSelectedContractIds([])
                  }}
                >
                  Heel dit project
                </Button>
              ) : null}
              {selectedContractIds.length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={loading}
                  className="h-6 px-2 text-[10px] text-zinc-600"
                  onClick={() => setSelectedContractIds([])}
                >
                  Wis contractkeuze
                </Button>
              ) : null}
            </div>
            <div
              className="mt-1 flex gap-1.5 overflow-x-auto overscroll-x-contain pb-0.5 pt-0.5 [scrollbar-width:thin]"
              style={{ WebkitOverflowScrolling: 'touch' }}
              role="list"
            >
              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setListFilterProjectId('')
                  setScopeMode('org')
                  setSelectedScopeProjectId('')
                  setSelectedContractIds([])
                }}
                role="listitem"
                className={cn(
                  'flex w-[min(8.5rem,calc(100vw-6rem))] shrink-0 items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-[10px] transition-colors',
                  listFilterProjectId === ''
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-zinc-50/80 text-zinc-900 hover:border-zinc-300'
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded',
                    listFilterProjectId === '' ? 'bg-white/15 text-white' : 'bg-zinc-200/80 text-zinc-600'
                  )}
                >
                  <Building2 className="h-3 w-3" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-tight">Alle</span>
                  <span className={cn('text-[9px]', listFilterProjectId === '' ? 'text-zinc-300' : 'text-zinc-500')}>
                    {contracts.length} st.
                  </span>
                </span>
              </button>
              {projectFilterOptions.opts.map((o) => {
                const active = listFilterProjectId === o.id
                return (
                  <button
                    key={o.id}
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setListFilterProjectId(o.id)
                      setScopeMode('org')
                      setSelectedScopeProjectId('')
                    }}
                    role="listitem"
                    className={cn(
                      'flex w-[min(8.5rem,calc(100vw-6rem))] shrink-0 items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-[10px] transition-colors',
                      active
                        ? 'border-zinc-900 bg-zinc-900 text-white'
                        : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded',
                        active ? 'bg-white/15 text-white' : 'bg-emerald-50 text-emerald-700'
                      )}
                    >
                      <FolderOpen className="h-3 w-3" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 font-semibold leading-snug">{o.label}</span>
                      <span className={cn('text-[9px]', active ? 'text-zinc-300' : 'text-zinc-500')}>{o.count} st.</span>
                    </span>
                  </button>
                )
              })}
              {projectFilterOptions.unassignedCount > 0 ? (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => {
                    setListFilterProjectId(LIST_FILTER_UNASSIGNED)
                    setScopeMode('org')
                    setSelectedScopeProjectId('')
                  }}
                  role="listitem"
                  className={cn(
                    'flex w-[min(8.5rem,calc(100vw-6rem))] shrink-0 items-center gap-1.5 rounded-md border border-dashed px-1.5 py-1 text-left text-[10px] transition-colors',
                    listFilterProjectId === LIST_FILTER_UNASSIGNED
                      ? 'border-zinc-900 bg-zinc-900 text-white'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-800 hover:border-zinc-300'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded',
                      listFilterProjectId === LIST_FILTER_UNASSIGNED
                        ? 'bg-white/15 text-white'
                        : 'bg-zinc-200/80 text-zinc-600'
                    )}
                  >
                    <FolderOpen className="h-3 w-3 opacity-80" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-tight">Zonder proj.</span>
                    <span
                      className={cn(
                        'text-[9px]',
                        listFilterProjectId === LIST_FILTER_UNASSIGNED ? 'text-zinc-300' : 'text-zinc-500'
                      )}
                    >
                      {projectFilterOptions.unassignedCount} st.
                    </span>
                  </span>
                </button>
              ) : null}
            </div>

            <div id="contractagent-contract-strip" className="mt-1.5 border-t border-zinc-50 pt-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[9px] font-bold uppercase tracking-wide text-blue-700">Contract</span>
                <span className="text-[9px] text-zinc-400">klik om aan/uit · max. {MAX_SELECTED_CONTRACTS}</span>
                <div className="ml-auto w-full min-w-[8rem] max-w-[14rem] sm:w-44">
                  <Label htmlFor="contract-search" className="sr-only">
                    Zoek contract
                  </Label>
                  <Input
                    id="contract-search"
                    placeholder="Zoeken…"
                    value={contractSearch}
                    onChange={(e) => setContractSearch(e.target.value)}
                    disabled={loading}
                    className="h-7 rounded-md border-zinc-200 text-[11px]"
                  />
                </div>
              </div>
              <div
                className="mt-1 flex max-h-[5rem] gap-1.5 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-0.5 [scrollbar-width:thin]"
                style={{ WebkitOverflowScrolling: 'touch' }}
                role="list"
              >
                {contracts.length === 0 ? (
                  <p className="w-full rounded border border-zinc-200 bg-zinc-50/80 px-2 py-1.5 text-[10px] text-zinc-600" role="status">
                    Geen contracten —{' '}
                    <Link href="/contracts" className="font-medium underline-offset-2 hover:underline">
                      toevoegen
                    </Link>
                  </p>
                ) : filteredContractsForList.length === 0 ? (
                  <p className="w-full rounded border border-amber-200/80 bg-amber-50/80 px-2 py-1.5 text-[10px] text-amber-950" role="status">
                    Geen resultaat.
                  </p>
                ) : (
                  filteredContractsForList.map((c) => {
                    const contractSelected = selectedContractIds.includes(c.id)
                    const atMax = selectedContractIds.length >= MAX_SELECTED_CONTRACTS
                    const statusLabel = STATUS_LABELS[c.status] ?? c.status
                    const statusVariant =
                      c.status === 'actief' ? 'success' : c.status === 'verlopen' ? 'danger' : 'outline'
                    const showProject = !listFilterProjectId && c.projectName
                    return (
                      <button
                        key={c.id}
                        type="button"
                        disabled={loading || (!contractSelected && atMax)}
                        role="listitem"
                        title={
                          !contractSelected && atMax
                            ? `Maximaal ${MAX_SELECTED_CONTRACTS} contracten`
                            : 'Toggle selectie voor deze vraag'
                        }
                        aria-pressed={contractSelected}
                        onClick={() => toggleContractSelection(c.id)}
                        className={cn(
                          'relative flex w-[min(9rem,calc(100vw-6rem))] shrink-0 flex-col rounded-md border px-1.5 py-1 text-left text-[10px] transition-all sm:w-[9.5rem]',
                          contractSelected
                            ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                            : 'border-zinc-200 bg-white hover:border-zinc-300',
                          !contractSelected && atMax && 'opacity-45'
                        )}
                      >
                        {contractSelected ? (
                          <Check className="absolute right-1 top-1 h-3 w-3 text-blue-100" aria-hidden />
                        ) : null}
                        <div className="flex items-start gap-1 pr-3">
                          <FileText
                            className={cn(
                              'mt-0.5 h-3 w-3 shrink-0',
                              contractSelected ? 'text-blue-100' : 'text-blue-600'
                            )}
                            aria-hidden
                          />
                          <span
                            className={cn(
                              'line-clamp-2 font-semibold leading-snug',
                              contractSelected ? 'text-white' : 'text-zinc-900'
                            )}
                          >
                            {c.title}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-0.5">
                          {c.contractNumber ? (
                            <span
                              className={cn(
                                'text-[9px] tabular-nums',
                                contractSelected ? 'text-blue-100' : 'text-zinc-600'
                              )}
                            >
                              #{c.contractNumber}
                            </span>
                          ) : null}
                          <Badge
                            variant={contractSelected ? 'outline' : statusVariant}
                            className={cn(
                              'h-3.5 px-1 text-[8px] font-medium',
                              contractSelected && 'border-white/50 bg-white/15 text-white'
                            )}
                          >
                            {statusLabel}
                          </Badge>
                          {c.endDate ? (
                            <span
                              className={cn(
                                'text-[9px] tabular-nums',
                                contractSelected ? 'text-blue-100' : 'text-zinc-500'
                              )}
                            >
                              {formatDate(c.endDate)}
                            </span>
                          ) : null}
                        </div>
                        {showProject ? (
                          <p
                            className={cn(
                              'mt-0.5 line-clamp-1 text-[9px]',
                              contractSelected ? 'text-blue-100/90' : 'text-zinc-500'
                            )}
                          >
                            {c.projectName}
                          </p>
                        ) : null}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>
        </details>
      </section>

      {/* Vraag (groot) naast antwoord */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden lg:flex-row lg:items-stretch lg:gap-6">
        <div
          className={cn(
            'flex min-h-0 w-full min-w-0 flex-col gap-3',
            'lg:h-full lg:min-h-0 lg:max-w-[min(100%,520px)] lg:flex-1 lg:shrink-0 lg:overflow-y-auto lg:overscroll-contain xl:max-w-[560px]'
          )}
          aria-label="Uw vraag"
        >
          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm ring-1 ring-zinc-100/80 sm:p-5"
          >
            <p className="shrink-0 text-xs font-medium uppercase tracking-wider text-zinc-400">Uw vraag</p>
            <details className="mt-2 shrink-0 rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2 text-left">
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

            <div className="mt-3 flex min-h-0 flex-1 flex-col gap-2 rounded-2xl border border-zinc-200/90 bg-zinc-50/40 p-2 focus-within:border-zinc-300 focus-within:ring-2 focus-within:ring-zinc-200/80 sm:p-3">
              <Textarea
                id="chat-input"
                placeholder="Stel uw vraag over de contracten…"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleQuestionKeyDown}
                rows={14}
                disabled={loading}
                className="min-h-[min(42vh,22rem)] w-full flex-1 resize-y border-0 bg-transparent px-2 py-2 text-[15px] leading-relaxed text-zinc-900 shadow-none placeholder:text-zinc-400 focus-visible:ring-0 focus-visible:ring-offset-0 lg:min-h-[min(52vh,28rem)]"
              />
              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-zinc-200/80 pt-2">
                <p className="text-[11px] text-zinc-400">
                  Enter verstuurt · Shift+Enter nieuwe regel
                </p>
                <Button
                  type="submit"
                  size="default"
                  disabled={!canSubmit}
                  className="rounded-xl gap-2"
                  aria-label={loading ? 'Bezig…' : 'Verstuur vraag'}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden />
                  )}
                  Verstuur
                </Button>
              </div>
            </div>
            {!loading && question.trim() && scopeMode === 'project' && !selectedScopeProjectId ? (
              <p className="mt-2 text-center text-xs text-amber-800/90" role="status">
                {projects.length === 0 ? (
                  <>
                    Geen projecten.{' '}
                    <Link href="/projects" className="underline">
                      Projecten
                    </Link>
                  </>
                ) : (
                  <>Open bronnen hierboven en kies &quot;Heel dit project&quot; of een contract.</>
                )}
              </p>
            ) : null}
          </form>

          <details className="group shrink-0 rounded-2xl border border-dashed border-zinc-200/90 bg-zinc-50/50 px-4 py-3 text-sm text-zinc-600 open:border-zinc-300 open:bg-white">
            <summary className="cursor-pointer list-none font-medium text-zinc-700 outline-none marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-2">
                <span className="text-zinc-400 transition-transform group-open:rotate-90">▸</span>
                Aan de slag
              </span>
            </summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-xs leading-relaxed text-zinc-600 sm:text-sm">
              <li>
                Vouw <span className="font-medium">Bronnen</span> open: filter project, kies één of meerdere contracten, of
                &quot;Heel dit project&quot;. Zonder contractkeuze is de zoekslag breed.
              </li>
              <li>
                Maak projecten aan onder{' '}
                <Link href="/projects" className="font-medium text-zinc-800 underline-offset-2 hover:underline">
                  Projecten
                </Link>{' '}
                en voeg PDF/DOCX toe bij{' '}
                <Link href="/contracts" className="font-medium text-zinc-800 underline-offset-2 hover:underline">
                  Contracten
                </Link>
                .
              </li>
            </ol>
          </details>
        </div>

        <div className="flex min-h-[min(44dvh,440px)] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200/90 bg-zinc-50/90 shadow-[0_1px_0_rgba(0,0,0,0.04)] lg:min-h-0">
        <div className="shrink-0 border-b border-zinc-200/80 bg-white/90 px-3 py-2 sm:px-4">
          <p className="text-[11px] text-zinc-500">
            Bronnen wijzigen?{' '}
            <button
              type="button"
              className="font-medium text-blue-700 underline-offset-2 hover:underline"
              onClick={() => document.getElementById('contractagent-bronnen-hub')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              Naar boven
            </button>
          </p>
        </div>
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
                  <span className="lg:hidden">Typ uw vraag in het grote veld hierboven. </span>
                  <span className="hidden lg:inline">Typ uw vraag in het veld links van dit antwoord. </span>
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
