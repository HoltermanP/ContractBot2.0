import { NextResponse } from 'next/server'

export async function PUT() {
  return NextResponse.json(
    { error: 'Leveranciersmodule is uitgefaseerd in het nieuwe datamodel.' },
    { status: 410 }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Leveranciersmodule is uitgefaseerd in het nieuwe datamodel.' },
    { status: 410 }
  )
}
