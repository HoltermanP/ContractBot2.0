import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import {
  answerContractQuestion,
  extractContractAskStructuredFields,
  sanitizeFollowUpQuestions,
  streamAnswerContractQuestionHtml,
  type ContractQuestionAnswer,
} from '@/lib/openai'
import { db, contracts, projects } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import {
  contractIdsWithDocumentsFallback,
  contractIdsWithDocumentsFallbackForProject,
  contractIdsWithDocumentsFallbackUnassigned,
  loadContractTextBlocks,
  semanticTopContractIds,
  semanticTopContractIdsForProject,
  semanticTopContractIdsUnassigned,
  type QaContextBlock,
} from '@/lib/contract-qa-context'
import { fetchReferenceUrlAsText } from '@/lib/fetch-reference-url'
import { persistContractAskTurn } from '@/lib/contract-ask-persist'
import { enrichAskSources } from '@/lib/ask-source-links'

const MAX_CONTEXT_CONTRACTS = 5
const MAX_REFERENCE_URLS = 4

function dedupeContractsById(blocks: QaContextBlock[]) {
  const uniqueById = new Map<string, { id: string; title: string; detail: string }>()
  for (const block of blocks) {
    if (!uniqueById.has(block.id)) {
      uniqueById.set(block.id, { id: block.id, title: block.title, detail: block.detail })
    }
  }
  return [...uniqueById.values()]
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = await req.json()
    const question = typeof body.question === 'string' ? body.question.trim() : ''
    if (!question) return NextResponse.json({ error: 'Stel een vraag' }, { status: 400 })

    const contractIdsRaw = Array.isArray(body.contractIds) ? body.contractIds : []
    const contractIds = [...new Set(contractIdsRaw.filter((id: unknown) => typeof id === 'string' && id.length > 0))] as string[]

    const projectIdRaw = typeof body.projectId === 'string' ? body.projectId.trim() : ''
    const projectId = projectIdRaw.length > 0 ? projectIdRaw : undefined

    let projectScopeMeta: { id: string; name: string } | undefined
    if (projectId) {
      const proj = await db.query.projects.findFirst({
        where: and(eq(projects.id, projectId), eq(projects.orgId, user.orgId)),
      })
      if (!proj) return NextResponse.json({ error: 'Project niet gevonden' }, { status: 400 })
      projectScopeMeta = { id: proj.id, name: proj.name }
    }

    const portfolioMode = body.portfolioMode !== false && contractIds.length === 0
    const portfolioUnassignedOnly = body.portfolioUnassignedOnly === true

    const urlsRaw = Array.isArray(body.referenceUrls) ? body.referenceUrls : []
    const referenceUrls = [...new Set(urlsRaw.filter((u: unknown) => typeof u === 'string' && u.trim().length > 0))].slice(
      0,
      MAX_REFERENCE_URLS
    ) as string[]

    const readerMode = user.role === 'reader'

    let contractBlocks: QaContextBlock[] = []

    if (contractIds.length > 0) {
      if (projectId) {
        for (const cid of contractIds) {
          const row = await db.query.contracts.findFirst({
            where: and(eq(contracts.id, cid), eq(contracts.orgId, user.orgId)),
          })
          if (!row || row.projectId !== projectId) {
            return NextResponse.json(
              { error: 'Een of meer contracten horen niet bij het gekozen project.' },
              { status: 400 }
            )
          }
        }
      }
      contractBlocks = await loadContractTextBlocks(user.orgId, contractIds, { hideArchivedForReader: readerMode })
      /* Alleen gekozen dossiers: defensief filteren op contract-id. */
      const idSet = new Set(contractIds)
      contractBlocks = contractBlocks.filter((b) => idSet.has(b.id))
    } else if (portfolioMode) {
      if (portfolioUnassignedOnly && !projectId) {
        let topIds = await semanticTopContractIdsUnassigned(
          user.orgId,
          question,
          MAX_CONTEXT_CONTRACTS,
          { readerMode }
        )
        if (topIds.length === 0) {
          topIds = await contractIdsWithDocumentsFallbackUnassigned(
            user.orgId,
            MAX_CONTEXT_CONTRACTS,
            { readerMode }
          )
        }
        contractBlocks = await loadContractTextBlocks(user.orgId, topIds, { hideArchivedForReader: readerMode })
      } else if (projectId) {
        let topIds = await semanticTopContractIdsForProject(
          user.orgId,
          projectId,
          question,
          MAX_CONTEXT_CONTRACTS,
          { readerMode }
        )
        if (topIds.length === 0) {
          topIds = await contractIdsWithDocumentsFallbackForProject(
            user.orgId,
            projectId,
            MAX_CONTEXT_CONTRACTS,
            { readerMode }
          )
        }
        contractBlocks = await loadContractTextBlocks(user.orgId, topIds, { hideArchivedForReader: readerMode })
      } else {
        let topIds = await semanticTopContractIds(user.orgId, question, MAX_CONTEXT_CONTRACTS, { readerMode })
        if (topIds.length === 0) {
          topIds = await contractIdsWithDocumentsFallback(user.orgId, MAX_CONTEXT_CONTRACTS, { readerMode })
        }
        contractBlocks = await loadContractTextBlocks(user.orgId, topIds, { hideArchivedForReader: readerMode })
      }
    } else {
      contractBlocks = await loadContractTextBlocks(user.orgId, contractIds, { hideArchivedForReader: readerMode })
    }

    const urlBlocks: QaContextBlock[] = []
    for (const url of referenceUrls) {
      try {
        const { title, text } = await fetchReferenceUrlAsText(url)
        urlBlocks.push({
          kind: 'url',
          id: url,
          documentId: null,
          fileType: null,
          title,
          detail: url,
          text: text.slice(0, 48_000),
        })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Kon URL niet laden'
        return NextResponse.json({ error: `Bron-URL: ${msg}` }, { status: 400 })
      }
    }

    const allBlocks = [...contractBlocks, ...urlBlocks]
    if (allBlocks.length === 0) {
      return NextResponse.json(
        {
          error:
            'Geen bruikbare bronnen: zorg dat contracten actuele PDF- of DOCX-documenten hebben (en dat BLOB_READ_WRITE_TOKEN gezet is voor private Blob-URL’s), of voeg referentie-URL’s toe. Optioneel: indexeer contracten voor slimmere automatische selectie.',
        },
        { status: 400 }
      )
    }

    const ctxForAi = allBlocks.map((b) => ({ kind: b.kind, title: b.title, detail: b.detail, text: b.text }))
    const ctxMetaOnly = ctxForAi.map((b) => ({ kind: b.kind, title: b.title, detail: b.detail }))
    const useStream = body.stream === true
    /** Expliciete contractkeuze in de UI → model en metadata alleen binnen die dossiers. */
    const qaOptions = contractIds.length > 0 ? { scopedContractIds: contractIds } : undefined

    if (useStream) {
      const encoder = new TextEncoder()
      const ndjson = new ReadableStream({
        async start(controller) {
          const push = (obj: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`))
          try {
            let answerHtml = ''
            for await (const chunk of streamAnswerContractQuestionHtml(question, ctxForAi, user.orgId, qaOptions)) {
              answerHtml += chunk
              push({ type: 'delta', text: chunk })
            }
            const extracted = await extractContractAskStructuredFields(
              question,
              answerHtml,
              ctxMetaOnly,
              user.orgId,
              qaOptions
            )
            const merged: ContractQuestionAnswer = {
              answer: answerHtml,
              sources: extracted.sources,
              limitations: extracted.limitations,
              followUpQuestions: sanitizeFollowUpQuestions(extracted.followUpQuestions, question),
            }
            const sourcesWithLinks = enrichAskSources(merged.sources, allBlocks)
            const payload = {
              ...merged,
              sources: sourcesWithLinks,
              contextSummary: {
                contractsUsed: dedupeContractsById(contractBlocks),
                urlsUsed: urlBlocks.map((b) => ({ url: b.detail })),
                ...(projectScopeMeta ? { projectScope: projectScopeMeta } : {}),
              },
            }
            try {
              await persistContractAskTurn({
                orgId: user.orgId,
                userId: user.id,
                questionRaw: question,
                portfolioMode,
                contractIds,
                referenceUrls,
                response: payload,
              })
            } catch (e) {
              console.error('contract ask persist failed', e)
            }
            push({ type: 'done', ...payload })
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Onbekende fout'
            push({ type: 'error', error: message })
          } finally {
            controller.close()
          }
        },
      })
      return new Response(ndjson, {
        headers: {
          'Content-Type': 'application/x-ndjson; charset=utf-8',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    const result = await answerContractQuestion(question, ctxForAi, user.orgId, qaOptions)

    const sourcesWithLinks = enrichAskSources(result.sources, allBlocks)

    const payload = {
      ...result,
      sources: sourcesWithLinks,
      contextSummary: {
        contractsUsed: dedupeContractsById(contractBlocks),
        urlsUsed: urlBlocks.map((b) => ({ url: b.detail })),
        ...(projectScopeMeta ? { projectScope: projectScopeMeta } : {}),
      },
    }

    try {
      await persistContractAskTurn({
        orgId: user.orgId,
        userId: user.id,
        questionRaw: question,
        portfolioMode,
        contractIds,
        referenceUrls,
        response: payload,
      })
    } catch (e) {
      console.error('contract ask persist failed', e)
    }

    return NextResponse.json(payload)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
