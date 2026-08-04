import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Egyptian mobile numbers: 010/011/012/015 followed by exactly 8 digits (11 digits total).
export const EGYPT_PHONE_REGEX = /^01[0125]\d{8}$/

export function isValidEgyptPhone(phone: string): boolean {
  return EGYPT_PHONE_REGEX.test(phone.trim())
}

export function phoneValidationError(phone: string): string | null {
  const trimmed = phone.trim()
  if (!trimmed) return null // empty is allowed — phone itself is optional, this only checks format
  if (!/^\d+$/.test(trimmed)) return 'Phone number must contain digits only.'
  if (trimmed.length !== 11) return 'Phone number must be exactly 11 digits.'
  if (!/^01[0125]/.test(trimmed)) return 'Phone number must start with 010, 011, 012, or 015.'
  if (!EGYPT_PHONE_REGEX.test(trimmed)) return 'Enter a valid Egyptian mobile number (e.g. 01012345678).'
  return null
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'EGP') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount)
}

export function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const membershipColors: Record<string, string> = {
  ACTIVE: 'text-primary-400 bg-primary-400/10 border-primary-400/20',
  EXPIRED: 'text-red-400 bg-red-400/10 border-red-400/20',
  FROZEN: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  CANCELED: 'text-gray-400 bg-gray-400/10 border-gray-400/20',
  NO_PLAN: 'text-dark-400 bg-dark-700 border-dark-600',
}

export const paymentColors: Record<string, string> = {
  COMPLETED: 'text-primary-400 bg-primary-400/10 border-primary-400/20',
  PENDING: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  FAILED: 'text-red-400 bg-red-400/10 border-red-400/20',
  REFUNDED: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
}

/** Total sessions allotted for one billing cycle, given how many days/week a class meets. */
export function sessionsAllowedForCycle(daysPerWeek: number, durationDays: number) {
  if (daysPerWeek <= 0) return 0
  // Each billing month is treated as a flat 4 weeks (not real calendar days / 7) —
  // e.g. 2 sessions/week × 4 × 1 month = 8, × 3 months (a 90-day offer) = 24.
  const months = durationDays / 30
  return Math.round(daysPerWeek * 4 * months)
}

/** Builds a wa.me link from a phone number, stripping everything but digits and a leading +. */
export function normalizeEgyptPhone(phone: string): string | null {
  // Strip everything except digits (drops spaces, dashes, parentheses, plus signs)
  let digits = phone.replace(/\D/g, '')
  if (!digits) return null
  // Duplicate/leading country code typed as 0020...
  if (digits.startsWith('0020')) digits = digits.slice(2)
  // Local format: 01012345678 (11 digits, starts 010/011/012/015) -> drop the leading 0, add 20
  if (/^01[0125]\d{8}$/.test(digits)) return `20${digits.slice(1)}`
  // Already has the country code, with or without the leading 0: 201012345678 or 2001012345678
  if (/^2001[0125]\d{8}$/.test(digits)) return `20${digits.slice(3)}`
  if (/^201[0125]\d{8}$/.test(digits)) return digits
  // Not a recognizable Egyptian mobile number — fall back to whatever digits we have
  return digits
}

export function whatsappLink(phone?: string | null, message?: string | null) {
  if (!phone) return null
  const cleaned = normalizeEgyptPhone(phone)
  if (!cleaned) return null
  return message ? `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}` : `https://wa.me/${cleaned}`
}

export const DAYS_OF_WEEK = ['MON','TUE','WED','THU','FRI','SAT','SUN']
export const DAY_LABELS: Record<string,string> = { MON:'Mon', TUE:'Tue', WED:'Wed', THU:'Thu', FRI:'Fri', SAT:'Sat', SUN:'Sun' }
