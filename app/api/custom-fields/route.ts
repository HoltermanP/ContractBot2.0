import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { customFields } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { canManageOrgSettings } from '@/lib/permissions'

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const fields = await db.query.customFields.findMany({ where: eq(customFields.orgId, user.orgId) })
    return NextResponse.json(fields)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canManageOrgSettings(user.role)) return NextResponse.json({ error: 'Alleen admins' }, { status: 403 })

    const body = await req.json()
    const [field] = await db.insert(customFields).values({
      orgId: user.orgId,
      fieldName: body.fieldName,
      fieldType: body.fieldType,
      optionsJson: body.optionsJson ?? null,
      required: body.required ?? false,
    }).returning()

    return NextResponse.json(field)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
