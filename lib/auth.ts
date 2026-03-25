import { auth, currentUser } from '@clerk/nextjs/server'
import { db, users, organizations, organizationMembers, projects } from './db'
import { and, eq } from 'drizzle-orm'
import { roleRank } from './permissions'

export type UserRole = 'admin' | 'registrator' | 'manager' | 'compliance' | 'reader'

export interface AuthUser {
  id: string
  clerkId: string
  orgId: string
  role: UserRole
  name: string
  email: string
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

export async function getOrCreateUser(): Promise<AuthUser | null> {
  const clerkUser = await currentUser()
  if (!clerkUser) return null

  const existing = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkUser.id),
  })
  if (existing) {
    if (existing.orgId) {
      await ensureOrgMembership(existing.id, existing.orgId, existing.role as UserRole)
    }
    return existing as AuthUser
  }

  // Get or create org from Clerk org
  // Use clerk_id as the org slug for solo users, or create a default org
  const clerkOrgId = clerkUser.id
  let orgId: string | null = null

  const existingOrg = await db.query.organizations.findFirst({
    where: eq(organizations.slug, clerkOrgId),
  })
  if (existingOrg) {
    orgId = existingOrg.id
  } else {
    const orgName = 'Mijn Organisatie'
    const [newOrg] = await db.insert(organizations).values({
      name: orgName,
      slug: clerkOrgId,
    }).returning()
    orgId = newOrg.id
    await db.insert(projects).values({
      orgId: newOrg.id,
      name: 'Algemeen',
      description: 'Standaardproject voor contracten',
    })
  }

  const role = (clerkUser.publicMetadata?.role as UserRole) ?? 'reader'
  const [newUser] = await db.insert(users).values({
    clerkId: clerkUser.id,
    orgId,
    role,
    name: (`${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim()) || (clerkUser.emailAddresses[0]?.emailAddress ?? 'Gebruiker'),
    email: clerkUser.emailAddresses[0]?.emailAddress ?? '',
  }).returning()

  await ensureOrgMembership(newUser.id, orgId!, role)

  return newUser as AuthUser
}
