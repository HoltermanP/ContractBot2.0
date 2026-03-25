import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { customFields } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { canManageOrgSettings } from '@/lib/permissions'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getOrCreateUser()
    if (!user || !canManageOrgSettings(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })
    const body = await req.json()
    const [f] = await db.update(customFields).set({
      fieldName: body.fieldName,
      fieldType: body.fieldType,
      optionsJson: body.optionsJson,
      required: body.required,
    }).where(eq(customFields.id, id)).returning()
    return NextResponse.json(f)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getOrCreateUser()
    if (!user || !canManageOrgSettings(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })
    await db.delete(customFields).where(eq(customFields.id, id))
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
