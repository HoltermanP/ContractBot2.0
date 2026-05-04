import { redirect } from 'next/navigation'
import { getOrCreateUser } from '@/lib/auth'
import { db, organizations } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { getEffectiveModuleVisibility, type OrgModuleKey } from '@/lib/org-modules'

export async function getOrgSettingsJsonForUser(orgId: string): Promise<unknown> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: { settingsJson: true },
  })
  return org?.settingsJson
}

/** Server-side: redirect naar dashboard als deze module voor de rol niet beschikbaar is. */
export async function requireOrgModule(key: OrgModuleKey) {
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  const settingsJson = await getOrgSettingsJsonForUser(user.orgId)
  const visibility = getEffectiveModuleVisibility(settingsJson, user.role)
  if (!visibility[key]) redirect('/dashboard')

  return user
}
