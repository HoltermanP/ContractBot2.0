import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, organizations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const { type, data } = payload

    if (type === 'user.created' || type === 'user.updated') {
      const clerkUser = data
      const existing = await db.query.users.findFirst({ where: eq(users.clerkId, clerkUser.id) })

      const name = (`${clerkUser.first_name ?? ''} ${clerkUser.last_name ?? ''}`.trim()) || (clerkUser.email_addresses?.[0]?.email_address ?? 'Gebruiker')
      const email = clerkUser.email_addresses?.[0]?.email_address ?? ''

      if (existing) {
        await db.update(users).set({ name, email }).where(eq(users.clerkId, clerkUser.id))
      } else {
        await db.insert(users).values({
          clerkId: clerkUser.id,
          orgId: null,
          role: (clerkUser.public_metadata?.role as any) ?? 'reader',
          name,
          email,
        })
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
