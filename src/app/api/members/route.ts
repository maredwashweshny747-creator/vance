import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym } from '@/lib/getGym'
import { checkAndExpireEnrollment, sessionsAllowedForEnrollment } from '@/lib/enrollment'
import { phoneValidationError } from '@/lib/utils'
import { baseAmountForClass, applyDiscount } from '@/lib/payment'

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
    // Scoped to THIS enrollment's own current cycle (its startDate), not the calendar
    // month — a multi-month offer's "remaining" must reflect the whole cycle's usage,
    // not just whatever's happened since the 1st of this month.
    const cycleStart = new Date(e.startDate)
    const [attended, excused, absent] = await Promise.all([
      prisma.classAttendance.count({ where: { enrollmentId: e.id, date: { gte: cycleStart }, status: 'ATTENDED' } }),
      prisma.classAttendance.count({ where: { enrollmentId: e.id, date: { gte: cycleStart }, status: 'EXCUSED' } }),
      prisma.classAttendance.count({ where: { enrollmentId: e.id, date: { gte: cycleStart }, status: 'ABSENT' } }),
    ])
    const sessionsAllowed = sessionsAllowedForEnrollment(e, e.class || {})
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
        enrollments: { include: { class: { include: { offers: { where: { isActive: true }, orderBy: { createdAt: 'asc' } } } } }, orderBy: { createdAt: 'asc' } },
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

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10) || 25))
  const status = searchParams.get('status')

  const where = {
    gymId: gym.id,
    ...(search ? { OR: [
      { firstName: { contains: search, mode: 'insensitive' as const } },
      { lastName: { contains: search, mode: 'insensitive' as const } },
      { email: { contains: search, mode: 'insensitive' as const } },
      { phone: { contains: search } }, // phone/fighterId are digits — case-insensitivity doesn't apply
      { parentPhone: { contains: search } },
      { fighterId: { contains: search, mode: 'insensitive' as const } },
    ] } : {}),
  }

  // Status (Active/Frozen/Expired/...) isn't a stored column — it's derived live from each
  // enrollment's expiry check — so it can't be pushed into the DB `where` clause. We fetch
  // every search-match, compute each member's real status, THEN filter and paginate in
  // memory. This trades DB-level pagination for correctness: filtering "Expired" now
  // actually returns only expired fighters instead of silently ignoring the filter.
  const allMatching = await prisma.member.findMany({
    where,
    include: { enrollments: { include: { class: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const withStatus = []
  for (const m of allMatching) {
    // checkAndExpireEnrollment already tells us the (possibly just-updated) status —
    // no need to re-fetch the member's enrollments a second time to find out.
    for (const e of m.enrollments) (e as any).status = await checkAndExpireEnrollment(e, e.class)
    const overallStatus = m.enrollments.some(e => e.status === 'ACTIVE') ? 'ACTIVE'
      : m.enrollments.some(e => e.status === 'FROZEN') ? 'FROZEN'
      : m.enrollments.some(e => e.status === 'EXPIRED') ? 'EXPIRED'
      : m.enrollments.length > 0 ? 'CANCELED' : 'NO_PLAN'
    withStatus.push({ ...m, overallStatus })
  }

  const filtered = status && status !== 'ALL' ? withStatus.filter(m => m.overallStatus === status) : withStatus
  const total = filtered.length
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)

  return NextResponse.json({ data: paged, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) })
}

export async function POST(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym, user } = result
  try {
    const body = await req.json()
    if (body.phone) {
      const formatError = phoneValidationError(body.phone)
      if (formatError) return NextResponse.json({ error: formatError }, { status: 400 })
      const dupe = await prisma.member.findUnique({ where: { phone: body.phone } })
      if (dupe) return NextResponse.json({ error: 'This phone number is already assigned to another fighter.' }, { status: 409 })
    }
    const member = await prisma.$transaction(async (tx) => {
      const gymRow = await tx.gym.update({
        where: { id: gym.id }, data: { fighterIdSeq: { increment: 1 } },
        select: { fighterIdSeq: true, fighterIdPrefix: true },
      })
      const fighterId = `${gymRow.fighterIdPrefix}${String(gymRow.fighterIdSeq).padStart(4, '0')}`
      return tx.member.create({
        data: {
          gymId:            gym.id,
          fighterId,
          firstName:        body.firstName,
          lastName:         body.lastName,
          email:            body.email            || null,
          phone:            body.phone            || null,
          parentPhone:      body.parentPhone       || null,
          photo:            body.photo            || null,
          birthYear:        body.birthYear ? Number(body.birthYear) : null,
          branchId:         body.branchId         || null,
          notes:            body.notes            || null,
          createdById:      user.id,
        },
      })
    })

    // Optionally sign into an initial class right away — this is now optional,
    // a fighter can be added first and enrolled later.
    if (body.classId) {
      const cls = await prisma.gymClass.findFirst({ where: { id: body.classId, gymId: gym.id } })
      if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 400 })
      const startDate = body.startDate ? new Date(body.startDate) : new Date()
      const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + cls.durationDays)
      const sessionCount = cls.type === 'PRIVATE' ? Math.max(1, Number(body.sessionCount) || 1) : null

      const enrollment = await prisma.classEnrollment.create({
        data: {
          memberId: member.id, classId: cls.id, status: 'ACTIVE', startDate, endDate, sessionCount,
          addedById: user.id, lastAction: 'CREATED', lastActionById: user.id, lastActionAt: new Date(),
        },
      })

      const base = baseAmountForClass(cls, sessionCount)
      const { type: discountType, value: discountValue, originalAmount, amount } = applyDiscount(base, body.discountType, body.discountValue)

      await prisma.payment.create({
        data: {
          gymId: gym.id, memberId: member.id, classId: cls.id, enrollmentId: enrollment.id,
          amount, originalAmount, discountType, discountValue, currency: gym.currency || 'EGP',
          type: 'MEMBERSHIP', status: 'COMPLETED', method: body.paymentMethod || null, proofPhoto: body.proofPhoto || null,
          description: `New enrollment — ${member.firstName} ${member.lastName} (${cls.name}${sessionCount ? `, ${sessionCount} sessions` : ''})`,
          paidAt: new Date(),
        },
      })

      return NextResponse.json({ ...member, endDate })
    }

    return NextResponse.json(member)
  } catch (err: any) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(',') : String(err.meta?.target || '')
      if (target.includes('phone')) return NextResponse.json({ error: 'This phone number is already assigned to another fighter.' }, { status: 409 })
      return NextResponse.json({ error: 'Member with this email already exists' }, { status: 409 })
    }
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

  // A fighter can keep their own existing number — only a *different* fighter
  // already holding that number is a conflict.
  if (body.phone && body.phone !== member.phone) {
    const formatError = phoneValidationError(body.phone)
    if (formatError) return NextResponse.json({ error: formatError }, { status: 400 })
    const dupe = await prisma.member.findUnique({ where: { phone: body.phone } })
    if (dupe && dupe.id !== id) return NextResponse.json({ error: 'This phone number is already assigned to another fighter.' }, { status: 409 })
  }

  const updateData: any = {}
  const allowedFields = ['firstName','lastName','email','phone','parentPhone','photo','notes','branchId']
  for (const field of allowedFields) {
    if (body[field] !== undefined) updateData[field] = body[field] ?? null
  }
  if (body.birthYear !== undefined) updateData.birthYear = body.birthYear ? Number(body.birthYear) : null
  if (Object.keys(updateData).length > 0) {
    try {
      await prisma.member.update({ where: { id }, data: updateData })
    } catch (err: any) {
      if (err.code === 'P2002') return NextResponse.json({ error: 'This phone number is already assigned to another fighter.' }, { status: 409 })
      throw err
    }
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
