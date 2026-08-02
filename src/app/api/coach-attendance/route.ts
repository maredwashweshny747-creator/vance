import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym } from '@/lib/getGym'
import { scheduledOccurrencesThisMonth } from '@/lib/enrollment'

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x }
const DOW = ['SUN','MON','TUE','WED','THU','FRI','SAT']

function isScheduledToday(cls: { daysOfWeek: string[]; isOneTime: boolean; sessionDate: Date | null }) {
  const today = startOfDay(new Date())
  if (cls.isOneTime) return cls.sessionDate && startOfDay(new Date(cls.sessionDate)).getTime() === today.getTime()
  return cls.daysOfWeek.includes(DOW[today.getDay()])
}

// GET ?classId=X — this class's coach + their attended/missed record this month
//     (no params)  — every coach's classes scheduled today + monthly attended/missed totals
export async function GET(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const classId = new URL(req.url).searchParams.get('classId')

  if (classId) {
    const cls = await prisma.gymClass.findFirst({ where: { id: classId, gymId: gym.id }, include: { coach: true } })
    if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    if (!cls.coach) return NextResponse.json({ coach: null })

    const assigned = scheduledOccurrencesThisMonth(cls)
    const attended = await prisma.coachAttendance.count({ where: { coachId: cls.coachId!, classId, status: 'ATTENDED', date: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } })
    const marks = await prisma.coachAttendance.findMany({ where: { coachId: cls.coachId!, classId }, orderBy: { date: 'desc' } })

    return NextResponse.json({
      coach: { id: cls.coach.id, firstName: cls.coach.firstName, lastName: cls.coach.lastName },
      assigned, attended, missed: Math.max(0, assigned - attended), marks,
    })
  }

  // Overview: every active coach, their classes scheduled today, and monthly totals across all their classes
  const coaches = await prisma.coach.findMany({ where: { gymId: gym.id, isActive: true }, include: { classes: { where: { status: 'APPROVED' } } }, orderBy: { firstName: 'asc' } })
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)

  const roster = await Promise.all(coaches.map(async coach => {
    const todaysClasses = coach.classes.filter(isScheduledToday)
    const todaysMarks = await prisma.coachAttendance.findMany({ where: { coachId: coach.id, date: startOfDay(new Date()) } })
    const markedClassIds = new Set(todaysMarks.map(m => m.classId))

    let assigned = 0, attended = 0
    for (const cls of coach.classes) {
      assigned += scheduledOccurrencesThisMonth(cls)
    }
    attended = await prisma.coachAttendance.count({ where: { coachId: coach.id, status: 'ATTENDED', date: { gte: monthStart }, class: { gymId: gym.id } } })

    return {
      coachId: coach.id, firstName: coach.firstName, lastName: coach.lastName,
      todaysClasses: todaysClasses.map(c => ({ id: c.id, name: c.name, checkedIn: markedClassIds.has(c.id) })),
      assignedThisMonth: assigned, attendedThisMonth: attended, missedThisMonth: Math.max(0, assigned - attended),
    }
  }))

  return NextResponse.json(roster)
}

// POST — mark a coach's attendance for a class. If classId is omitted (QR scan),
// resolve it from classes scheduled for the coach today.
export async function POST(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym, user } = result
  const body = await req.json()
  let { coachId, classId, status, method } = body
  const date = body.date ? startOfDay(new Date(body.date)) : startOfDay(new Date())

  if (!coachId && user.role === 'COACH') {
    const coach = await prisma.coach.findFirst({ where: { gymId: gym.id, userId: user.id } })
    if (!coach) return NextResponse.json({ error: 'Coach profile not found' }, { status: 404 })
    coachId = coach.id
  }
  if (!coachId) return NextResponse.json({ error: 'coachId required' }, { status: 400 })

  const coach = await prisma.coach.findFirst({ where: { id: coachId, gymId: gym.id }, include: { classes: { where: { status: 'APPROVED' } } } })
  if (!coach) return NextResponse.json({ error: 'Coach not found' }, { status: 404 })

  if (!classId) {
    const scheduledToday = coach.classes.filter(isScheduledToday)
    if (scheduledToday.length === 0) return NextResponse.json({ error: 'No classes scheduled for this coach today' }, { status: 400 })
    if (scheduledToday.length > 1) return NextResponse.json({ error: 'MULTIPLE_CLASSES', classes: scheduledToday.map(c => ({ id: c.id, name: c.name })) }, { status: 409 })
    classId = scheduledToday[0].id
  } else if (!coach.classes.some(c => c.id === classId)) {
    return NextResponse.json({ error: 'That class is not assigned to this coach' }, { status: 400 })
  }

  const mark = await prisma.coachAttendance.upsert({
    where: { coachId_classId_date: { coachId, classId, date } },
    update: { status: status || 'ATTENDED', method: method || 'MANUAL', markedById: user.id, markedAt: new Date() },
    create: { coachId, classId, date, status: status || 'ATTENDED', method: method || 'MANUAL', markedById: user.id },
    include: { class: true },
  })
  return NextResponse.json(mark)
}
