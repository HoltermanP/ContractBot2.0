import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { put } from '@vercel/blob'
import { db } from '@/lib/db'
import { contractDocuments, contracts } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { canMutateContractData } from '@/lib/permissions'
import { nextDocumentVersionNumber, refreshContractContentEmbedding } from '@/lib/contract-corpus'

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

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
    const documentKind: 'hoofdcontract' | 'addendum' =
      rawKind === 'addendum' ? 'addendum' : 'hoofdcontract'

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
    const blob = await put(blobPath, file, {
      access: 'private',
      token,
      contentType: file.type || (ext === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    })

    // Mark previous documents of same kind as not current
    await db
      .update(contractDocuments)
      .set({ isCurrent: false })
      .where(
        and(
          eq(contractDocuments.contractId, contractId),
          eq(contractDocuments.documentKind, documentKind),
          eq(contractDocuments.isCurrent, true)
        )
      )

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
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
