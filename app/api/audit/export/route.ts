import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Legacy audit export endpoint is uitgefaseerd.' }, { status: 410 })
}
