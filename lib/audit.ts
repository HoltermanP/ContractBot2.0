import { db, auditLog } from './db'
import type { AuthUser } from './auth'

export async function logAudit({
  user,
  contractId,
  action,
  oldValue,
  newValue,
  ipAddress,
}: {
  user: AuthUser
  contractId?: string
  action: string
  oldValue?: unknown
  newValue?: unknown
  ipAddress?: string
}) {
  await db.insert(auditLog).values({
    orgId: user.orgId,
    contractId: contractId ?? null,
    userId: user.id,
    action,
    oldValueJson: oldValue ? oldValue as Record<string, unknown> : null,
    newValueJson: newValue ? newValue as Record<string, unknown> : null,
    ipAddress: ipAddress ?? null,
  })
}
