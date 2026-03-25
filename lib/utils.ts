import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: string | number | null, currency = 'EUR'): string {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount))
}

export function formatDate(date: Date | string | null): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium' }).format(new Date(date))
}

export function daysUntil(date: Date | string | null): number | null {
  if (!date) return null
  const diff = new Date(date).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export function getExpiryColor(days: number | null): string {
  if (days === null) return 'text-muted-foreground'
  if (days < 0) return 'text-red-600'
  if (days < 30) return 'text-red-500'
  if (days < 90) return 'text-orange-500'
  return 'text-green-600'
}

export function getExpiryBadgeClass(days: number | null): string {
  if (days === null) return 'bg-gray-100 text-gray-600'
  if (days < 0) return 'bg-red-100 text-red-700'
  if (days < 30) return 'bg-red-50 text-red-600'
  if (days < 90) return 'bg-orange-50 text-orange-600'
  return 'bg-green-50 text-green-700'
}

export const STATUS_LABELS: Record<string, string> = {
  concept: 'Concept',
  actief: 'Actief',
  verlopen: 'Verlopen',
  gearchiveerd: 'Gearchiveerd',
  verwijderd: 'Verwijderd',
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Beheerder',
  registrator: 'Contractregistrator',
  manager: 'Contractmanager',
  compliance: 'Compliance / audit',
  reader: 'Lezer',
}

export const OBLIGATION_CATEGORY_LABELS: Record<string, string> = {
  it_security: 'IT Security',
  privacy: 'Privacy',
  financial: 'Financieel',
  sustainability: 'Duurzaamheid',
  other: 'Overig',
}
