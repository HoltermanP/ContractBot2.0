'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  type TooltipProps,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  format,
  addMonths,
  addQuarters,
  startOfMonth,
  startOfQuarter,
  endOfQuarter,
  endOfYear,
  startOfYear,
  differenceInCalendarMonths,
  getQuarter,
  getYear,
  isWithinInterval,
} from 'date-fns'
import { nl } from 'date-fns/locale'

interface Contract {
  id: string
  endDate: Date | null
  status: string
}

type Granularity = 'month' | 'quarter' | 'year'

function pickGranularity(monthSpan: number): Granularity {
  if (monthSpan <= 20) return 'month'
  if (monthSpan <= 48) return 'quarter'
  return 'year'
}

type Bucket = {
  key: string
  label: string
  rangeLabel: string
  actief: number
  verlopen: number
}

function buildBuckets(now: Date, furthest: Date, granularity: Granularity): Bucket[] {
  const buckets: Bucket[] = []

  if (granularity === 'month') {
    const monthSpan = Math.max(differenceInCalendarMonths(furthest, now) + 1, 12)
    for (let i = 0; i < monthSpan; i++) {
      const m = startOfMonth(addMonths(now, i))
      const label = format(m, 'MMM yy', { locale: nl })
      const rangeLabel = format(m, 'MMMM yyyy', { locale: nl })
      buckets.push({
        key: String(m.getTime()),
        label,
        rangeLabel,
        actief: 0,
        verlopen: 0,
      })
    }
    return buckets
  }

  if (granularity === 'quarter') {
    let q = startOfQuarter(now)
    while (q <= furthest) {
      const qEnd = endOfQuarter(q)
      const label = `Q${getQuarter(q)} ’${format(q, 'yy', { locale: nl })}`
      const rangeLabel = `${label} (${format(q, 'd MMM', { locale: nl })} – ${format(qEnd, 'd MMM yyyy', { locale: nl })})`
      buckets.push({
        key: String(q.getTime()),
        label,
        rangeLabel,
        actief: 0,
        verlopen: 0,
      })
      q = addQuarters(q, 1)
    }
    return buckets
  }

  // year
  const y0 = getYear(now)
  const y1 = getYear(furthest)
  for (let y = y0; y <= y1; y++) {
    const ys = startOfYear(new Date(y, 0, 1))
    const ye = endOfYear(ys)
    buckets.push({
      key: String(y),
      label: String(y),
      rangeLabel: `Kalenderjaar ${y} (${format(ys, 'd MMM', { locale: nl })} – ${format(ye, 'd MMM yyyy', { locale: nl })})`,
      actief: 0,
      verlopen: 0,
    })
  }
  return buckets
}

function assignContract(bucketMeta: { granularity: Granularity; buckets: Bucket[]; now: Date }, contract: Contract) {
  if (!contract.endDate) return
  const end = new Date(contract.endDate)
  if (end < bucketMeta.now) return

  const { granularity, buckets } = bucketMeta

  for (let i = 0; i < buckets.length; i++) {
    const b = buckets[i]!
    let hit = false
    if (granularity === 'month') {
      const m = startOfMonth(addMonths(bucketMeta.now, i))
      hit = startOfMonth(end).getTime() === m.getTime()
    } else if (granularity === 'quarter') {
      const qStart = new Date(Number(b.key))
      hit = isWithinInterval(end, { start: qStart, end: endOfQuarter(qStart) })
    } else {
      hit = getYear(end) === Number(b.key)
    }
    if (hit) {
      if (contract.status === 'actief') b.actief++
      else if (contract.status === 'verlopen') b.verlopen++
      return
    }
  }
}

