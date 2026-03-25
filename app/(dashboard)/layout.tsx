export const dynamic = 'force-dynamic'
import { Sidebar } from '@/components/layout/sidebar'
import { OrgSwitcher } from '@/components/layout/org-switcher'
import { getOrCreateUser } from '@/lib/auth'
import { db, organizations } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, user.orgId),
  })

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
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
