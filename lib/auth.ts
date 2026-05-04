import { auth, currentUser } from '@clerk/nextjs/server'
import { db, users, organizations, organizationMembers, projects } from './db'
import { and, eq } from 'drizzle-orm'
import { roleRank } from './permissions'

export type UserRole = 'super_admin' | 'admin' | 'registrator' | 'manager' | 'compliance' | 'reader'

/** Geldige rollen (o.a. Clerk `publicMetadata.role`). */
export const APP_USER_ROLES: UserRole[] = [
  'super_admin',
  'admin',
  'manager',
  'registrator',
  'compliance',
  'reader',
]

export interface AuthUser {
  id: string
  clerkId: string
  orgId: string
  role: UserRole
  name: string
  email: string
}

/**
 * Snelle request-scope lookup zonder provisioning/sync met Clerk profiel.
 * Gebruik dit voor layout/navigatie om onnodige latency per page-transition te voorkomen.
 */
export async function getSessionUser(): Promise<AuthUser | null> {
  const { userId } = await auth()
  if (!userId) return null
  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  })
  return user as AuthUser | null
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const { userId } = await auth()
  if (!userId) return null

  const user = await db.query.users.findFirst({
    where: eq(users.clerkId, userId),
  })

  return user as AuthUser | null
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getAuthUser()
  if (!user) throw new Error('Niet ingelogd')
  return user
}

export async function requireRole(minRole: UserRole): Promise<AuthUser> {
  const user = await requireAuth()
  if (roleRank(user.role) < roleRank(minRole)) {
    throw new Error('Onvoldoende rechten')
  }
  return user
}

export async function ensureOrgMembership(userId: string, orgId: string, role: UserRole): Promise<void> {
  const existing = await db.query.organizationMembers.findFirst({
    where: and(eq(organizationMembers.userId, userId), eq(organizationMembers.orgId, orgId)),
  })
  if (!existing) {
    await db.insert(organizationMembers).values({ userId, orgId, role })
  }
}

async function getOrCreateSoloOrgForClerkUser(clerkUserId: string): Promise<string> {
  const existingOrg = await db.query.organizations.findFirst({
    where: eq(organizations.slug, clerkUserId),
  })
  if (existingOrg) return existingOrg.id

  const [newOrg] = await db.insert(organizations).values({
    name: 'Mijn Organisatie',
    slug: clerkUserId,
  }).returning()
  await db.insert(projects).values({
    orgId: newOrg.id,
    name: 'Algemeen',
    description: 'Standaardproject voor contracten',
  })
  return newOrg.id
}

/** Uitnodiging via Clerk: publicMetadata bevat doel-organisatie (zie invite API). */
function invitedOrgFromPublicMetadata(
  publicMetadata: Record<string, unknown> | null | undefined
): { orgId: string; role: UserRole } | null {
  if (!publicMetadata || typeof publicMetadata !== 'object') return null
  const invitedOrgId =
    typeof publicMetadata.invited_org_id === 'string' ? publicMetadata.invited_org_id : undefined
  if (!invitedOrgId) return null
  const rawRole = publicMetadata.role
  const role: UserRole =
    typeof rawRole === 'string' && APP_USER_ROLES.includes(rawRole as UserRole)
      ? (rawRole as UserRole)
      : 'reader'
  return { orgId: invitedOrgId, role }
}

async function invitedOrgExists(orgId: string): Promise<boolean> {
  const row = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: { id: true },
  })
  return Boolean(row)
}

/** Solo-org = placeholder met slug gelijk aan Clerk user id (niet de uitgenodigde org). */
async function isSoloPlaceholderOrg(clerkUserId: string, orgId: string | null): Promise<boolean> {
  if (!orgId) return false
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: { slug: true },
  })
  return org?.slug === clerkUserId
}

export async function getOrCreateUser(): Promise<AuthUser | null> {
  const clerkUser = await currentUser()
  if (!clerkUser) return null

  const existing = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkUser.id),
  })

  const pm = clerkUser.publicMetadata as Record<string, unknown> | null | undefined
  const invited = invitedOrgFromPublicMetadata(pm)

  const rawRole = clerkUser.publicMetadata?.role
  const role: UserRole =
    typeof rawRole === 'string' && APP_USER_ROLES.includes(rawRole as UserRole)
      ? (rawRole as UserRole)
      : 'reader'
  const name =
    (`${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim()) ||
    (clerkUser.emailAddresses[0]?.emailAddress ?? 'Gebruiker')
  const email = clerkUser.emailAddresses[0]?.emailAddress ?? ''

  if (existing) {
    if (invited && (await invitedOrgExists(invited.orgId))) {
      const wronglySolo = await isSoloPlaceholderOrg(clerkUser.id, existing.orgId)
      if (!existing.orgId || wronglySolo) {
        const [updated] = await db
          .update(users)
          .set({ orgId: invited.orgId, role: invited.role, name, email })
          .where(eq(users.id, existing.id))
          .returning()
        await ensureOrgMembership(updated.id, invited.orgId, invited.role)
        return updated as AuthUser
      }
    }

    if (!existing.orgId) {
      const orgId = await getOrCreateSoloOrgForClerkUser(clerkUser.id)
      const [updated] = await db
        .update(users)
        .set({ orgId, role, name, email })
        .where(eq(users.id, existing.id))
        .returning()
      await ensureOrgMembership(updated.id, orgId, updated.role as UserRole)
      return updated as AuthUser
    }
    await ensureOrgMembership(existing.id, existing.orgId, existing.role as UserRole)
    return existing as AuthUser
  }

  if (invited && (await invitedOrgExists(invited.orgId))) {
    const [newUser] = await db
      .insert(users)
      .values({
        clerkId: clerkUser.id,
        orgId: invited.orgId,
        role: invited.role,
        name,
        email,
      })
      .returning()
    await ensureOrgMembership(newUser.id, invited.orgId, invited.role)
    return newUser as AuthUser
  }

  const orgId = await getOrCreateSoloOrgForClerkUser(clerkUser.id)
  const [newUser] = await db
    .insert(users)
    .values({
      clerkId: clerkUser.id,
      orgId,
      role,
      name,
      email,
    })
    .returning()

  await ensureOrgMembership(newUser.id, orgId, role)

  return newUser as AuthUser
}
