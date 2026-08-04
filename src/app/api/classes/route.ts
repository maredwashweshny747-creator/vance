import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym, isAdmin } from '@/lib/getGym'

export async function GET() {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym, user } = result

  // Coaches only see their own classes (any status). Admin & receptionist see everything.
  let coachFilter: any = {}
  if (user.role === 'COACH') {
    const coach = await prisma.coach.findFirst({ where: { gymId: gym.id, userId: user.id } })
    coachFilter = { coachId: coach?.id || '__none__' }
  }

  const classes = await prisma.gymClass.findMany({
    where: { gymId: gym.id, ...coachFilter },
    include: { coach: true, offers: { where: { isActive: true }, orderBy: { months: 'asc' } }, _count: { select: { enrollments: { where: { status: { in: ['ACTIVE', 'FROZEN'] } } } } } },
    orderBy: { createdAt: 'desc' },
  })

  // Total revenue per class = sum of all completed payments recorded against it
  // (discounts are already baked into Payment.amount, so this reflects real revenue).
  const revenueByClass = await prisma.payment.groupBy({
    by: ['classId'],
    where: { gymId: gym.id, status: 'COMPLETED', classId: { in: classes.map(c => c.id) } },
    _sum: { amount: true },
  })
  const revenueMap = new Map(revenueByClass.map(r => [r.classId, r._sum.amount || 0]))

  return NextResponse.json(classes.map(c => ({ ...c, totalRevenue: revenueMap.get(c.id) || 0 })))
}

export async function POST(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym, user } = result
  try {
    const body = await req.json()
    if (!body.name) return NextResponse.json({ error: 'Class name is required' }, { status: 400 })
    const isPrivate = body.type === 'PRIVATE'
    const isOneTime = !isPrivate && !!body.isOneTime
    // Private sessions are session-count based (Coach + Price Per Session), not scheduled
    // by day of week — skip the weekly-schedule / one-time-date requirements for them.
    if (isPrivate) {
      if (!body.coachId) return NextResponse.json({ error: 'Pick a coach for the private session' }, { status: 400 })
    } else if (isOneTime) {
      if (!body.sessionDate) return NextResponse.json({ error: 'Pick a date for the session' }, { status: 400 })
    } else if (!Array.isArray(body.daysOfWeek) || body.daysOfWeek.length === 0) {
      return NextResponse.json({ error: 'Pick at least one day of the week' }, { status: 400 })
    }

    let coachId: string | null = body.coachId || null
    let status = 'APPROVED' // admin/receptionist submissions go live immediately

    if (user.role === 'COACH') {
      const coach = await prisma.coach.findFirst({ where: { gymId: gym.id, userId: user.id } })
      if (!coach) return NextResponse.json({ error: 'Coach profile not found' }, { status: 403 })
      coachId = coach.id
      status = 'PENDING' // coach submissions need admin approval before they go live
    }

    const cls = await prisma.gymClass.create({
      data: {
        gymId:       gym.id,
        name:        body.name,
        description: body.description || null,
        category:    body.category    || null,
        type:        isPrivate ? 'PRIVATE' : 'GROUP',
        isOneTime,
        daysOfWeek:  isPrivate || isOneTime ? [] : body.daysOfWeek,
        sessionDate: isOneTime ? new Date(body.sessionDate) : null,
        startTimeOfDay: body.startTimeOfDay || '18:00',
        duration:    Number(body.duration)  || 60,
        capacity:    Number(body.capacity)  || 20,
        price:       Number(body.price)     || 0, // for PRIVATE this is the price PER SESSION
        durationDays: isPrivate ? 3650 : isOneTime ? 1 : (Number(body.durationDays) || 30),
        color:       body.color       || '#ffc700',
        location:    body.location    || null,
        coachId,
        branchId:    body.branchId    || null,
        status,
        createdById: user.id,
        offers: (!isPrivate && Array.isArray(body.offers))
          ? { create: body.offers.filter((o: any) => o.months > 0 && o.price >= 0).map((o: any) => ({ months: Number(o.months), price: Number(o.price), label: o.label || null })) }
          : undefined,
      },
      include: { coach: true, offers: true },
    })
    return NextResponse.json(cls)
  } catch (err: any) {
    console.error('Class create error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to create class' }, { status: 500 })
  }
}

// PATCH: admin approves/rejects a pending class, or edits an existing one
export async function PATCH(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym, user } = result
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Class ID required' }, { status: 400 })
  const cls = await prisma.gymClass.findFirst({ where: { id, gymId: gym.id } })
  if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })

  const body = await req.json()
  const action = body._action; delete body._action

  if (action === 'approve' || action === 'reject') {
    if (!isAdmin(result.session)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    await prisma.gymClass.update({
      where: { id },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        rejectionNote: action === 'reject' ? (body.rejectionNote || null) : null,
      },
    })
    return NextResponse.json({ success: true })
  }

  // General edit — a coach may only edit their own classes; editing an already-
  // approved class as a coach sends it back to PENDING so an admin reviews the change.
  if (user.role === 'COACH') {
    const coach = await prisma.coach.findFirst({ where: { gymId: gym.id, userId: user.id } })
    if (!coach || cls.coachId !== coach.id) return NextResponse.json({ error: 'You can only edit your own classes' }, { status: 403 })
  }

  const updateData: any = {}
  const editable = ['name','description','category','type','duration','capacity','color','location','coachId','branchId','price','durationDays','startTimeOfDay']
  for (const f of editable) {
    if (body[f] !== undefined) {
      if (f === 'duration' || f === 'capacity' || f === 'durationDays') updateData[f] = Number(body[f])
      else if (f === 'price') updateData[f] = Number(body[f])
      else updateData[f] = body[f] || null
    }
  }
  if (body.daysOfWeek !== undefined && Array.isArray(body.daysOfWeek)) updateData.daysOfWeek = body.daysOfWeek
  if (body.isOneTime !== undefined) updateData.isOneTime = !!body.isOneTime
  if (body.sessionDate !== undefined) updateData.sessionDate = body.sessionDate ? new Date(body.sessionDate) : null

  let revertedToPending = false
  if (user.role === 'COACH' && cls.status === 'APPROVED') {
    updateData.status = 'PENDING'
    revertedToPending = true
  }
  if (Array.isArray(body.offers)) {
    await prisma.classOffer.deleteMany({ where: { classId: id } })
    const valid = body.offers.filter((o: any) => o.months > 0 && o.price >= 0)
    if (valid.length > 0) updateData.offers = { create: valid.map((o: any) => ({ months: Number(o.months), price: Number(o.price), label: o.label || null })) }
  }
  const updated = await prisma.gymClass.update({ where: { id }, data: updateData, include: { coach: true, offers: true } })
  return NextResponse.json({ success: true, revertedToPending, class: updated })
}

export async function DELETE(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Class ID required' }, { status: 400 })
  const cls = await prisma.gymClass.findFirst({ where: { id, gymId: gym.id } })
  if (!cls) return NextResponse.json({ error: 'Class not found' }, { status: 404 })
  await prisma.gymClass.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
