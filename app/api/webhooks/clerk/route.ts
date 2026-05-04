import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhook } from '@clerk/backend/webhooks'
import { syncClerkUserJsonToDatabase } from '@/lib/clerk-user-sync'
import type { UserJSON } from '@clerk/backend'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const evt = await verifyWebhook(req)

    if (evt.type === 'user.created' || evt.type === 'user.updated') {
      await syncClerkUserJsonToDatabase(evt.data as UserJSON)
    }

    if (evt.type === 'session.created') {
      const data = evt.data as { user?: UserJSON | null }
      if (data.user) {
        await syncClerkUserJsonToDatabase(data.user)
      }
    }

    return NextResponse.json({ received: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Fout'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
