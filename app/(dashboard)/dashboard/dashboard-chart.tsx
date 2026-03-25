'use client'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { format, addMonths, startOfMonth } from 'date-fns'
import { nl } from 'date-fns/locale'

interface Contract {
  id: string
  endDate: Date | null
  status: string
}

export function DashboardChart({ contracts }: { contracts: Contract[] }) {
  // Build chart data: contracts expiring per month for next 12 months
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = addMonths(startOfMonth(new Date()), i)
    return { month: m, label: format(m, 'MMM yy', { locale: nl }), actief: 0, verlopen: 0 }
  })

  for (const contract of contracts) {
    if (!contract.endDate) continue
    const endMonth = startOfMonth(new Date(contract.endDate))
    const idx = months.findIndex(m => m.month.getTime() === endMonth.getTime())
    if (idx >= 0) {
      if (contract.status === 'actief') months[idx].actief++
      else if (contract.status === 'verlopen') months[idx].verlopen++
    }
  }

  const data = months.map(m => ({ name: m.label, Actief: m.actief, Verlopen: m.verlopen }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contracten per afloopdatum (12 maanden)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Actief" fill="#3b82f6" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Verlopen" fill="#f97316" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
