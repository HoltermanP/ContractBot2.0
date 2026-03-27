import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { answerContractQuestion } from '@/lib/openai'
import {
  contractIdsWithDocumentsFallback,
  loadContractTextBlocks,
  semanticTopContractIds,
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

    const portfolioMode = body.portfolioMode !== false && contractIds.length === 0

    const urlsRaw = Array.isArray(body.referenceUrls) ? body.referenceUrls : []
    const referenceUrls = [...new Set(urlsRaw.filter((u: unknown) => typeof u === 'string' && u.trim().length > 0))].slice(
      0,
      MAX_REFERENCE_URLS
    ) as string[]

    const readerMode = user.role === 'reader'

    let contractBlocks: QaContextBlock[] = []

    if (portfolioMode) {
      let topIds = await semanticTopContractIds(user.orgId, question, MAX_CONTEXT_CONTRACTS, { readerMode })
      if (topIds.length === 0) {
        topIds = await contractIdsWithDocumentsFallback(user.orgId, MAX_CONTEXT_CONTRACTS, { readerMode })
      }
      contractBlocks = await loadContractTextBlocks(user.orgId, topIds, { hideArchivedForReader: readerMode })
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

    const result = await answerContractQuestion(
      question,
      allBlocks.map((b) => ({ kind: b.kind, title: b.title, detail: b.detail, text: b.text })),
      user.orgId
    )

    const sourcesWithLinks = enrichAskSources(result.sources, allBlocks)

    const payload = {
      ...result,
      sources: sourcesWithLinks,
      contextSummary: {
        contractsUsed: dedupeContractsById(contractBlocks),
        urlsUsed: urlBlocks.map((b) => ({ url: b.detail })),
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
