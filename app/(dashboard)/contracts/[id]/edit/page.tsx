import { getOrCreateUser, requireRole } from '@/lib/auth'
import { db, contracts, projects } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { ContractForm } from '../../contract-form'
import { canMutateContractData } from '@/lib/permissions'

export default async function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole('registrator')
  const { id } = await params
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  if (!canMutateContractData(user.role)) redirect(`/contracts/${id}`)

  const row = await db.query.contracts.findFirst({
    where: and(eq(contracts.id, id), eq(contracts.orgId, user.orgId)),
  })
  if (!row) notFound()

  const allProjects = await db.query.projects.findMany({
    where: eq(projects.orgId, user.orgId),
    orderBy: (p, { asc }) => [asc(p.name)],
  })

  const initialData = {
    projectId: row.projectId ?? allProjects[0]?.id ?? '',
    title: row.title,
    contractNumber: row.contractNumber ?? '',
    status: row.status,
    contractType: row.contractType ?? '',
    supplierId: row.supplierId ?? '',
    ownerUserId: row.ownerUserId ?? user.id,
    startDate: row.startDate ? new Date(row.startDate).toISOString().split('T')[0] : '',
    endDate: row.endDate ? new Date(row.endDate).toISOString().split('T')[0] : '',
    optionDate: row.optionDate ? new Date(row.optionDate).toISOString().split('T')[0] : '',
    noticePeriodDays: row.noticePeriodDays != null ? String(row.noticePeriodDays) : '',
    valueTotal: row.valueTotal != null ? String(row.valueTotal) : '',
    valueAnnual: row.valueAnnual != null ? String(row.valueAnnual) : '',
    currency: row.currency ?? 'EUR',
    autoRenewal: row.autoRenewal ?? false,
    autoRenewalTerms: row.autoRenewalTerms ?? '',
    retentionYears: row.retentionYears != null ? String(row.retentionYears) : '7',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contract bewerken</h1>
        <p className="text-muted-foreground">{row.contractNumber?.trim() || row.title}</p>
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
