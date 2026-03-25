import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { approvalWorkflows } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logAudit } from '@/lib/audit'
import { canApproveWorkflow } from '@/lib/permissions'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canApproveWorkflow(user.role)) {
      return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })
    }

    const { comment } = await req.json()
    const wf = await db.query.approvalWorkflows.findFirst({ where: eq(approvalWorkflows.id, id) })
    if (!wf) return NextResponse.json({ error: 'Niet gevonden' }, { status: 404 })

    const steps = [...((wf.stepsJson as any[]) ?? []), {
      approver: user.name,
      approverId: user.id,
      action: 'rejected',
      comment: comment ?? null,
      rejectedAt: new Date().toISOString(),
    }]

    await db.update(approvalWorkflows).set({
      status: 'rejected',
      stepsJson: steps as any,
      completedAt: new Date(),
    }).where(eq(approvalWorkflows.id, id))

    await logAudit({
      user,
      contractId: wf.contractId,
      action: 'goedkeuring.afgewezen',
      newValue: { workflowId: id, comment },
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
