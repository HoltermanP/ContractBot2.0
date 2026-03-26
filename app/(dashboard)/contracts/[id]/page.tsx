import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contract, contractProject, project } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { ContractOverview } from './contract-overview'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  const row = await db.query.contract.findFirst({
    where: eq(contract.id, id),
  })
  if (!row) notFound()

  const links = await db
    .select({
      projectId: project.id,
      projectName: project.name,
      role: contractProject.role,
    })
    .from(contractProject)
    .innerJoin(project, eq(project.id, contractProject.projectId))
    .where(eq(contractProject.contractId, row.id))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{row.reference}</h1>
          <p className="text-muted-foreground">{row.contractType ?? 'Onbekend type'}</p>
        </div>
        <Button asChild>
          <Link href={`/ai/ask?contractId=${id}`}>Vraag over dit contract</Link>
        </Button>
      </div>
      <ContractOverview contract={{ ...row, projects: links }} user={user} />
    </div>
  )
}
