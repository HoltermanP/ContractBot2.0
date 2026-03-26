import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'Legacy audit endpoint is uitgefaseerd.' }, { status: 410 })
}
