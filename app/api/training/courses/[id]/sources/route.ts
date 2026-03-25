import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db, trainingCourses, trainingCourseContracts, trainingCourseDocuments, contracts, contractDocuments } from '@/lib/db'
import { eq, and, inArray } from 'drizzle-orm'
import { canMutateContractData } from '@/lib/permissions'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const body = (await req.json()) as { contractIds?: string[]; documentIds?: string[] }
    const contractIds = Array.isArray(body.contractIds) ? body.contractIds.filter((x) => typeof x === 'string') : []
    const documentIds = Array.isArray(body.documentIds) ? body.documentIds.filter((x) => typeof x === 'string') : []

    if (contractIds.length > 0) {
      const found = await db.query.contracts.findMany({
        where: and(inArray(contracts.id, contractIds), eq(contracts.orgId, user.orgId)),
      })
      if (found.length !== contractIds.length) {
        return NextResponse.json({ error: 'Ongeldige contractselectie' }, { status: 400 })
      }
    }

    if (documentIds.length > 0) {
      const docs = await db.query.contractDocuments.findMany({
        where: inArray(contractDocuments.id, documentIds),
        with: { contract: true },
      })
      const bad = docs.filter((d) => d.contract?.orgId !== user.orgId)
      if (bad.length > 0) {
        return NextResponse.json({ error: 'Een of meer documenten zijn ongeldig' }, { status: 400 })
      }
    }

    await db.delete(trainingCourseContracts).where(eq(trainingCourseContracts.courseId, courseId))
    await db.delete(trainingCourseDocuments).where(eq(trainingCourseDocuments.courseId, courseId))

    if (contractIds.length > 0) {
      await db.insert(trainingCourseContracts).values(
        contractIds.map((contractId) => ({ courseId, contractId }))
      )
    }
    if (documentIds.length > 0) {
      await db.insert(trainingCourseDocuments).values(
        documentIds.map((documentId) => ({ courseId, documentId }))
      )
    }

    await db
      .update(trainingCourses)
      .set({ updatedAt: new Date() })
      .where(eq(trainingCourses.id, courseId))

    return NextResponse.json({
      ok: true,
      contractIds,
      documentIds,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Onbekende fout'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
