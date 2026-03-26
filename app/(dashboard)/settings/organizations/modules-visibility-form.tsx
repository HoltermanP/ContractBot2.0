'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DEFAULT_ORG_MODULE_VISIBILITY,
  ORG_MODULE_KEYS,
  ORG_MODULE_LABELS,
  type OrgModuleVisibility,
} from '@/lib/org-modules'

function VisibilityRow({
  label,
  checked,
  onToggle,
  disabled,
}: {
  label: string
  checked: boolean
  onToggle: () => void
  disabled: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      className="w-full flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <span>{label}</span>
      <span
        className={checked ? 'text-emerald-700 font-medium' : 'text-slate-500'}
        aria-label={checked ? 'Ingeschakeld' : 'Uitgeschakeld'}
      >
        {checked ? 'Aan' : 'Uit'}
      </span>
    </button>
  )
}

export function ModulesVisibilityForm() {
  const [modules, setModules] = useState<OrgModuleVisibility>(DEFAULT_ORG_MODULE_VISIBILITY)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/organizations/modules')
        if (!res.ok) return
        const data = (await res.json()) as { modules?: OrgModuleVisibility }
        if (cancelled || !data.modules) return
        setModules(data.modules)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const disabledCount = useMemo(() => ORG_MODULE_KEYS.filter((k) => !modules[k]).length, [modules])

  function toggleKey(key: (typeof ORG_MODULE_KEYS)[number]) {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }))
    setStatus('')
  }

  async function onSave() {
    setSaving(true)
    setStatus('')
    try {
      const res = await fetch('/api/organizations/modules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setStatus(data.error ?? 'Opslaan mislukt')
        return
      }
      setStatus('Opgeslagen')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Schakel modules per organisatie aan of uit. Uitgeschakelde modules verdwijnen uit de navigatie en zijn niet meer
        direct bereikbaar.
      </p>

      <div className="grid gap-2">
        {ORG_MODULE_KEYS.map((key) => (
          <VisibilityRow
            key={key}
            label={ORG_MODULE_LABELS[key]}
            checked={modules[key]}
            disabled={loading || saving}
            onToggle={() => toggleKey(key)}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={loading || saving}>
          {saving ? 'Bezig met opslaan...' : 'Opslaan'}
        </Button>
        <span className="text-xs text-slate-500">{disabledCount} uitgeschakeld</span>
        {status ? <span className="text-xs text-slate-600">{status}</span> : null}
      </div>
    </div>
  )
}
