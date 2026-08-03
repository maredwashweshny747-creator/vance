import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym } from '@/lib/getGym'

function toDate(val: unknown): Date | null {
  if (!val || val === '') return null
  const d = new Date(val as string)
  return isNaN(d.getTime()) ? null : d
}

export async function GET(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  const pageParam = searchParams.get('page')
  const page = Math.max(1, parseInt(pageParam || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10) || 25))
  const paginate = pageParam !== null // pipeline/kanban view needs the whole matching set, unpaginated

  const where = {
    gymId: gym.id,
    ...(status && status !== 'ALL' ? { status } : {}),
    ...(search ? { OR: [
      { firstName: { contains: search } },
      { lastName:  { contains: search } },
      { phone:     { contains: search } },
    ]} : {}),
  }

  const [total, leads] = await Promise.all([
    prisma.lead.count({ where }),
    prisma.lead.findMany({
      where,
      include: { interactions: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
      ...(paginate ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
    }),
  ])

  // Stats reflect the gym's whole pipeline, not just the current filtered page.
  const gymWhere = { gymId: gym.id }
  const [allTotal, converted, trials, newLeads, followUpsDue] = await Promise.all([
    prisma.lead.count({ where: gymWhere }),
    prisma.lead.count({ where: { ...gymWhere, status: 'CONVERTED' } }),
    prisma.lead.count({ where: { ...gymWhere, status: 'TRIAL' } }),
    prisma.lead.count({ where: { ...gymWhere, status: 'NEW' } }),
    prisma.lead.count({ where: { ...gymWhere, followUpAt: { lte: new Date() }, status: { notIn: ['CONVERTED', 'LOST'] } } }),
  ])

  return NextResponse.json({
    leads, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
    stats: { total: allTotal, converted, trials, newLeads, followUpsDue, conversionRate: allTotal > 0 ? Math.round((converted/allTotal)*100) : 0 },
  })
}

export async function POST(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  try {
    const body = await req.json()
    const lead = await prisma.lead.create({
      data: {
        gymId:      gym.id,
        firstName:  body.firstName,
        lastName:   body.lastName,
        email:      body.email      || null,
        phone:      body.phone      || null,
        source:     body.source     || 'WALK_IN',
        status:     body.status     || 'NEW',
        assignedTo: body.assignedTo || null,
        notes:      body.notes      || null,
        trialStart:  toDate(body.trialStart),
        trialEnd:    toDate(body.trialEnd),
        followUpAt:  toDate(body.followUpAt),
        convertedAt: toDate(body.convertedAt),
      },
    })
    return NextResponse.json(lead)
  } catch (err: any) {
    console.error('Lead create error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to create lead' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  try {
    const body = await req.json()
    if (body.interactionNote) {
      await prisma.leadInteraction.create({
        data: { leadId: id, type: body.interactionType || 'NOTE', note: body.interactionNote },
      })
      delete body.interactionNote
      delete body.interactionType
    }
    const updateData: any = { ...body }
    if ('trialStart'  in body) updateData.trialStart  = toDate(body.trialStart)
    if ('trialEnd'    in body) updateData.trialEnd    = toDate(body.trialEnd)
    if ('followUpAt'  in body) updateData.followUpAt  = toDate(body.followUpAt)
    if ('convertedAt' in body) updateData.convertedAt = toDate(body.convertedAt)
    if (Object.keys(updateData).length > 0) {
      await prisma.lead.updateMany({ where: { id, gymId: gym.id }, data: updateData })
    }
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Lead update error:', err)
    return NextResponse.json({ error: err?.message || 'Failed to update lead' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  await prisma.lead.deleteMany({ where: { id, gymId: gym.id } })
  return NextResponse.json({ success: true })
}
