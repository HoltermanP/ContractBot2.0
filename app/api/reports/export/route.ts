import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { contracts, suppliers } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import ExcelJS from 'exceljs'

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const { format, filters } = await req.json()

    const allContracts = await db.query.contracts.findMany({
      where: eq(contracts.orgId, user.orgId),
      with: { supplier: true, owner: true },
    })

    if (format === 'csv') {
      const headers = ['Naam', 'Nummer', 'Type', 'Status', 'Leverancier', 'Eigenaar', 'Startdatum', 'Einddatum', 'Jaarwaarde', 'Valuta']
      const rows = allContracts.map(c => [
        c.title,
        c.contractNumber ?? '',
        c.contractType ?? '',
        c.status,
        (c as any).supplier?.name ?? '',
        (c as any).owner?.name ?? '',
        c.startDate ? new Date(c.startDate).toLocaleDateString('nl-NL') : '',
        c.endDate ? new Date(c.endDate).toLocaleDateString('nl-NL') : '',
        c.valueAnnual ?? '',
        c.currency ?? 'EUR',
      ])
      const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="contracten.csv"',
        },
      })
    }

    if (format === 'excel') {
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Contracten')

      ws.columns = [
        { header: 'Naam', key: 'title', width: 40 },
        { header: 'Nummer', key: 'contractNumber', width: 20 },
        { header: 'Type', key: 'contractType', width: 25 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Leverancier', key: 'supplier', width: 30 },
        { header: 'Eigenaar', key: 'owner', width: 25 },
        { header: 'Startdatum', key: 'startDate', width: 15 },
        { header: 'Einddatum', key: 'endDate', width: 15 },
        { header: 'Jaarwaarde', key: 'valueAnnual', width: 15 },
        { header: 'Valuta', key: 'currency', width: 10 },
      ]

      ws.getRow(1).font = { bold: true }
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3B82F6' } }

      for (const c of allContracts) {
        ws.addRow({
          title: c.title,
          contractNumber: c.contractNumber ?? '',
          contractType: c.contractType ?? '',
          status: c.status,
          supplier: (c as any).supplier?.name ?? '',
          owner: (c as any).owner?.name ?? '',
          startDate: c.startDate ? new Date(c.startDate).toLocaleDateString('nl-NL') : '',
          endDate: c.endDate ? new Date(c.endDate).toLocaleDateString('nl-NL') : '',
          valueAnnual: c.valueAnnual ? Number(c.valueAnnual) : '',
          currency: c.currency ?? 'EUR',
        })
      }

      const buf = await wb.xlsx.writeBuffer()
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': 'attachment; filename="contracten.xlsx"',
        },
      })
    }

    return NextResponse.json({ error: 'Onbekend formaat' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
