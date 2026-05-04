/**
 * Voegt een organisatie toe aan je account ZONDER de actieve org te wijzigen.
 * Handig om bv. Baas-demodata te zien in de org-schakelaar naast je bestaande org.
 *
 *   npm run db:add-org-member -- user_xxx baas-bv-demo manager
 *
 * Daarna: pagina vernieuwen. Met 2+ lidmaatschappen verschijnt de schakelaar rechtsboven.
 *
 * Om meteen naar die org te schakelen: npm run db:link-user (die zet ook orgId).
 */
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../lib/db/schema'
import { and, eq } from 'drizzle-orm'

function normalizeDatabaseUrl(raw: string | undefined): string {
  if (!raw) return ''
  const t = raw.trim()
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
    return t.slice(1, -1)
  }
  return t
}

const ROLES = ['super_admin', 'admin', 'manager', 'registrator', 'compliance', 'reader'] as const
type Role = (typeof ROLES)[number]

function parseRole(s: string | undefined): Role {
  if (!s) return 'manager'
  const lower = s.toLowerCase()
  if (!ROLES.includes(lower as Role)) {
    console.error(`Ongeldige rol "${s}". Kies: ${ROLES.join(', ')}`)
    process.exit(1)
  }
  return lower as Role
}

async function main() {
  const clerkUserId = process.argv[2]?.trim()
  const orgSlug = (process.argv[3]?.trim() || 'baas-bv-demo').toLowerCase()
  const role = parseRole(process.argv[4])

  if (!clerkUserId) {
    console.error('Gebruik: npm run db:add-org-member -- <clerkUserId> [orgSlug] [rol]')
    console.error('Voorbeeld: npm run db:add-org-member -- user_2abc... baas-bv-demo manager')
    process.exit(1)
  }

  const DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL)
  if (!DATABASE_URL) {
    console.error('DATABASE_URL ontbreekt in .env.local')
    process.exit(1)
  }

  const sql = neon(DATABASE_URL)
  const db = drizzle(sql, { schema })

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.slug, orgSlug),
  })
  if (!org) {
    console.error(`Geen organisatie met slug "${orgSlug}". Voer eerst npm run db:seed:baas uit.`)
    process.exit(1)
  }

  const user = await db.query.users.findFirst({
    where: eq(schema.users.clerkId, clerkUserId),
  })
  if (!user) {
    console.error(`Geen gebruiker met clerk_id "${clerkUserId}". Log één keer in op de app.`)
    process.exit(1)
  }

  const hasMember = await db.query.organizationMembers.findFirst({
    where: and(eq(schema.organizationMembers.userId, user.id), eq(schema.organizationMembers.orgId, org.id)),
  })
  if (hasMember) {
    if (hasMember.role !== role) {
      await db
        .update(schema.organizationMembers)
        .set({ role })
        .where(
          and(eq(schema.organizationMembers.userId, user.id), eq(schema.organizationMembers.orgId, org.id))
        )
      console.log(`✓ Rol bijgewerkt naar ${role} voor ${org.name}`)
    } else {
      console.log(`↩ Lidmaatschap bestond al: ${user.email} → ${org.name} (${role})`)
    }
  } else {
    await db.insert(schema.organizationMembers).values({
      userId: user.id,
      orgId: org.id,
      role,
    })
    console.log(`✓ Lidmaatschap toegevoegd: ${user.email} → ${org.name} als ${role}`)
  }

  const all = await db.query.organizationMembers.findMany({
    where: eq(schema.organizationMembers.userId, user.id),
    with: { organization: true },
  })

  console.log('')
  console.log(`Actieve org in app blijft: ${user.orgId} (niet gewijzigd).`)
  console.log(`Je bent nu lid van ${all.length} organisatie(s):`)
  for (const m of all) {
    console.log(`   - ${m.organization?.name ?? m.orgId} (${m.organization?.slug})`)
  }
  if (all.length >= 2) {
    console.log('')
    console.log('Vernieuw de app: de organisatieschakelaar rechtsboven toont meerdere opties.')
  }
  console.log('')
  console.log('Wil je meteen Baas als actieve org? Voer dan uit:')
  console.log(`  npm run db:link-user -- ${clerkUserId} ${orgSlug} ${role}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
