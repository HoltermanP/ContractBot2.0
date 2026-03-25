import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notificationRules, contracts } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { canManageOrgSettings } from '@/lib/permissions'

const TRIGGER_LABELS: Record<string, string> = {
  days_before_end: 'Dagen voor einddatum',
  days_before_option: 'Dagen voor optiedatum',
  obligation_due: 'Verplichting vervalt',
  budget_threshold: 'Budget drempel',
}

export default async function NotificationsSettingsPage() {
  const user = await getOrCreateUser()
  if (!user || !canManageOrgSettings(user.role)) redirect('/dashboard')

  const rules = await db.query.notificationRules.findMany({
    with: { contractId: true } as any,
  })

  const contractsList = await db.query.contracts.findMany({
    where: eq(contracts.orgId, user.orgId),
  })

  const orgRules = rules.filter(r => {
    const contract = contractsList.find(c => c.id === r.contractId)
    return contract !== undefined
  })

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Notificatie-instellingen</h1>
        <p className="text-muted-foreground">Overzicht van alle actieve notificatieregels</p>
      </div>

      <Card>
        <CardContent className="pt-4">
          {orgRules.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Geen notificatieregels geconfigureerd</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Contract</th>
                  <th className="pb-3 font-medium">Trigger</th>
                  <th className="pb-3 font-medium">Waarde</th>
                  <th className="pb-3 font-medium">Kanaal</th>
                  <th className="pb-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {orgRules.map(rule => {
                  const contract = contractsList.find(c => c.id === rule.contractId)
                  return (
                    <tr key={rule.id}>
                      <td className="py-3">
                        <Link href={`/contracts/${rule.contractId}`} className="text-blue-600 hover:underline">
                          {contract?.title ?? '—'}
                        </Link>
                      </td>
                      <td className="py-3">{TRIGGER_LABELS[rule.triggerType] ?? rule.triggerType}</td>
                      <td className="py-3">{rule.triggerValue ? `${rule.triggerValue} dagen` : '—'}</td>
                      <td className="py-3 capitalize">{rule.channel}</td>
                      <td className="py-3">
                        <Badge variant={rule.active ? 'success' : 'outline'}>{rule.active ? 'Actief' : 'Inactief'}</Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
