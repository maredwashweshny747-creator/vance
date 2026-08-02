import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym } from '@/lib/getGym'
import { checkAndExpireEnrollment, generateFighterId } from '@/lib/enrollment'
import { sessionsAllowedForCycle } from '@/lib/utils'

// Attaches {xName} to rows by resolving the plain-string user id fields.
async function withUserNames<T extends Record<string, any>>(rows: T[], idFields: string[]) {
  const ids = new Set<string>()
  for (const row of rows) for (const f of idFields) if (row[f]) ids.add(row[f])
  if (ids.size === 0) return rows
  const users = await prisma.user.findMany({ where: { id: { in: Array.from(ids) } }, select: { id: true, name: true } })
  const map = new Map(users.map(u => [u.id, u.name]))
  return rows.map(row => {
    const extra: Record<string, string | null> = {}
    for (const f of idFields) extra[`${f}Name`] = row[f] ? (map.get(row[f]) || null) : null
    return { ...row, ...extra }
  })
}

async function attachMonthSummaries(enrollments: any[]) {
  const withNames = await withUserNames(enrollments, ['addedById', 'lastActionById'])
  return Promise.all(withNames.map(async (e: any) => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const [attended, excused, absent] = await Promise.all([
      prisma.classAttendance.count({ where: { enrollmentId: e.id, date: { gte: monthStart }, status: 'ATTENDED' } }),
      prisma.classAttendance.count({ where: { enrollmentId: e.id, date: { gte: monthStart }, status: 'EXCUSED' } }),
      prisma.classAttendance.count({ where: { enrollmentId: e.id, date: { gte: monthStart }, status: 'ABSENT' } }),
    ])
    const sessionsAllowed = e.class?.isOneTime ? 1 : sessionsAllowedForCycle(e.class?.daysOfWeek?.length || 0, e.class?.durationDays || 30)
    const remaining = Math.max(0, sessionsAllowed - attended)
    return { ...e, monthSummary: { attended, excused, absent, remaining, sessionsAllowed } }
  }))
}

export async function GET(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const search = searchParams.get('search')

  if (id) {
    const member = await prisma.member.findFirst({
      where: { id, gymId: gym.id },
      include: {
        enrollments: { include: { class: true }, orderBy: { createdAt: 'asc' } },
        payments: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    })
    if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    for (const e of member.enrollments) {
      const newStatus = await checkAndExpireEnrollment(e, e.class)
      e.status = newStatus as any
    }

    const enrollmentsWithSummary = await attachMonthSummaries(member.enrollments)
    const [memberWithName] = await withUserNames([member], ['createdById'])
    const recentAttendance = await prisma.classAttendance.findMany({
      where: { memberId: id }, include: { class: true }, orderBy: { date: 'desc' }, take: 15,
    })
    return NextResponse.json({ ...memberWithName, enrollments: enrollmentsWithSummary, recentAttendance })
  }

  const members = await prisma.member.findMany({
    where: {
      gymId: gym.id,
      ...(search ? { OR: [{ firstName: { contains: search } }, { lastName: { contains: search } }, { email: { contains: search } }] } : {}),
    },
    include: { enrollments: { include: { class: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const results = []
  for (const m of members) {
    for (const e of m.enrollments) await checkAndExpireEnrollment(e, e.class)
    // re-read statuses post-expiry-check for accurate summary below
    const freshEnrollments = await prisma.classEnrollment.findMany({ where: { memberId: m.id }, include: { class: true } })
    const overallStatus = freshEnrollments.some(e => e.status === 'ACTIVE') ? 'ACTIVE'
      : freshEnrollments.some(e => e.status === 'FROZEN') ? 'FROZEN'
      : freshEnrollments.some(e => e.status === 'EXPIRED') ? 'EXPIRED'
      : freshEnrollments.length > 0 ? 'CANCELED' : 'NO_PLAN'
    results.push({ ...m, enrollments: freshEnrollments, overallStatus })
  }

  return NextResponse.json(results)
}

export async function POST(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym, user } = result
  try {
    const body = await req.json()
    const fighterId = await generateFighterId(gym.id)
    const member = await prisma.member.create({
      data: {
        gymId:            gym.id,
        fighterId,
        firstName:        body.firstName,
        lastName:         body.lastName,
        email:            body.email            || null,
        phone:            body.phone            || null,
        photo:            body.photo            || null,
        birthYear:        body.birthYear ? Number(body.birthYear) : null,
        branchId:         body.branchId         || null,
        notes:            body.notes            || null,
        createdById:      user.id,
      },
    })

    // Optionally sign into an initial class right away — this is now optional,
    // a fighter can be added first and enrolled later.
    if (body.classId) {
      const cls = await prisma.gymClass.findFirst({ where: { id: body.classId, gymId: gym.id } })
      if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 400 })
      const startDate = body.startDate ? new Date(body.startDate) : new Date()
      const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + cls.durationDays)

      await prisma.classEnrollment.create({
        data: {
          memberId: member.id, classId: cls.id, status: 'ACTIVE', startDate, endDate,
          addedById: user.id, lastAction: 'CREATED', lastActionById: user.id, lastActionAt: new Date(),
        },
      })

      await prisma.payment.create({
        data: {
          gymId: gym.id, memberId: member.id, amount: cls.price, currency: gym.currency || 'EGP',
          type: 'MEMBERSHIP', status: 'COMPLETED', method: body.paymentMethod || null, proofPhoto: body.proofPhoto || null,
          description: `New enrollment — ${member.firstName} ${member.lastName} (${cls.name})`,
          paidAt: new Date(),
        },
      })

      return NextResponse.json({ ...member, endDate })
    }

    return NextResponse.json(member)
  } catch (err: any) {
    if (err.code === 'P2002') return NextResponse.json({ error: 'Member with this email already exists' }, { status: 409 })
    console.error(err)
    return NextResponse.json({ error: 'Failed to create member' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const member = await prisma.member.findFirst({ where: { id, gymId: gym.id } })
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json()

  const updateData: any = {}
  const allowedFields = ['firstName','lastName','email','phone','photo','notes','branchId']
  for (const field of allowedFields) {
    if (body[field] !== undefined) updateData[field] = body[field] ?? null
  }
  if (body.birthYear !== undefined) updateData.birthYear = body.birthYear ? Number(body.birthYear) : null
  if (Object.keys(updateData).length > 0) {
    await prisma.member.update({ where: { id }, data: updateData })
  }
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const member = await prisma.member.findFirst({ where: { id, gymId: gym.id } })
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.member.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
