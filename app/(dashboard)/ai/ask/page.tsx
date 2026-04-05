'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Bot, Sparkles, Link2, Copy, Check } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import DOMPurify from 'dompurify'
import ReactMarkdown from 'react-markdown'

type ContractRow = { id: string; title: string; contractNumber: string | null; status: string }

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

export default function ContractAskPage() {
  const searchParams = useSearchParams()
  const contractIdFromUrl = searchParams.get('contractId')
  const [question, setQuestion] = useState('')
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [scopeMode, setScopeMode] = useState<'auto' | 'single'>('auto')
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

  useEffect(() => {
    if (!contractIdFromUrl || contracts.length === 0) return
    const exists = contracts.some((contract) => contract.id === contractIdFromUrl)
    if (exists) {
      setScopeMode('single')
      setSelectedContractId(contractIdFromUrl)
    }
  }, [contractIdFromUrl, contracts])

  function scrollChatToBottom() {
    const el = chatScrollRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }

  useEffect(() => {
    scrollChatToBottom()
  }, [chatMessages])

  async function typeAssistantAnswer(messageId: string, response: AskResponse) {
    const fullAnswer = response.answer ?? ''
    const answerLength = fullAnswer.length
    const step = Math.max(1, Math.ceil(answerLength / 180))

    for (let i = step; i < answerLength; i += step) {
      const partial = fullAnswer.slice(0, i)
      setChatMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, content: partial } : msg))
      )
      await new Promise((resolve) => setTimeout(resolve, 14))
    }

    setChatMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, content: fullAnswer, response } : msg))
    )
  }

  async function submitQuestion(rawQuestion: string) {
    const q = rawQuestion.trim()
    if (!q) return
    if (scopeMode === 'single' && !selectedContractId) return

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
        const errMessage = data.error ?? 'Er ging iets mis'
        setError(errMessage)
        setChatMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId ? { ...msg, content: errMessage, isError: true } : msg
          )
        )
        return
      }
      await typeAssistantAnswer(assistantMessageId, data as AskResponse)
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
    e.preventDefault()
    e.currentTarget.form?.requestSubmit()
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
    'prose prose-slate prose-sm max-w-none leading-7 prose-headings:scroll-m-20 prose-headings:font-semibold prose-headings:tracking-tight prose-h1:mt-1 prose-h1:mb-3 prose-h1:text-xl prose-h2:mt-6 prose-h2:mb-2 prose-h2:text-lg prose-h3:mt-5 prose-h3:mb-2 prose-h3:text-base prose-p:my-3 prose-strong:text-slate-900 prose-ul:my-3 prose-ol:my-3 prose-li:my-1 prose-blockquote:my-4 prose-blockquote:border-l-4 prose-blockquote:border-blue-200 prose-blockquote:bg-blue-50/60 prose-blockquote:py-2 prose-blockquote:px-3 prose-blockquote:italic prose-code:rounded prose-code:bg-slate-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-pre:my-4 prose-pre:rounded-lg prose-pre:border prose-pre:border-slate-200 prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-a:font-medium prose-a:text-blue-700 prose-a:underline-offset-4 hover:prose-a:underline prose-table:my-4 prose-table:w-full prose-th:border prose-th:border-slate-200 prose-th:bg-slate-100 prose-th:px-2 prose-th:py-1.5 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-td:border prose-td:border-slate-200 prose-td:px-2 prose-td:py-1.5'

  async function handleCopyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopiedMessageId(message.id)
      setTimeout(() => setCopiedMessageId((prev) => (prev === message.id ? null : prev)), 1500)
    } catch {
      /* ignore clipboard errors */
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Bot className="h-7 w-7 text-blue-600" />
          Contractagent
        </h1>
        <p className="text-muted-foreground mt-1">
          Stel een vraag over uw contracten. Het antwoord wordt onderbouwd met de contractdocumenten en optioneel met
          door u opgegeven webpagina&apos;s (URL&apos;s).
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Card className="border-blue-100 bg-blue-50/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Zoekbereik</CardTitle>
            <CardDescription>Automatisch over contracten, of gefocust op één document.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scope"
                  checked={scopeMode === 'auto'}
                  onChange={() => setScopeMode('auto')}
                  disabled={loading}
                />
                <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
                Automatisch relevante contracten
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="scope"
                  checked={scopeMode === 'single'}
                  onChange={() => setScopeMode('single')}
                  disabled={loading}
                />
                Eén specifiek contract
              </label>
            </div>
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
                  <div className="text-xs text-muted-foreground">
                    <span>Geselecteerd: </span>
                    <span className="font-medium text-slate-800">{selectedContract.title}</span>{' '}
                    <Badge variant="outline" className="ml-1 text-[10px]">
                      {selectedContract.status}
                    </Badge>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[min(70dvh,640px)] flex-col overflow-hidden">
          <CardHeader className="shrink-0 border-b pb-4">
            <CardTitle>Gesprek</CardTitle>
            <CardDescription>
              Je vragen en antwoorden staan hieronder in één doorlopend gesprek; typ onderaan om door te vragen.
            </CardDescription>
          </CardHeader>
          {faqClusters.length > 0 ? (
            <div className="shrink-0 space-y-2 border-b bg-slate-50/80 px-6 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Meestgestelde vragen
              </p>
              <p className="text-xs text-muted-foreground">
                Zelfde onderwerp wordt door AI gegroepeerd (ook bij andere woorden). Tik voor het laatst opgeslagen
                antwoord — zonder nieuwe AI-rondgang.
              </p>
              <div className="flex flex-wrap gap-2">
                {faqClusters.map((c) => (
                  <Button
                    key={c.id}
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={loading}
                    className="h-auto max-w-full justify-start whitespace-normal text-left text-xs sm:text-sm"
                    onClick={() => handleFaqClusterClick(c.id)}
                  >
                    <span className="line-clamp-2">{c.label}</span>
                    {c.askCount > 1 ? (
                      <Badge variant="outline" className="ml-2 shrink-0 text-[10px]">
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
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4"
          >
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
            ) : null}
            {chatMessages.length === 0 && (
              <div className="rounded-md border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                Typ hieronder je eerste vraag. Antwoorden, bronnen en vervolgsuggesties verschijnen hier in hetzelfde
                venster.
              </div>
            )}
            {chatMessages.map((message) => (
              <div
                key={message.id}
                className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={
                    message.role === 'user'
                      ? 'max-w-[min(100%,32rem)] rounded-2xl bg-blue-600 px-4 py-3 text-sm text-white shadow-sm'
                      : `max-w-[min(100%,40rem)] rounded-2xl border px-4 py-3 text-sm shadow-sm ${message.isError ? 'border-red-200 bg-red-50 text-red-800' : 'border-slate-200/80 bg-slate-50 text-slate-900'}`
                  }
                >
                  {message.role === 'assistant' && !message.isError && message.response ? (
                    contentLooksLikeHtml(message.content) ? (
                      <div className={`${assistantContentClassName} [&_table]:overflow-hidden [&_table]:rounded-lg`} dangerouslySetInnerHTML={{ __html: sanitizeAssistantHtml(message.content) }} />
                    ) : (
                      <div className={assistantContentClassName}>
                        <ReactMarkdown
                          components={{
                            table: ({ children }) => (
                              <div className="my-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
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
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyMessage(message)}
                        className="h-8 gap-1.5"
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
                                className="h-auto whitespace-normal text-left"
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
                              Documenten:{' '}
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
          <form
            onSubmit={handleSubmit}
            className="shrink-0 space-y-3 border-t bg-background px-4 py-4 sm:px-6"
          >
            <div className="space-y-2">
              <Label htmlFor="urls" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Link2 className="h-4 w-4" />
                Extra referentie-URL&apos;s (optioneel)
              </Label>
              <Textarea
                id="urls"
                placeholder={'Eén URL per regel\nhttps://example.org/...'}
                value={referenceUrls}
                onChange={(e) => setReferenceUrls(e.target.value)}
                className="min-h-[64px] font-mono text-sm"
                disabled={loading}
              />
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Textarea
                id="chat-input"
                placeholder="Stel je vraag… (Enter om te versturen, Shift+Enter voor nieuwe regel)"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={handleQuestionKeyDown}
                className="min-h-[100px] flex-1 resize-y text-base"
                disabled={loading}
              />
              <Button
                type="submit"
                disabled={loading || !question.trim() || (scopeMode === 'single' && !selectedContractId)}
                className="w-full shrink-0 sm:w-auto sm:min-w-[120px]"
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Verstuur
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
