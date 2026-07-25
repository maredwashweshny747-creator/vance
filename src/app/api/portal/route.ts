import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkAndExpireEnrollment } from '@/lib/enrollment'

// Public portal - member accesses via email lookup (no auth needed, just email+gymSlug)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')
  const gymSlug = searchParams.get('gym')
  if (!email || !gymSlug) return NextResponse.json({ error: 'email and gym required' }, { status: 400 })
  const gym = await prisma.gym.findUnique({ where: { slug: gymSlug } })
  if (!gym) return NextResponse.json({ error: 'Gym not found' }, { status: 404 })
  const member = await prisma.member.findFirst({
    where: { gymId: gym.id, email },
    include: {
      enrollments: { include: { class: { include: { coach: true } } }, orderBy: { createdAt: 'asc' } },
      workoutPlans: { where: { isActive: true }, include: { exercises: true }, take: 1 },
      progress: { orderBy: { recordedAt: 'desc' }, take: 5 },
    },
  })
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  for (const e of member.enrollments) await checkAndExpireEnrollment(e, e.class)

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
  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}
