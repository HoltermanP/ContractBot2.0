/**
 * Controleert of BLOB_READ_WRITE_TOKEN naar de juiste Vercel Blob-store wijst.
 * Gebruik: npm run blob:smoke
 *
 * In het Vercel-dashboard: open precies de store waar je bestanden verwacht
 * (bijv. ai-vergunningen-blob) → tab ".env.local" → kopieer het Read/Write-token
 * naar .env.local als BLOB_READ_WRITE_TOKEN.
 */
import { loadEnvConfig } from '@next/env'
loadEnvConfig(process.cwd())

import { put, list } from '@vercel/blob'

async function main() {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token?.trim()) {
    console.error('❌ Geen BLOB_READ_WRITE_TOKEN in .env.local')
    console.error('   Vercel → jouw project → Storage → open de gewenste Blob store → .env.local-tab → plak token.')
    process.exit(1)
  }

  const marker = `contractbot-smoke-${Date.now()}.txt`
  const body = `ok ${new Date().toISOString()}\n`

  try {
    const created = await put(marker, body, {
      access: 'private',
      contentType: 'text/plain',
      token,
    })
    console.log('✅ Upload gelukt — dit token schrijft naar de store die bij dit token hoort.')
    console.log('   pathname:', created.pathname)
    console.log('   url (begint meestal met https://…blob.vercel-storage.com/…):')
    console.log('  ', created.url.slice(0, 72) + (created.url.length > 72 ? '…' : ''))

    const listed = await list({ prefix: 'contractbot-smoke-', token, limit: 5 })
    console.log('   list-prefix contractbot-smoke-:', listed.blobs.length, 'blob(s)')
  } catch (e) {
    console.error('❌ Upload mislukt:', e instanceof Error ? e.message : e)
    process.exit(1)
  }
}

main()
