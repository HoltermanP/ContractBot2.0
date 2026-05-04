import type { UserRole } from './auth'

export const ORG_MODULE_KEYS = [
  'dashboard',
  'aiAsk',
  'aiFaq',
  'aiInsights',
  'aiIssues',
  'projects',
  'contracts',
  'suppliers',
  'search',
  'reports',
  'handleiding',
  'training',
  'settingsOrganizations',
  'settingsUsers',
  'settingsNotifications',
  'settingsCustomFields',
  'settingsRetention',
] as const

export type OrgModuleKey = (typeof ORG_MODULE_KEYS)[number]
export type OrgModuleVisibility = Record<OrgModuleKey, boolean>

/** Rollen waarvoor de beheerder de matrix kan invullen (super_admin volgt alleen org-brede schakels). */
export const MODULE_MATRIX_ROLES: UserRole[] = [
  'admin',
  'manager',
  'registrator',
  'compliance',
  'reader',
]

export const ROLE_MATRIX_LABELS: Record<UserRole, string> = {
  super_admin: 'Super-admin',
  admin: 'Beheerder',
  manager: 'Manager',
  registrator: 'Registrator',
  compliance: 'Compliance',
  reader: 'Lezer',
}

export type ModulesByRole = Partial<Record<UserRole, Partial<Record<OrgModuleKey, boolean>>>>

export const ORG_MODULE_LABELS: Record<OrgModuleKey, string> = {
  dashboard: 'Dashboard',
  aiAsk: 'Contractagent',
  aiFaq: 'Veelgestelde vragen',
  aiInsights: 'Praktijkpunten',
  aiIssues: 'Contractkwaliteit',
  projects: 'Projecten',
  contracts: 'Contracten',
  suppliers: 'Leveranciers',
  search: 'Zoeken',
  reports: 'Rapportages',
  handleiding: 'Handleiding',
  training: 'Training & e-learning',
  settingsOrganizations: 'Instellingen — Organisaties',
  settingsUsers: 'Instellingen — Gebruikers',
  settingsNotifications: 'Instellingen — Notificaties',
  settingsCustomFields: 'Instellingen — Aangepaste velden',
  settingsRetention: 'Instellingen — Bewaartermijnen',
}

export const DEFAULT_ORG_MODULE_VISIBILITY: OrgModuleVisibility = {
  dashboard: true,
  aiAsk: true,
  aiFaq: true,
  aiInsights: true,
  aiIssues: true,
  projects: true,
  contracts: true,
  suppliers: true,
  search: true,
  reports: true,
  handleiding: true,
  training: true,
  settingsOrganizations: true,
  settingsUsers: true,
  settingsNotifications: true,
  settingsCustomFields: true,
  settingsRetention: true,
}

export function normalizeOrgModuleVisibility(input: unknown): OrgModuleVisibility {
  if (!input || typeof input !== 'object') return DEFAULT_ORG_MODULE_VISIBILITY
  const parsed = input as Partial<Record<OrgModuleKey, unknown>>

  return ORG_MODULE_KEYS.reduce((acc, key) => {
    acc[key] = typeof parsed[key] === 'boolean' ? parsed[key] : DEFAULT_ORG_MODULE_VISIBILITY[key]
    return acc
  }, {} as OrgModuleVisibility)
}

function isUserRole(v: unknown): v is UserRole {
  return (
    typeof v === 'string' &&
    (['super_admin', 'admin', 'manager', 'registrator', 'compliance', 'reader'] as const).includes(
      v as UserRole
    )
  )
}

export function normalizeModulesByRole(input: unknown): ModulesByRole {
  if (!input || typeof input !== 'object') return {}
  const out: ModulesByRole = {}
  for (const [roleKey, row] of Object.entries(input)) {
    if (!isUserRole(roleKey)) continue
    if (!row || typeof row !== 'object') continue
    const partial: Partial<Record<OrgModuleKey, boolean>> = {}
    for (const [moduleKey, val] of Object.entries(row)) {
      if (!ORG_MODULE_KEYS.includes(moduleKey as OrgModuleKey)) continue
      if (typeof val === 'boolean') {
        partial[moduleKey as OrgModuleKey] = val
      }
    }
    if (Object.keys(partial).length > 0) {
      out[roleKey] = partial
    }
  }
  return out
}

export function getOrgModuleVisibilityFromSettings(settingsJson: unknown): OrgModuleVisibility {
  if (!settingsJson || typeof settingsJson !== 'object') {
    return DEFAULT_ORG_MODULE_VISIBILITY
  }
  const root = settingsJson as Record<string, unknown>
  return normalizeOrgModuleVisibility(root.modules)
}

