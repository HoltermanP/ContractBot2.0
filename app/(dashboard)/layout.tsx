export const dynamic = 'force-dynamic'
import { Sidebar } from '@/components/layout/sidebar'
import { OrgSwitcher } from '@/components/layout/org-switcher'
import { OrgRouteGuard } from '@/components/layout/org-route-guard'
import { getOrCreateUser } from '@/lib/auth'
import { db, organizations } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { getOrgModuleVisibilityFromSettings, type OrgModuleVisibility } from '@/lib/org-modules'
import { isOrgAdminRole } from '@/lib/permissions'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, user.orgId),
  })
  const baseVisibility = getOrgModuleVisibilityFromSettings(org?.settingsJson)
  const moduleVisibility: OrgModuleVisibility = {
    ...baseVisibility,
    training: baseVisibility.training && isOrgAdminRole(user.role),
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar moduleVisibility={moduleVisibility} />
      <main className="flex-1 ml-64 p-8">
        <OrgRouteGuard moduleVisibility={moduleVisibility} />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 mb-6">
          <p className="text-sm text-muted-foreground order-2 sm:order-1 sm:mr-auto">
            <span className="font-medium text-slate-800">{org?.name ?? 'Organisatie'}</span>
            <span className="mx-2 text-slate-300">·</span>
            Actieve organisatie
          </p>
          <div className="order-1 sm:order-2">
            <OrgSwitcher />
          </div>
        </div>
        {children}
      </main>
    </div>
  )
}
