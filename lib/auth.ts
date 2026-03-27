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

export async function getOrCreateUser(): Promise<AuthUser | null> {
  const clerkUser = await currentUser()
  if (!clerkUser) return null

  const existing = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkUser.id),
  })

  const role = (clerkUser.publicMetadata?.role as UserRole) ?? 'reader'
  const name =
    (`${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim()) ||
    (clerkUser.emailAddresses[0]?.emailAddress ?? 'Gebruiker')
  const email = clerkUser.emailAddresses[0]?.emailAddress ?? ''

  if (existing) {
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
