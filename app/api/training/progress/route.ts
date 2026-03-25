import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db, trainingModules, trainingCourses, trainingProgress } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { canViewTrainingCourse } from '@/lib/permissions'

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const body = (await req.json()) as { moduleId?: string }
    if (!body.moduleId || typeof body.moduleId !== 'string') {
      return NextResponse.json({ error: 'moduleId is verplicht' }, { status: 400 })
    }

    const mod = await db.query.trainingModules.findFirst({
      where: eq(trainingModules.id, body.moduleId),
      with: { course: true },
    })
    if (!mod?.course || mod.course.orgId !== user.orgId) {
      return NextResponse.json({ error: 'Module niet gevonden' }, { status: 404 })
    }
    if (!canViewTrainingCourse(user.role, mod.course.status)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const existing = await db.query.trainingProgress.findFirst({
      where: and(eq(trainingProgress.userId, user.id), eq(trainingProgress.moduleId, body.moduleId)),
    })
    if (!existing) {
      await db.insert(trainingProgress).values({ userId: user.id, moduleId: body.moduleId })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
