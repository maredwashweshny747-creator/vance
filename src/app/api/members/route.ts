import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym, canDelete } from '@/lib/getGym'
import { checkAndExpireEnrollmentsBatch, sessionsAllowedForEnrollment, backfillElapsedAttendance } from '@/lib/enrollment'
import { phoneValidationError, sessionsAllowedForCycle } from '@/lib/utils'
import { baseAmountForClass, applyDiscount } from '@/lib/payment'
import { nthOccurrenceDate } from '@/lib/sessions'

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
        payments: {
          orderBy: { createdAt: 'desc' }, take: 10,
          select: { id: true, amount: true, type: true, status: true, method: true, proofPhoto: true, createdAt: true },
        },
      },
    })
    if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const enrollmentIds = member.enrollments.map(e => e.id)
    const nameIds = new Set<string>()
    if (member.createdById) nameIds.add(member.createdById)
    for (const e of member.enrollments) { if (e.addedById) nameIds.add(e.addedById); if (e.lastActionById) nameIds.add(e.lastActionById) }

    // Opening a single fighter used to be ~6 sequential round-trips (expire-check, then
    // month-summary attendance counts, then two SEPARATE user-name lookups, then recent
    // attendance) — none of these four actually depend on each other's results, only on
    // the member row already in hand, so run them together instead of one at a time.
    const [statusMap, allMarks, users, recentAttendance] = await Promise.all([
      checkAndExpireEnrollmentsBatch(member.enrollments),
      enrollmentIds.length ? prisma.classAttendance.findMany({
        where: { enrollmentId: { in: enrollmentIds }, status: { in: ['ATTENDED', 'EXCUSED', 'ABSENT'] } },
        select: { enrollmentId: true, status: true, date: true },
      }) : Promise.resolve([] as { enrollmentId: string; status: string; date: Date }[]),
      nameIds.size ? prisma.user.findMany({ where: { id: { in: Array.from(nameIds) } }, select: { id: true, name: true } }) : Promise.resolve([] as { id: string; name: string | null }[]),
      prisma.classAttendance.findMany({
        where: { memberId: id }, orderBy: { date: 'desc' }, take: 15,
        select: { id: true, date: true, status: true, class: { select: { name: true } } },
      }),
    ])

    const nameMap = new Map(users.map(u => [u.id, u.name]))
    const marksByEnrollment = new Map<string, typeof allMarks>()
    for (const m of allMarks) {
      const list = marksByEnrollment.get(m.enrollmentId) || []
      list.push(m)
      marksByEnrollment.set(m.enrollmentId, list)
    }

    const enrollmentsWithSummary = member.enrollments.map((e: any) => {
      e.status = statusMap.get(e.id) || e.status
      // Scoped to THIS enrollment's own current cycle (its startDate), not the calendar
      // month — a multi-month offer's "remaining" must reflect the whole cycle's usage,
      // not just whatever's happened since the 1st of this month.
      const cycleStart = new Date(e.startDate)
      const marks = (marksByEnrollment.get(e.id) || []).filter(m => new Date(m.date) >= cycleStart)
      const attended = marks.filter(m => m.status === 'ATTENDED').length
      const excused = marks.filter(m => m.status === 'EXCUSED').length
      const absent = marks.filter(m => m.status === 'ABSENT').length
      const sessionsAllowed = sessionsAllowedForEnrollment(e, e.class || {})
      const remaining = Math.max(0, sessionsAllowed - attended - absent)
      return {
        ...e,
        addedByIdName: e.addedById ? nameMap.get(e.addedById) || null : null,
        lastActionByIdName: e.lastActionById ? nameMap.get(e.lastActionById) || null : null,
        monthSummary: { attended, excused, absent, remaining, sessionsAllowed },
      }
    })

    return NextResponse.json({
      ...member,
      createdByIdName: member.createdById ? nameMap.get(member.createdById) || null : null,
      enrollments: enrollmentsWithSummary,
      recentAttendance,
    })
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

  if (!status || status === 'ALL') {
    // Fast path — no computed-status filter needed, so paginate for real at the DB
    // level: fetch only this page's rows instead of the entire matching roster.
    const [total, pageMembers] = await Promise.all([
      prisma.member.count({ where }),
      prisma.member.findMany({
        where,
        include: { enrollments: { include: { class: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])
    const statusMap = await checkAndExpireEnrollmentsBatch(pageMembers.flatMap(m => m.enrollments))
    const withStatus = pageMembers.map(m => {
      for (const e of m.enrollments) (e as any).status = statusMap.get(e.id) || e.status
      const overallStatus = m.enrollments.some(e => e.status === 'ACTIVE') ? 'ACTIVE'
        : m.enrollments.some(e => e.status === 'EXPIRED') ? 'EXPIRED'
        : m.enrollments.length > 0 ? 'CANCELED' : 'NO_PLAN'
      return { ...m, overallStatus }
    })
    return NextResponse.json({ data: withStatus, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) })
  }

  // Status (Active/Frozen/Expired/...) isn't a stored column — it's derived live from each
  // enrollment's expiry check — so it can't be pushed into the DB `where` clause. We fetch
  // every search-match, compute each member's real status, THEN filter and paginate in
  // memory. This trades DB-level pagination for correctness: filtering "Expired" now
  // actually returns only expired fighters instead of silently ignoring the filter. Only
  // hit when a specific status filter is actually applied — the common "ALL" view above
  // never pays this cost.
  const allMatching = await prisma.member.findMany({
    where,
    include: { enrollments: { include: { class: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const withStatus = []
  const allEnrollments = allMatching.flatMap(m => m.enrollments)
  const statusMap = await checkAndExpireEnrollmentsBatch(allEnrollments)
  for (const m of allMatching) {
    for (const e of m.enrollments) (e as any).status = statusMap.get(e.id) || e.status
    const overallStatus = m.enrollments.some(e => e.status === 'ACTIVE') ? 'ACTIVE'
      : m.enrollments.some(e => e.status === 'EXPIRED') ? 'EXPIRED'
      : m.enrollments.length > 0 ? 'CANCELED' : 'NO_PLAN'
    withStatus.push({ ...m, overallStatus })
  }

  const filtered = withStatus.filter(m => m.overallStatus === status)
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
          gender:           body.gender            || null,
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
      const sessionCount = cls.type === 'PRIVATE' ? Math.max(1, Number(body.sessionCount) || 1) : null
      const totalSessions = cls.type === 'PRIVATE' ? null : sessionsAllowedForCycle(cls.daysOfWeek.length, cls.durationDays)
      const endDate = cls.type === 'PRIVATE'
        ? (() => { const d = new Date(startDate); d.setDate(d.getDate() + cls.durationDays); return d })()
        : nthOccurrenceDate(cls, startDate, totalSessions!)

      const enrollment = await prisma.classEnrollment.create({
        data: {
          memberId: member.id, classId: cls.id, status: 'ACTIVE', startDate, endDate, sessionCount, totalSessions,
          addedById: user.id, lastAction: 'CREATED', lastActionById: user.id, lastActionAt: new Date(),
        },
      })

      // Backdated starting class (startDate before today) auto-attends every session the
      // class's schedule says has already happened since then — see backfillElapsedAttendance.
      await backfillElapsedAttendance(prisma, enrollment, cls, user.id)

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
  const allowedFields = ['firstName','lastName','email','phone','parentPhone','gender','photo','notes','branchId']
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
  if (!(await canDelete(result.session))) return NextResponse.json({ error: 'You do not have permission to delete' }, { status: 403 })
  const { gym } = result
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const member = await prisma.member.findFirst({ where: { id, gymId: gym.id } })
  if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.member.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
