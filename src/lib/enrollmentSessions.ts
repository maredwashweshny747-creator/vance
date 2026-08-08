import { prisma } from '@/lib/prisma'
import { generateSessionDates } from '@/lib/sessions'
import { sessionsAllowedForEnrollment } from '@/lib/enrollment'

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
function startOfDayISO(d: Date | string) { return startOfDay(new Date(d)).toISOString() }

export async function getEnrollmentSessions(enr: any) {
  const marks = await prisma.classAttendance.findMany({ where: { enrollmentId: enr.id }, orderBy: { date: 'asc' } })
  const markByDate = new Map<string, any>(marks.map((m: any) => [startOfDayISO(m.date), m]))

  if (enr.class.type === 'PRIVATE') {
    const total = enr.sessionCount || 0
    const attendedCount = marks.filter((m: any) => m.status === 'ATTENDED').length
    const sessions = marks.map((m: any) => ({ date: m.date, status: m.status, reason: m.reason || null }))
    return { isPrivate: true, sessionsAllowed: total, attended: attendedCount, remaining: Math.max(0, total - attendedCount), sessions }
  }

  const today = startOfDay(new Date())
  const rangeEnd = enr.endDate ? new Date(enr.endDate) : today
  const dates = generateSessionDates(enr.class, enr.startDate, rangeEnd)

  const sessions = dates.map(d => {
    const mark = markByDate.get(startOfDayISO(d))
    let status: string
    if (mark) status = mark.status
    else status = d > today ? 'UPCOMING' : 'MISSED' // past + unmarked reads as a missed session
    return { date: d, status, reason: mark?.reason || null }
  })

  const attended = sessions.filter(s => s.status === 'ATTENDED').length
  const absentUnexcused = sessions.filter(s => s.status === 'ABSENT').length
  const sessionsAllowed = sessionsAllowedForEnrollment(enr, enr.class)
  return { isPrivate: false, sessionsAllowed, attended, remaining: Math.max(0, sessionsAllowed - attended - absentUnexcused), sessions }
}
