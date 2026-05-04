/**
 * Koppel een bestaande users-rij (na eerste login) aan een organisatie op slug.
 * Handig als je je Clerk User ID niet weet, wel je e-mail.
 *
 *   npx tsx scripts/link-user-by-email.ts jouw@email.nl baas-bv-demo manager
 *
 * Productie: zet DATABASE_URL naar dezelfde Neon als Vercel, gebruik het e-mailadres
 * waarmee je in productie inlogt (na één keer inloggen bestaat de users-rij).
 */
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { existsSync } from 'fs'
import { resolve } from 'path'
import { config as loadDotenv } from 'dotenv'
const envLocal = resolve(process.cwd(), '.env.local')
if (existsSync(envLocal)) loadDotenv({ path: envLocal, override: true })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { and, eq } from 'drizzle-orm'
import * as schema from '../lib/db/schema'
import type { UserRole } from '../lib/auth'

const ROLES = ['super_admin', 'admin', 'manager', 'registrator', 'compliance', 'reader'] as const

function parseRole(s: string | undefined): UserRole {
  if (!s) return 'manager'
  const lower = s.toLowerCase()
  if (!ROLES.includes(lower as UserRole)) {
    console.error(`Ongeldige rol. Kies: ${ROLES.join(', ')}`)
    process.exit(1)
  }
  return lower as UserRole
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase()
  const orgSlug = (process.argv[3]?.trim() || 'baas-bv-demo').toLowerCase()
  const role = parseRole(process.argv[4])

  if (!email) {
    console.error('Gebruik: npx tsx scripts/link-user-by-email.ts <email> [orgSlug] [rol]')
    process.exit(1)
  }

  const raw = process.env.DATABASE_URL?.trim()
  if (!raw) {
    console.error('DATABASE_URL ontbreekt')
    process.exit(1)
  }
  const db = drizzle(neon(raw.replace(/^['"]|['"]$/g, '')), { schema })

  const org = await db.query.organizations.findFirst({
    where: eq(schema.organizations.slug, orgSlug),
  })
  if (!org) {
    console.error(`Geen organisatie met slug "${orgSlug}"`)
    process.exit(1)
  }

  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  })
  if (!user) {
    console.error(`Geen gebruiker met e-mail ${email}. Log eerst één keer in op de app die deze DATABASE_URL gebruikt.`)
    process.exit(1)
  }

  const prev = user.orgId
  await db.update(schema.users).set({ orgId: org.id, role }).where(eq(schema.users.id, user.id))

  const has = await db.query.organizationMembers.findFirst({
    where: and(eq(schema.organizationMembers.userId, user.id), eq(schema.organizationMembers.orgId, org.id)),
  })
  if (!has) {
    await db.insert(schema.organizationMembers).values({ userId: user.id, orgId: org.id, role })
  } else if (has.role !== role) {
    await db
      .update(schema.organizationMembers)
      .set({ role })
      .where(eq(schema.organizationMembers.id, has.id))
  }

  console.log('')
  console.log('✅ Gebruiker gekoppeld')
  console.log(`   ${user.name} <${user.email}>`)
  console.log(`   clerk_id: ${user.clerkId}`)
  console.log(`   Actieve org: ${org.name} (${org.slug})`)
  console.log(`   Rol: ${role}`)
  if (prev && prev !== org.id) console.log(`   (vorige org_id: ${prev})`)
  console.log('')
  console.log('Tip: lokaal vs productie-Clerk hebben verschillende clerk_id. Gebruik de DATABASE_URL van de omgeving waar je het probleem ziet.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
