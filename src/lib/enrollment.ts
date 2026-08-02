import { prisma } from '@/lib/prisma'
import { sessionsAllowedForCycle } from '@/lib/utils'

/**
 * How many times a class has been scheduled to occur so far this month —
 * used as the "assigned sessions" a coach is expected to have taught.
 * One-time classes count as 1 (on their session date) or 0 (before/after it).
 */
export function scheduledOccurrencesThisMonth(cls: { daysOfWeek: string[]; isOneTime?: boolean; sessionDate?: Date | string | null }): number {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  if (cls.isOneTime) {
    if (!cls.sessionDate) return 0
    const d = new Date(cls.sessionDate)
    return (d >= monthStart && d <= now) ? 1 : 0
  }
  const DOW = ['SUN','MON','TUE','WED','THU','FRI','SAT']
  let count = 0
  const cursor = new Date(monthStart)
  while (cursor <= now) {
    if (cls.daysOfWeek.includes(DOW[cursor.getDay()])) count++
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

/**
 * Generates the next sequential 8-digit fighter ID for a gym, starting at
 * 00002000. This ID doubles as the fighter's portal login, so it must be
 * unique per gym and never reused.
 */
export async function generateFighterId(gymId: string): Promise<string> {
  const last = await prisma.member.findFirst({
    where: { gymId },
    orderBy: { fighterId: 'desc' },
    select: { fighterId: true },
  })
  const next = last ? parseInt(last.fighterId, 10) + 1 : 2000
  return String(next).padStart(8, '0')
}

/**
 * A subscription ends when EITHER condition is met:
 *  1. the fighter has used up all sessions allotted for this cycle, or
 *  2. the cycle's day count has passed (today > endDate)
 * Whichever comes first. Call this whenever enrollments are read/listed so
 * status stays accurate without a background job.
 */
export async function checkAndExpireEnrollment(enrollment: { id: string; status: string; endDate: Date | null }, cls: { daysOfWeek: string[]; durationDays: number; isOneTime?: boolean }) {
  if (enrollment.status !== 'ACTIVE') return enrollment.status

  const daysPassed = enrollment.endDate ? new Date() > new Date(enrollment.endDate) : false

  const attended = await prisma.classAttendance.count({
    where: { enrollmentId: enrollment.id, status: 'ATTENDED' },
  })
  const sessionsAllowed = cls.isOneTime ? 1 : sessionsAllowedForCycle(cls.daysOfWeek.length, cls.durationDays)
  const sessionsUsedUp = sessionsAllowed > 0 && attended >= sessionsAllowed

  if (daysPassed || sessionsUsedUp) {
    await prisma.classEnrollment.update({ where: { id: enrollment.id }, data: { status: 'EXPIRED' } })
    return 'EXPIRED'
  }
  return 'ACTIVE'
}