export function getModulesByRoleFromSettings(settingsJson: unknown): ModulesByRole {
  if (!settingsJson || typeof settingsJson !== 'object') return {}
  const root = settingsJson as Record<string, unknown>
  return normalizeModulesByRole(root.modulesByRole)
}

/**
 * Zichtbare modules voor deze gebruiker: org-brede schakels × optionele per-rol uitzonderingen.
 * `super_admin` volgt alleen de org-brede modules (voorkomt dat een tenant zichzelf uitsluit).
 */
export function getEffectiveModuleVisibility(
  settingsJson: unknown,
  role: UserRole
): OrgModuleVisibility {
  const base = getOrgModuleVisibilityFromSettings(settingsJson)
  if (role === 'super_admin') {
    return base
  }
  const byRole = getModulesByRoleFromSettings(settingsJson)
  const overrides = byRole[role] ?? {}
  return ORG_MODULE_KEYS.reduce((acc, key) => {
    acc[key] = base[key] && overrides[key] !== false
    return acc
  }, {} as OrgModuleVisibility)
}

export function mergeSettingsWithModuleVisibility(
  settingsJson: unknown,
  visibility: OrgModuleVisibility
): Record<string, unknown> {
  const base =
    settingsJson && typeof settingsJson === 'object' && !Array.isArray(settingsJson)
      ? ({ ...(settingsJson as Record<string, unknown>) } as Record<string, unknown>)
      : {}

  base.modules = visibility
  return base
}

export function mergeSettingsWithModulesPatch(
  settingsJson: unknown,
  patch: { modules: OrgModuleVisibility; modulesByRole: ModulesByRole }
): Record<string, unknown> {
  const base =
    settingsJson && typeof settingsJson === 'object' && !Array.isArray(settingsJson)
      ? ({ ...(settingsJson as Record<string, unknown>) } as Record<string, unknown>)
      : {}

  base.modules = patch.modules
  base.modulesByRole = patch.modulesByRole
  return base
}

export function isPathAllowedByModules(pathname: string, visibility: OrgModuleVisibility): boolean {
  const checks: Array<{ key: OrgModuleKey; matches: boolean }> = [
    { key: 'dashboard', matches: pathname === '/dashboard' },
    { key: 'aiAsk', matches: pathname === '/ai/ask' || pathname.startsWith('/ai/ask/') },
    { key: 'aiFaq', matches: pathname === '/ai/faq' || pathname.startsWith('/ai/faq/') },
    { key: 'aiInsights', matches: pathname === '/ai/insights' || pathname.startsWith('/ai/insights/') },
    { key: 'aiIssues', matches: pathname === '/ai/issues' || pathname.startsWith('/ai/issues/') },
    { key: 'projects', matches: pathname === '/projects' || pathname.startsWith('/projects/') },
    { key: 'contracts', matches: pathname === '/contracts' || pathname.startsWith('/contracts/') },
    { key: 'suppliers', matches: pathname === '/suppliers' || pathname.startsWith('/suppliers/') },
    { key: 'search', matches: pathname === '/search' || pathname.startsWith('/search/') },
    { key: 'reports', matches: pathname === '/reports' || pathname.startsWith('/reports/') },
    { key: 'handleiding', matches: pathname === '/handleiding' || pathname.startsWith('/handleiding/') },
    { key: 'training', matches: pathname === '/training' || pathname.startsWith('/training/') },
    {
      key: 'settingsOrganizations',
      matches: pathname === '/settings/organizations' || pathname.startsWith('/settings/organizations/'),
    },
    {
      key: 'settingsUsers',
      matches: pathname === '/settings/users' || pathname.startsWith('/settings/users/'),
    },
    {
      key: 'settingsNotifications',
      matches: pathname === '/settings/notifications' || pathname.startsWith('/settings/notifications/'),
    },
    {
      key: 'settingsCustomFields',
      matches: pathname === '/settings/custom-fields' || pathname.startsWith('/settings/custom-fields/'),
    },
    {
      key: 'settingsRetention',
      matches: pathname === '/settings/retention' || pathname.startsWith('/settings/retention/'),
    },
  ]

  for (const check of checks) {
    if (check.matches) return visibility[check.key]
  }

  if (pathname === '/settings' || pathname.startsWith('/settings/')) {
    return false
  }

  return true
}
