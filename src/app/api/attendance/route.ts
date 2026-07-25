import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym } from '@/lib/getGym'


// GET: list today's check-ins + members for manual check-in
export async function GET(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result

  const { searchParams } = new URL(req.url)
  const view = searchParams.get('view') // 'today' | 'members'

  if (view === 'members') {
    const members = await prisma.member.findMany({
      where: { gymId: gym.id, membershipStatus: 'ACTIVE' },
      orderBy: [{ firstName: 'asc' }],
    })
    return NextResponse.json(members)
  }

  // Today's check-ins
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const checkIns = await prisma.checkIn.findMany({
    where: {
      member: { gymId: gym.id },
      checkedIn: { gte: today, lt: tomorrow },
    },
    include: { member: true },
    orderBy: { checkedIn: 'desc' },
  })

  // Weekly stats
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const weeklyCheckIns = await prisma.checkIn.count({
    where: { member: { gymId: gym.id }, checkedIn: { gte: weekAgo } },
  })

  // Inactive members (no check-in in 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const recentlyActive = await prisma.checkIn.findMany({
    where: { member: { gymId: gym.id }, checkedIn: { gte: thirtyDaysAgo } },
    select: { memberId: true },
    distinct: ['memberId'],
  })
  const activeIds = recentlyActive.map(c => c.memberId)
  const inactiveCount = await prisma.member.count({
    where: { gymId: gym.id, membershipStatus: 'ACTIVE', id: { notIn: activeIds } },
  })

  return NextResponse.json({ checkIns, todayCount: checkIns.length, weeklyCheckIns, inactiveCount })
}

// POST: log a check-in
export async function POST(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result

  const { memberId, method = 'MANUAL' } = await req.json()
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  // Verify member belongs to this gym
  const member = await prisma.member.findFirst({ where: { id: memberId, gymId: gym.id } })
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  if (member.membershipStatus !== 'ACTIVE') return NextResponse.json({ error: 'Membership is not active' }, { status: 403 })

  // Prevent duplicate check-in same day
  const today = new Date(); today.setHours(0,0,0,0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1)
  const existing = await prisma.checkIn.findFirst({
    where: { memberId, checkedIn: { gte: today, lt: tomorrow } },
  })
  if (existing) return NextResponse.json({ error: 'Already checked in today' }, { status: 409 })

  const checkIn = await prisma.checkIn.create({ data: { memberId, method } })
  return NextResponse.json(checkIn)
}
