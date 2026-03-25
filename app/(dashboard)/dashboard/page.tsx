import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contracts, contractObligations, approvalWorkflows, dashboardNotifications } from '@/lib/db/schema'
import { eq, and, lt, gte, count, sql } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatCurrency, daysUntil, getExpiryBadgeClass } from '@/lib/utils'
import { FileText, AlertTriangle, CheckCircle, Clock, TrendingUp, MessageCircleQuestion } from 'lucide-react'
import Link from 'next/link'
import { DashboardChart } from './dashboard-chart'

export default async function DashboardPage() {
  const user = await getOrCreateUser()
  if (!user) return null

  const now = new Date()
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const in90Days = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

  const [
    activeContracts,
    expiringIn30,
    expiringIn90,
    openObligations,
    pendingApprovals,
    recentContracts,
    notifications,
  ] = await Promise.all([
    db.select({ count: count() }).from(contracts)
      .where(and(eq(contracts.orgId, user.orgId), eq(contracts.status, 'actief'))),
    db.select({ count: count() }).from(contracts)
      .where(and(eq(contracts.orgId, user.orgId), eq(contracts.status, 'actief'), lt(contracts.endDate, in30Days))),
    db.select({ count: count() }).from(contracts)
      .where(and(eq(contracts.orgId, user.orgId), eq(contracts.status, 'actief'), lt(contracts.endDate, in90Days))),
    db.select({ count: count() }).from(contractObligations)
      .where(eq(contractObligations.status, 'open')),
    db.select({ count: count() }).from(approvalWorkflows)
      .where(eq(approvalWorkflows.status, 'pending')),
    db.query.contracts.findMany({
      where: eq(contracts.orgId, user.orgId),
      orderBy: (c, { desc }) => [desc(c.updatedAt)],
      limit: 10,
      with: { supplier: true },
    }),
    db.query.dashboardNotifications.findMany({
      where: and(
        eq(dashboardNotifications.orgId, user.orgId),
        eq(dashboardNotifications.read, false)
      ),
      orderBy: (n, { desc }) => [desc(n.createdAt)],
      limit: 5,
    }),
  ])

  const kpis = [
    {
      title: 'Actieve contracten',
      value: activeContracts[0]?.count ?? 0,
      icon: FileText,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      title: 'Verloopt binnen 30 dagen',
      value: expiringIn30[0]?.count ?? 0,
      icon: AlertTriangle,
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      title: 'Verloopt binnen 90 dagen',
      value: expiringIn90[0]?.count ?? 0,
      icon: Clock,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
    },
    {
      title: 'Open verplichtingen',
      value: openObligations[0]?.count ?? 0,
      icon: CheckCircle,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      title: 'Openstaande goedkeuringen',
      value: pendingApprovals[0]?.count ?? 0,
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-muted-foreground">Welkom bij AI-Contractbot — overzicht van uw contractportfolio</p>
      </div>

      <Card className="border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="inline-flex items-center gap-2 text-sm font-medium text-blue-700">
                <MessageCircleQuestion className="h-4 w-4" />
                Snel starten met Contractvragen
              </p>
              <h2 className="text-lg font-semibold text-slate-900">
                Stel direct een vraag over een contract of over uw hele portfolio
              </h2>
              <p className="text-sm text-muted-foreground">
                Kies in de chat eerst het contract en krijg daarna een onderbouwd antwoord met bronnen.
              </p>
            </div>
            <Link
              href="/ai/ask"
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Open Contractvragen
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map(({ title, value, icon: Icon, color, bg }) => (
          <Card key={title}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold">{value}</div>
                  <div className="text-xs text-muted-foreground">{title}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Chart */}
        <div className="col-span-2">
          <DashboardChart contracts={recentContracts} />
        </div>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meldingen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">Geen nieuwe meldingen</p>
            ) : (
              notifications.map(n => (
                <div key={n.id} className="flex items-start gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.type === 'warning' ? 'bg-orange-500' : n.type === 'error' ? 'bg-red-500' : 'bg-blue-500'}`} />
                  <div>
                    <div className="font-medium">{n.title}</div>
                    <div className="text-muted-foreground text-xs">{n.message}</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Contracts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent gewijzigde contracten</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Naam</th>
                  <th className="pb-3 font-medium">Leverancier</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Afloopdatum</th>
                  <th className="pb-3 font-medium">Waarde</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentContracts.map(contract => {
                  const days = daysUntil(contract.endDate)
                  return (
                    <tr key={contract.id} className="hover:bg-gray-50">
                      <td className="py-3">
                        <Link href={`/contracts/${contract.id}`} className="font-medium text-blue-600 hover:underline">
                          {contract.title}
                        </Link>
                      </td>
                      <td className="py-3 text-muted-foreground">{(contract as any).supplier?.name ?? '—'}</td>
                      <td className="py-3">
                        <Badge variant="outline">{contract.status}</Badge>
                      </td>
                      <td className="py-3">
                        {contract.endDate ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getExpiryBadgeClass(days)}`}>
                            {formatDate(contract.endDate)}
                            {days !== null && ` (${days > 0 ? `${days}d` : 'Verlopen'})`}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="py-3">{formatCurrency(contract.valueAnnual, contract.currency ?? 'EUR')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {recentContracts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nog geen contracten aangemaakt</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
