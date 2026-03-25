'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, FileText, Users, BarChart3, Search,
  Settings, Building2, Bell, GitCompare, PenLine, BookOpen, FolderKanban,
  MessageCircleQuestion, GraduationCap,
} from 'lucide-react'
import { UserButton } from '@clerk/nextjs'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/ai/ask', label: 'Contractvragen', icon: MessageCircleQuestion },
  { href: '/projects', label: 'Projecten', icon: FolderKanban },
  { href: '/contracts', label: 'Contracten', icon: FileText },
  { href: '/suppliers', label: 'Leveranciers', icon: Building2 },
  { href: '/search', label: 'Zoeken', icon: Search },
  { href: '/reports', label: 'Rapportages', icon: BarChart3 },
  { href: '/handleiding', label: 'Handleiding', icon: BookOpen },
]

const aiItems = [
  { href: '/contracts/compare', label: 'Contractvergelijking', icon: GitCompare },
  { href: '/ai/draft', label: 'Ontwerp-assistent', icon: PenLine },
  { href: '/training', label: 'Training & e-learning', icon: GraduationCap },
]

const settingsItems = [
  { href: '/settings/organizations', label: 'Organisaties', icon: Building2 },
  { href: '/settings/users', label: 'Gebruikers', icon: Users },
  { href: '/settings/notifications', label: 'Notificaties', icon: Bell },
  { href: '/settings/custom-fields', label: 'Aangepaste velden', icon: Settings },
  { href: '/settings/retention', label: 'Bewaartermijnen', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-slate-900 text-white flex flex-col z-40">
      <div className="p-6 border-b border-slate-700">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">AI</div>
          <div>
            <div className="font-semibold text-sm">AI-Contractbot</div>
            <div className="text-xs text-slate-400">Contractmanagement</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">Navigatie</div>
        {navItems.map(({ href, label, icon: Icon }) => (
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

        <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mt-6 mb-3">AI Tools</div>
        {aiItems.map(({ href, label, icon: Icon }) => (
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
