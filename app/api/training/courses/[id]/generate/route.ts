import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import {
  db,
  trainingCourses,
  trainingModules,
  trainingCourseContracts,
  trainingCourseDocuments,
} from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { canMutateContractData } from '@/lib/permissions'
import { resolveTrainingSources, trimSourcesForModel } from '@/lib/training-sources'
import { generateExtendedContractTraining } from '@/lib/training-ai'
import { logAudit } from '@/lib/audit'

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

    const cLinks = await db.query.trainingCourseContracts.findMany({
      where: eq(trainingCourseContracts.courseId, courseId),
    })
    const dLinks = await db.query.trainingCourseDocuments.findMany({
      where: eq(trainingCourseDocuments.courseId, courseId),
    })
    const contractIds = cLinks.map((c) => c.contractId)
    const documentIds = dLinks.map((d) => d.documentId)

    if (contractIds.length === 0 && documentIds.length === 0) {
      return NextResponse.json(
        {
          error:
            'Geen bronnen gekoppeld. Kies minstens één contract en/of specifieke contractdocumenten (addenda) in de stap “Bronnen”.',
        },
        { status: 400 }
      )
    }

    const resolved = await resolveTrainingSources(user.orgId, contractIds, documentIds)
    if (resolved.length === 0) {
      return NextResponse.json(
        { error: 'Geen documenttekst gevonden. Controleer of er PDF/DOCX-documenten aan de contracten hangen.' },
        { status: 400 }
      )
    }

    const blocks = trimSourcesForModel(resolved)
    const generated = await generateExtendedContractTraining(blocks, user.orgId)

    await db.delete(trainingModules).where(eq(trainingModules.courseId, courseId))

    const rows = generated.modules.map((m, i) => ({
      courseId,
      sortOrder: i,
      title: m.title,
      bodyMarkdown: m.bodyMarkdown,
      estimatedMinutes: m.estimatedMinutes,
      quizJson: m.quiz && m.quiz.length > 0 ? { questions: m.quiz } : null,
    }))

    if (rows.length > 0) {
      await db.insert(trainingModules).values(rows)
    }

    const intro = generated.introduction.trim()
    await db
      .update(trainingCourses)
      .set({
        description: intro || course.description,
        updatedAt: new Date(),
      })
      .where(eq(trainingCourses.id, courseId))

    await logAudit({
      user,
      action: 'training_course_generated',
      newValue: { courseId, moduleCount: rows.length },
    })

    return NextResponse.json({
      ok: true,
      introduction: intro,
      moduleCount: rows.length,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
