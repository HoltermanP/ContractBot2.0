import { getOrCreateUser, requireRole } from '@/lib/auth'
import { db, projects } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { ContractForm } from '../contract-form'

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>
}) {
  await requireRole('registrator')
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  const { project: projectFromUrl } = await searchParams

  const allProjects = await db.query.projects.findMany({
    where: eq(projects.orgId, user.orgId),
    orderBy: (p, { asc }) => [asc(p.name)],
  })

  if (allProjects.length === 0) {
    redirect('/dashboard')
  }

  const initialProject =
    projectFromUrl && allProjects.some((p) => p.id === projectFromUrl) ? projectFromUrl : allProjects[0]!.id

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
