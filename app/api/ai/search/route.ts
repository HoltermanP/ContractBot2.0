import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contracts } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { getEmbedding } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const { query } = await req.json()
    if (!query) return NextResponse.json({ error: 'Zoekopdracht verplicht' }, { status: 400 })

    const embedding = await getEmbedding(query)

    // Vector similarity search using pgvector
    const results = await db.execute(sql`
      SELECT id, title, contract_number, status, end_date,
             1 - (content_embedding <=> ${JSON.stringify(embedding)}::vector) AS similarity
      FROM contracts
      WHERE org_id = ${user.orgId}
        AND content_embedding IS NOT NULL
        AND status != 'verwijderd'
      ORDER BY content_embedding <=> ${JSON.stringify(embedding)}::vector
      LIMIT 10
    `)

    return NextResponse.json({ results: results.rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
