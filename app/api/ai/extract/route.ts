import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { parseDocument } from '@/lib/parse-document'
import { extractContractData } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Bestand verplicht' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())
    const text = await parseDocument(buffer, file.type)
    const extraction = await extractContractData(text, user.orgId)

    return NextResponse.json({ extraction, text: text.slice(0, 500) })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
