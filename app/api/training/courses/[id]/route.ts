import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db, trainingCourses, trainingModules, trainingCourseContracts, trainingCourseDocuments, trainingProgress } from '@/lib/db'
import { eq, and, asc, inArray } from 'drizzle-orm'
import { canMutateContractData, canViewTrainingCourse } from '@/lib/permissions'
import { logAudit } from '@/lib/audit'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const course = await db.query.trainingCourses.findFirst({
      where: and(eq(trainingCourses.id, id), eq(trainingCourses.orgId, user.orgId)),
    })
    if (!course) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })
    if (!canViewTrainingCourse(user.role, course.status)) {
      return NextResponse.json({ error: 'Geen toegang' }, { status: 403 })
    }

    const modules = await db
      .select()
      .from(trainingModules)
      .where(eq(trainingModules.courseId, id))
      .orderBy(asc(trainingModules.sortOrder))

    const cc = await db.query.trainingCourseContracts.findMany({
      where: eq(trainingCourseContracts.courseId, id),
      with: { contract: { columns: { id: true, title: true, contractNumber: true } } },
    })
    const cd = await db.query.trainingCourseDocuments.findMany({
      where: eq(trainingCourseDocuments.courseId, id),
      with: {
        document: { columns: { id: true, filename: true, contractId: true } },
      },
    })

    const moduleIds = modules.map((m) => m.id)
    const progressRows =
      moduleIds.length === 0
        ? []
        : await db.query.trainingProgress.findMany({
            where: and(eq(trainingProgress.userId, user.id), inArray(trainingProgress.moduleId, moduleIds)),
          })
    const completedModuleIds = new Set(progressRows.map((p) => p.moduleId))

    return NextResponse.json({
      ...course,
      modules,
      sourceContracts: cc.map((x) => x.contract).filter(Boolean),
      sourceDocuments: cd.map((x) => ({
        ...x.document,
        courseId: x.courseId,
      })),
      completedModuleIds: Array.from(completedModuleIds),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canMutateContractData(user.role)) {
      return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })
    }

    const course = await db.query.trainingCourses.findFirst({
      where: and(eq(trainingCourses.id, id), eq(trainingCourses.orgId, user.orgId)),
    })
    if (!course) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    const body = (await req.json()) as {
      title?: string
      description?: string | null
      status?: 'draft' | 'published'
    }

    const updates: Partial<typeof trainingCourses.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (typeof body.title === 'string') updates.title = body.title.trim()
    if (body.description !== undefined) updates.description = body.description
    if (body.status === 'draft' || body.status === 'published') updates.status = body.status

    const [updated] = await db.update(trainingCourses).set(updates).where(eq(trainingCourses.id, id)).returning()
    if (!updated) return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 })

    await logAudit({
      user,
      action: 'training_course_updated',
      newValue: { courseId: id, ...body },
    })

    return NextResponse.json(updated)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canMutateContractData(user.role)) {
      return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })
    }

    const course = await db.query.trainingCourses.findFirst({
      where: and(eq(trainingCourses.id, id), eq(trainingCourses.orgId, user.orgId)),
    })
    if (!course) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    await db.delete(trainingCourses).where(eq(trainingCourses.id, id))

    await logAudit({
      user,
      action: 'training_course_deleted',
      oldValue: { courseId: id, title: course.title },
    })

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
