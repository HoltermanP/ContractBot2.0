import { db } from '@/lib/db'
import { organizationMembers, organizations, users } from '@/lib/db/schema'
import type { UserRole } from '@/lib/auth'
import { APP_USER_ROLES } from '@/lib/auth'
import { and, eq } from 'drizzle-orm'

/** Clerk `UserJSON.public_metadata.role` → app-rol. */
function roleFromClerkPublicMetadata(raw: unknown): UserRole {
  return typeof raw === 'string' && APP_USER_ROLES.includes(raw as UserRole) ? (raw as UserRole) : 'reader'
}

function primaryEmailFromClerkPayload(clerkUser: {
  email_addresses?: Array<{ id: string; email_address: string }>
  primary_email_address_id?: string | null
}): string {
  const list = clerkUser.email_addresses ?? []
  if (clerkUser.primary_email_address_id) {
    const p = list.find((e) => e.id === clerkUser.primary_email_address_id)
    if (p?.email_address) return p.email_address.toLowerCase()
  }
  return (list[0]?.email_address ?? '').toLowerCase()
}

async function upsertOrganizationMembership(userId: string, orgId: string, role: UserRole): Promise<void> {
  const existing = await db.query.organizationMembers.findFirst({
    where: and(eq(organizationMembers.userId, userId), eq(organizationMembers.orgId, orgId)),
  })
  if (!existing) {
    await db.insert(organizationMembers).values({ userId, orgId, role })
  } else if (existing.role !== role) {
    await db.update(organizationMembers).set({ role }).where(eq(organizationMembers.id, existing.id))
  }
}

/**
 * Synchroniseert een Clerk-gebruiker (webhook-/sessiepayload, snake_case) naar Neon.
 * Idempotent: veilig bij herhaalde webhooks of session.created na user.created.
 */
export async function syncClerkUserJsonToDatabase(clerkUser: {
  id: string
  first_name?: string | null
  last_name?: string | null
  email_addresses?: Array<{ id: string; email_address: string }>
  primary_email_address_id?: string | null
  public_metadata?: Record<string, unknown> | null
}): Promise<void> {
  const email = primaryEmailFromClerkPayload(clerkUser)
  const name =
    (`${clerkUser.first_name ?? ''} ${clerkUser.last_name ?? ''}`.trim()) || email || 'Gebruiker'

  const pm = clerkUser.public_metadata
  const invitedOrgId =
    pm && typeof pm === 'object' && typeof (pm as Record<string, unknown>).invited_org_id === 'string'
      ? ((pm as Record<string, unknown>).invited_org_id as string)
      : undefined
  const role = roleFromClerkPublicMetadata(
    pm && typeof pm === 'object' ? (pm as Record<string, unknown>).role : undefined
  )

  const existing = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkUser.id),
  })

  const invitedOrgRow = invitedOrgId
    ? await db.query.organizations.findFirst({
        where: eq(organizations.id, invitedOrgId),
        columns: { id: true },
      })
    : null
  const invitedOrgValid = Boolean(invitedOrgRow)

  if (!existing) {
    if (invitedOrgId && invitedOrgValid) {
      const [row] = await db
        .insert(users)
        .values({
          clerkId: clerkUser.id,
          orgId: invitedOrgId,
          role,
          name,
          email,
        })
        .returning()
      await upsertOrganizationMembership(row.id, invitedOrgId, role)
      return
    }

    await db.insert(users).values({
      clerkId: clerkUser.id,
      orgId: null,
      role,
      name,
      email,
    })
    return
  }

  await db.update(users).set({ name, email }).where(eq(users.clerkId, clerkUser.id))

  if (!invitedOrgId || !invitedOrgValid) return

  const currentOrgSlug = existing.orgId
    ? (
        await db.query.organizations.findFirst({
          where: eq(organizations.id, existing.orgId),
          columns: { slug: true },
        })
      )?.slug
    : undefined
  const wronglySoloPlaceholder = currentOrgSlug === clerkUser.id

  const shouldSetHomeOrg =
    !existing.orgId || wronglySoloPlaceholder || existing.orgId === invitedOrgId

  if (shouldSetHomeOrg) {
    await db
      .update(users)
      .set({ orgId: invitedOrgId, role })
      .where(eq(users.id, existing.id))
  }

  await upsertOrganizationMembership(existing.id, invitedOrgId, role)
}
