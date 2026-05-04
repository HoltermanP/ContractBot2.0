/**
 * Promoveer een gebruiker tot platform-super-admin (alle organisaties, alle admin-rechten).
 *
 * Vereist: migratie 0007 (enum-waarde super_admin).
 *
 *   npm run db:set-super-admin -- jouw@email.nl
 *
 * Optioneel: zet in Clerk Dashboard → Users → public metadata: { "role": "super_admin" }
 * zodat nieuwe sessies dezelfde rol blijven houden als je later users-sync toevoegt.
 */
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

function normalizeDatabaseUrl(raw: string | undefined): string {
  if (!raw) return ''
  const t = raw.trim()
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
    return t.slice(1, -1)
  }
  return t
}

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import * as schema from '../lib/db/schema'

const DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL)
if (!DATABASE_URL) {
  console.error('DATABASE_URL ontbreekt.')
  process.exit(1)
}

const emailArg = process.argv[2]?.trim().toLowerCase()
if (!emailArg) {
  console.error('Gebruik: npm run db:set-super-admin -- jouw@email.nl')
  process.exit(1)
}

async function main() {
  const sql = neon(DATABASE_URL)
  const db = drizzle(sql, { schema })

  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, emailArg),
  })
  if (!user) {
    console.error(`Geen gebruiker met e-mail ${emailArg}. Log eerst één keer in op de app.`)
    process.exit(1)
  }

  await db.update(schema.users).set({ role: 'super_admin' }).where(eq(schema.users.id, user.id))

  await db
    .update(schema.organizationMembers)
    .set({ role: 'super_admin' })
    .where(eq(schema.organizationMembers.userId, user.id))

  console.log(`✓ Super-admin gezet voor ${user.name} (${user.email})`)
  console.log('  Tip: Clerk publicMetadata.role = "super_admin" voor consistentie.')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
