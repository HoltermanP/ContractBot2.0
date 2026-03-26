import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Legacy documents upload endpoint is uitgefaseerd.' }, { status: 410 })
}
