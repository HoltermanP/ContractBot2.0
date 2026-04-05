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
] as const

export type OrgModuleKey = (typeof ORG_MODULE_KEYS)[number]
export type OrgModuleVisibility = Record<OrgModuleKey, boolean>

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
}

export function normalizeOrgModuleVisibility(input: unknown): OrgModuleVisibility {
  if (!input || typeof input !== 'object') return DEFAULT_ORG_MODULE_VISIBILITY
  const parsed = input as Partial<Record<OrgModuleKey, unknown>>

  return ORG_MODULE_KEYS.reduce((acc, key) => {
    acc[key] = typeof parsed[key] === 'boolean' ? parsed[key] : DEFAULT_ORG_MODULE_VISIBILITY[key]
    return acc
  }, {} as OrgModuleVisibility)
}

export function getOrgModuleVisibilityFromSettings(settingsJson: unknown): OrgModuleVisibility {
  if (!settingsJson || typeof settingsJson !== 'object') {
    return DEFAULT_ORG_MODULE_VISIBILITY
  }
  const root = settingsJson as Record<string, unknown>
  return normalizeOrgModuleVisibility(root.modules)
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

export function isPathAllowedByModules(pathname: string, visibility: OrgModuleVisibility): boolean {
  if (pathname.startsWith('/settings')) return true

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
  ]

  for (const check of checks) {
    if (check.matches) return visibility[check.key]
  }
  return true
}
