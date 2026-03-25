import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { canManageSupplierWrite } from '@/lib/permissions'
import { db } from '@/lib/db'
import { suppliers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    const all = await db.query.suppliers.findMany({ where: eq(suppliers.orgId, user.orgId) })
    return NextResponse.json(all)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canManageSupplierWrite(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })

    const body = await req.json()
    const [s] = await db.insert(suppliers).values({
      orgId: user.orgId,
      name: body.name,
      kvk: body.kvk ?? null,
      contactEmail: body.contactEmail ?? null,
      contactName: body.contactName ?? null,
    }).returning()

    return NextResponse.json(s)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
