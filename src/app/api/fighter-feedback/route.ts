import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym } from '@/lib/getGym'

export async function GET() {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const messages = await prisma.fighterFeedback.findMany({
    where: { gymId: gym.id },
    include: { member: { select: { id: true, firstName: true, lastName: true, fighterId: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(messages)
}

export async function PATCH(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const msg = await prisma.fighterFeedback.findFirst({ where: { id, gymId: gym.id } })
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  await prisma.fighterFeedback.update({ where: { id }, data: { isRead: body.isRead !== undefined ? !!body.isRead : true } })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const msg = await prisma.fighterFeedback.findFirst({ where: { id, gymId: gym.id } })
  if (!msg) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await prisma.fighterFeedback.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
