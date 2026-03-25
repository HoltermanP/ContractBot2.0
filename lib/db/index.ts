import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

function getDb() {
  const url = process.env.DATABASE_URL
  if (!url) {
    // Return a proxy that throws on use (during build static analysis)
    throw new Error('DATABASE_URL not set')
  }
  const sql = neon(url)
  return drizzle(sql, { schema })
}

// Lazy singleton
let _db: ReturnType<typeof getDb> | null = null

export const db = new Proxy({} as ReturnType<typeof getDb>, {
  get(_target, prop) {
    if (!_db) {
      _db = getDb()
    }
    return (_db as any)[prop]
  },
})

export * from './schema'
