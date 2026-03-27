import { getOrCreateUser } from '@/lib/auth'
import { db, contracts } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { ContractOverview } from './contract-overview'
import { ContractDocuments } from './contract-documents'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  const row = await db.query.contracts.findFirst({
    where: and(eq(contracts.id, id), eq(contracts.orgId, user.orgId)),
    with: {
      project: true,
      documents: {
        orderBy: (d, { desc: ddesc }) => [ddesc(d.uploadedAt)],
      },
    },
  })
  if (!row) notFound()

  const links = row.project
    ? [{ projectId: row.project.id, projectName: row.project.name, role: 'lead' as const }]
    : []

  const contractForClient = {
    ...row,
    reference: row.contractNumber?.trim() || row.title,
    projects: links,
    documents: row.documents ?? [],
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{row.contractNumber?.trim() || row.title}</h1>
          <p className="text-muted-foreground">{row.contractType ?? 'Onbekend type'}</p>
        </div>
        <Button asChild>
          <Link href={`/ai/ask?contractId=${id}`}>Vraag over dit contract</Link>
        </Button>
      </div>
      <ContractOverview contract={contractForClient} user={user} />
      <ContractDocuments contract={contractForClient} user={user} />
    </div>
  )
}
