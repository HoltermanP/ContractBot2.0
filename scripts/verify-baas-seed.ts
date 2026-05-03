/**
 * Controleer of Baas-demodata op de database van DATABASE_URL staat.
 * Toont alleen host/pad (geen wachtwoord). Gebruik: npm run db:verify:baas
 */
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { neon } from '@neondatabase/serverless'

function redactedDbLabel(url: string): string {
  try {
    const u = new URL(url.replace(/^['"]|['"]$/g, ''))
    const user = u.username ? `${u.username}:***` : ''
    return `${u.protocol}//${user}@${u.hostname}${u.pathname}`
  } catch {
    return '(ongeldige DATABASE_URL)'
  }
}

async function main() {
  const raw = process.env.DATABASE_URL?.trim()
  if (!raw) {
    console.error('DATABASE_URL ontbreekt (.env.local)')
    process.exit(1)
  }
  const url = raw.replace(/^['"]|['"]$/g, '')
  console.log('DATABASE_URL →', redactedDbLabel(url))
  console.log('')

  const sql = neon(url)
  const org = await sql`
    SELECT id, slug, name FROM organizations WHERE slug = 'baas-bv-demo' LIMIT 1
  `
  if (!org.length) {
    console.log('❌ Geen organisatie met slug baas-bv-demo.')
    console.log('   Voer uit: npm run db:seed:baas')
    console.log('')
    console.log('   Tip: in Neon SQL Editor moet je dezelfde branch/database gebruiken')
    console.log('   als in deze connection string (andere branch = lege tabellen).')
    process.exit(1)
  }

  const [{ n: contractCount }] = await sql`
    SELECT count(*)::int AS n FROM contracts WHERE org_id = ${org[0].id}
  `
  const [{ n: projectCount }] = await sql`
    SELECT count(*)::int AS n FROM projects WHERE org_id = ${org[0].id}
  `
  const [{ n: supplierCount }] = await sql`
    SELECT count(*)::int AS n FROM suppliers WHERE org_id = ${org[0].id}
  `

  console.log('✓ Baas B.V. demodata gevonden:')
  console.log(`   Organisatie: ${org[0].name} (${org[0].id})`)
  console.log(`   Contracten:  ${contractCount}`)
  console.log(`   Projecten:   ${projectCount}`)
  console.log(`   Leveranciers:${supplierCount}`)
  console.log('')
  console.log('Zie je dit niet in de Neon Console? Kies links de branch die bij dit endpoint hoort.')
  process.exit(0)
}

main().catch((e) => {
  console.error('Fout:', e instanceof Error ? e.message : e)
  process.exit(1)
})
