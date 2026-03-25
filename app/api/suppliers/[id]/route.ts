import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { suppliers } from '@/lib/db/schema'
import { and, eq } from 'drizzle-orm'
import { canDeleteContract, canManageSupplierWrite } from '@/lib/permissions'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canManageSupplierWrite(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })

    const inOrg = await db.query.suppliers.findFirst({
      where: and(eq(suppliers.id, id), eq(suppliers.orgId, user.orgId)),
    })
    if (!inOrg) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    const body = await req.json()
    const [s] = await db.update(suppliers).set({
      name: body.name,
      kvk: body.kvk ?? null,
      contactEmail: body.contactEmail ?? null,
      contactName: body.contactName ?? null,
    }).where(and(eq(suppliers.id, id), eq(suppliers.orgId, user.orgId))).returning()

    return NextResponse.json(s)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getOrCreateUser()
    if (!user || !canDeleteContract(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })
    await db.delete(suppliers).where(and(eq(suppliers.id, id), eq(suppliers.orgId, user.orgId)))
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
