import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym } from '@/lib/getGym'
import { sessionsAllowedForCycle } from '@/lib/utils'
import { baseAmountForClass, applyDiscount } from '@/lib/payment'

import { getEnrollmentSessions } from '@/lib/enrollmentSessions'

function calcEndDate(start: Date, durationDays: number): Date {
  const d = new Date(start)
  d.setDate(d.getDate() + (durationDays || 30))
  return d
}

// GET ?id=<enrollmentId> — every session this enrollment covers, as real calendar
// dates (not just a count), each annotated with its actual attendance status.
export async function GET(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const enr = await prisma.classEnrollment.findFirst({ where: { id, member: { gymId: gym.id } }, include: { class: true } })
  if (!enr) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data = await getEnrollmentSessions(enr)
  return NextResponse.json({ class: { id: enr.class.id, name: enr.class.name, type: enr.class.type }, ...data })
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

    const existingActive = await prisma.classEnrollment.findFirst({ where: { memberId: member.id, classId: cls.id, status: 'ACTIVE' } })
    if (existingActive) return NextResponse.json({ error: `${member.firstName} is already signed into ${cls.name}` }, { status: 409 })

    const startDate = body.startDate ? new Date(body.startDate) : new Date()

    // Regular subscription, OR an existing promotional offer (multi-month for GROUP
    // classes, a preset session-pack for PRIVATE classes).
    let sessionCount = cls.type === 'PRIVATE' ? Math.max(1, Number(body.sessionCount) || 1) : null
    let durationDays = cls.durationDays
    let base = baseAmountForClass(cls, sessionCount)
    let offerLabel = ''
    if (body.offerId) {
      const offer = await prisma.classOffer.findFirst({ where: { id: body.offerId, classId: cls.id, isActive: true } })
      if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
      if (cls.type === 'PRIVATE') {
        sessionCount = offer.sessions || sessionCount
        offerLabel = ` — ${offer.sessions}-session offer`
      } else {
        durationDays = (offer.months || 1) * 30
        offerLabel = ` — ${offer.months}-month offer`
      }
      base = offer.price
    }
    const endDate = calcEndDate(startDate, durationDays)
    const totalSessions = cls.type === 'PRIVATE' ? null : sessionsAllowedForCycle(cls.daysOfWeek.length, durationDays)

    const enrollment = await prisma.classEnrollment.create({
      data: {
        memberId: member.id, classId: cls.id, status: 'ACTIVE', startDate, endDate, sessionCount, totalSessions,
        addedById: user.id, lastAction: 'CREATED', lastActionById: user.id, lastActionAt: new Date(),
      },
      include: { class: true },
    })

    const { type: discountType, value: discountValue, originalAmount, amount } = applyDiscount(base, body.discountType, body.discountValue)

    await prisma.payment.create({
      data: {
        gymId: gym.id, memberId: member.id, classId: cls.id, enrollmentId: enrollment.id,
        amount, originalAmount, discountType, discountValue, currency: gym.currency || 'EGP',
        type: 'MEMBERSHIP', status: 'COMPLETED', method: body.paymentMethod || null, proofPhoto: body.proofPhoto || null,
        description: `New enrollment — ${member.firstName} ${member.lastName} (${cls.name}${sessionCount ? `, ${sessionCount} sessions` : ''}${offerLabel})`,
        paidAt: new Date(),
      },
    })

    return NextResponse.json(enrollment)
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err?.message || 'Failed to sign fighter into class' }, { status: 500 })
  }
}

