import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym, isAdmin } from '@/lib/getGym'

// GET: list all membership plans for this gym
export async function GET() {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const plans = await prisma.membershipPlan.findMany({
    where: { gymId: gym.id },
    orderBy: { price: 'asc' },
  })
  return NextResponse.json(plans)
}

// POST: create a new membership plan (admin only)
export async function POST(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  if (!isAdmin(result.session)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { gym } = result
  try {
    const body = await req.json()
    if (!body.name) return NextResponse.json({ error: 'Plan name is required' }, { status: 400 })
    const plan = await prisma.membershipPlan.create({
      data: {
        gymId:           gym.id,
        name:            body.name,
        category:        body.category || null,
        sessionsPerWeek: Number(body.sessionsPerWeek) || 0,
        price:           Number(body.price) || 0,
        durationDays:    Number(body.durationDays) || 30,
        description:     body.description || null,
        isActive:        body.isActive !== false,
      },
    })
    return NextResponse.json(plan)
  } catch (err: any) {
    if (err.code === 'P2002') return NextResponse.json({ error: 'A plan with this name already exists' }, { status: 409 })
    return NextResponse.json({ error: err?.message || 'Failed to create plan' }, { status: 500 })
  }
}

// PATCH: update a membership plan (admin only)
export async function PATCH(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  if (!isAdmin(result.session)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { gym } = result
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const body = await req.json()
  const upd: any = {}
  if (body.name            !== undefined) upd.name            = body.name
  if (body.category        !== undefined) upd.category        = body.category || null
  if (body.sessionsPerWeek !== undefined) upd.sessionsPerWeek = Number(body.sessionsPerWeek)
  if (body.price           !== undefined) upd.price           = Number(body.price)
  if (body.durationDays    !== undefined) upd.durationDays    = Number(body.durationDays)
  if (body.description     !== undefined) upd.description     = body.description
  if (body.isActive        !== undefined) upd.isActive        = body.isActive
  await prisma.membershipPlan.updateMany({ where: { id, gymId: gym.id }, data: upd })
  return NextResponse.json({ success: true })
}

// DELETE: remove a membership plan (admin only) — blocked if members are on it
export async function DELETE(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  if (!isAdmin(result.session)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { gym } = result
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const inUse = await prisma.memberPlan.count({ where: { planId: id, status: { in: ['ACTIVE', 'FROZEN'] } } })
  if (inUse > 0) return NextResponse.json({ error: `${inUse} member(s) are currently on this plan. Move them to another plan first.` }, { status: 409 })
  await prisma.membershipPlan.deleteMany({ where: { id, gymId: gym.id } })
  return NextResponse.json({ success: true })
}
