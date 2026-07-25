import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym } from '@/lib/getGym'

// GET: list active coaches for this gym (for assignment dropdowns).
// Pass ?mine=true to instead get the calling coach's own full profile (incl. sessionRate).
export async function GET(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym, user } = result

  const mine = new URL(req.url).searchParams.get('mine')
  if (mine === 'true') {
    if (user.role !== 'COACH') return NextResponse.json({ error: 'Coach only' }, { status: 403 })
    const coach = await prisma.coach.findFirst({ where: { gymId: gym.id, userId: user.id } })
    if (!coach) return NextResponse.json({ error: 'Coach profile not found' }, { status: 404 })
    return NextResponse.json(coach)
  }

  const coaches = await prisma.coach.findMany({
    where: { gymId: gym.id, isActive: true },
    select: { id: true, firstName: true, lastName: true, specialties: true, photo: true },
    orderBy: { firstName: 'asc' },
  })
  return NextResponse.json(coaches)
}
