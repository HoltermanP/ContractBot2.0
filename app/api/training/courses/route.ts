import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db, trainingCourses } from '@/lib/db'
import { eq, desc } from 'drizzle-orm'
import { canMutateContractData } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

export async function GET() {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const rows = await db.query.trainingCourses.findMany({
      where: eq(trainingCourses.orgId, user.orgId),
      orderBy: [desc(trainingCourses.updatedAt)],
      with: {
        modules: { columns: { id: true } },
      },
    })

    const list = rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      status: r.status,
      moduleCount: r.modules.length,
      gammaStatus: r.gammaStatus,
      gammaUrl: r.gammaUrl,
      updatedAt: r.updatedAt,
    }))

    return NextResponse.json(list)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canMutateContractData(user.role)) {
      return NextResponse.json({ error: 'Geen rechten om trainingen aan te maken' }, { status: 403 })
    }

    const body = (await req.json()) as { title?: string; description?: string }
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) return NextResponse.json({ error: 'Titel is verplicht' }, { status: 400 })

    const [created] = await db
      .insert(trainingCourses)
      .values({
        orgId: user.orgId,
        title,
        description: typeof body.description === 'string' ? body.description.trim() || null : null,
        createdBy: user.id,
        updatedAt: new Date(),
      })
      .returning()

    if (!created) return NextResponse.json({ error: 'Aanmaken mislukt' }, { status: 500 })

    await logAudit({
      user,
      action: 'training_course_created',
      newValue: { courseId: created.id, title: created.title },
    })

    return NextResponse.json(created)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
