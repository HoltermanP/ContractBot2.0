import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { approvalWorkflows } from '@/lib/db/schema'
import { logAudit } from '@/lib/audit'
import { canMutateContractData } from '@/lib/permissions'

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    if (!canMutateContractData(user.role)) return NextResponse.json({ error: 'Geen rechten' }, { status: 403 })

    const { contractId, workflowType, steps } = await req.json()

    // Build initial steps structure
    const initialSteps = Array.isArray(steps) && steps.length > 0
      ? steps.map((s: { approver: string; role?: string }, i: number) => ({
          step: i + 1,
          approver: s.approver,
          role: s.role ?? null,
          status: 'pending',
          approvedAt: null,
          comment: null,
        }))
      : []

    const [workflow] = await db.insert(approvalWorkflows).values({
      contractId,
      workflowType: workflowType ?? 'new_contract',
      status: 'pending',
      stepsJson: initialSteps as any,
      currentStep: 0,
      createdBy: user.id,
    }).returning()

    await logAudit({
      user,
      contractId,
      action: 'goedkeuring.gestart',
      newValue: { workflowType, workflowId: workflow.id },
    })

    return NextResponse.json(workflow)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
