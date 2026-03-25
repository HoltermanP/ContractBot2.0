import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db, trainingCourses } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { canMutateContractData } from '@/lib/permissions'
import { gammaGetGeneration } from '@/lib/gamma'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canMutateContractData(user.role)) {
      return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })
    }

    const course = await db.query.trainingCourses.findFirst({
      where: and(eq(trainingCourses.id, courseId), eq(trainingCourses.orgId, user.orgId)),
    })
    if (!course) return NextResponse.json({ error: 'Cursus niet gevonden' }, { status: 404 })

    const genId = course.gammaGenerationId
    if (!genId) {
      return NextResponse.json({ error: 'Geen Gamma-generatie gestart voor deze cursus.' }, { status: 400 })
    }

    const status = await gammaGetGeneration(genId)

    if (status.status === 'completed' || status.status === 'failed') {
      await db
        .update(trainingCourses)
        .set({
          gammaStatus: status.status,
          gammaUrl: status.gammaUrl ?? null,
          gammaExportUrl: status.exportUrl ?? null,
          updatedAt: new Date(),
        })
        .where(eq(trainingCourses.id, courseId))
    } else {
      await db
        .update(trainingCourses)
        .set({
          gammaStatus: status.status,
          updatedAt: new Date(),
        })
        .where(eq(trainingCourses.id, courseId))
    }

    return NextResponse.json({
      generationId: status.generationId,
      status: status.status,
      gammaUrl: status.gammaUrl ?? null,
      exportUrl: status.exportUrl ?? null,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
