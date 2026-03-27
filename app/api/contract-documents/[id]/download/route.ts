import { NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db, contractDocuments } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { downloadFileToBuffer } from '@/lib/blob-fetch'

/**
 * Authenticated download: werkt voor private Vercel Blob én publieke URL’s.
 * (Direct <a href={fileUrl}> werkt niet voor private blobs zonder token.)
 */
function viewableInline(mime: string): boolean {
  const m = mime.toLowerCase()
  return (
    m === 'application/pdf' ||
    m.startsWith('text/html') ||
    m.startsWith('image/') ||
    m === 'text/plain' ||
    m === 'text/markdown'
  )
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getOrCreateUser()
  if (!user) {
    return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
  }

  const { id } = await params

  const doc = await db.query.contractDocuments.findFirst({
    where: eq(contractDocuments.id, id),
    with: { contract: true },
  })

  if (!doc?.contract) {
    return NextResponse.json({ error: 'Document niet gevonden' }, { status: 404 })
  }

  if (doc.contract.orgId !== user.orgId) {
    return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
  }

  try {
    const buffer = await downloadFileToBuffer(doc.fileUrl)
    const filename = doc.filename.replace(/[^\w.\- ()\[\]]+/g, '_').slice(0, 200) || 'document.pdf'
    const contentType = doc.fileType || 'application/pdf'
    const url = new URL(req.url)
    const inline =
      url.searchParams.get('inline') === '1' || url.searchParams.get('disposition') === 'inline'
    const disposition =
      inline && viewableInline(contentType) ? `inline; filename="${filename}"` : `attachment; filename="${filename}"`

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': disposition,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Download mislukt'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
