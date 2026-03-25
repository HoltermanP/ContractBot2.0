import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { suppliers, contracts } from '@/lib/db/schema'
import { eq, count } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import { Building2, Mail, FileText, Plus, ChevronRight } from 'lucide-react'
import { SupplierForm } from './supplier-form'
import { canManageSupplierWrite } from '@/lib/permissions'

export default async function SuppliersPage() {
  const user = await getOrCreateUser()
  if (!user) return null

  const allSuppliers = await db.query.suppliers.findMany({
    where: eq(suppliers.orgId, user.orgId),
    with: { contracts: true },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leveranciers</h1>
          <p className="text-muted-foreground">{allSuppliers.length} leveranciers</p>
        </div>
        {canManageSupplierWrite(user.role) && <SupplierForm />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {allSuppliers.map(supplier => {
          const activeContracts = (supplier as any).contracts?.filter((c: any) => c.status === 'actief') ?? []
          const totalValue = (supplier as any).contracts?.reduce((sum: number, c: any) => sum + Number(c.valueAnnual ?? 0), 0) ?? 0

          return (
            <Link key={supplier.id} href={`/suppliers/${supplier.id}`}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{supplier.name}</CardTitle>
                      {supplier.kvk && <div className="text-xs text-muted-foreground">KvK: {supplier.kvk}</div>}
                    </div>
                  </div>
                  <Badge variant="outline">{activeContracts.length} actief</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {supplier.contactName && (
                  <div className="text-muted-foreground">{supplier.contactName}</div>
                )}
                {supplier.contactEmail && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <a href={`mailto:${supplier.contactEmail}`} className="hover:underline">{supplier.contactEmail}</a>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <FileText className="h-3.5 w-3.5" />
                    {(supplier as any).contracts?.length ?? 0} contracten
                  </div>
                  <div className="font-medium">{formatCurrency(totalValue, 'EUR')}</div>
                </div>
              </CardContent>
            </Card>
            </Link>
          )
        })}
      </div>

      {allSuppliers.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Building2 className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p>Nog geen leveranciers aangemaakt</p>
        </div>
      )}
    </div>
  )
}
