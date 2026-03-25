import { NextRequest, NextResponse } from 'next/server'
import { getOrCreateUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { auditLog, users } from '@/lib/db/schema'
import { eq, and, gte, lte } from 'drizzle-orm'
import ExcelJS from 'exceljs'

export async function POST(req: NextRequest) {
  try {
    const user = await getOrCreateUser()
    if (!user) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })

    const { format, contractId, fromDate, toDate } = await req.json()

    const conditions = [eq(auditLog.orgId, user.orgId)]
    if (contractId) conditions.push(eq(auditLog.contractId, contractId))
    if (fromDate) conditions.push(gte(auditLog.createdAt, new Date(fromDate)))
    if (toDate) conditions.push(lte(auditLog.createdAt, new Date(toDate)))

    const logs = await db.query.auditLog.findMany({
      where: and(...conditions),
      orderBy: (l, { desc }) => [desc(l.createdAt)],
      limit: 5000,
    })

    // Get user names for IDs
    const userIds = [...new Set(logs.map(l => l.userId).filter(Boolean))]
    const userMap: Record<string, string> = {}
    if (userIds.length > 0) {
      const dbUsers = await db.query.users.findMany({
        where: eq(users.orgId, user.orgId),
        columns: { id: true, name: true },
      })
      for (const u of dbUsers) userMap[u.id] = u.name
    }

    const rows = logs.map(l => ({
      datum: new Date(l.createdAt).toLocaleString('nl-NL'),
      actie: l.action,
      gebruiker: l.userId ? (userMap[l.userId] ?? l.userId) : '',
      contractId: l.contractId ?? '',
      ip: l.ipAddress ?? '',
      details: l.newValueJson ? JSON.stringify(l.newValueJson).slice(0, 200) : '',
    }))

    if (format === 'csv') {
      const headers = ['Datum', 'Actie', 'Gebruiker', 'Contract ID', 'IP-adres', 'Details']
      const csv = [
        headers.join(','),
        ...rows.map(r => [r.datum, r.actie, r.gebruiker, r.contractId, r.ip, r.details]
          .map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      ].join('\n')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="auditlog-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    if (format === 'excel') {
      const wb = new ExcelJS.Workbook()
      const ws = wb.addWorksheet('Auditlog')
      ws.columns = [
        { header: 'Datum', key: 'datum', width: 22 },
        { header: 'Actie', key: 'actie', width: 35 },
        { header: 'Gebruiker', key: 'gebruiker', width: 25 },
        { header: 'Contract ID', key: 'contractId', width: 40 },
        { header: 'IP-adres', key: 'ip', width: 18 },
        { header: 'Details', key: 'details', width: 50 },
      ]
      ws.getRow(1).font = { bold: true }
      ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
      ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      for (const r of rows) ws.addRow(r)
      const buf = await wb.xlsx.writeBuffer()
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="auditlog-${new Date().toISOString().split('T')[0]}.xlsx"`,
        },
      })
    }

    return NextResponse.json({ error: 'Onbekend formaat' }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
