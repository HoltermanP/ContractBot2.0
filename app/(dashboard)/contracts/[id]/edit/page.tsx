import { getOrCreateUser, requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { contract, contractProject, project } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { ContractForm } from '../../contract-form'
import { canMutateContractData } from '@/lib/permissions'
import { ensureDefaultProjectForOrg } from '@/lib/org'
import { z } from 'zod'

export default async function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('registrator')
  const { id } = await params
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  if (!canMutateContractData(user.role)) redirect(`/contracts/${id}`)

  const row = await db.query.contract.findFirst({
    where: eq(contract.id, id),
  })
  if (!row) notFound()

  const parsedOrgId = z.string().uuid().safeParse(user.orgId)
  if (!parsedOrgId.success) redirect('/contracts')
  await ensureDefaultProjectForOrg(parsedOrgId.data)

  const [allProjects, links] = await Promise.all([
    db.query.project.findMany({
      where: eq(project.organisationId, parsedOrgId.data),
      orderBy: (p, { asc }) => [asc(p.name)],
    }),
    db.query.contractProject.findMany({
      where: eq(contractProject.contractId, row.id),
    }),
  ])

  const fallbackProjectId = allProjects[0]?.id ?? ''

  const initialData = {
    projectId: links[0]?.projectId ?? fallbackProjectId,
    title: row.reference,
    contractNumber: row.reference,
    status: row.status,
    contractType: row.contractType ?? '',
    startDate: row.startDate ? new Date(row.startDate).toISOString().split('T')[0] : '',
    endDate: row.endDate ? new Date(row.endDate).toISOString().split('T')[0] : '',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contract bewerken</h1>
        <p className="text-muted-foreground">{row.reference}</p>
      </div>
      <ContractForm
        suppliers={[]}
        users={[]}
        projects={allProjects}
        currentUser={user}
        initialData={initialData}
        contractId={id}
        customFields={[]}
        initialCustomValues={{}}
      />
    </div>
  )
}
