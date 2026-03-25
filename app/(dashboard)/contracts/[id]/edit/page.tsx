import { getOrCreateUser, requireRole } from '@/lib/auth'
import { db } from '@/lib/db'
import { contracts, suppliers, customFields, organizationMembers, projects } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { ContractForm } from '../../contract-form'
import { canMutateContractData } from '@/lib/permissions'
import { ensureDefaultProjectForOrg } from '@/lib/org'

export default async function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  if (!canMutateContractData(user.role)) redirect(`/contracts/${id}`)

  const contract = await db.query.contracts.findFirst({
    where: and(eq(contracts.id, id), eq(contracts.orgId, user.orgId)),
  })
  if (!contract) notFound()

  await ensureDefaultProjectForOrg(user.orgId)

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
  const fallbackProjectId = allProjects[0]?.id ?? ''

  const initialData = {
    projectId: contract.projectId ?? fallbackProjectId,
    title: contract.title,
    contractNumber: contract.contractNumber ?? '',
    status: contract.status,
    contractType: contract.contractType ?? '',
    supplierId: contract.supplierId ?? '',
    ownerUserId: contract.ownerUserId ?? '',
    startDate: contract.startDate ? new Date(contract.startDate).toISOString().split('T')[0] : '',
    endDate: contract.endDate ? new Date(contract.endDate).toISOString().split('T')[0] : '',
    optionDate: contract.optionDate ? new Date(contract.optionDate).toISOString().split('T')[0] : '',
    noticePeriodDays: contract.noticePeriodDays?.toString() ?? '',
    valueTotal: contract.valueTotal?.toString() ?? '',
    valueAnnual: contract.valueAnnual?.toString() ?? '',
    currency: contract.currency ?? 'EUR',
    autoRenewal: contract.autoRenewal ?? false,
    autoRenewalTerms: contract.autoRenewalTerms ?? '',
    retentionYears: contract.retentionYears?.toString() ?? '7',
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Contract bewerken</h1>
        <p className="text-muted-foreground">{contract.title}</p>
      </div>
      <ContractForm
        suppliers={allSuppliers}
        users={allUsers}
        projects={allProjects}
        currentUser={user}
        initialData={initialData}
        contractId={id}
        customFields={orgCustomFields}
        initialCustomValues={(contract.metadataJson as Record<string, string>) ?? {}}
      />
    </div>
  )
}
