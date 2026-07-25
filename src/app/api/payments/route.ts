import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym } from '@/lib/getGym'

export async function GET() {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const payments = await prisma.payment.findMany({ where: { gymId: gym.id }, include: { member: true }, orderBy: { createdAt: 'desc' } })
  return NextResponse.json(payments)
}
