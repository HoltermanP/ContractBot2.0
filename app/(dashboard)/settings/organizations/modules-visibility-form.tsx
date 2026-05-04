'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DEFAULT_ORG_MODULE_VISIBILITY,
  MODULE_MATRIX_ROLES,
  ORG_MODULE_KEYS,
  ORG_MODULE_LABELS,
  ROLE_MATRIX_LABELS,
  type ModulesByRole,
  type OrgModuleKey,
  type OrgModuleVisibility,
} from '@/lib/org-modules'

const MODULE_SECTIONS: { title: string; keys: OrgModuleKey[] }[] = [
  {
    title: 'Contractagent',
    keys: ['aiAsk', 'aiFaq', 'aiInsights', 'aiIssues'],
  },
  {
    title: 'Hoofdnavigatie',
    keys: ['dashboard', 'projects', 'contracts', 'suppliers', 'search', 'reports', 'handleiding', 'training'],
  },
  {
    title: 'Instellingen (sidebar)',
    keys: [
      'settingsOrganizations',
      'settingsUsers',
      'settingsNotifications',
      'settingsCustomFields',
      'settingsRetention',
    ],
  },
]

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

function emptyModulesByRole(): ModulesByRole {
  return {}
}

export function ModulesVisibilityForm() {
  const [modules, setModules] = useState<OrgModuleVisibility>(DEFAULT_ORG_MODULE_VISIBILITY)
  const [modulesByRole, setModulesByRole] = useState<ModulesByRole>(emptyModulesByRole)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/organizations/modules')
        if (!res.ok) return
        const data = (await res.json()) as {
          modules?: OrgModuleVisibility
          modulesByRole?: ModulesByRole
        }
        if (cancelled) return
        if (data.modules) setModules(data.modules)
        if (data.modulesByRole) setModulesByRole(data.modulesByRole)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const disabledCount = useMemo(() => ORG_MODULE_KEYS.filter((k) => !modules[k]).length, [modules])

  function toggleKey(key: OrgModuleKey) {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }))
    setStatus('')
  }

  function isCellChecked(role: (typeof MODULE_MATRIX_ROLES)[number], key: OrgModuleKey): boolean {
    if (!modules[key]) return false
    return modulesByRole[role]?.[key] !== false
  }

  function toggleMatrixCell(role: (typeof MODULE_MATRIX_ROLES)[number], key: OrgModuleKey) {
    if (!modules[key]) return
    setModulesByRole((prev) => {
      const next = { ...prev }
      const row = { ...(next[role] ?? {}) }
      const currentlyOff = row[key] === false
      if (currentlyOff) {
        delete row[key]
      } else {
        row[key] = false
      }
      if (Object.keys(row).length === 0) {
        delete next[role]
      } else {
        next[role] = row
      }
      return next
    })
    setStatus('')
  }

  async function onSave() {
    setSaving(true)
    setStatus('')
    try {
      const res = await fetch('/api/organizations/modules', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules, modulesByRole }),
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

  const sectionKeys = useMemo(() => new Set(MODULE_SECTIONS.flatMap((s) => s.keys)), [])
  const orphanKeys = ORG_MODULE_KEYS.filter((k) => !sectionKeys.has(k))

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Schakel modules organisatiebreed aan of uit. Uitgeschakelde modules verdwijnen voor iedereen en zijn niet meer
          direct bereikbaar.
        </p>

        <div className="space-y-6">
          {MODULE_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-2">
              <h3 className="text-sm font-medium text-slate-800">{section.title}</h3>
              <div className="grid gap-2">
                {section.keys.map((key) => (
                  <VisibilityRow
                    key={key}
                    label={ORG_MODULE_LABELS[key]}
                    checked={modules[key]}
                    disabled={loading || saving}
                    onToggle={() => toggleKey(key)}
                  />
                ))}
              </div>
            </div>
          ))}

          {orphanKeys.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-slate-800">Overig</h3>
              <div className="grid gap-2">
                {orphanKeys.map((key) => (
                  <VisibilityRow
                    key={key}
                    label={ORG_MODULE_LABELS[key]}
                    checked={modules[key]}
                    disabled={loading || saving}
                    onToggle={() => toggleKey(key)}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="space-y-3 border-t border-slate-200 pt-6">
        <div>
          <h3 className="text-sm font-medium text-slate-800">Per gebruikersrol</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Vink uit om een module (die organisatiebreed aan staat) voor een specifieke rol te verbergen — navigatie en
            directe URL-toegang. Super-admin volgt alleen de organisatiebrede schakels hierboven.
          </p>
        </div>

        <div className="rounded-md border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left font-medium p-2 pl-3 sticky left-0 bg-slate-50 z-10 min-w-[180px]">Module</th>
                {MODULE_MATRIX_ROLES.map((role) => (
                  <th key={role} className="text-center font-medium p-2 px-1 w-[88px]">
                    <span className="block truncate" title={ROLE_MATRIX_LABELS[role]}>
                      {ROLE_MATRIX_LABELS[role]}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ORG_MODULE_KEYS.map((key) => (
                <tr key={key} className="border-b border-slate-100 last:border-0">
                  <td className="p-2 pl-3 sticky left-0 bg-white z-10 font-normal text-slate-700 border-r border-slate-100">
                    {ORG_MODULE_LABELS[key]}
                  </td>
                  {MODULE_MATRIX_ROLES.map((role) => {
                    const orgOff = !modules[key]
                    const checked = isCellChecked(role, key)
                    return (
                      <td key={role} className="p-1 text-center align-middle">
                        <div className="flex justify-center py-1">
                          <Checkbox
                            checked={checked}
                            disabled={loading || saving || orgOff}
                            onCheckedChange={() => toggleMatrixCell(role, key)}
                            aria-label={`${ORG_MODULE_LABELS[key]} — ${ROLE_MATRIX_LABELS[role]}`}
                          />
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={onSave} disabled={loading || saving}>
          {saving ? 'Bezig met opslaan...' : 'Opslaan'}
        </Button>
        <span className="text-xs text-slate-500">{disabledCount} organisatiebreed uitgeschakeld</span>
        {status ? <span className="text-xs text-slate-600">{status}</span> : null}
      </div>
    </div>
  )
}
