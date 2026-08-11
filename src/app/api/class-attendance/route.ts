import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym } from '@/lib/getGym'
import { checkAndExpireEnrollment, checkAndExpireEnrollmentsBatch } from '@/lib/enrollment'

import { generateSessionDates, nextScheduledDate } from '@/lib/sessions'

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x }
// Parses a plain "YYYY-MM-DD" date string as UTC midnight, immune to server timezone.
function parseDateOnly(input: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(input)
  if (m) return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return startOfDay(new Date(input))
}

// GET ?classId=X&month=M&year=Y — every session date this class has this month, with a
// quick "has attendance been taken" signal, so Manage Attendance can show a session
// picker instead of just prev/next day navigation.
async function monthOverview(gym: { id: string }, classId: string, month: number, year: number) {
  const cls = await prisma.gymClass.findFirst({ where: { id: classId, gymId: gym.id } })
  if (!cls) return null
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0)
  const dates = generateSessionDates(cls, monthStart, monthEnd)

  const marks = await prisma.classAttendance.groupBy({
    by: ['date'],
    where: { classId, date: { gte: monthStart, lte: monthEnd } },
    _count: { _all: true },
  })
  const markedCountByDate = new Map<string, number>(marks.map((m: any) => [startOfDay(m.date).toISOString(), m._count._all as number]))

  const coachMarks = cls.coachId
    ? await prisma.coachAttendance.findMany({ where: { classId, date: { gte: monthStart, lte: monthEnd } } })
    : []
  const coachByDate = new Map<string, any>(coachMarks.map((m: any) => [startOfDay(m.date).toISOString(), m]))

  return {
    class: cls,
    sessions: dates.map(d => {
      const key = d.toISOString()
      const coachMark = coachByDate.get(key)
      return {
        date: d,
        attendanceTaken: (markedCountByDate.get(key) || 0) > 0,
        markedCount: markedCountByDate.get(key) || 0,
        coachStatus: coachMark?.status || null,
        coachCovered: coachMark && coachMark.assignedCoachId && coachMark.assignedCoachId !== coachMark.coachId,
      }
    }),
  }
}

// GET ?classId=X&date=YYYY-MM-DD — the class roster for that date: every fighter
// currently signed into the class, with their mark for that date if one exists.
export async function GET(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const { searchParams } = new URL(req.url)
  const classId = searchParams.get('classId')
  const dateParam = searchParams.get('date')
  const monthParam = searchParams.get('month')
  const yearParam = searchParams.get('year')
  if (!classId) return NextResponse.json({ error: 'classId required' }, { status: 400 })

  if (monthParam && yearParam) {
    const overview = await monthOverview(gym, classId, parseInt(monthParam, 10), parseInt(yearParam, 10))
    if (!overview) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    return NextResponse.json(overview)
  }

  const cls = await prisma.gymClass.findFirst({ where: { id: classId, gymId: gym.id } })
  if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })

  const date = startOfDay(dateParam ? new Date(dateParam) : new Date())
  const nextDay = new Date(date); nextDay.setDate(nextDay.getDate() + 1)

  const enrollments = await prisma.classEnrollment.findMany({
    where: { classId, status: 'ACTIVE' },
    include: { member: true },
    orderBy: { member: { firstName: 'asc' } },
  })

  // keep statuses accurate (auto-expire where needed) before returning the roster — batched
  // into 2 queries total instead of one round-trip per enrollment.
  const statusMap = await checkAndExpireEnrollmentsBatch(enrollments.map(e => ({ ...e, class: cls })))
  for (const e of enrollments) (e as any).status = statusMap.get(e.id) || e.status

  const marks = await prisma.classAttendance.findMany({
    where: { classId, date: { gte: date, lt: nextDay } },
  })
  const markByEnrollment = new Map(marks.map(m => [m.enrollmentId, m]))

  const roster = enrollments
    .filter(e => e.status === 'ACTIVE')
    .map(e => ({
      enrollmentId: e.id,
      member: { id: e.member.id, firstName: e.member.firstName, lastName: e.member.lastName, photo: e.member.photo },
      status: e.status,
      mark: markByEnrollment.get(e.id) || null,
    }))

  return NextResponse.json({ class: cls, date: date.toISOString(), roster })
}

// POST — mark (or update) a fighter's attendance for a class on a specific date
export async function POST(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym, user } = result
  const body = await req.json()
  const { enrollmentId, date, status, reason, method } = body
  if (!enrollmentId || !date || !status) return NextResponse.json({ error: 'enrollmentId, date, and status are required' }, { status: 400 })
  if (!['ATTENDED', 'ABSENT', 'EXCUSED'].includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const enr = await prisma.classEnrollment.findFirst({ where: { id: enrollmentId, member: { gymId: gym.id } }, include: { class: true } })
  if (!enr) return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })

  const day = parseDateOnly(date)

  const mark = await prisma.classAttendance.upsert({
    where: { enrollmentId_date: { enrollmentId, date: day } },
    update: { status, reason: reason || null, method: method || 'ROSTER', markedById: user.id, markedAt: new Date() },
    create: { classId: enr.classId, enrollmentId, memberId: enr.memberId, date: day, status, reason: reason || null, method: method || 'ROSTER', markedById: user.id },
  })

  // Excused sessions don't cost the fighter a session — push their cycle out by exactly
  // one scheduled occurrence so they still get their full session count, just later.
  // (Re-excusing the same date twice is a no-op: nextScheduledDate always extends from
  // the *current* endDate, not from the excused date itself.)
  if (status === 'EXCUSED') {
    const next = nextScheduledDate(enr.class, enr.endDate ? new Date(enr.endDate) : day)
    if (next) await prisma.classEnrollment.update({ where: { id: enr.id }, data: { endDate: next } })
  }

  // an ATTENDED/ABSENT mark can push the fighter over their session cap — check right away
  await checkAndExpireEnrollment(enr, enr.class)

  return NextResponse.json(mark)
}
