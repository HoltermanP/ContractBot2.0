import { NextResponse } from 'next/server'

export async function PATCH() {
  return NextResponse.json({ error: 'Legacy obligations endpoint is uitgefaseerd.' }, { status: 410 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Legacy obligations endpoint is uitgefaseerd.' }, { status: 410 })
}
