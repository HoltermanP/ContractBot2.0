'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Building2 } from 'lucide-react'

type Row = { orgId: string; name: string; role: string; isActive: boolean }

type OrganizationsPayload = { organizations: Row[]; isGlobalAdmin: boolean }

function parseOrganizationsPayload(json: unknown): { rows: Row[]; isGlobalAdmin: boolean } {
  if (Array.isArray(json)) {
    return { rows: json as Row[], isGlobalAdmin: false }
  }
  const p = json as OrganizationsPayload
  if (p?.organizations && Array.isArray(p.organizations)) {
    return { rows: p.organizations, isGlobalAdmin: Boolean(p.isGlobalAdmin) }
  }
  return { rows: [], isGlobalAdmin: false }
}

export function OrgSwitcher() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [isGlobalAdmin, setIsGlobalAdmin] = useState(false)
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/organizations')
        if (!res.ok) return
        const { rows: data, isGlobalAdmin: globalAdmin } = parseOrganizationsPayload(await res.json())
        if (cancelled) return
        setRows(data)
        setIsGlobalAdmin(globalAdmin)
        const cur = data.find((r) => r.isActive)
        if (cur) setActiveId(cur.orgId)
        else if (data[0]) setActiveId(data[0].orgId)
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function onChange(orgId: string) {
    if (!orgId || orgId === activeId) return
    setActiveId(orgId)
    const res = await fetch('/api/organizations/active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId }),
    })
    if (res.ok) router.refresh()
  }

  if (rows.length === 0) return null
  if (rows.length <= 1 && !isGlobalAdmin) return null

  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <Building2 className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
      <Select value={activeId} onValueChange={onChange}>
        <SelectTrigger
          className="h-9 w-[min(100%,280px)] border-slate-200 bg-white text-slate-800"
          aria-label="Actieve organisatie kiezen"
        >
          <SelectValue placeholder="Organisatie" />
        </SelectTrigger>
        <SelectContent className="max-h-[min(60vh,320px)]">
          {rows.map((r) => (
            <SelectItem key={r.orgId} value={r.orgId}>
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
