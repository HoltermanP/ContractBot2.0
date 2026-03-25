import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contractDocuments, documentVersions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logAudit } from '@/lib/audit'
import { canRestoreDocumentVersion } from '@/lib/permissions'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  try {
    const { id, versionId } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canRestoreDocumentVersion(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })

    const doc = await db.query.contractDocuments.findFirst({ where: eq(contractDocuments.id, id) })
    if (!doc) return NextResponse.json({ error: 'Document niet gevonden' }, { status: 404 })

    const version = await db.query.documentVersions.findFirst({
      where: eq(documentVersions.id, versionId),
    })
    if (!version) return NextResponse.json({ error: 'Versie niet gevonden' }, { status: 404 })

    // Restore: update current doc with old version's file URL
    await db.update(contractDocuments).set({
      fileUrl: version.fileUrl,
      isCurrent: true,
    }).where(eq(contractDocuments.id, id))

    await logAudit({
      user,
      contractId: doc.contractId,
      action: 'document.versie_hersteld',
      newValue: { documentId: id, restoredVersion: version.versionNumber },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
