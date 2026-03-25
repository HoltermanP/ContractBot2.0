import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contracts, suppliers, projects } from '@/lib/db/schema'
import { eq, and, or, ilike, desc } from 'drizzle-orm'
import { ensureDefaultProjectForOrg } from '@/lib/org'
import { canMutateContractData } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatCurrency, daysUntil, getExpiryBadgeClass, STATUS_LABELS } from '@/lib/utils'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { ContractsFilter } from './contracts-filter'

interface SearchParams {
  status?: string
  search?: string
  type?: string
  project?: string
}

export default async function ContractsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const resolvedParams = await searchParams
  const user = await getOrCreateUser()
  if (!user) return null

  await ensureDefaultProjectForOrg(user.orgId)

  const conditions = [eq(contracts.orgId, user.orgId)]

  // Readers don't see archived contracts
  if (user.role === 'reader') {
    conditions.push(or(eq(contracts.status, 'actief'), eq(contracts.status, 'concept'), eq(contracts.status, 'verlopen'))!)
  }

  if (resolvedParams.status) conditions.push(eq(contracts.status, resolvedParams.status as any))
  if (resolvedParams.project) {
    conditions.push(eq(contracts.projectId, resolvedParams.project))
  }
  if (resolvedParams.search) {
    conditions.push(or(
      ilike(contracts.title, `%${resolvedParams.search}%`),
      ilike(contracts.contractNumber, `%${resolvedParams.search}%`)
    )!)
  }

  const allContracts = await db.query.contracts.findMany({
    where: and(...conditions),
    orderBy: [desc(contracts.updatedAt)],
    with: { supplier: true, owner: true, project: true },
  })

  const [allSuppliers, allProjects] = await Promise.all([
    db.query.suppliers.findMany({ where: eq(suppliers.orgId, user.orgId) }),
    db.query.projects.findMany({
      where: eq(projects.orgId, user.orgId),
      orderBy: (p, { asc }) => [asc(p.name)],
    }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contracten</h1>
          <p className="text-muted-foreground">{allContracts.length} contracten gevonden</p>
        </div>
        {canMutateContractData(user.role) && (
          <Button asChild>
            <Link href="/contracts/new">
              <Plus className="h-4 w-4 mr-2" />
              Nieuw contract
            </Link>
          </Button>
        )}
      </div>

      <ContractsFilter suppliers={allSuppliers} projects={allProjects} currentParams={resolvedParams} />

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Naam</th>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Nummer</th>
              <th className="px-4 py-3 font-medium">Leverancier</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Afloopdatum</th>
              <th className="px-4 py-3 font-medium">Waarde (jaar)</th>
              <th className="px-4 py-3 font-medium">Eigenaar</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {allContracts.map(contract => {
              const days = daysUntil(contract.endDate)
              return (
                <tr key={contract.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/contracts/${contract.id}`} className="font-medium text-blue-600 hover:underline">
                      {contract.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {(contract as { project?: { name?: string } | null }).project?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{contract.contractNumber ?? '—'}</td>
                  <td className="px-4 py-3">{(contract as any).supplier?.name ?? '—'}</td>
                  <td className="px-4 py-3">{contract.contractType ?? '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={contract.status === 'actief' ? 'success' : contract.status === 'verlopen' ? 'danger' : 'outline'}>
                      {STATUS_LABELS[contract.status] ?? contract.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {contract.endDate ? (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getExpiryBadgeClass(days)}`}>
                        {formatDate(contract.endDate)}
                        {days !== null && (
                          <span className="ml-1">
                            {days > 0 ? `${days}d` : 'Verlopen'}
                          </span>
                        )}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">{formatCurrency(contract.valueAnnual, contract.currency ?? 'EUR')}</td>
                  <td className="px-4 py-3 text-muted-foreground">{(contract as any).owner?.name ?? '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {allContracts.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p>Geen contracten gevonden</p>
            {canMutateContractData(user.role) && (
              <Button asChild className="mt-4" variant="outline">
                <Link href="/contracts/new">Eerste contract aanmaken</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function FileText({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
