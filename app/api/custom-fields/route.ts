import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'Legacy custom-fields endpoint is uitgefaseerd.' }, { status: 410 })
}

export async function POST() {
  return NextResponse.json({ error: 'Legacy custom-fields endpoint is uitgefaseerd.' }, { status: 410 })
}
