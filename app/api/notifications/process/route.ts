import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json({ error: 'Legacy notifications processor is uitgefaseerd.' }, { status: 410 })
}
