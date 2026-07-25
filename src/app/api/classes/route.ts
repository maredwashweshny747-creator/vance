import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym, isAdmin } from '@/lib/getGym'

function toDate(val: unknown): Date | null {
  if (!val || val === '') return null
  const d = new Date(val as string)
  return isNaN(d.getTime()) ? null : d
}

export async function GET() {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym, user } = result

  // Coaches only see their own classes/private sessions (any status).
  // Admin & receptionist see everything, including classes pending approval.
  let coachFilter: any = {}
  if (user.role === 'COACH') {
    const coach = await prisma.coach.findFirst({ where: { gymId: gym.id, userId: user.id } })
    coachFilter = { coachId: coach?.id || '__none__' }
  }

  const classes = await prisma.gymClass.findMany({
    where: { gymId: gym.id, ...coachFilter },
    include: { coach: true },
    orderBy: { startTime: 'asc' },
  })
  return NextResponse.json(classes)
}

export async function POST(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym, user } = result
  try {
    const body = await req.json()
    const startTime = toDate(body.startTime)
    const endTime   = toDate(body.endTime)
    if (!startTime) return NextResponse.json({ error: 'Valid start time is required' }, { status: 400 })
    if (!endTime)   return NextResponse.json({ error: 'Valid end time is required'   }, { status: 400 })

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
        type:        body.type === 'PRIVATE' ? 'PRIVATE' : 'GROUP',
        duration:    Number(body.duration)  || 60,
        capacity:    Number(body.capacity)  || 20,
        color:       body.color       || '#ffc700',
        location:    body.location    || null,
        coachId,
        branchId:    body.branchId    || null,
        status,
        startTime,
        endTime,
      },
      include: { coach: true },
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
  const { gym } = result
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

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
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
