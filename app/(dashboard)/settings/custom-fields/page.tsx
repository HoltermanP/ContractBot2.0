import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { customFields } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'
import { CustomFieldForm } from './custom-field-form'
import { DeleteFieldButton } from './delete-field-button'
import { canManageOrgSettings } from '@/lib/permissions'

export default async function CustomFieldsPage() {
  const user = await getOrCreateUser()
  if (!user || !canManageOrgSettings(user.role)) redirect('/dashboard')

  const fields = await db.query.customFields.findMany({ where: eq(customFields.orgId, user.orgId) })

  const TYPE_LABELS: Record<string, string> = { text: 'Tekst', number: 'Getal', date: 'Datum', select: 'Keuzelijst' }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aangepaste metadatavelden</h1>
          <p className="text-muted-foreground">Definieer eigen velden voor contracten</p>
        </div>
        <CustomFieldForm />
      </div>

      <Card>
        <CardContent className="pt-4">
          {fields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nog geen velden aangemaakt</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr className="text-left text-muted-foreground">
                  <th className="pb-3 font-medium">Veldnaam</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Verplicht</th>
                  <th className="pb-3 font-medium">Aangemaakt</th>
                  <th className="pb-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {fields.map(f => (
                  <tr key={f.id}>
                    <td className="py-3 font-medium">{f.fieldName}</td>
                    <td className="py-3"><Badge variant="outline">{TYPE_LABELS[f.fieldType] ?? f.fieldType}</Badge></td>
                    <td className="py-3">{f.required ? 'Ja' : 'Nee'}</td>
                    <td className="py-3 text-muted-foreground">{formatDate(f.createdAt)}</td>
                    <td className="py-3"><DeleteFieldButton id={f.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
