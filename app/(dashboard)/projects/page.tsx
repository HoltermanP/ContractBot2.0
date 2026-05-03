import Link from 'next/link'
import { getOrCreateUser } from '@/lib/auth'
import { db, projects } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { FolderKanban, Plus } from 'lucide-react'
import { ensureDefaultProjectForOrg } from '@/lib/org'
import { canManageProjects } from '@/lib/permissions'
import { NewProjectForm } from './new-project-form'
import { ProjectListRow } from '@/components/projects/project-list-row'

export default async function ProjectsPage() {
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  await ensureDefaultProjectForOrg(user.orgId)

  const list = await db.query.projects.findMany({
    where: eq(projects.orgId, user.orgId),
    orderBy: (p, { asc }) => [asc(p.name)],
  })

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Projecten</h1>
          <p className="max-w-xl text-sm leading-relaxed text-zinc-600">
            U koppelt contracten aan een project om mappen overzichtelijk te houden. Standaard bestaat het project{' '}
            <span className="font-medium text-zinc-800">&quot;Algemeen&quot;</span>.
          </p>
          <p className="text-sm font-medium text-zinc-500">
            <span className="tabular-nums text-zinc-900">{list.length}</span>{' '}
            {list.length === 1 ? 'project' : 'projecten'}
          </p>
        </div>
        {canManageProjects(user.role) && (
          <Button asChild className="shrink-0 rounded-xl shadow-sm">
            <Link href="/contracts/new">
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Nieuw contract
            </Link>
          </Button>
        )}
      </header>

      {canManageProjects(user.role) && (
        <section
          className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]"
          aria-label="Nieuw project aanmaken"
        >
          <div className="border-b border-zinc-100 bg-zinc-50/80 px-4 py-3 sm:px-6">
            <h2 className="text-sm font-medium text-zinc-800">Project aanmaken</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">
              Naam en optioneel een omschrijving; daarna opent het nieuwe project.
            </p>
          </div>
          <div className="p-4 sm:p-6">
            <NewProjectForm />
          </div>
        </section>
      )}

      <section
        className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)]"
        aria-labelledby="projects-list-heading"
      >
        <div className="border-b border-zinc-100 bg-zinc-50/80 px-4 py-3 sm:px-6">
          <h2 id="projects-list-heading" className="text-sm font-medium text-zinc-800">
            Alle projecten
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">Alfabetisch op naam · klik voor detail en contracten</p>
        </div>

        {list.length > 0 ? (
          <ul className="m-0 list-none divide-y divide-zinc-100 p-0">
            {list.map((p) => (
              <ProjectListRow
                key={p.id}
                id={p.id}
                name={p.name}
                description={p.description}
                createdAt={p.createdAt}
              />
            ))}
          </ul>
        ) : (
          <div className="px-4 py-16 text-center sm:py-20">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-400">
              <FolderKanban className="h-7 w-7" aria-hidden />
            </div>
            <p className="mt-4 text-sm font-medium text-zinc-800">Geen projecten</p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-zinc-500">
              Dit zou niet moeten voorkomen na het aanmaken van de standaardmap. Vernieuw de pagina of neem contact op
              met een beheerder.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
