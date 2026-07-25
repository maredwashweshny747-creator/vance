import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym } from '@/lib/getGym'
import { checkAndExpireEnrollment } from '@/lib/enrollment'

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x }

// GET ?classId=X&date=YYYY-MM-DD — the class roster for that date: every fighter
// currently signed into the class, with their mark for that date if one exists.
export async function GET(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const { searchParams } = new URL(req.url)
  const classId = searchParams.get('classId')
  const dateParam = searchParams.get('date')
  if (!classId) return NextResponse.json({ error: 'classId required' }, { status: 400 })

  const cls = await prisma.gymClass.findFirst({ where: { id: classId, gymId: gym.id } })
  if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })

  const date = startOfDay(dateParam ? new Date(dateParam) : new Date())
  const nextDay = new Date(date); nextDay.setDate(nextDay.getDate() + 1)

  const enrollments = await prisma.classEnrollment.findMany({
    where: { classId, status: { in: ['ACTIVE', 'FROZEN'] } },
    include: { member: true },
    orderBy: { member: { firstName: 'asc' } },
  })

  // keep statuses accurate (auto-expire where needed) before returning the roster
  for (const e of enrollments) await checkAndExpireEnrollment(e, cls)

  const marks = await prisma.classAttendance.findMany({
    where: { classId, date: { gte: date, lt: nextDay } },
  })
  const markByEnrollment = new Map(marks.map(m => [m.enrollmentId, m]))

  const roster = enrollments
    .filter(e => e.status === 'ACTIVE' || e.status === 'FROZEN')
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

  const day = startOfDay(new Date(date))

  const mark = await prisma.classAttendance.upsert({
    where: { enrollmentId_date: { enrollmentId, date: day } },
    update: { status, reason: reason || null, method: method || 'ROSTER', markedById: user.id, markedAt: new Date() },
    create: { classId: enr.classId, enrollmentId, memberId: enr.memberId, date: day, status, reason: reason || null, method: method || 'ROSTER', markedById: user.id },
  })

  // an ATTENDED mark can push the fighter over their session cap — check right away
  await checkAndExpireEnrollment(enr, enr.class)

  return NextResponse.json(mark)
}
