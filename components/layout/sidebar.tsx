'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, FileText, Users, BarChart3, Search,
  Settings, Building2, Bell, BookOpen, FolderKanban,
  Bot, HelpCircle, Lightbulb, ShieldAlert, GraduationCap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import type { OrgModuleKey, OrgModuleVisibility } from '@/lib/org-modules'

type ModuleNavItem = {
  href: string
  label: string
  icon: LucideIcon
  key: OrgModuleKey
}

const agentItems: ModuleNavItem[] = [
  { href: '/ai/ask', label: 'Contractagent', icon: Bot, key: 'aiAsk' },
  { href: '/ai/faq', label: 'Veelgestelde vragen', icon: HelpCircle, key: 'aiFaq' },
  { href: '/ai/insights', label: 'Praktijkpunten', icon: Lightbulb, key: 'aiInsights' },
  { href: '/ai/issues', label: 'Contractkwaliteit', icon: ShieldAlert, key: 'aiIssues' },
]

const navItems: ModuleNavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' },
  { href: '/projects', label: 'Projecten', icon: FolderKanban, key: 'projects' },
  { href: '/contracts', label: 'Contracten', icon: FileText, key: 'contracts' },
  { href: '/search', label: 'Zoeken', icon: Search, key: 'search' },
  { href: '/reports', label: 'Rapportages', icon: BarChart3, key: 'reports' },
  { href: '/handleiding', label: 'Handleiding', icon: BookOpen, key: 'handleiding' },
]

const aiItems: ModuleNavItem[] = [
  { href: '/training', label: 'Training & e-learning', icon: GraduationCap, key: 'training' },
]

const settingsItems = [
  { href: '/settings/organizations', label: 'Organisaties', icon: Building2 },
  { href: '/settings/users', label: 'Gebruikers', icon: Users },
  { href: '/settings/notifications', label: 'Notificaties', icon: Bell },
  { href: '/settings/custom-fields', label: 'Aangepaste velden', icon: Settings },
  { href: '/settings/retention', label: 'Bewaartermijnen', icon: Settings },
]

export function Sidebar({ moduleVisibility }: { moduleVisibility: OrgModuleVisibility }) {
  const pathname = usePathname()
  const visibleAgentItems = agentItems.filter((item) => moduleVisibility[item.key])
  const visibleNavItems = navItems.filter((item) => moduleVisibility[item.key])
  const visibleAiItems = aiItems.filter((item) => moduleVisibility[item.key])
  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900 text-white flex flex-col z-40">
      <div className="p-6 border-b border-slate-700">
        <Link href="/ai/ask" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <div className="font-semibold text-sm">AI-Contractagent</div>
            <div className="text-xs text-slate-400">Contractmanagement</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visibleAgentItems.length > 0 && (
          <>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Contractagent</div>
            {visibleAgentItems.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
              const isPrimary = href === '/ai/ask'
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : isPrimary
                        ? 'bg-blue-900/60 text-blue-200 hover:bg-blue-800 hover:text-white border border-blue-700/40'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              )
            })}
          </>
        )}

        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-6 mb-3">Navigatie</div>
        {visibleNavItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}

        {visibleAiItems.length > 0 && (
          <>
            <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-6 mb-3">AI Tools</div>
            {visibleAiItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  pathname.startsWith(href)
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            ))}
          </>
        )}

        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-6 mb-3">Instellingen</div>
        {settingsItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
              pathname.startsWith(href)
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700 flex items-center gap-3">
        <UserButton afterSignOutUrl="/sign-in" />
        <div className="text-xs text-slate-400">Account</div>
      </div>
    </aside>
  )
}
