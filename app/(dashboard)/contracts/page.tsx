import { getOrCreateUser } from '@/lib/auth'
import { approvalWorkflows, contractObligations, contracts, db, projects } from '@/lib/db'
import { and, desc, eq, inArray, or } from 'drizzle-orm'
import { canMutateContractData } from '@/lib/permissions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDate, daysUntil, getExpiryBadgeClass, cn, STATUS_LABELS } from '@/lib/utils'
import Link from 'next/link'
import { CalendarDays, ChevronRight, FileText, FolderKanban, Plus } from 'lucide-react'
import { ContractsFilter } from './contracts-filter'

interface SearchParams {
  status?: string
  search?: string
  type?: string
  project?: string
  /** Komt overeen met dashboard-KPI: actief en afloop vóór nu + N dagen */
  expiring?: string
  /** obligations = contracten met minstens één open verplichting; approvals = openstaande workflow */
  focus?: string
}

export default async function ContractsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const resolvedParams = await searchParams
  const user = await getOrCreateUser()
  if (!user) return null

  const readerArchiveFilter =
    user.role === 'reader'
      ? or(
          eq(contracts.status, 'actief'),
          eq(contracts.status, 'concept'),
          eq(contracts.status, 'verlopen')
        )
      : undefined

  const allProjects = await db.query.projects.findMany({
    where: eq(projects.orgId, user.orgId),
    orderBy: (p, { asc }) => [asc(p.name)],
  })
  const allowedProjectIds = allProjects.map((p) => p.id)
  if (allowedProjectIds.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 rounded-2xl border border-zinc-200/80 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-500">
          <FolderKanban className="h-7 w-7" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Contracten</h1>
        <p className="text-sm leading-relaxed text-zinc-600">
          Geen projecten voor uw organisatie. Maak eerst een project aan voordat u contracten kunt beheren.
        </p>
      </div>
    )
  }

  const selectedProjectIds =
    resolvedParams.project && allowedProjectIds.includes(resolvedParams.project)
      ? [resolvedParams.project]
      : allowedProjectIds

  const baseRows = await db.query.contracts.findMany({
    where: and(
      eq(contracts.orgId, user.orgId),
      readerArchiveFilter,
      inArray(contracts.projectId, selectedProjectIds as [string, ...string[]])
    ),
    with: { project: true },
    orderBy: [desc(contracts.updatedAt)],
  })

  let allContracts = baseRows
    .filter((c) => !resolvedParams.status || resolvedParams.status === 'all' || c.status === resolvedParams.status)
    .filter((c) => !resolvedParams.type || resolvedParams.type === 'all' || c.contractType === resolvedParams.type)
    .filter((c) => {
      if (!resolvedParams.search?.trim()) return true
      const q = resolvedParams.search.toLowerCase()
      return (
        (c.contractNumber?.toLowerCase().includes(q) ?? false) ||
        c.title.toLowerCase().includes(q) ||
        (c.contractType?.toLowerCase().includes(q) ?? false)
      )
    })
    .map((c) => ({
      id: c.id,
      title: c.title,
      contractNumber: c.contractNumber?.trim() || null,
      reference: c.contractNumber?.trim() || c.title,
      contractType: c.contractType ?? '—',
      status: c.status,
      endDate: c.endDate,
      projects: c.project ? [{ projectId: c.project.id, projectName: c.project.name }] : [],
    }))

  const now = new Date()
  const horizon30 = new Date(now.getTime() + 30 * 86400000)
  const horizon90 = new Date(now.getTime() + 90 * 86400000)

  if (resolvedParams.expiring === '30') {
    allContracts = allContracts.filter(
      (c) => c.status === 'actief' && c.endDate != null && new Date(c.endDate) < horizon30
    )
  } else if (resolvedParams.expiring === '90') {
    allContracts = allContracts.filter(
      (c) => c.status === 'actief' && c.endDate != null && new Date(c.endDate) < horizon90
    )
  }

  if (resolvedParams.focus === 'obligations') {
    const rows = await db
      .select({ contractId: contractObligations.contractId })
      .from(contractObligations)
      .innerJoin(contracts, eq(contracts.id, contractObligations.contractId))
      .where(and(eq(contracts.orgId, user.orgId), eq(contractObligations.status, 'open')))
    const withOpen = new Set(rows.map((r) => r.contractId))
    allContracts = allContracts.filter((c) => withOpen.has(c.id))
  } else if (resolvedParams.focus === 'approvals') {
    const rows = await db
      .select({ contractId: approvalWorkflows.contractId })
      .from(approvalWorkflows)
      .innerJoin(contracts, eq(contracts.id, approvalWorkflows.contractId))
      .where(and(eq(contracts.orgId, user.orgId), eq(approvalWorkflows.status, 'pending')))
    const pending = new Set(rows.map((r) => r.contractId))
    allContracts = allContracts.filter((c) => pending.has(c.id))
  }

  const statusLabel = (s: string) => STATUS_LABELS[s] ?? s

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Contracten</h1>
          <p className="max-w-xl text-sm leading-relaxed text-zinc-600">
            Overzicht van uw dossiers met project, type, status en looptijd. Klik op een regel voor het volledige
            contract.
          </p>
          <p className="text-sm font-medium text-zinc-500">
            <span className="tabular-nums text-zinc-900">{allContracts.length}</span>{' '}
            {allContracts.length === 1 ? 'contract' : 'contracten'} in deze weergave
          </p>
        </div>
        {canMutateContractData(user.role) && (
          <Button asChild className="shrink-0 rounded-xl shadow-sm">
            <Link href="/contracts/new">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Nieuw contract
            </Link>
          </Button>
        )}
      </header>

      <section
        className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] sm:p-5"
        aria-label="Filters"
      >
        <ContractsFilter
          suppliers={[]}
          projects={allProjects.map((p) => ({ id: p.id, name: p.name }))}
          currentParams={resolvedParams}
        />
      </section>

      <section
        className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]"
        aria-labelledby="contracts-table-heading"
      >
        <div className="border-b border-zinc-100 bg-zinc-50/80 px-4 py-3 sm:px-6">
          <h2 id="contracts-table-heading" className="text-sm font-medium text-zinc-800">
            Lijst
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">Gesorteerd op laatst bijgewerkt</p>
        </div>

        {/* Mobiel: kaarten */}
        <ul className="divide-y divide-zinc-100 md:hidden" role="list">
          {allContracts.map((contract) => {
            const days = daysUntil(contract.endDate)
            const projectNames = contract.projects.map((p) => p.projectName).join(', ') || null
            return (
              <li key={contract.id}>
                <Link
                  href={`/contracts/${contract.id}`}
                  className="flex gap-3 p-4 transition-colors hover:bg-zinc-50/90 active:bg-zinc-100/80"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500">
                    <FileText className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium leading-snug text-zinc-900">{contract.title}</p>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                    </div>
                    {contract.contractNumber ? (
                      <p className="mt-0.5 text-xs tabular-nums text-zinc-500">#{contract.contractNumber}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          contract.status === 'actief'
                            ? 'success'
                            : contract.status === 'verlopen'
                              ? 'danger'
                              : 'outline'
                        }
                        className="font-medium"
                      >
                        {statusLabel(contract.status)}
                      </Badge>
                      {projectNames ? (
                        <span className="inline-flex max-w-full items-center gap-1 truncate text-xs text-zinc-600">
                          <FolderKanban className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
                          {projectNames}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">{contract.contractType}</p>
                    {contract.endDate ? (
                      <p
                        className={cn(
                          'mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                          getExpiryBadgeClass(days)
                        )}
                      >
                        <CalendarDays className="h-3.5 w-3.5 opacity-80" aria-hidden />
                        {formatDate(contract.endDate)}
                        <span className="tabular-nums">{days > 0 ? `· nog ${days} dagen` : days === 0 ? '· vandaag' : '· verlopen'}</span>
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-zinc-400">Geen einddatum</p>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Desktop: tabel */}
        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Contracten, kolommen: contract, project, type, status, afloopdatum</caption>
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50/50 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <th scope="col" className="px-6 py-3.5">
                    Contract
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Project
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-3.5">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3.5 text-right">
                    Afloop
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {allContracts.map((contract) => {
                  const days = daysUntil(contract.endDate)
                  return (
                    <tr key={contract.id} className="group transition-colors hover:bg-zinc-50/80">
                      <td className="px-6 py-4">
                        <Link
                          href={`/contracts/${contract.id}`}
                          className="flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 rounded-lg -m-1 p-1"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 transition-colors group-hover:bg-zinc-200/90">
                            <FileText className="h-5 w-5" aria-hidden />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-medium text-zinc-900 group-hover:text-blue-700">
                              {contract.title}
                            </span>
                            {contract.contractNumber ? (
                              <span className="mt-0.5 block text-xs tabular-nums text-zinc-500">
                                #{contract.contractNumber}
                              </span>
                            ) : null}
                          </span>
                          <ChevronRight
                            className="ml-1 h-4 w-4 shrink-0 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100"
                            aria-hidden
                          />
                        </Link>
                      </td>
                      <td className="max-w-[200px] px-4 py-4">
                        <span className="flex items-center gap-1.5 text-zinc-600">
                          <FolderKanban className="h-3.5 w-3.5 shrink-0 text-zinc-400" aria-hidden />
                          <span className="line-clamp-2 leading-snug">
                            {contract.projects.map((p) => p.projectName).join(', ') || '—'}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-4 text-zinc-600">{contract.contractType}</td>
                      <td className="px-4 py-4">
                        <Badge
                          variant={
                            contract.status === 'actief'
                              ? 'success'
                              : contract.status === 'verlopen'
                                ? 'danger'
                                : 'outline'
                          }
                          className="font-medium"
                        >
                          {statusLabel(contract.status)}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {contract.endDate ? (
                          <span
                            className={cn(
                              'inline-flex items-center justify-end gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums',
                              getExpiryBadgeClass(days)
                            )}
                          >
                            <CalendarDays className="h-3.5 w-3.5 opacity-80" aria-hidden />
                            {formatDate(contract.endDate)}
                            <span className="hidden lg:inline">
                              {days > 0 ? `(${days}d)` : days === 0 ? '(vandaag)' : '(verlopen)'}
                            </span>
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {allContracts.length === 0 && (
          <div className="px-4 py-16 text-center sm:py-20">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
              <FileText className="h-7 w-7" aria-hidden />
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-800">Geen contracten in deze weergave</p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-zinc-500">
              Pas de filters aan of voeg een contract toe om het hier te zien.
            </p>
            {canMutateContractData(user.role) && (
              <Button asChild className="mt-6 rounded-xl" variant="outline">
                <Link href="/contracts/new">Eerste contract aanmaken</Link>
              </Button>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
