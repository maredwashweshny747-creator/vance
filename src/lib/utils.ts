import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

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
  return Math.round(daysPerWeek * (durationDays / 7))
}

/** Builds a wa.me link from a phone number, stripping everything but digits and a leading +. */
export function whatsappLink(phone?: string | null, message?: string | null) {
  if (!phone) return null
  const cleaned = phone.replace(/[^\d+]/g, '').replace(/^\+/, '')
  if (!cleaned) return null
  return message ? `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}` : `https://wa.me/${cleaned}`
}

export const DAYS_OF_WEEK = ['MON','TUE','WED','THU','FRI','SAT','SUN']
export const DAY_LABELS: Record<string,string> = { MON:'Mon', TUE:'Tue', WED:'Wed', THU:'Thu', FRI:'Fri', SAT:'Sat', SUN:'Sun' }
