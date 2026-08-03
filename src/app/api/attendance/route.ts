import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym } from '@/lib/getGym'

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x }

// GET: list today's check-ins + fighters (with active class enrollments) for manual check-in
export async function GET(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result

  const { searchParams } = new URL(req.url)
  const view = searchParams.get('view') // 'today' | 'members'

  if (view === 'members') {
    const members = await prisma.member.findMany({
      where: { gymId: gym.id, enrollments: { some: { status: 'ACTIVE' } } },
      include: { enrollments: { where: { status: 'ACTIVE' }, include: { class: true } } },
      orderBy: [{ firstName: 'asc' }],
    })
    return NextResponse.json(members)
  }

  // Today's check-ins
  const today = startOfDay(new Date())
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10) || 25))

  const checkInWhere = { class: { gymId: gym.id }, date: { gte: today, lt: tomorrow }, status: 'ATTENDED' }
  const [marksTotal, marks] = await Promise.all([
    prisma.classAttendance.count({ where: checkInWhere }),
    prisma.classAttendance.findMany({
      where: checkInWhere,
      include: { member: true, class: true },
      orderBy: { markedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  // Weekly stats
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
  const weeklyCheckIns = await prisma.classAttendance.count({
    where: { class: { gymId: gym.id }, date: { gte: weekAgo }, status: 'ATTENDED' },
  })

  // Inactive members (have an active enrollment, but no attended mark in 30 days)
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const recentlyActive = await prisma.classAttendance.findMany({
    where: { class: { gymId: gym.id }, date: { gte: thirtyDaysAgo }, status: 'ATTENDED' },
    select: { memberId: true },
    distinct: ['memberId'],
  })
  const activeIds = recentlyActive.map(c => c.memberId)
  const inactiveCount = await prisma.member.count({
    where: { gymId: gym.id, enrollments: { some: { status: 'ACTIVE' } }, id: { notIn: activeIds } },
  })

  return NextResponse.json({
    checkIns: marks.map(m => ({ id: m.id, checkedIn: m.markedAt, method: m.method, member: m.member, memberPlan: { plan: { name: m.class.name } } })),
    todayCount: marksTotal, weeklyCheckIns, inactiveCount,
    page, pageSize, total: marksTotal, totalPages: Math.max(1, Math.ceil(marksTotal / pageSize)),
  })
}

// POST: log a check-in (resolves which class enrollment this counts against)
export async function POST(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym, user } = result
  const body = await req.json()

  const { memberId, method = 'MANUAL' } = body
  let { memberPlanId: enrollmentId } = body
  if (!memberId) return NextResponse.json({ error: 'memberId required' }, { status: 400 })

  const member = await prisma.member.findFirst({
    where: { id: memberId, gymId: gym.id },
    include: { enrollments: { where: { status: 'ACTIVE' }, include: { class: true } } },
  })
  if (!member) return NextResponse.json({ error: 'Fighter not found' }, { status: 404 })
  if (member.enrollments.length === 0) return NextResponse.json({ error: 'No active class enrollment' }, { status: 403 })

  if (!enrollmentId) {
    if (member.enrollments.length === 1) {
      enrollmentId = member.enrollments[0].id
    } else {
      // Trains more than one class/discipline — caller must say which one this session is for
      return NextResponse.json({ error: 'MULTIPLE_PLANS', plans: member.enrollments.map(e => ({ id: e.id, plan: { id: e.class.id, name: e.class.name, category: e.class.category } })) }, { status: 409 })
    }
  } else if (!member.enrollments.some(e => e.id === enrollmentId)) {
    return NextResponse.json({ error: 'That class is not active for this fighter' }, { status: 400 })
  }

  const enrollment = member.enrollments.find(e => e.id === enrollmentId)!
  const day = startOfDay(new Date())

  const existing = await prisma.classAttendance.findFirst({ where: { enrollmentId, date: day } })
  if (existing) return NextResponse.json({ error: 'Already checked in today for this class' }, { status: 409 })

  const mark = await prisma.classAttendance.create({
    data: { classId: enrollment.classId, enrollmentId, memberId, date: day, status: 'ATTENDED', method, markedById: user.id },
    include: { class: true },
  })
  return NextResponse.json({ ...mark, memberPlan: { plan: { name: mark.class.name } } })
}
