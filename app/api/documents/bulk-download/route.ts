import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contractDocuments, contracts } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import JSZip from 'jszip'
import { canBulkDownloadDocuments } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canBulkDownloadDocuments(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })

    const contractId = req.nextUrl.searchParams.get('contractId')
    if (!contractId) return NextResponse.json({ error: 'contractId verplicht' }, { status: 400 })

    const contract = await db.query.contracts.findFirst({
      where: and(eq(contracts.id, contractId), eq(contracts.orgId, user.orgId)),
    })
    if (!contract) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    const docs = await db.query.contractDocuments.findMany({
      where: eq(contractDocuments.contractId, contractId),
    })

    const zip = new JSZip()

    for (const doc of docs) {
      const res = await fetch(doc.fileUrl)
      if (res.ok) {
        const buf = await res.arrayBuffer()
        zip.file(`v${doc.versionNumber}-${doc.filename}`, buf)
      }
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
    return new NextResponse(zipBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${contract.title}-documenten.zip"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
