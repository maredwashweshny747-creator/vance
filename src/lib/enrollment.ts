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
  // A single atomic `UPDATE ... SET seq = seq + 1` is safe under concurrency: Postgres
  // takes a row lock for the duration of the update, so two simultaneous fighter
  // creations can never read/increment the same starting value and collide.
  const gym = await prisma.gym.update({
    where: { id: gymId },
    data: { fighterIdSeq: { increment: 1 } },
    select: { fighterIdSeq: true, fighterIdPrefix: true },
  })
  return `${gym.fighterIdPrefix}${String(gym.fighterIdSeq).padStart(4, '0')}`
}

/**
 * A subscription ends when EITHER condition is met:
 *  1. the fighter has used up all sessions allotted for this cycle, or
 *  2. the cycle's day count has passed (today > endDate)
 * Whichever comes first. Call this whenever enrollments are read/listed so
 * status stays accurate without a background job.
 */
export async function checkAndExpireEnrollment(enrollment: { id: string; status: string; startDate: Date; endDate: Date | null; sessionCount?: number | null }, cls: { daysOfWeek: string[]; durationDays: number; isOneTime?: boolean; type?: string }) {
  if (enrollment.status !== 'ACTIVE') return enrollment.status

  const daysPassed = enrollment.endDate ? new Date() > new Date(enrollment.endDate) : false

  const attended = await prisma.classAttendance.count({
    where: { enrollmentId: enrollment.id, status: 'ATTENDED' },
  })
  // Private/session-based classes are bounded by the sessions purchased, not a weekly schedule.
  // Group classes use the enrollment's actual start->end span (not the class's nominal
  // 30-day cycle) so a multi-month offer correctly scales the total — e.g. 2x/week over a
  // 3-month (90-day) offer = 2 × 4 × 3 = 24, not the 1-month default.
  const spanDays = enrollment.endDate
    ? Math.round((new Date(enrollment.endDate).getTime() - new Date(enrollment.startDate).getTime()) / 86400000)
    : cls.durationDays
  const sessionsAllowed = cls.type === 'PRIVATE'
    ? (enrollment.sessionCount || 0)
    : cls.isOneTime ? 1 : sessionsAllowedForCycle(cls.daysOfWeek.length, spanDays)
  const sessionsUsedUp = sessionsAllowed > 0 && attended >= sessionsAllowed

  if (daysPassed || sessionsUsedUp) {
    await prisma.classEnrollment.update({ where: { id: enrollment.id }, data: { status: 'EXPIRED' } })
    return 'EXPIRED'
  }
  return 'ACTIVE'
}
