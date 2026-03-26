import { getOrCreateUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateOrgForm } from './create-org-form'
import { InviteMemberForm } from './invite-member-form'
import { canManageOrgSettings, canManageUsers } from '@/lib/permissions'
import { ModulesVisibilityForm } from './modules-visibility-form'

export default async function OrganizationsSettingsPage() {
  const user = await getOrCreateUser()
  if (!user) redirect('/sign-in')

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Organisaties</h1>
        <p className="text-muted-foreground">
          Maak een extra organisatie aan of nodig collega&apos;s uit. U kunt tussen organisaties wisselen via de schakelaar
          rechtsboven (als u lid bent van meer dan één).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nieuwe organisatie</CardTitle>
          <CardDescription>
            U wordt beheerder van de nieuwe organisatie en schakelt automatisch naar deze omgeving. U blijft ook lid van
            uw vorige organisatie.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateOrgForm />
        </CardContent>
      </Card>

      {canManageUsers(user.role) && (
        <Card>
          <CardHeader>
            <CardTitle>Gebruiker aan huidige organisatie koppelen</CardTitle>
            <CardDescription>
              Voeg iemand toe op basis van het e-mailadres uit het gebruikersprofiel. De persoon moet minstens één keer
              zijn ingelogd geweest.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InviteMemberForm orgId={user.orgId} />
          </CardContent>
        </Card>
      )}

      {canManageOrgSettings(user.role) && (
        <Card>
          <CardHeader>
            <CardTitle>Modulebeschikbaarheid</CardTitle>
            <CardDescription>
              Beheer welke modules en pagina&apos;s beschikbaar zijn binnen de actieve organisatie.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ModulesVisibilityForm />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
