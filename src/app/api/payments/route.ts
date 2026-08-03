import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym } from '@/lib/getGym'

export async function GET(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const { searchParams } = new URL(req.url)

  const date = searchParams.get('date')       // exact single date (YYYY-MM-DD)
  const fromDate = searchParams.get('fromDate')
  const toDate = searchParams.get('toDate')
  const search = searchParams.get('search')?.trim()
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '25', 10) || 25))

  const where: any = { gymId: gym.id }

  if (date) {
    const start = new Date(date); start.setHours(0, 0, 0, 0)
    const end = new Date(start); end.setDate(end.getDate() + 1)
    where.createdAt = { gte: start, lt: end }
  } else if (fromDate || toDate) {
    where.createdAt = {}
    if (fromDate) { const d = new Date(fromDate); d.setHours(0, 0, 0, 0); where.createdAt.gte = d }
    if (toDate) { const d = new Date(toDate); d.setHours(23, 59, 59, 999); where.createdAt.lte = d }
  }

  if (search) {
    where.OR = [
      { id: search },
      { member: { firstName: { contains: search } } },
      { member: { lastName: { contains: search } } },
      { member: { phone: { contains: search } } },
      { member: { parentPhone: { contains: search } } },
      { class: { name: { contains: search } } },
    ]
  }

  const [total, payments, totalCollectedAgg, pendingCount] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      // Only the fields the Payments page actually renders — avoids over-fetching.
      select: {
        id: true, amount: true, currency: true, type: true, status: true, method: true,
        proofPhoto: true, createdAt: true,
        member: { select: { id: true, firstName: true, lastName: true, phone: true, parentPhone: true } },
        class: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.payment.aggregate({ where: { ...where, status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.payment.count({ where: { ...where, status: 'PENDING' } }),
  ])

  return NextResponse.json({
    data: payments, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
    totalCollected: totalCollectedAgg._sum.amount || 0, pendingCount,
  })
}
