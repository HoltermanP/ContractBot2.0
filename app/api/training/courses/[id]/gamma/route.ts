import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db, trainingCourses, trainingModules } from '@/lib/db'
import { eq, and, asc } from 'drizzle-orm'
import { canMutateContractData } from '@/lib/permissions'
import { gammaCreateGeneration } from '@/lib/gamma'
import { buildGammaInputFromCourse } from '@/lib/training-ai'
import { logAudit } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: courseId } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canMutateContractData(user.role)) {
      return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as {
      numCards?: number
      textMode?: 'generate' | 'condense' | 'preserve'
      exportAs?: 'pdf' | 'pptx' | 'png'
    }

    const course = await db.query.trainingCourses.findFirst({
      where: and(eq(trainingCourses.id, courseId), eq(trainingCourses.orgId, user.orgId)),
    })
    if (!course) return NextResponse.json({ error: 'Cursus niet gevonden' }, { status: 404 })

    const modules = await db
      .select()
      .from(trainingModules)
      .where(eq(trainingModules.courseId, courseId))
      .orderBy(asc(trainingModules.sortOrder))

    if (modules.length === 0) {
      return NextResponse.json(
        { error: 'Genereer eerst de e-learningmodules voordat u een presentatie maakt.' },
        { status: 400 }
      )
    }

    const intro = course.description ?? ''
    const inputText = buildGammaInputFromCourse(
      course.title,
      intro,
      modules.map((m) => ({ title: m.title, bodyMarkdown: m.bodyMarkdown }))
    )

    const { generationId } = await gammaCreateGeneration({
      inputText,
      format: 'presentation',
      numCards: body.numCards,
      textMode: body.textMode ?? 'preserve',
      exportAs: body.exportAs,
    })

    await db
      .update(trainingCourses)
      .set({
        gammaGenerationId: generationId,
        gammaStatus: 'pending',
        gammaUrl: null,
        gammaExportUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(trainingCourses.id, courseId))

    await logAudit({
      user,
      action: 'training_gamma_started',
      newValue: { courseId, generationId },
    })

    return NextResponse.json({ generationId, status: 'pending' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
