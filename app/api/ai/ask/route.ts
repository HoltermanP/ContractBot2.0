import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { answerContractQuestion } from '@/lib/openai'
import { loadContractTextBlocks, semanticTopContractIds, type QaContextBlock } from '@/lib/contract-qa-context'
import { fetchReferenceUrlAsText } from '@/lib/fetch-reference-url'

const MAX_CONTEXT_CONTRACTS = 5
const MAX_REFERENCE_URLS = 4

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
      const topIds = await semanticTopContractIds(user.orgId, question, MAX_CONTEXT_CONTRACTS, { readerMode })
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
            'Geen bruikbare bronnen: koppel contracten met documenten, of voeg referentie-URL\'s toe. Voor automatische selectie van contracten is een geïndexeerd (geüpload) contract nodig.',
        },
        { status: 400 }
      )
    }

    const result = await answerContractQuestion(
      question,
      allBlocks.map((b) => ({ kind: b.kind, title: b.title, detail: b.detail, text: b.text })),
      user.orgId
    )

    return NextResponse.json({
      ...result,
      contextSummary: {
        contractsUsed: contractBlocks.map((b) => ({ id: b.id, title: b.title, detail: b.detail })),
        urlsUsed: urlBlocks.map((b) => ({ url: b.detail })),
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
