import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contracts } from '@/lib/db/schema'
import { eq, and, ne } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { ContractCompareClient } from './compare-client'

export default async function ContractComparePage() {
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  const allContracts = await db.query.contracts.findMany({
    where: and(
      eq(contracts.orgId, user.orgId),
      ne(contracts.status, 'verwijderd')
    ),
    columns: { id: true, title: true, contractNumber: true, contractType: true },
    orderBy: (c, { asc }) => [asc(c.title)],
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Contractvergelijking</h1>
        <p className="text-muted-foreground">Vergelijk twee contracten inhoudelijk met behulp van AI</p>
      </div>
      <ContractCompareClient contracts={allContracts} />
    </div>
  )
}
