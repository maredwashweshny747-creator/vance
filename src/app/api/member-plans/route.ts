import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym } from '@/lib/getGym'

function calcEndDate(start: Date, durationDays: number): Date {
  const d = new Date(start)
  d.setDate(d.getDate() + (durationDays || 30))
  return d
}

// POST: enroll a fighter in an additional plan (e.g. adding Kickboxing to an existing MMA fighter)
export async function POST(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym, user } = result
  try {
    const body = await req.json()
    const member = await prisma.member.findFirst({ where: { id: body.memberId, gymId: gym.id } })
    if (!member) return NextResponse.json({ error: 'Fighter not found' }, { status: 404 })
    const plan = await prisma.membershipPlan.findFirst({ where: { id: body.planId, gymId: gym.id } })
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

    const existingActive = await prisma.memberPlan.findFirst({ where: { memberId: member.id, planId: plan.id, status: { in: ['ACTIVE', 'FROZEN'] } } })
    if (existingActive) return NextResponse.json({ error: `${member.firstName} is already enrolled in ${plan.name}` }, { status: 409 })

    const startDate = body.startDate ? new Date(body.startDate) : new Date()
    const endDate = calcEndDate(startDate, plan.durationDays)

    const memberPlan = await prisma.memberPlan.create({
      data: {
        memberId: member.id, planId: plan.id, status: 'ACTIVE', startDate, endDate,
        addedById: user.id, lastAction: 'CREATED', lastActionById: user.id, lastActionAt: new Date(),
      },
      include: { plan: true },
    })

    await prisma.payment.create({
      data: {
        gymId: gym.id, memberId: member.id, amount: plan.price, currency: gym.currency || 'USD',
        type: 'MEMBERSHIP', status: 'COMPLETED', method: 'CASH',
        description: `New enrollment — ${member.firstName} ${member.lastName} (${plan.name})`,
        paidAt: new Date(),
      },
    })

    return NextResponse.json(memberPlan)
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err?.message || 'Failed to add plan' }, { status: 500 })
  }
}

// PATCH ?id=<memberPlanId> — freeze / unfreeze / renew / cancel / expire a single plan enrollment
export async function PATCH(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym, user } = result
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  const mp = await prisma.memberPlan.findFirst({
    where: { id, member: { gymId: gym.id } },
    include: { plan: true, member: true },
  })
  if (!mp) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const action = body._action

  if (action === 'freeze') {
    const now = new Date()
    const currentEnd = mp.endDate ? new Date(mp.endDate) : now
    const msLeft = Math.max(0, currentEnd.getTime() - now.getTime())
    await prisma.memberPlan.update({
      where: { id }, data: {
        status: 'FROZEN', freezeStartedAt: now, totalFreezeDaysLeft: Math.round(msLeft / 86400000),
        lastAction: 'FROZEN', lastActionById: user.id, lastActionAt: now,
      },
    })
    return NextResponse.json({ success: true, message: `Frozen. ${Math.ceil(msLeft / 86400000)} days paused.` })
  }

  if (action === 'unfreeze') {
    const daysLeft = mp.totalFreezeDaysLeft || 0
    const newEnd = new Date(); newEnd.setDate(newEnd.getDate() + daysLeft)
    await prisma.memberPlan.update({
      where: { id }, data: {
        status: 'ACTIVE', endDate: newEnd, freezeStartedAt: null, totalFreezeDaysLeft: 0,
        lastAction: 'UNFROZEN', lastActionById: user.id, lastActionAt: new Date(),
      },
    })
    return NextResponse.json({ success: true, message: `Unfrozen! ${daysLeft} days restored. Expires ${newEnd.toDateString()}` })
  }

  if (action === 'renew') {
    const newStart = new Date()
    const newEnd = calcEndDate(newStart, mp.plan.durationDays)
    await prisma.memberPlan.update({
      where: { id }, data: {
        status: 'ACTIVE', startDate: newStart, endDate: newEnd, freezeStartedAt: null, totalFreezeDaysLeft: 0,
        lastAction: 'RENEWED', lastActionById: user.id, lastActionAt: new Date(),
      },
    })
    await prisma.payment.create({
      data: {
        gymId: gym.id, memberId: mp.memberId, amount: mp.plan.price, currency: gym.currency || 'USD',
        type: 'MEMBERSHIP', status: 'COMPLETED', method: 'CASH',
        description: `Renewal — ${mp.member.firstName} ${mp.member.lastName} (${mp.plan.name})`,
        paidAt: new Date(),
      },
    })
    return NextResponse.json({ success: true, message: `Renewed until ${newEnd.toDateString()}`, amountCharged: mp.plan.price })
  }

  if (action === 'cancel') {
    await prisma.memberPlan.update({
      where: { id }, data: { status: 'CANCELED', freezeStartedAt: null, lastAction: 'CANCELED', lastActionById: user.id, lastActionAt: new Date() },
    })
    return NextResponse.json({ success: true, message: 'Enrollment canceled.' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

// DELETE ?id=<memberPlanId> — remove an enrollment entirely (e.g. added by mistake)
export async function DELETE(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const mp = await prisma.memberPlan.findFirst({ where: { id, member: { gymId: gym.id } } })
  if (!mp) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.memberPlan.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
