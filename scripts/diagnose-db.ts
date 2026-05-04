/**
 * Snel overzicht: organisaties, gebruikers, Baas — zelfde DB als DATABASE_URL.
 *   npx tsx scripts/diagnose-db.ts
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
import { eq, sql } from 'drizzle-orm'
import * as schema from '../lib/db/schema'

function redact(url: string): string {
  try {
    const u = new URL(url.replace(/^['"]|['"]$/g, ''))
    return `${u.hostname}${u.pathname}`
  } catch {
    return '(ongeldig)'
  }
}

async function main() {
  const raw = process.env.DATABASE_URL?.trim()
  if (!raw) {
    console.error('DATABASE_URL ontbreekt')
    process.exit(1)
  }
  const url = raw.replace(/^['"]|['"]$/g, '')
  console.log('DATABASE_URL host/pad:', redact(url), '\n')

  const db = drizzle(neon(url), { schema })

  const orgs = await db.select({ slug: schema.organizations.slug, name: schema.organizations.name }).from(schema.organizations)
  console.log(`Organisaties (${orgs.length}):`)
  for (const o of orgs.slice(0, 25)) {
    console.log(`  - ${o.slug}  |  ${o.name}`)
  }
  if (orgs.length > 25) console.log(`  ... +${orgs.length - 25} meer`)

  const [{ nUsers }] = await db.select({ nUsers: sql<number>`count(*)::int` }).from(schema.users)
  const [{ nContracts }] = await db.select({ nContracts: sql<number>`count(*)::int` }).from(schema.contracts)
  console.log(`\nGebruikers: ${nUsers}  |  Contracten (totaal): ${nContracts}`)

  const baasOrg = await db.query.organizations.findFirst({
    where: eq(schema.organizations.slug, 'baas-bv-demo'),
  })
  if (baasOrg) {
    const [{ c }] = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.contracts)
      .where(eq(schema.contracts.orgId, baasOrg.id))
    console.log(`\nBaas B.V. (baas-bv-demo): ${c} contracten in deze org`)
  } else {
    console.log('\nGeen org met slug baas-bv-demo — draai: npm run db:seed:baas')
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
