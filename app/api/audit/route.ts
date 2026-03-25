import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditLog } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const contractId = searchParams.get('contractId')

    const conditions = [eq(auditLog.orgId, user.orgId)]
    if (contractId) conditions.push(eq(auditLog.contractId, contractId))

    const logs = await db.query.auditLog.findMany({
      where: and(...conditions),
      orderBy: [desc(auditLog.createdAt)],
      limit: 200,
    })

    return NextResponse.json({ logs })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
