import { NextResponse } from 'next/server'

export async function PATCH() {
  return NextResponse.json({ error: 'Legacy contract archive endpoint is uitgefaseerd.' }, { status: 410 })
}
