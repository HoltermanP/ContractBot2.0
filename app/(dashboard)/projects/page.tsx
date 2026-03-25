import Link from 'next/link'
import { getOrCreateUser } from '@/lib/auth'
import { db, projects } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { ensureDefaultProjectForOrg } from '@/lib/org'
import { canManageProjects } from '@/lib/permissions'
import { NewProjectForm } from './new-project-form'

export default async function ProjectsPage() {
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  await ensureDefaultProjectForOrg(user.orgId)

  const list = await db.query.projects.findMany({
    where: eq(projects.orgId, user.orgId),
    orderBy: (p, { asc }) => [asc(p.name)],
  })

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projecten</h1>
          <p className="text-muted-foreground">
            Contracten worden onder een project gehangen. Standaard bestaat het project &quot;Algemeen&quot;.
          </p>
        </div>
        {canManageProjects(user.role) && (
          <Button asChild>
            <Link href="/contracts/new">
              <Plus className="h-4 w-4 mr-2" />
              Nieuw contract
            </Link>
          </Button>
        )}
      </div>

      {canManageProjects(user.role) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project aanmaken</CardTitle>
          </CardHeader>
          <CardContent>
            <NewProjectForm />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 divide-y">
          {list.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="flex items-center justify-between py-4 first:pt-0 hover:bg-slate-50/80 -mx-2 px-2 rounded-lg transition-colors"
            >
              <div>
                <p className="font-medium text-slate-900">{p.name}</p>
                {p.description && <p className="text-sm text-muted-foreground mt-0.5">{p.description}</p>}
              </div>
              <span className="text-xs text-muted-foreground shrink-0 ml-4">{formatDate(p.createdAt)}</span>
            </Link>
          ))}
          {list.length === 0 && <p className="text-muted-foreground py-8 text-center">Geen projecten</p>}
        </CardContent>
      </Card>
    </div>
  )
}
