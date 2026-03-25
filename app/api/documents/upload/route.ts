import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contractDocuments, documentVersions, contracts } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { parseDocument } from '@/lib/parse-document'
import { extractContractData } from '@/lib/openai'
import { logAudit } from '@/lib/audit'
import { canMutateContractData } from '@/lib/permissions'
import {
  hasCurrentHoofdcontract,
  nextDocumentVersionNumber,
  refreshContractContentEmbedding,
} from '@/lib/contract-corpus'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        {
          error:
            'Vercel Blob is niet geconfigureerd. Zet BLOB_READ_WRITE_TOKEN als environment variable (Preview + Production) in Vercel.',
        },
        { status: 500 }
      )
    }

    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canMutateContractData(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })

    const formData = await req.formData()
    const fileEntry = formData.get('file')
    const file = fileEntry instanceof File ? fileEntry : null
    const contractId = formData.get('contractId') as string | null
    const documentKindRaw = formData.get('documentKind') as string | null
    const documentKind = documentKindRaw === 'addendum' ? 'addendum' : 'hoofdcontract'

    if (!file || !contractId) {
      return NextResponse.json({ error: 'Bestand en contractId zijn verplicht' }, { status: 400 })
    }

    const contract = await db.query.contracts.findFirst({
      where: and(eq(contracts.id, contractId), eq(contracts.orgId, user.orgId)),
    })
    if (!contract) return NextResponse.json({ error: 'Contract niet gevonden' }, { status: 404 })

    if (documentKind === 'addendum') {
      const ok = await hasCurrentHoofdcontract(contractId)
      if (!ok) {
        return NextResponse.json(
          { error: 'Upload eerst een hoofdcontract voordat u een addendum of wijziging toevoegt.' },
          { status: 400 }
        )
      }
    }

    const newVersion = await nextDocumentVersionNumber(contractId)

    if (file.size <= 0) {
      return NextResponse.json({ error: 'Leeg bestand kan niet geüpload worden' }, { status: 400 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const uploadBody = new Blob([bytes], { type: file.type || 'application/octet-stream' })
    const blobPath = `contracts/${contractId}/${Date.now()}-${file.name}`
    let blob: Awaited<ReturnType<typeof put>>
    try {
      blob = await put(blobPath, uploadBody, {
        access: 'private',
        contentType: file.type || 'application/octet-stream',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      })
    } catch (err: any) {
      const message = err?.message || 'Blob upload mislukt'
      throw new Error(`Blob upload mislukt (${blobPath}): ${message}`)
    }

    if (documentKind === 'hoofdcontract') {
      const latestMain = await db.query.contractDocuments.findFirst({
        where: and(
          eq(contractDocuments.contractId, contractId),
          eq(contractDocuments.isCurrent, true),
          eq(contractDocuments.documentKind, 'hoofdcontract')
        ),
        orderBy: [desc(contractDocuments.versionNumber)],
      })

      if (latestMain) {
        await db.insert(documentVersions).values({
          documentId: latestMain.id,
          versionNumber: latestMain.versionNumber,
          fileUrl: latestMain.fileUrl,
          uploadedBy: latestMain.uploadedBy,
          uploadedAt: latestMain.uploadedAt,
        })
        await db.update(contractDocuments).set({ isCurrent: false }).where(eq(contractDocuments.id, latestMain.id))
      }
    }

    const [doc] = await db.insert(contractDocuments).values({
      contractId,
      filename: file.name,
      // For private Blob stores we persist the downloadUrl so existing fetch/link logic keeps working.
      fileUrl: blob.downloadUrl,
      fileType: file.type,
      fileSize: file.size,
      versionNumber: newVersion,
      isCurrent: true,
      documentKind,
      uploadedBy: user.id,
      aiProcessed: false,
    }).returning()

    await logAudit({
      user,
      contractId,
      action: 'document.geupload',
      newValue: { filename: file.name, version: newVersion, documentKind },
      ipAddress: req.headers.get('x-forwarded-for') ?? undefined,
    })

    extractAndUpdateAsync(Buffer.from(bytes), file.type, doc.id, contractId, user.orgId).catch(console.error)

    return NextResponse.json(doc)
  } catch (err: any) {
    console.error('Upload naar Blob mislukt:', err)
    return NextResponse.json({ error: err?.message ?? 'Onbekende fout bij upload' }, { status: 500 })
  }
}

async function extractAndUpdateAsync(
  buffer: Buffer,
  mimeType: string,
  docId: string,
  contractId: string,
  orgId: string
) {
  try {
    const text = await parseDocument(buffer, mimeType)
    const extraction = await extractContractData(text, orgId)

    await db.update(contractDocuments).set({
      aiProcessed: true,
      aiExtractedDataJson: extraction as any,
    }).where(eq(contractDocuments.id, docId))

    await refreshContractContentEmbedding(contractId, orgId)
  } catch (err) {
    console.error('AI extractie mislukt:', err)
  }
}
