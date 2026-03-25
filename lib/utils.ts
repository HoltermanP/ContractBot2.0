import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const STATUS_LABELS: Record<string, string> = {
  concept: "Concept",
  actief: "Actief",
  verlopen: "Verlopen",
  gearchiveerd: "Gearchiveerd",
  verwijderd: "Verwijderd",
}

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  registrator: "Registrator",
  manager: "Manager",
  compliance: "Compliance",
  reader: "Lezer",
}

export const OBLIGATION_CATEGORY_LABELS: Record<string, string> = {
  it_security: "IT-beveiliging",
  privacy: "Privacy",
  financial: "Financieel",
  sustainability: "Duurzaamheid",
  other: "Overig",
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return "-"
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

export function formatCurrency(value?: number | string | null, currency = "EUR"): string {
  if (value === null || value === undefined || value === "") return "-"
  const amount = typeof value === "number" ? value : Number(value)
  if (Number.isNaN(amount)) return "-"
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function daysUntil(value?: string | Date | null): number {
  if (!value) return 0
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 0
  const now = new Date()
  const ms = date.getTime() - now.getTime()
  return Math.ceil(ms / (1000 * 60 * 60 * 24))
}

export function getExpiryBadgeClass(days: number): string {
  if (days < 0) return "bg-red-100 text-red-700"
  if (days <= 30) return "bg-amber-100 text-amber-700"
  if (days <= 90) return "bg-blue-100 text-blue-700"
  return "bg-emerald-100 text-emerald-700"
}
