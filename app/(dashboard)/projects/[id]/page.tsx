import Link from 'next/link'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contracts, projects } from '@/lib/db/schema'
import { and, desc, eq, or } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDate, formatCurrency, STATUS_LABELS } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { canMutateContractData } from '@/lib/permissions'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.orgId, user.orgId)),
  })
  if (!project) notFound()

  const readerArchiveFilter =
    user.role === 'reader'
      ? or(eq(contracts.status, 'actief'), eq(contracts.status, 'concept'), eq(contracts.status, 'verlopen'))
      : undefined

  const projectContracts = await db.query.contracts.findMany({
    where: readerArchiveFilter
      ? and(eq(contracts.projectId, id), eq(contracts.orgId, user.orgId), readerArchiveFilter)
      : and(eq(contracts.projectId, id), eq(contracts.orgId, user.orgId)),
    orderBy: [desc(contracts.updatedAt)],
    with: { supplier: true, owner: true },
  })

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground mb-1">
            <Link href="/projects" className="hover:text-blue-600 hover:underline">
              ← Alle projecten
            </Link>
          </p>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          {project.description && <p className="text-muted-foreground mt-1">{project.description}</p>}
        </div>
        {canMutateContractData(user.role) && (
          <Button asChild>
            <Link href={`/contracts/new?project=${project.id}`}>
              <Plus className="h-4 w-4 mr-2" />
              Contract in dit project
            </Link>
          </Button>
        )}
      </div>

      <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left text-muted-foreground">
              <th className="px-4 py-3 font-medium">Contract</th>
              <th className="px-4 py-3 font-medium">Nummer</th>
              <th className="px-4 py-3 font-medium">Leverancier</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Afloop</th>
              <th className="px-4 py-3 font-medium">Waarde (jr.)</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {projectContracts.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/contracts/${c.id}`} className="font-medium text-blue-600 hover:underline">
                    {c.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{c.contractNumber ?? '—'}</td>
                <td className="px-4 py-3">{(c as { supplier?: { name?: string } }).supplier?.name ?? '—'}</td>
                <td className="px-4 py-3">
                  <Badge variant={c.status === 'actief' ? 'success' : 'outline'}>
                    {STATUS_LABELS[c.status] ?? c.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">{formatDate(c.endDate)}</td>
                <td className="px-4 py-3">{formatCurrency(c.valueAnnual, c.currency ?? 'EUR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {projectContracts.length === 0 && (
          <p className="text-center py-12 text-muted-foreground">Nog geen contracten in dit project</p>
        )}
      </div>
    </div>
  )
}
