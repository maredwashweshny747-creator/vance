import { prisma } from '@/lib/prisma'
import { sessionsAllowedForCycle } from '@/lib/utils'

/**
 * How many sessions this enrollment allows in total. Private/session-based classes
 * are bounded by the sessions purchased. Group classes use the enrollment's ACTUAL
 * start->end span (not the class's nominal 30-day cycle) so a multi-month offer
 * scales correctly — e.g. 2x/week over a 3-month (90-day) offer = 2 × 4 × 3 = 24,
 * not the 1-month default of 8. This is the single source of truth for that math —
 * both the expiry check and the fighters-page "remaining sessions" display use it,
 * so they can never drift out of sync with each other again.
 */
export function sessionsAllowedForEnrollment(
  enrollment: { startDate: Date | string; endDate: Date | string | null; sessionCount?: number | null; totalSessions?: number | null },
  cls: { daysOfWeek: string[]; durationDays: number; isOneTime?: boolean; type?: string }
): number {
  if (cls.type === 'PRIVATE') return enrollment.sessionCount || 0
  if (cls.isOneTime) return 1
  if (enrollment.totalSessions != null) return enrollment.totalSessions
  // Fallback for enrollments created before totalSessions existed — derive from the
  // span. Not excuse-safe, but only hit for legacy rows.
  const spanDays = enrollment.endDate
    ? Math.round((new Date(enrollment.endDate).getTime() - new Date(enrollment.startDate).getTime()) / 86400000)
    : cls.durationDays
  return sessionsAllowedForCycle(cls.daysOfWeek.length, spanDays)
}

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
/**
 * Batched version of checkAndExpireEnrollment for list pages (fighters roster, portal,
 * etc.) where the naive per-enrollment version was doing N sequential DB round-trips
 * (one count() + maybe one update() PER enrollment, awaited one at a time in a loop) —
 * for a roster of a few hundred fighters with ~1.3 enrollments each that's 300+ blocking
 * queries on every single page load, which is the main reason those pages were slow.
 * This does it in exactly 2 queries total: one groupBy for every enrollment's attended
 * count, one updateMany for whichever ones need to flip to EXPIRED.
 */
export async function checkAndExpireEnrollmentsBatch(
  enrollments: { id: string; status: string; startDate: Date; endDate: Date | null; sessionCount?: number | null; totalSessions?: number | null; class: { daysOfWeek: string[]; durationDays: number; isOneTime?: boolean; type?: string } }[]
): Promise<Map<string, string>> {
  const statusMap = new Map<string, string>()
  const activeOnes = enrollments.filter(e => e.status === 'ACTIVE')
  if (activeOnes.length === 0) {
    for (const e of enrollments) statusMap.set(e.id, e.status)
    return statusMap
  }

  // A session only "uses up" one of the fighter's allotted sessions if they attended it
  // or were absent WITHOUT an excuse — an excused session doesn't count against them
  // (their cycle's endDate gets pushed out by one occurrence separately, see class-attendance POST).
  const counts = await prisma.classAttendance.groupBy({
    by: ['enrollmentId'],
    where: { enrollmentId: { in: activeOnes.map(e => e.id) }, status: { in: ['ATTENDED', 'ABSENT'] } },
    _count: { _all: true },
  })
  const countMap = new Map<string, number>(counts.map((c: any) => [c.enrollmentId, c._count._all as number]))

  const now = new Date()
  const toExpire: string[] = []
  for (const e of enrollments) {
    if (e.status !== 'ACTIVE') { statusMap.set(e.id, e.status); continue }
    const daysPassed = e.endDate ? now > new Date(e.endDate) : false
    const usedSlots = countMap.get(e.id) || 0
    const sessionsAllowed = sessionsAllowedForEnrollment(e, e.class)
    const sessionsUsedUp = sessionsAllowed > 0 && usedSlots >= sessionsAllowed
    if (daysPassed || sessionsUsedUp) { toExpire.push(e.id); statusMap.set(e.id, 'EXPIRED') }
    else statusMap.set(e.id, 'ACTIVE')
  }

  if (toExpire.length > 0) {
    await prisma.classEnrollment.updateMany({ where: { id: { in: toExpire } }, data: { status: 'EXPIRED' } })
  }
  return statusMap
}

export async function checkAndExpireEnrollment(enrollment: { id: string; status: string; startDate: Date; endDate: Date | null; sessionCount?: number | null; totalSessions?: number | null }, cls: { daysOfWeek: string[]; durationDays: number; isOneTime?: boolean; type?: string }) {
  if (enrollment.status !== 'ACTIVE') return enrollment.status

  const daysPassed = enrollment.endDate ? new Date() > new Date(enrollment.endDate) : false

  const usedSlots = await prisma.classAttendance.count({
    where: { enrollmentId: enrollment.id, status: { in: ['ATTENDED', 'ABSENT'] } },
  })
  const sessionsAllowed = sessionsAllowedForEnrollment(enrollment, cls)
  const sessionsUsedUp = sessionsAllowed > 0 && usedSlots >= sessionsAllowed

  if (daysPassed || sessionsUsedUp) {
    await prisma.classEnrollment.update({ where: { id: enrollment.id }, data: { status: 'EXPIRED' } })
    return 'EXPIRED'
  }
  return 'ACTIVE'
}
