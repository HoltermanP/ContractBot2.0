import { db } from '@/lib/db'
import { organizationMembers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { canManageUsers, canAssignSuperAdmin, canInviteUsers } from '@/lib/permissions'
import { requireOrgModule } from '@/lib/org-module-access'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, ROLE_LABELS } from '@/lib/utils'
import { UserRoleEditor } from './user-role-editor'
import { InviteUserForm } from './invite-user-form'

export default async function UsersPage() {
  const user = await requireOrgModule('settingsUsers')
  if (!canInviteUsers(user.role)) redirect('/dashboard')
  if (!user.orgId) redirect('/dashboard')

  const canEditRoles = canManageUsers(user.role)
  const allowSuperAdminInUi = canAssignSuperAdmin(user.role)

  const memberRows = await db.query.organizationMembers.findMany({
    where: eq(organizationMembers.orgId, user.orgId!),
    with: { user: true },
    orderBy: (m, { asc }) => [asc(m.createdAt)],
  })
  const allUsers = memberRows
    .map((row) => (row.user ? { ...row.user, role: row.role } : null))
    .filter(Boolean) as { id: string; name: string; email: string; role: string; createdAt: Date }[]

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Gebruikersbeheer</h1>
        <p className="text-muted-foreground">{allUsers.length} gebruikers in uw organisatie</p>
      </div>

      <InviteUserForm orgId={user.orgId} canAssignSuperAdmin={allowSuperAdminInUi} />

      <Card>
        <CardContent className="pt-4">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left text-muted-foreground">
                <th className="pb-3 font-medium">Naam</th>
                <th className="pb-3 font-medium">E-mail</th>
                <th className="pb-3 font-medium">Rol</th>
                <th className="pb-3 font-medium">Aangemeld</th>
                <th className="pb-3 font-medium">Acties</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {allUsers.map(u => (
                <tr key={u.id}>
                  <td className="py-3 font-medium">{u.name}</td>
                  <td className="py-3 text-muted-foreground">{u.email}</td>
                  <td className="py-3">
                    <Badge variant="outline">{ROLE_LABELS[u.role] ?? u.role}</Badge>
                  </td>
                  <td className="py-3 text-muted-foreground">{formatDate(u.createdAt)}</td>
                  <td className="py-3">
                    {u.id !== user.id && canEditRoles && (
                      <UserRoleEditor
                        userId={u.id}
                        currentRole={u.role}
                        currentName={u.name}
                        canAssignSuperAdmin={allowSuperAdminInUi}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
