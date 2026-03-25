import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contracts } from '@/lib/db/schema'
import { eq, and, isNotNull, lt } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, daysUntil, getExpiryBadgeClass } from '@/lib/utils'
import Link from 'next/link'
import { canManageOrgSettings } from '@/lib/permissions'

export default async function RetentionPage() {
  const user = await getOrCreateUser()
  if (!user || !canManageOrgSettings(user.role)) redirect('/dashboard')

  const contractsWithDestructionDate = await db.query.contracts.findMany({
    where: and(
      eq(contracts.orgId, user.orgId),
      isNotNull(contracts.destructionDate)
    ),
    orderBy: (c, { asc }) => [asc(c.destructionDate)],
    with: { supplier: true },
  })

  const in90Days = new Date(Date.now() + 90 * 86400000)

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bewaar- en vernietigingstermijnen</h1>
        <p className="text-muted-foreground">AVG-compliante verwerking van contractdocumenten</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Contracten met vernietigingsdatum</CardTitle>
        </CardHeader>
        <CardContent>
          {contractsWithDestructionDate.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Geen contracten met vernietigingsdatum ingesteld</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Contract</th>
                  <th className="pb-3 font-medium">Leverancier</th>
                  <th className="pb-3 font-medium">Einddatum</th>
                  <th className="pb-3 font-medium">Bewaartermijn</th>
                  <th className="pb-3 font-medium">Vernietigingsdatum</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {contractsWithDestructionDate.map(c => {
                  const destructionDays = daysUntil(c.destructionDate)
                  const urgent = c.destructionDate && new Date(c.destructionDate) <= in90Days
                  return (
                    <tr key={c.id} className={urgent ? 'bg-orange-50' : ''}>
                      <td className="py-3">
                        <Link href={`/contracts/${c.id}`} className="font-medium text-blue-600 hover:underline">
                          {c.title}
                        </Link>
                      </td>
                      <td className="py-3 text-muted-foreground">{(c as any).supplier?.name ?? '—'}</td>
                      <td className="py-3">{formatDate(c.endDate)}</td>
                      <td className="py-3">{c.retentionYears ? `${c.retentionYears} jaar` : '—'}</td>
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getExpiryBadgeClass(destructionDays)}`}>
                          {formatDate(c.destructionDate)}
                          {destructionDays !== null && ` (${destructionDays > 0 ? `${destructionDays}d` : 'Vervallen'})`}
                        </span>
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
