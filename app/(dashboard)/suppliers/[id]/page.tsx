import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { suppliers, contracts, contractObligations } from '@/lib/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Building2, Mail, FileText, ArrowLeft, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  actief: 'bg-green-100 text-green-800',
  concept: 'bg-gray-100 text-gray-800',
  verlopen: 'bg-red-100 text-red-800',
  gearchiveerd: 'bg-yellow-100 text-yellow-800',
}

const OBLIGATION_STATUS_CONFIG = {
  open: { label: 'Open', icon: Clock, className: 'text-yellow-600' },
  in_progress: { label: 'In behandeling', icon: Clock, className: 'text-blue-600' },
  compliant: { label: 'Conform', icon: CheckCircle, className: 'text-green-600' },
  non_compliant: { label: 'Niet conform', icon: XCircle, className: 'text-red-600' },
}

export default async function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  const supplier = await db.query.suppliers.findFirst({
    where: and(eq(suppliers.id, id), eq(suppliers.orgId, user.orgId)),
    with: {
      contracts: {
        where: ne(contracts.status, 'verwijderd'),
        with: {
          obligations: true,
          owner: { columns: { name: true } },
        },
        orderBy: (c, { desc }) => [desc(c.createdAt)],
      },
    },
  })

  if (!supplier) notFound()

  const allContracts = (supplier as any).contracts ?? []
  const activeContracts = allContracts.filter((c: any) => c.status === 'actief')
  const totalValue = activeContracts.reduce((sum: number, c: any) => sum + Number(c.valueAnnual ?? 0), 0)

  // Aggregate obligations
  const allObligations = allContracts.flatMap((c: any) =>
    (c.obligations ?? []).map((o: any) => ({ ...o, contractTitle: c.title, contractId: c.id }))
  )
  const nonCompliantCount = allObligations.filter((o: any) => o.status === 'non_compliant').length
  const openCount = allObligations.filter((o: any) => o.status === 'open').length
  const compliantCount = allObligations.filter((o: any) => o.status === 'compliant').length

  const complianceScore = allObligations.length > 0
    ? Math.round((compliantCount / allObligations.length) * 100)
    : null

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/suppliers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />Leveranciers
          </Button>
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center">
            <Building2 className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{supplier.name}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
              {supplier.kvk && <span>KvK: {supplier.kvk}</span>}
              {supplier.contactEmail && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  <a href={`mailto:${supplier.contactEmail}`} className="hover:underline">{supplier.contactEmail}</a>
                </span>
              )}
              {supplier.contactName && <span>{supplier.contactName}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{allContracts.length}</div>
            <div className="text-sm text-muted-foreground">Totaal contracten</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{activeContracts.length}</div>
            <div className="text-sm text-muted-foreground">Actieve contracten</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xl font-bold">{formatCurrency(totalValue)}</div>
            <div className="text-sm text-muted-foreground">Jaarwaarde (actief)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            {complianceScore !== null ? (
              <>
                <div className={`text-2xl font-bold ${complianceScore >= 70 ? 'text-green-600' : complianceScore >= 40 ? 'text-orange-600' : 'text-red-600'}`}>
                  {complianceScore}%
                </div>
                <div className="text-sm text-muted-foreground">Compliancescore</div>
              </>
            ) : (
              <>
                <div className="text-2xl font-bold text-muted-foreground">—</div>
                <div className="text-sm text-muted-foreground">Geen verplichtingen</div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Compliance status */}
      {allObligations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Compliance status verplichtingen ({allObligations.length} totaal)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-3">
              {[
                { status: 'compliant', label: 'Conform', count: compliantCount, color: 'bg-green-50 border-green-200 text-green-700' },
                { status: 'open', label: 'Open', count: openCount, color: 'bg-yellow-50 border-yellow-200 text-yellow-700' },
                { status: 'in_progress', label: 'In behandeling', count: allObligations.filter((o: any) => o.status === 'in_progress').length, color: 'bg-blue-50 border-blue-200 text-blue-700' },
                { status: 'non_compliant', label: 'Niet conform', count: nonCompliantCount, color: 'bg-red-50 border-red-200 text-red-700' },
              ].map(item => (
                <div key={item.status} className={`rounded-lg border p-3 ${item.color}`}>
                  <div className="text-2xl font-bold">{item.count}</div>
                  <div className="text-xs font-medium">{item.label}</div>
                </div>
              ))}
            </div>

            {nonCompliantCount > 0 && (
              <div className="mt-4 space-y-2">
                <div className="text-xs font-medium text-red-700">Niet-conforme verplichtingen:</div>
                {allObligations
                  .filter((o: any) => o.status === 'non_compliant')
                  .slice(0, 5)
                  .map((o: any) => (
                    <div key={o.id} className="flex items-start gap-2 text-xs p-2 bg-red-50 rounded border border-red-200">
                      <XCircle className="h-3.5 w-3.5 text-red-600 mt-0.5 shrink-0" />
                      <div>
                        <div className="font-medium text-red-800">{o.description}</div>
                        <div className="text-red-600 mt-0.5">
                          Contract: <Link href={`/contracts/${o.contractId}`} className="underline">{o.contractTitle}</Link>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contracts table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />Contracten
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allContracts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Geen contracten</p>
          ) : (
            <div className="space-y-2">
              {allContracts.map((contract: any) => {
                const contractObligations = contract.obligations ?? []
                const ncCount = contractObligations.filter((o: any) => o.status === 'non_compliant').length
                return (
                  <Link key={contract.id} href={`/contracts/${contract.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-gray-50 transition-colors cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="text-sm font-medium">{contract.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {contract.contractNumber && `${contract.contractNumber} · `}
                            {contract.contractType ?? 'Onbekend type'}
                            {contract.owner?.name && ` · ${contract.owner.name}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {ncCount > 0 && (
                          <Badge variant="outline" className="text-xs border-red-300 text-red-700 bg-red-50">
                            {ncCount} niet-conform
                          </Badge>
                        )}
                        {contract.endDate && (
                          <div className="text-xs text-muted-foreground">{formatDate(contract.endDate)}</div>
                        )}
                        {contract.valueAnnual && (
                          <div className="text-xs font-medium">{formatCurrency(Number(contract.valueAnnual))}</div>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[contract.status] ?? 'bg-gray-100 text-gray-800'}`}>
                          {contract.status}
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
