import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { error: 'Leveranciersmodule is uitgefaseerd in het nieuwe datamodel.' },
    { status: 410 }
  )
}

export async function POST() {
  return NextResponse.json(
    { error: 'Leveranciersmodule is uitgefaseerd in het nieuwe datamodel.' },
    { status: 410 }
  )
}
