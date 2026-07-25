import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
      membershipPlan: true,
      checkIns: { orderBy: { checkedIn: 'desc' }, take: 10 },
      classBookings: { include: { class: true }, orderBy: { bookedAt: 'desc' }, take: 5 },
      workoutPlans: { where: { isActive: true }, include: { exercises: true }, take: 1 },
      progress: { orderBy: { recordedAt: 'desc' }, take: 5 },
    },
  })
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  const upcomingClasses = await prisma.gymClass.findMany({
    where: { gymId: gym.id, status: 'APPROVED', startTime: { gte: new Date() } },
    include: { coach: true },
    orderBy: { startTime: 'asc' },
    take: 10,
  })
  return NextResponse.json({ member, gym: { name: gym.name, slug: gym.slug }, upcomingClasses })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (body._type === 'book_class') {
    const cls = await prisma.gymClass.findUnique({ where: { id: body.classId } })
    if (!cls || cls.status !== 'APPROVED') return NextResponse.json({ error: 'This class is not open for booking' }, { status: 400 })
    const existing = await prisma.classBooking.findFirst({ where: { classId: body.classId, memberId: body.memberId } })
    if (existing) return NextResponse.json({ error: 'Already booked' }, { status: 409 })
    const booking = await prisma.classBooking.create({ data: { classId: body.classId, memberId: body.memberId } })
    return NextResponse.json(booking)
  }
  if (body._type === 'add_progress') {
    const progress = await prisma.memberProgress.create({ data: { memberId: body.memberId, weight: body.weight, bodyFat: body.bodyFat, waist: body.waist, notes: body.notes } })
    return NextResponse.json(progress)
  }
  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}
