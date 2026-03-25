import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contracts, organizationMembers } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { canViewArchivedContracts } from '@/lib/permissions'
import { notFound, redirect } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContractOverview } from './contract-overview'
import { ContractDocuments } from './contract-documents'
import { ContractObligations } from './contract-obligations'
import { ContractNotifications } from './contract-notifications'
import { ContractApproval } from './contract-approval'
import { ContractAudit } from './contract-audit'
import { ContractAiAnalysis } from './contract-ai-analysis'
import { ContractCompliance } from './contract-compliance'
import { ContractAccess } from './contract-access'

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  const contract = await db.query.contracts.findFirst({
    where: and(eq(contracts.id, id), eq(contracts.orgId, user.orgId)),
    with: {
      supplier: true,
      owner: true,
      documents: { orderBy: (d, { desc }) => [desc(d.uploadedAt)] },
      obligations: { orderBy: (o, { asc }) => [asc(o.createdAt)] },
      notificationRules: true,
      approvalWorkflows: { orderBy: (w, { desc }) => [desc(w.createdAt)] },
    },
  })

  if (!contract) notFound()

  if (!canViewArchivedContracts(user.role) && contract.status === 'gearchiveerd') notFound()

  const memberRows = await db.query.organizationMembers.findMany({
    where: eq(organizationMembers.orgId, user.orgId!),
    with: { user: true },
  })
  const orgUsers = memberRows
    .filter((m) => m.user)
    .map((m) => ({
      id: m.user!.id,
      name: m.user!.name,
      email: m.user!.email,
      role: m.role,
    }))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{contract.title}</h1>
          <p className="text-muted-foreground">{contract.contractNumber ?? 'Geen nummer'} · {contract.contractType ?? 'Onbekend type'}</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid grid-cols-9 w-full">
          <TabsTrigger value="overview">Overzicht</TabsTrigger>
          <TabsTrigger value="documents">Documenten</TabsTrigger>
          <TabsTrigger value="ai">AI Analyse</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="obligations">Verplichtingen</TabsTrigger>
          <TabsTrigger value="notifications">Notificaties</TabsTrigger>
          <TabsTrigger value="approval">Goedkeuring</TabsTrigger>
          <TabsTrigger value="access">Toegang</TabsTrigger>
          <TabsTrigger value="audit">Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <ContractOverview contract={contract as any} user={user} />
        </TabsContent>
        <TabsContent value="documents">
          <ContractDocuments contract={contract as any} user={user} />
        </TabsContent>
        <TabsContent value="ai">
          <ContractAiAnalysis contract={contract as any} user={user} />
        </TabsContent>
        <TabsContent value="compliance">
          <ContractCompliance contract={contract as any} />
        </TabsContent>
        <TabsContent value="obligations">
          <ContractObligations contract={contract as any} user={user} />
        </TabsContent>
        <TabsContent value="notifications">
          <ContractNotifications contract={contract as any} user={user} />
        </TabsContent>
        <TabsContent value="approval">
          <ContractApproval contract={contract as any} user={user} />
        </TabsContent>
        <TabsContent value="access">
          <ContractAccess contract={contract as any} currentUser={user} orgUsers={orgUsers} />
        </TabsContent>
        <TabsContent value="audit">
          <ContractAudit contractId={id} orgId={user.orgId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
