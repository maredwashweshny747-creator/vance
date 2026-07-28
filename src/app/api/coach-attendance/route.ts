import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym } from '@/lib/getGym'

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x }

// GET: today's coach check-in status for the whole gym (admin/receptionist view),
// or just the calling coach's own status (?mine=true)
export async function GET(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym, user } = result
  const mine = new URL(req.url).searchParams.get('mine')
  const today = startOfDay(new Date())

  if (mine === 'true') {
    if (user.role !== 'COACH') return NextResponse.json({ error: 'Coach only' }, { status: 403 })
    const coach = await prisma.coach.findFirst({ where: { gymId: gym.id, userId: user.id } })
    if (!coach) return NextResponse.json({ error: 'Coach profile not found' }, { status: 404 })
    const mark = await prisma.coachAttendance.findFirst({ where: { coachId: coach.id, date: today } })
    return NextResponse.json({ checkedIn: !!mark, checkedInAt: mark?.checkedIn || null })
  }

  const coaches = await prisma.coach.findMany({ where: { gymId: gym.id, isActive: true }, orderBy: { firstName: 'asc' } })
  const marks = await prisma.coachAttendance.findMany({ where: { coachId: { in: coaches.map(c => c.id) }, date: today } })
  const markByCoachId = new Map(marks.map(m => [m.coachId, m]))
  const roster = coaches.map(c => ({
    coachId: c.id, firstName: c.firstName, lastName: c.lastName,
    checkedIn: markByCoachId.has(c.id), checkedInAt: markByCoachId.get(c.id)?.checkedIn || null,
  }))
  return NextResponse.json(roster)
}

// POST: check in a coach for today
export async function POST(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym, user } = result
  const body = await req.json()
  let coachId = body.coachId

  // A coach checking themself in doesn't need to pass coachId
  if (!coachId && user.role === 'COACH') {
    const coach = await prisma.coach.findFirst({ where: { gymId: gym.id, userId: user.id } })
    if (!coach) return NextResponse.json({ error: 'Coach profile not found' }, { status: 404 })
    coachId = coach.id
  }
  if (!coachId) return NextResponse.json({ error: 'coachId required' }, { status: 400 })

  const coach = await prisma.coach.findFirst({ where: { id: coachId, gymId: gym.id } })
  if (!coach) return NextResponse.json({ error: 'Coach not found' }, { status: 404 })

  const today = startOfDay(new Date())
  const existing = await prisma.coachAttendance.findFirst({ where: { coachId, date: today } })
  if (existing) return NextResponse.json({ error: 'Already checked in today' }, { status: 409 })

  const mark = await prisma.coachAttendance.create({
    data: { coachId, date: today, method: body.method || 'MANUAL', markedById: user.id },
  })
  return NextResponse.json(mark)
}
