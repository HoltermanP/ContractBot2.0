import { getOrCreateUser, requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { ContractForm } from '../contract-form'
import { ensureDefaultProjectForOrg } from '@/lib/org'
import { project } from '@/lib/db'
import { z } from 'zod'

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  await requireRole('registrator')
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  const parsedOrgId = z.string().uuid().safeParse(user.orgId)
  if (!parsedOrgId.success) redirect('/dashboard')

  await ensureDefaultProjectForOrg(parsedOrgId.data)

  const { project: projectFromUrl } = await searchParams

  const allProjects = await db.query.project.findMany({
      where: eq(project.organisationId, parsedOrgId.data),
      orderBy: (p, { asc }) => [asc(p.name)],
    })
  const initialProject =
    projectFromUrl && allProjects.some((p) => p.id === projectFromUrl) ? projectFromUrl : allProjects[0]?.id ?? ''

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nieuw contract aanmaken</h1>
        <p className="text-muted-foreground">Vul de contractgegevens in of upload een document voor automatische extractie</p>
      </div>
      <ContractForm
        suppliers={[]}
        users={[]}
        projects={allProjects}
        currentUser={user}
        customFields={[]}
        initialData={{ projectId: initialProject }}
      />
    </div>
  )
}