function ChartTooltip({
  active,
  payload,
}: TooltipProps<number, string> & { payload?: Array<{ payload: Bucket & { name: string } }> }) {
  if (!active || !payload?.length) return null
  const row = payload[0]!.payload
  const actief = row.actief ?? 0
  const verlopen = row.verlopen ?? 0
  const total = actief + verlopen
  if (total === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm shadow-lg">
        <p className="font-medium text-zinc-900">{row.rangeLabel}</p>
        <p className="mt-1 text-xs text-zinc-500">Geen afloop in deze periode</p>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm shadow-lg">
      <p className="font-medium text-zinc-900">{row.rangeLabel}</p>
      <ul className="mt-2 space-y-1 text-xs">
        {actief > 0 ? (
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-sm bg-blue-500" />
            <span className="text-zinc-700">
              Actief: <span className="font-semibold tabular-nums text-zinc-900">{actief}</span>
            </span>
          </li>
        ) : null}
        {verlopen > 0 ? (
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-sm bg-orange-500" />
            <span className="text-zinc-700">
              Verlopen: <span className="font-semibold tabular-nums text-zinc-900">{verlopen}</span>
            </span>
          </li>
        ) : null}
        <li className="border-t border-zinc-100 pt-1.5 font-medium text-zinc-800">
          Totaal: <span className="tabular-nums">{total}</span>
        </li>
      </ul>
    </div>
  )
}

export function DashboardChart({ contracts }: { contracts: Contract[] }) {
  const now = startOfMonth(new Date())

  const endDates = contracts
    .map((c) => (c.endDate ? startOfMonth(new Date(c.endDate)) : null))
    .filter((d): d is Date => d != null)

  const furthest =
    endDates.length > 0 ? new Date(Math.max(...endDates.map((d) => d.getTime()))) : addMonths(now, 11)

  let monthSpan = differenceInCalendarMonths(furthest, now) + 1
  if (monthSpan < 12) monthSpan = 12

  const granularity = pickGranularity(monthSpan)
  const buckets = buildBuckets(now, furthest, granularity)
  const bucketMeta = { granularity, buckets, now }

  for (const c of contracts) {
    assignContract(bucketMeta, c)
  }

  const data = buckets.map((b) => ({
    name: b.label,
    rangeLabel: b.rangeLabel,
    Actief: b.actief,
    Verlopen: b.verlopen,
  }))

  const withData = data.filter((d) => d.Actief > 0 || d.Verlopen > 0).length
  const granularityHint =
    granularity === 'month'
      ? 'per maand'
      : granularity === 'quarter'
        ? 'per kwartaal (langere looptijden)'
        : 'per kalenderjaar (zeer lange looptijden)'

  const firstLabel = format(now, 'MMM yyyy', { locale: nl })
  const lastLabel = format(furthest, 'MMM yyyy', { locale: nl })

  return (
    <Card className="overflow-hidden rounded-2xl border-zinc-200/80 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
      <CardHeader className="border-b border-zinc-100 bg-zinc-50/80 pb-4">
        <CardTitle className="text-base font-semibold text-zinc-900">Afloop contracten</CardTitle>
        <p className="text-xs font-normal leading-relaxed text-zinc-500">
          {firstLabel} t/m {lastLabel} — weergave {granularityHint}. Balken zijn gestapeld: actief (blauw) en verlopen
          (oranje) in dezelfde periode.
        </p>
        <p className="text-xs text-zinc-500">
          <span className="font-medium tabular-nums text-zinc-800">{withData}</span> periodes met minstens één afloop ·{' '}
          <span className="font-medium tabular-nums text-zinc-800">{contracts.filter((c) => c.endDate).length}</span>{' '}
          contracten met einddatum
        </p>
      </CardHeader>
      <CardContent className="pt-5">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={data}
            margin={{ top: 8, right: 12, bottom: 8, left: 4 }}
            barCategoryGap={granularity === 'month' ? '18%' : '24%'}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#71717a' }}
              tickLine={false}
              axisLine={{ stroke: '#e4e4e7' }}
              interval={granularity === 'month' && data.length > 14 ? 'preserveStartEnd' : 0}
              angle={granularity === 'year' ? 0 : data.length > 16 ? -35 : 0}
              textAnchor={data.length > 16 && granularity !== 'year' ? 'end' : 'middle'}
              height={granularity === 'year' ? 30 : data.length > 16 ? 56 : 36}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#71717a' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={36}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(24, 24, 27, 0.06)' }} />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
              formatter={(value) => <span className="text-zinc-700">{value}</span>}
            />
            <Bar dataKey="Actief" stackId="exp" fill="#3b82f6" maxBarSize={52} radius={[0, 0, 0, 0]} />
            <Bar dataKey="Verlopen" stackId="exp" fill="#f97316" maxBarSize={52} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
