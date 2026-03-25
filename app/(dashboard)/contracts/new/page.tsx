import { getOrCreateUser, requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { suppliers, customFields, organizationMembers, projects } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { ContractForm } from '../contract-form'
import { ensureDefaultProjectForOrg } from '@/lib/org'

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  await requireRole('registrator')
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  await ensureDefaultProjectForOrg(user.orgId)

  const { project: projectFromUrl } = await searchParams

  const [allSuppliers, memberRows, orgCustomFields, allProjects] = await Promise.all([
    db.query.suppliers.findMany({ where: eq(suppliers.orgId, user.orgId) }),
    db.query.organizationMembers.findMany({
      where: eq(organizationMembers.orgId, user.orgId!),
      with: { user: true },
    }),
    db.query.customFields.findMany({ where: eq(customFields.orgId, user.orgId) }),
    db.query.projects.findMany({
      where: eq(projects.orgId, user.orgId),
      orderBy: (p, { asc }) => [asc(p.name)],
    }),
  ])

  const allUsers = memberRows.map((m) => m.user).filter((u): u is NonNullable<typeof u> => !!u)
  const initialProject =
    projectFromUrl && allProjects.some((p) => p.id === projectFromUrl) ? projectFromUrl : allProjects[0]?.id ?? ''

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nieuw contract aanmaken</h1>
        <p className="text-muted-foreground">Vul de contractgegevens in of upload een document voor automatische extractie</p>
      </div>
      <ContractForm
        suppliers={allSuppliers}
        users={allUsers}
        projects={allProjects}
        currentUser={user}
        customFields={orgCustomFields}
        initialData={{ projectId: initialProject }}
      />
    </div>
  )
}
