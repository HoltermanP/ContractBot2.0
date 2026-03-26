import { getOrCreateUser } from '@/lib/auth'
import { db, contract, contractProject, project } from '@/lib/db'
import { and, eq, inArray } from 'drizzle-orm'
import { ensureDefaultProjectForOrg } from '@/lib/org'
import { canMutateContractData } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate, daysUntil, getExpiryBadgeClass } from '@/lib/utils'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { ContractsFilter } from './contracts-filter'
import { z } from 'zod'

interface SearchParams {
  status?: string
  search?: string
  project?: string
}

export default async function ContractsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const resolvedParams = await searchParams
  const user = await getOrCreateUser()
  if (!user) return null

  const parsedOrgId = z.string().uuid().safeParse(user.orgId)
  if (!parsedOrgId.success) return null

  await ensureDefaultProjectForOrg(parsedOrgId.data)

  const allProjects = await db.query.project.findMany({
    where: eq(project.organisationId, parsedOrgId.data),
    orderBy: (p, { asc }) => [asc(p.name)],
  })
  const allowedProjectIds = allProjects.map((p) => p.id)
  if (allowedProjectIds.length === 0) return null

  const selectedProjectIds =
    resolvedParams.project && allowedProjectIds.includes(resolvedParams.project)
      ? [resolvedParams.project]
      : allowedProjectIds

  const links = await db
    .select({
      contractId: contractProject.contractId,
      projectId: contractProject.projectId,
      projectName: project.name,
    })
    .from(contractProject)
    .innerJoin(project, eq(project.id, contractProject.projectId))
    .where(and(eq(project.organisationId, parsedOrgId.data)))

  const linkByContract = new Map<string, Array<{ projectId: string; projectName: string }>>()
  for (const link of links) {
    if (!selectedProjectIds.includes(link.projectId)) continue
    const existing = linkByContract.get(link.contractId) ?? []
    existing.push({ projectId: link.projectId, projectName: link.projectName })
    linkByContract.set(link.contractId, existing)
  }

  const contractIds = [...new Set([...linkByContract.keys()])]
  const baseContracts = contractIds.length
    ? await db.select().from(contract).where(inArray(contract.id, contractIds))
    : []
  const allContracts = baseContracts
    .filter((c) => !resolvedParams.status || c.status === resolvedParams.status)
    .filter(
      (c) =>
        !resolvedParams.search ||
        c.reference.toLowerCase().includes(resolvedParams.search.toLowerCase()) ||
        c.contractType.toLowerCase().includes(resolvedParams.search.toLowerCase())
    )
    .map((c) => ({
      ...c,
      projects: linkByContract.get(c.id) ?? [],
    }))

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

      <ContractsFilter suppliers={[]} projects={allProjects.map((p) => ({ id: p.id, name: p.name }))} currentParams={resolvedParams} />

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Referentie</th>
              <th className="px-4 py-3 font-medium">Project</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Afloopdatum</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {allContracts.map(contract => {
              const days = daysUntil(contract.endDate)
              return (
                <tr key={contract.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/contracts/${contract.id}`} className="font-medium text-blue-600 hover:underline">
                      {contract.reference}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {contract.projects.map((p) => p.projectName).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-3">{contract.contractType}</td>
                  <td className="px-4 py-3">
                    <Badge variant={contract.status === 'actief' ? 'success' : contract.status === 'verlopen' ? 'danger' : 'outline'}>
                      {contract.status}
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
