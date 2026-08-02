import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym } from '@/lib/getGym'
import { sessionsAllowedForCycle } from '@/lib/utils'
import { baseAmountForClass, applyDiscount } from '@/lib/payment'

function calcEndDate(start: Date, durationDays: number): Date {
  const d = new Date(start)
  d.setDate(d.getDate() + (durationDays || 30))
  return d
}

// POST: sign a fighter into a class (their initial enrollment, or an additional discipline).
// For PRIVATE (session-based) classes, body.sessionCount is the number of sessions purchased
// and the amount is pricePerSession * sessionCount. body.discountType/discountValue optionally
// apply a discount (No Discount / Percentage / Fixed Amount) before the payment is saved.
export async function POST(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym, user } = result
  try {
    const body = await req.json()
    const member = await prisma.member.findFirst({ where: { id: body.memberId, gymId: gym.id } })
    if (!member) return NextResponse.json({ error: 'Fighter not found' }, { status: 404 })
    const cls = await prisma.gymClass.findFirst({ where: { id: body.classId, gymId: gym.id } })
    if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })

    const existingActive = await prisma.classEnrollment.findFirst({ where: { memberId: member.id, classId: cls.id, status: { in: ['ACTIVE', 'FROZEN'] } } })
    if (existingActive) return NextResponse.json({ error: `${member.firstName} is already signed into ${cls.name}` }, { status: 409 })

    const startDate = body.startDate ? new Date(body.startDate) : new Date()
    const endDate = calcEndDate(startDate, cls.durationDays)
    const sessionCount = cls.type === 'PRIVATE' ? Math.max(1, Number(body.sessionCount) || 1) : null

    const enrollment = await prisma.classEnrollment.create({
      data: {
        memberId: member.id, classId: cls.id, status: 'ACTIVE', startDate, endDate, sessionCount,
        addedById: user.id, lastAction: 'CREATED', lastActionById: user.id, lastActionAt: new Date(),
      },
      include: { class: true },
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

    return NextResponse.json(enrollment)
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err?.message || 'Failed to sign fighter into class' }, { status: 500 })
  }
}

