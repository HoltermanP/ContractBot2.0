import { requireOrgModule } from '@/lib/org-module-access'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CreateOrgForm } from './create-org-form'
import { InviteMemberForm } from './invite-member-form'
import { canManageOrgSettings, canManageUsers } from '@/lib/permissions'
import { ModulesVisibilityForm } from './modules-visibility-form'

export default async function OrganizationsSettingsPage() {
  const user = await requireOrgModule('settingsOrganizations')

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Organisaties</h1>
        <p className="text-muted-foreground">
          Maak een extra organisatie aan of nodig collega&apos;s uit. U kunt tussen organisaties wisselen via de schakelaar
          rechtsboven (als u lid bent van meer dan één).
        </p>
      </div>

      {process.env.NODE_ENV === 'development' && (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardTitle className="text-base">Baas-demodata wel in Neon, niet in de org-schakelaar?</CardTitle>
            <CardDescription className="text-slate-700">
              De schakelaar toont alleen organisaties waar jouw account <strong>lid</strong> van is. Voeg lidmaatschap toe
              (je huidige actieve organisatie blijft hetzelfde), ververs daarna deze pagina:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-800">
            <code className="block rounded-md bg-white px-3 py-2 text-xs border border-amber-100">
              npm run db:add-org-member -- user_JOUW_CLERK_ID baas-bv-demo manager
            </code>
            <p className="text-muted-foreground text-xs">
              Om meteen naar Baas te schakelen: npm run db:link-user met dezelfde argumenten (past ook je actieve org aan).
            </p>
          </CardContent>
        </Card>
      )}

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
              Stel in welke modules en instellingen-pagina&apos;s organisatiebreed aan staan, en per gebruikersrol
              zichtbaar zijn.
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
