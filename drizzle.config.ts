import type { Config } from 'drizzle-kit'
import { existsSync } from 'fs'
import { resolve } from 'path'
import { config as loadDotenv } from 'dotenv'
import { loadEnvConfig } from '@next/env'

loadEnvConfig(process.cwd())
// Zorg dat `.env.local` (zoals bij `next dev`) ook voor CLI-commando's wint op o.a. `.env` / `.env.production`,
// anders wijst DATABASE_URL naar een andere Neon-DB → migraties ok, app ziet geen tabellen.
const envLocal = resolve(process.cwd(), '.env.local')
if (existsSync(envLocal)) {
  loadDotenv({ path: envLocal, override: true })
}

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config