// PATCH ?id=<enrollmentId> — freeze / unfreeze / renew / cancel a single enrollment.
// Renew always records who confirmed it (the logged-in user) — the frontend is expected
// to show a confirm step before calling this, since renewing charges the fighter again.
export async function PATCH(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym, user } = result
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const enr = await prisma.classEnrollment.findFirst({
    where: { id, member: { gymId: gym.id } },
    include: { class: true, member: true },
  })
  if (!enr) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const action = body._action

  if (action === 'freeze') {
    const now = new Date()
    const currentEnd = enr.endDate ? new Date(enr.endDate) : now
    const msLeft = Math.max(0, currentEnd.getTime() - now.getTime())
    await prisma.classEnrollment.update({
      where: { id }, data: {
        status: 'FROZEN', freezeStartedAt: now, totalFreezeDaysLeft: Math.round(msLeft / 86400000),
        lastAction: 'FROZEN', lastActionById: user.id, lastActionAt: now,
      },
    })
    return NextResponse.json({ success: true, message: `Frozen. ${Math.ceil(msLeft / 86400000)} days paused.` })
  }

  if (action === 'unfreeze') {
    const daysLeft = enr.totalFreezeDaysLeft || 0
    const newEnd = new Date(); newEnd.setDate(newEnd.getDate() + daysLeft)
    await prisma.classEnrollment.update({
      where: { id }, data: {
        status: 'ACTIVE', endDate: newEnd, freezeStartedAt: null, totalFreezeDaysLeft: 0,
        lastAction: 'UNFROZEN', lastActionById: user.id, lastActionAt: new Date(),
      },
    })
    return NextResponse.json({ success: true, message: `Unfrozen! ${daysLeft} days restored. Expires ${newEnd.toDateString()}` })
  }

  if (action === 'renew') {
    // Explicit confirmation is expected client-side before this call; we still record
    // exactly who performed it and when, regardless.
    const newStart = new Date()
    const newEnd = calcEndDate(newStart, enr.class.durationDays)
    const sessionCount = enr.class.type === 'PRIVATE' ? Math.max(1, Number(body.sessionCount) || enr.sessionCount || 1) : null

    await prisma.classEnrollment.update({
      where: { id }, data: {
        status: 'ACTIVE', startDate: newStart, endDate: newEnd, freezeStartedAt: null, totalFreezeDaysLeft: 0,
        sessionCount,
        lastAction: 'RENEWED', lastActionById: user.id, lastActionAt: new Date(),
      },
    })

    // The Payments page should only hold the current active payment for this
    // subscription — remove the previous one(s) tied to this enrollment before
    // creating the new one, so renewals never leave stale payments behind.
    await prisma.payment.deleteMany({ where: { enrollmentId: enr.id } })

    const base = baseAmountForClass(enr.class, sessionCount)
    const { type: discountType, value: discountValue, originalAmount, amount } = applyDiscount(base, body.discountType, body.discountValue)

    await prisma.payment.create({
      data: {
        gymId: gym.id, memberId: enr.memberId, classId: enr.classId, enrollmentId: enr.id,
        amount, originalAmount, discountType, discountValue, currency: gym.currency || 'EGP',
        type: 'MEMBERSHIP', status: 'COMPLETED', method: body.paymentMethod || null, proofPhoto: body.proofPhoto || null,
        description: `Renewal — ${enr.member.firstName} ${enr.member.lastName} (${enr.class.name}${sessionCount ? `, ${sessionCount} sessions` : ''}), confirmed by ${user.name || user.email}`,
        paidAt: new Date(),
      },
    })
    return NextResponse.json({ success: true, message: `Renewed until ${newEnd.toDateString()}`, amountCharged: amount, renewedBy: user.name })
  }

  if (action === 'cancel') {
    await prisma.classEnrollment.update({
      where: { id }, data: { status: 'CANCELED', freezeStartedAt: null, lastAction: 'CANCELED', lastActionById: user.id, lastActionAt: new Date() },
    })
    return NextResponse.json({ success: true, message: 'Enrollment canceled.' })
  }

  // Switch to a different class mid-cycle (e.g. Kickboxing -> MMA). The remaining
  // time on the current cycle carries over — no new charge, no lost days.
  if (action === 'switch') {
    const newClassId = body.newClassId
    if (!newClassId) return NextResponse.json({ error: 'newClassId required' }, { status: 400 })
    const newClass = await prisma.gymClass.findFirst({ where: { id: newClassId, gymId: gym.id } })
    if (!newClass) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    if (newClassId === enr.classId) return NextResponse.json({ error: 'Already signed into that class' }, { status: 400 })

    const alreadyIn = await prisma.classEnrollment.findFirst({ where: { memberId: enr.memberId, classId: newClassId, status: { in: ['ACTIVE', 'FROZEN'] } } })
    if (alreadyIn) return NextResponse.json({ error: `${enr.member.firstName} is already signed into ${newClass.name}` }, { status: 409 })

    const now = new Date()
    await prisma.classEnrollment.update({
      where: { id }, data: { status: 'CANCELED', freezeStartedAt: null, lastAction: 'SWITCHED', lastActionById: user.id, lastActionAt: now },
    })
    const newEnrollment = await prisma.classEnrollment.create({
      data: {
        memberId: enr.memberId, classId: newClassId, status: 'ACTIVE',
        startDate: now, endDate: enr.endDate, // keep the remaining time from the old cycle
        addedById: user.id, lastAction: 'SWITCHED', lastActionById: user.id, lastActionAt: now,
      },
      include: { class: true },
    })
    return NextResponse.json({ success: true, message: `Switched from ${enr.class.name} to ${newClass.name} — remaining days carried over.`, enrollment: newEnrollment })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// DELETE ?id=<enrollmentId> — remove an enrollment entirely (e.g. added by mistake)
export async function DELETE(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const enr = await prisma.classEnrollment.findFirst({ where: { id, member: { gymId: gym.id } } })
  if (!enr) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // Delete the payment(s) tied to this enrollment first so removing a fighter from a
  // class never leaves an orphan payment on the Payments page.
  await prisma.payment.deleteMany({ where: { enrollmentId: id } })
  await prisma.classEnrollment.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
