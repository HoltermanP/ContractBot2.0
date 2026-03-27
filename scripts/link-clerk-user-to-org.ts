/**
 * Koppel je echte Clerk-gebruiker aan de seed-organisatie (zonder db:seed / zonder data te wissen).
 *
 * 1. Log één keer in op de app (dan bestaat er een `users`-rij met jouw Clerk user id).
 * 2. Vind je Clerk User ID: Clerk Dashboard → Users → [jij] → "User ID" (begint meestal met user_…).
 *
 * Gebruik:
 *   npm run db:link-user -- user_2abc...
 *   npm run db:link-user -- user_2abc... universiteit-leiden admin
 *
 * Argumenten: <clerkUserId> [orgSlug] [rol]
 * - orgSlug: default `universiteit-leiden` (zoals in scripts/seed.ts)
 * - rol: admin | manager | registrator | compliance | reader — default `admin`
 */
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../lib/db/schema'
import { and, eq } from 'drizzle-orm'

const ROLES = ['admin', 'manager', 'registrator', 'compliance', 'reader'] as const
type Role = (typeof ROLES)[number]

function parseRole(s: string | undefined): Role {
  if (!s) return 'admin'
  const lower = s.toLowerCase()
  if (!ROLES.includes(lower as Role)) {
    console.error(`Ongeldige rol "${s}". Kies: ${ROLES.join(', ')}`)
    process.exit(1)
  }
  return lower as Role
}

async function main() {
  const clerkUserId = process.argv[2]?.trim()
  const orgSlug = (process.argv[3]?.trim() || 'universiteit-leiden').toLowerCase()
  const role = parseRole(process.argv[4])

  if (!clerkUserId) {
    console.error(`Gebruik: npx tsx scripts/link-clerk-user-to-org.ts <clerkUserId> [orgSlug] [rol]`)
    console.error(`Voorbeeld: npm run db:link-user -- user_2aBcDeFgHiJkLmNoPqRsTuVw`)
    process.exit(1)
  }

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL ontbreekt in .env.local')
    process.exit(1)
  }

  const sql = neon(process.env.DATABASE_URL)
  const db = drizzle(sql, { schema })

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.slug, orgSlug),
  })
  if (!org) {
    console.error(`Geen organisatie met slug "${orgSlug}". Voer eerst npm run db:seed uit of pas de slug aan.`)
    process.exit(1)
  }

  const user = await db.query.users.findFirst({
    where: eq(schema.users.clerkId, clerkUserId),
  })
  if (!user) {
    console.error(`Geen gebruiker met clerk_id "${clerkUserId}".`)
    console.error('Log één keer in op de app (lokaal of preview), daarna bestaat deze rij. Of controleer het User ID in Clerk.')
    process.exit(1)
  }

  const previousOrgId = user.orgId

  await db
    .update(schema.users)
    .set({ orgId: org.id, role })
    .where(eq(schema.users.id, user.id))

  const hasMember = await db.query.organizationMembers.findFirst({
    where: and(eq(schema.organizationMembers.userId, user.id), eq(schema.organizationMembers.orgId, org.id)),
  })
  if (!hasMember) {
    await db.insert(schema.organizationMembers).values({
      userId: user.id,
      orgId: org.id,
      role,
    })
  } else if (hasMember.role !== role) {
    await db
      .update(schema.organizationMembers)
      .set({ role })
      .where(
        and(eq(schema.organizationMembers.userId, user.id), eq(schema.organizationMembers.orgId, org.id))
      )
  }

  console.log('')
  console.log('✅ Clerk-gebruiker gekoppeld aan seed-organisatie')
  console.log(`   Gebruiker:  ${user.name} <${user.email}>`)
  console.log(`   clerk_id:   ${clerkUserId}`)
  console.log(`   Organisatie: ${org.name} (${org.id})`)
  console.log(`   slug:       ${org.slug}`)
  console.log(`   Rol:        ${role}`)
  if (previousOrgId && previousOrgId !== org.id) {
    console.log(`   (vorige org_id: ${previousOrgId})`)
  }
  console.log('')
  console.log('Herstart de dev-server en log opnieuw in als de app nog de oude sessie cached.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
