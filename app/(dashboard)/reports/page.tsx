import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contracts, suppliers } from '@/lib/db/schema'
import { eq, and, lt, sum, count } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { ExportButton } from './export-button'
import { AiPortfolioSummary } from './ai-summary'
import { BarChart3, TrendingUp, FileText, Building2 } from 'lucide-react'

export default async function ReportsPage() {
  const user = await getOrCreateUser()
  if (!user) return null

  const now = new Date()
  const in30 = new Date(now.getTime() + 30 * 86400000)
  const in90 = new Date(now.getTime() + 90 * 86400000)

  const [allContracts, allSuppliers] = await Promise.all([
    db.query.contracts.findMany({
      where: eq(contracts.orgId, user.orgId),
      with: { supplier: true },
    }),
    db.query.suppliers.findMany({
      where: eq(suppliers.orgId, user.orgId),
      with: { contracts: true },
    }),
  ])

  const byStatus = allContracts.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const totalValue = allContracts.reduce((sum, c) => sum + Number(c.valueAnnual ?? 0), 0)
  const expiringIn30 = allContracts.filter(c => c.endDate && new Date(c.endDate) <= in30 && c.status === 'actief').length
  const expiringIn90 = allContracts.filter(c => c.endDate && new Date(c.endDate) <= in90 && c.status === 'actief').length

  const byType = allContracts.reduce((acc, c) => {
    const t = c.contractType ?? 'Onbekend'
    acc[t] = (acc[t] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rapportages</h1>
          <p className="text-muted-foreground">Overzicht en exports van uw contractportfolio</p>
        </div>
        <div className="flex gap-2">
          <ExportButton format="csv" />
          <ExportButton format="excel" />
        </div>
      </div>

      <AiPortfolioSummary />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold">{allContracts.length}</div>
            <div className="text-sm text-muted-foreground">Totaal contracten</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-green-600">{byStatus['actief'] ?? 0}</div>
            <div className="text-sm text-muted-foreground">Actieve contracten</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-orange-600">{expiringIn90}</div>
            <div className="text-sm text-muted-foreground">Verloopt &lt; 90 dagen</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            <div className="text-sm text-muted-foreground">Totale jaarwaarde</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Status verdeling</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(byStatus).map(([status, cnt]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm capitalize">{status}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(cnt / allContracts.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-6 text-right">{cnt}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Type verdeling</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(byType).slice(0, 8).map(([type, cnt]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-sm truncate max-w-[160px]">{type}</span>
                  <span className="text-sm font-medium">{cnt}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Top leveranciers op contractwaarde</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {allSuppliers
              .map(s => ({
                name: s.name,
                totalValue: ((s as any).contracts ?? []).reduce((sum: number, c: any) => sum + Number(c.valueAnnual ?? 0), 0),
                contractCount: ((s as any).contracts ?? []).length,
              }))
              .sort((a, b) => b.totalValue - a.totalValue)
              .slice(0, 10)
              .map(s => (
                <div key={s.name} className="flex items-center justify-between py-1 border-b last:border-0">
                  <span className="text-sm">{s.name}</span>
                  <div className="text-right">
                    <div className="text-sm font-medium">{formatCurrency(s.totalValue)}</div>
                    <div className="text-xs text-muted-foreground">{s.contractCount} contracten</div>
                  </div>
                </div>
              ))
            }
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
