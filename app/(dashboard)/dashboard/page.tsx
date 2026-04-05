import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contracts, contractObligations, approvalWorkflows, dashboardNotifications } from '@/lib/db/schema'
import { eq, and, lt, gte, count, sql } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatCurrency, daysUntil, getExpiryBadgeClass } from '@/lib/utils'
import { FileText, AlertTriangle, CheckCircle, Clock, TrendingUp, Bot, Lightbulb, ShieldAlert, HelpCircle } from 'lucide-react'
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
        <p className="text-muted-foreground">Welkom bij AI-Contractagent — overzicht van uw contractportfolio</p>
      </div>

      <Card className="border-blue-200 bg-gradient-to-r from-blue-600 to-indigo-600 text-white overflow-hidden">
        <CardContent className="pt-6 pb-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <Bot className="h-5 w-5 text-white" />
                </div>
                <p className="text-sm font-semibold text-blue-100">AI-Contractagent</p>
              </div>
              <h2 className="text-xl font-bold text-white">
                Stel een vraag over uw contracten
              </h2>
              <p className="text-sm text-blue-100">
                De Contractagent beantwoordt vragen op basis van uw contractdocumenten — met bronvermelding en vervolgvragen.
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Link
                href="/ai/ask"
                className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 shadow"
              >
                <Bot className="h-4 w-4" />
                Open Contractagent
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/ai/faq" className="group block">
          <Card className="h-full border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all">
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <div className="rounded-lg p-2 bg-purple-50 shrink-0">
                  <HelpCircle className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-slate-900 group-hover:text-blue-700">Veelgestelde vragen</div>
                  <div className="text-xs text-muted-foreground mt-1">Top 10 meestgestelde vragen over uw contracten</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/ai/insights" className="group block">
          <Card className="h-full border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all">
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <div className="rounded-lg p-2 bg-amber-50 shrink-0">
                  <Lightbulb className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-slate-900 group-hover:text-blue-700">Praktijkpunten</div>
                  <div className="text-xs text-muted-foreground mt-1">Belangrijkste contractpunten per project met uitgewerkte voorbeelden</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/ai/issues" className="group block">
          <Card className="h-full border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all">
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <div className="rounded-lg p-2 bg-red-50 shrink-0">
                  <ShieldAlert className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-slate-900 group-hover:text-blue-700">Contractkwaliteit</div>
                  <div className="text-xs text-muted-foreground mt-1">Onduidelijkheden, tegenstrijdigheden en vaagheden per contract</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {kpis.map(({ title, value, icon: Icon, color, bg }) => (
          <Card key={title}>
            <CardContent className="pt-5">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className={`rounded-lg p-2 shrink-0 ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold tabular-nums sm:text-3xl">{value}</div>
                  </div>
                </div>
                <div className="text-sm leading-snug text-muted-foreground">{title}</div>
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
