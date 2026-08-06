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
    // Cover-coach rows for this class are separate CoachAttendance rows (coachId = the
    // cover, not the assigned coach) — fetch them too so an absent-but-covered date
    // shows who covered instead of endlessly prompting to assign a cover.
    const coverMarks = await prisma.coachAttendance.findMany({
      where: { classId, assignedCoachId: cls.coachId, coachId: { not: cls.coachId! } },
      include: { coach: true },
    })
    const coverByDate = new Map(coverMarks.map(m => [startOfDay(m.date).toISOString(), { id: m.coach.id, name: `${m.coach.firstName} ${m.coach.lastName}` }]))
    const marksWithCover = marks.map(m => ({ ...m, coveredBy: coverByDate.get(startOfDay(m.date).toISOString()) || null }))

    return NextResponse.json({
      coach: { id: cls.coach.id, firstName: cls.coach.firstName, lastName: cls.coach.lastName },
      assigned, attended, missed: Math.max(0, assigned - attended), marks: marksWithCover,
    })
  }

  // Overview: every active coach, their classes scheduled today, and monthly totals across all their classes
  const coaches = await prisma.coach.findMany({ where: { gymId: gym.id, isActive: true }, include: { classes: { where: { status: 'APPROVED' } } }, orderBy: { firstName: 'asc' } })
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const today = startOfDay(new Date())

  // All of today's marks gym-wide, so we can tell — for any class — whether the
  // normally-assigned coach checked in themselves, was marked absent, or was covered
  // by someone else (and by whom).
  const todaysMarksAll = await prisma.coachAttendance.findMany({ where: { date: today, class: { gymId: gym.id } }, include: { coach: true } })
  const marksByClass = new Map<string, typeof todaysMarksAll>()
  for (const m of todaysMarksAll) marksByClass.set(m.classId, [...(marksByClass.get(m.classId) || []), m])

  const roster = await Promise.all(coaches.map(async coach => {
    const todaysClasses = coach.classes.filter(isScheduledToday)

    let assigned = 0, attended = 0
    for (const cls of coach.classes) {
      assigned += scheduledOccurrencesThisMonth(cls)
    }
    attended = await prisma.coachAttendance.count({ where: { coachId: coach.id, status: 'ATTENDED', date: { gte: monthStart }, class: { gymId: gym.id } } })

    return {
      coachId: coach.id, firstName: coach.firstName, lastName: coach.lastName,
      todaysClasses: todaysClasses.map(c => {
        const marksForClass = marksByClass.get(c.id) || []
        const ownMark = marksForClass.find(m => m.coachId === coach.id)
        const coverMark = marksForClass.find(m => m.assignedCoachId === coach.id && m.coachId !== coach.id)
        return {
          id: c.id, name: c.name,
          checkedIn: ownMark?.status === 'ATTENDED',
          absent: ownMark?.status === 'ABSENT',
          coveredBy: coverMark ? { id: coverMark.coach.id, name: `${coverMark.coach.firstName} ${coverMark.coach.lastName}` } : null,
        }
      }),
      assignedThisMonth: assigned, attendedThisMonth: attended, missedThisMonth: Math.max(0, assigned - attended),
    }
  }))

  return NextResponse.json(roster)
}

// POST — mark a coach's attendance for a class. If classId is omitted (QR scan),
// resolve it from classes scheduled for the coach today.
// Coach attendance may only be recorded by an Admin or Receptionist — from the
// receptionist/admin dashboard (manual check-in or QR/barcode scan). A coach can
// never check themselves in, including from their own dashboard/QR.
export async function POST(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym, user } = result

  if (user.role !== 'ADMIN' && user.role !== 'RECEPTIONIST') {
    return NextResponse.json({ error: 'Only reception or admin can record coach attendance. Coaches cannot check themselves in.' }, { status: 403 })
  }

  const body = await req.json()
  let { coachId, classId, status, method, coverCoachId } = body
  const date = body.date ? startOfDay(new Date(body.date)) : startOfDay(new Date())

  if (!coachId && !classId) return NextResponse.json({ error: 'coachId or classId required' }, { status: 400 })

  // Cover-coach path: classId + coverCoachId identify the session, and the cover coach
  // doesn't need to be the class's normally-assigned coach.
  if (coverCoachId) {
    if (!classId) return NextResponse.json({ error: 'classId required to assign a cover coach' }, { status: 400 })
    const cls = await prisma.gymClass.findFirst({ where: { id: classId, gymId: gym.id } })
    if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    const cover = await prisma.coach.findFirst({ where: { id: coverCoachId, gymId: gym.id } })
    if (!cover) return NextResponse.json({ error: 'Cover coach not found' }, { status: 404 })

    const assignedCoachId = cls.coachId || null
    // If the assigned coach already has a record for this session, remove it — they
    // must not receive attendance credit once a cover coach is assigned.
    if (assignedCoachId && assignedCoachId !== coverCoachId) {
      await prisma.coachAttendance.deleteMany({ where: { coachId: assignedCoachId, classId, date, status: 'ATTENDED' } })
    }
    const existingCover = await prisma.coachAttendance.findUnique({ where: { coachId_classId_date: { coachId: coverCoachId, classId, date } } })
    if (existingCover && existingCover.status === 'ATTENDED') {
      return NextResponse.json({ error: 'This coach is already marked attended for this session' }, { status: 409 })
    }
    const mark = await prisma.coachAttendance.upsert({
      where: { coachId_classId_date: { coachId: coverCoachId, classId, date } },
      update: { status: status || 'ATTENDED', method: method || 'MANUAL', markedById: user.id, markedAt: new Date(), assignedCoachId },
      create: { coachId: coverCoachId, classId, date, status: status || 'ATTENDED', method: method || 'MANUAL', markedById: user.id, assignedCoachId },
      include: { class: true, coach: true },
    })
    return NextResponse.json(mark)
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

  // At most one attendance record per class/session: if already marked ATTENDED,
  // refuse rather than silently overwriting/duplicating.
  const existing = await prisma.coachAttendance.findUnique({ where: { coachId_classId_date: { coachId, classId, date } } })
  if (existing && existing.status === 'ATTENDED') {
    return NextResponse.json({ error: 'This coach is already marked attended for this session' }, { status: 409 })
  }

  const mark = await prisma.coachAttendance.upsert({
    where: { coachId_classId_date: { coachId, classId, date } },
    update: { status: status || 'ATTENDED', method: method || 'MANUAL', markedById: user.id, markedAt: new Date(), assignedCoachId: coachId },
    create: { coachId, classId, date, status: status || 'ATTENDED', method: method || 'MANUAL', markedById: user.id, assignedCoachId: coachId },
    include: { class: true },
  })
  return NextResponse.json(mark)
}