// PATCH ?id=<enrollmentId> — renew / cancel / switch a single enrollment.
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

  if (action === 'renew') {
    // Explicit confirmation is expected client-side before this call; we still record
    // exactly who performed it and when, regardless.
    const newStart = new Date()
    let sessionCount = enr.class.type === 'PRIVATE' ? Math.max(1, Number(body.sessionCount) || enr.sessionCount || 1) : null
    let durationDays = enr.class.durationDays
    let base = baseAmountForClass(enr.class, sessionCount)
    let offerLabel = ''
    if (body.offerId) {
      const offer = await prisma.classOffer.findFirst({ where: { id: body.offerId, classId: enr.classId, isActive: true } })
      if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 })
      if (enr.class.type === 'PRIVATE') {
        sessionCount = offer.sessions || sessionCount
        offerLabel = ` — ${offer.sessions}-session offer`
      } else {
        durationDays = (offer.months || 1) * 30
        offerLabel = ` — ${offer.months}-month offer`
      }
      base = offer.price
    }
    const newEnd = calcEndDate(newStart, durationDays)
    const { type: discountType, value: discountValue, originalAmount, amount } = applyDiscount(base, body.discountType, body.discountValue)

    // Atomic: remove the previous subscription + its payment, create a fresh
    // subscription + a fresh payment. No step commits unless all four do —
    // this guarantees we never end up with duplicate or orphaned subscriptions/payments.
    // Note: deleting the old enrollment cascades and removes its ClassAttendance
    // history too (FK is Cascade) — this is a deliberate consequence of "remove the
    // previous subscription record" being literal, flagged as an assumption.
    const { newEnrollment, payment } = await prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { enrollmentId: enr.id } })
      await tx.classEnrollment.delete({ where: { id: enr.id } })
      const newEnrollment = await tx.classEnrollment.create({
        data: {
          memberId: enr.memberId, classId: enr.classId, status: 'ACTIVE', startDate: newStart, endDate: newEnd,
          sessionCount, totalSessions: enr.class.type === 'PRIVATE' ? null : sessionsAllowedForCycle(enr.class.daysOfWeek.length, durationDays),
          addedById: enr.addedById, lastAction: 'RENEWED', lastActionById: user.id, lastActionAt: new Date(),
        },
      })
      const payment = await tx.payment.create({
        data: {
          gymId: gym.id, memberId: enr.memberId, classId: enr.classId, enrollmentId: newEnrollment.id,
          amount, originalAmount, discountType, discountValue, currency: gym.currency || 'EGP',
          type: 'MEMBERSHIP', status: 'COMPLETED', method: body.paymentMethod || null, proofPhoto: body.proofPhoto || null,
          description: `Renewal — ${enr.member.firstName} ${enr.member.lastName} (${enr.class.name}${sessionCount ? `, ${sessionCount} sessions` : ''}${offerLabel}), confirmed by ${user.name || user.email}`,
          paidAt: new Date(),
        },
      })
      return { newEnrollment, payment }
    })

    return NextResponse.json({ success: true, message: `Renewed until ${newEnd.toDateString()}`, amountCharged: amount, renewedBy: user.name, enrollmentId: newEnrollment.id })
  }

  if (action === 'cancel') {
    await prisma.classEnrollment.update({
      where: { id }, data: { status: 'CANCELED', lastAction: 'CANCELED', lastActionById: user.id, lastActionAt: new Date() },
    })
    return NextResponse.json({ success: true, message: 'Enrollment canceled.' })
  }

  // Switch to a different class mid-cycle (e.g. Kickboxing -> MMA). The original
  // start/end date and everything already attended carry over unchanged — only the
  // class (and the one payment tied to *this* subscription) actually changes.
  if (action === 'switch') {
    const newClassId = body.newClassId
    if (!newClassId) return NextResponse.json({ error: 'newClassId required' }, { status: 400 })
    const newClass = await prisma.gymClass.findFirst({ where: { id: newClassId, gymId: gym.id } })
    if (!newClass) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    if (newClassId === enr.classId) return NextResponse.json({ error: 'Already signed into that class' }, { status: 400 })

    const alreadyIn = await prisma.classEnrollment.findFirst({ where: { memberId: enr.memberId, classId: newClassId, status: 'ACTIVE' } })
    if (alreadyIn) return NextResponse.json({ error: `${enr.member.firstName} is already signed into ${newClass.name}` }, { status: 409 })

    const now = new Date()
    const sessionCount = newClass.type === 'PRIVATE' ? Math.max(1, Number(body.sessionCount) || enr.sessionCount || 1) : null
    const base = baseAmountForClass(newClass, sessionCount)
    const { type: discountType, value: discountValue, originalAmount, amount } = applyDiscount(base, body.discountType, body.discountValue)

    const { switched, payment } = await prisma.$transaction(async (tx) => {
      // Only the payment tied to THIS enrollment — never another class's subscription/payment.
      await tx.payment.deleteMany({ where: { enrollmentId: enr.id } })
      const switched = await tx.classEnrollment.update({
        where: { id: enr.id },
        data: {
          classId: newClassId, sessionCount,
          totalSessions: newClass.type === 'PRIVATE' ? null : sessionsAllowedForCycle(newClass.daysOfWeek.length, newClass.durationDays),
          // startDate/endDate deliberately untouched — same subscription period, only the class changes.
          lastAction: 'SWITCHED', lastActionById: user.id, lastActionAt: now,
        },
        include: { class: true },
      })
      const payment = await tx.payment.create({
        data: {
          gymId: gym.id, memberId: enr.memberId, classId: newClassId, enrollmentId: enr.id,
          amount, originalAmount, discountType, discountValue, currency: gym.currency || 'EGP',
          type: 'MEMBERSHIP', status: 'COMPLETED', method: body.paymentMethod || null, proofPhoto: body.proofPhoto || null,
          description: `Switched — ${enr.member.firstName} ${enr.member.lastName} (${enr.class.name} → ${newClass.name})`,
          paidAt: now,
        },
      })
      return { switched, payment }
    })

    return NextResponse.json({ success: true, message: `Switched from ${enr.class.name} to ${newClass.name} — remaining sessions and days carried over.`, enrollment: switched })
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
