import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { put } from '@vercel/blob'
import { db } from '@/lib/db'
import { contractDocuments, contracts } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { canMutateContractData } from '@/lib/permissions'
import { nextDocumentVersionNumber, refreshContractContentEmbedding } from '@/lib/contract-corpus'

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
type BlobAccessMode = 'private' | 'public'

function resolveBlobAccessMode(): BlobAccessMode {
  const raw = process.env.BLOB_ACCESS?.trim().toLowerCase()
  return raw === 'public' ? 'public' : 'private'
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    if (!canMutateContractData(user.role)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const contractId = typeof formData.get('contractId') === 'string' ? (formData.get('contractId') as string).trim() : ''
    const rawKind = formData.get('documentKind')
    const documentKind: 'hoofdcontract' | 'contractstuk' | 'addendum' =
      rawKind === 'addendum'
        ? 'addendum'
        : rawKind === 'contractstuk'
          ? 'contractstuk'
          : 'hoofdcontract'

    if (!file) return NextResponse.json({ error: 'Geen bestand ontvangen' }, { status: 400 })
    if (!contractId) return NextResponse.json({ error: 'contractId ontbreekt' }, { status: 400 })

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Bestand te groot (${(file.size / 1024 / 1024).toFixed(1)} MB, max 10 MB)` },
        { status: 400 }
      )
    }

    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (!['pdf', 'docx'].includes(ext)) {
      return NextResponse.json({ error: 'Alleen PDF en DOCX zijn toegestaan' }, { status: 400 })
    }

    // Verify contract belongs to this org
    const contract = await db.query.contracts.findFirst({
      where: and(eq(contracts.id, contractId), eq(contracts.orgId, user.orgId)),
    })
    if (!contract) return NextResponse.json({ error: 'Contract niet gevonden' }, { status: 404 })

    // Upload to Vercel Blob
    const token = process.env.BLOB_READ_WRITE_TOKEN
    if (!token) {
      return NextResponse.json({ error: 'BLOB_READ_WRITE_TOKEN niet geconfigureerd' }, { status: 500 })
    }

    const blobPath = `contracts/${user.orgId}/${contractId}/${Date.now()}-${file.name}`
    const contentType =
      file.type || (ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    const configuredAccess = resolveBlobAccessMode()
    let blob
    try {
      blob = await put(blobPath, file, {
        access: configuredAccess,
        token,
        contentType,
      })
    } catch (blobErr: unknown) {
      const blobMessage = getErrorMessage(blobErr)
      const canRetryAsPublic =
        configuredAccess === 'private' &&
        (blobMessage.toLowerCase().includes('public') || blobMessage.toLowerCase().includes('access'))

      if (canRetryAsPublic) {
        blob = await put(blobPath, file, {
          access: 'public',
          token,
          contentType,
        })
      } else {
        throw new Error(`Blob upload mislukt: ${blobMessage}`)
      }
    }

    // Alleen bij een nieuw hoofdcontract het vorige hoofdcontract als niet-actueel markeren.
    // Extra contractstukken en addenda mogen naast elkaar actueel blijven (meerdere bestanden).
    if (documentKind === 'hoofdcontract') {
      await db
        .update(contractDocuments)
        .set({ isCurrent: false })
        .where(
          and(
            eq(contractDocuments.contractId, contractId),
            eq(contractDocuments.documentKind, 'hoofdcontract'),
            eq(contractDocuments.isCurrent, true)
          )
        )
    }

    // Get next version number
    const versionNumber = await nextDocumentVersionNumber(contractId)

    // Insert new document record
    const [doc] = await db
      .insert(contractDocuments)
      .values({
        contractId,
        filename: file.name,
        fileUrl: blob.url,
        fileType: ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: file.size,
        versionNumber,
        isCurrent: true,
        documentKind,
        uploadedBy: user.id,
        aiProcessed: false,
      })
      .returning()

    // Refresh embeddings in background (don't await)
    refreshContractContentEmbedding(contractId, user.orgId).catch((e) =>
      console.error('Embedding refresh failed', e)
    )

    return NextResponse.json({ id: doc.id, filename: doc.filename, versionNumber })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Upload mislukt'
    const lower = message.toLowerCase()
    const enumOrKindError =
      lower.includes('document_kind') ||
      lower.includes('invalid input value for enum') ||
      lower.includes('contractstuk')
    if (enumOrKindError) {
      console.error('[documents/upload]', err)
      return NextResponse.json(
        {
          error:
            'Het documenttype wordt door de database nog niet herkend. Voer lokaal of op de server uit: npm run db:migrate (migratie met extra documenttype contractstuk).',
        },
        { status: 500 }
      )
    }
    if (lower.includes('blob upload mislukt')) {
      console.error('[documents/upload]', err)
      return NextResponse.json(
        {
          error:
            `${message}. Controleer in Vercel of de env var BLOB_READ_WRITE_TOKEN op deze environment staat en of access-mode klopt. ` +
            `Optioneel: zet BLOB_ACCESS=public als je een public Blob store gebruikt.`,
        },
        { status: 500 }
      )
    }
    console.error('[documents/upload]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
