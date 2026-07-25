import { prisma } from '@/lib/prisma'
import { sessionsAllowedForCycle } from '@/lib/utils'

/**
 * A subscription ends when EITHER condition is met:
 *  1. the fighter has used up all sessions allotted for this cycle, or
 *  2. the cycle's day count has passed (today > endDate)
 * Whichever comes first. Call this whenever enrollments are read/listed so
 * status stays accurate without a background job.
 */
export async function checkAndExpireEnrollment(enrollment: { id: string; status: string; endDate: Date | null }, cls: { daysOfWeek: string[]; durationDays: number }) {
  if (enrollment.status !== 'ACTIVE') return enrollment.status

  const daysPassed = enrollment.endDate ? new Date() > new Date(enrollment.endDate) : false

  const attended = await prisma.classAttendance.count({
    where: { enrollmentId: enrollment.id, status: 'ATTENDED' },
  })
  const sessionsAllowed = sessionsAllowedForCycle(cls.daysOfWeek.length, cls.durationDays)
  const sessionsUsedUp = sessionsAllowed > 0 && attended >= sessionsAllowed

  if (daysPassed || sessionsUsedUp) {
    await prisma.classEnrollment.update({ where: { id: enrollment.id }, data: { status: 'EXPIRED' } })
    return 'EXPIRED'
  }
  return 'ACTIVE'
}
