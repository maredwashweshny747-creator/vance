import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkAndExpireEnrollmentsBatch } from '@/lib/enrollment'
import { getEnrollmentSessions } from '@/lib/enrollmentSessions'

// Public portal - fighter accesses via their fighter ID (no auth needed, just fighterId+gymSlug)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fighterId = searchParams.get('fighterId')
  const gymSlug = searchParams.get('gym')
  if (!fighterId || !gymSlug) return NextResponse.json({ error: 'fighterId and gym required' }, { status: 400 })
  const gym = await prisma.gym.findUnique({ where: { slug: gymSlug } })
  if (!gym) return NextResponse.json({ error: 'Gym not found' }, { status: 404 })
  const member = await prisma.member.findFirst({
    where: { gymId: gym.id, fighterId },
    include: {
      enrollments: { include: { class: { include: { coach: true } } }, orderBy: { createdAt: 'asc' } },
      workoutPlans: { where: { isActive: true }, include: { exercises: true }, take: 1 },
      progress: { orderBy: { recordedAt: 'desc' }, take: 5 },
    },
  })
  if (!member) return NextResponse.json({ error: 'Fighter ID not found' }, { status: 404 })

  const statusMap = await checkAndExpireEnrollmentsBatch(member.enrollments)
  for (const e of member.enrollments) (e as any).status = statusMap.get(e.id) || e.status

  // Sessions calendar per class — real dates, not just a remaining count.
  const enrollmentsWithSessions = await Promise.all(member.enrollments.map(async (e: any) => {
    const sessions = await getEnrollmentSessions(e)
    return { ...e, sessions }
  }))
  ;(member as any).enrollments = enrollmentsWithSessions

  const recentAttendance = await prisma.classAttendance.findMany({
    where: { memberId: member.id }, include: { class: true }, orderBy: { date: 'desc' }, take: 10,
  })

  return NextResponse.json({ member, gym: { name: gym.name, slug: gym.slug }, recentAttendance })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (body._type === 'add_progress') {
    const progress = await prisma.memberProgress.create({ data: { memberId: body.memberId, weight: body.weight, bodyFat: body.bodyFat, waist: body.waist, notes: body.notes } })
    return NextResponse.json(progress)
  }
  if (body._type === 'submit_feedback') {
    if (!body.message || !String(body.message).trim()) return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    const member = await prisma.member.findUnique({ where: { id: body.memberId }, select: { gymId: true } })
    if (!member) return NextResponse.json({ error: 'Fighter not found' }, { status: 404 })
    const feedback = await prisma.fighterFeedback.create({
      data: { gymId: member.gymId, memberId: body.memberId, message: String(body.message).trim() },
    })
    return NextResponse.json(feedback)
  }
  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}
