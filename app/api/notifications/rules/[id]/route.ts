import { NextResponse } from 'next/server'

export async function PUT() {
  return NextResponse.json({ error: 'Legacy notifications endpoint is uitgefaseerd.' }, { status: 410 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Legacy notifications endpoint is uitgefaseerd.' }, { status: 410 })
}
