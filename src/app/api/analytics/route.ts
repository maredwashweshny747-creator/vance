import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym } from '@/lib/getGym'

export async function GET() {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result

  const now = new Date()

  // ── Revenue last 6 months ──────────────────────────────────────────────
  const revenueMonths: { month: string; revenue: number; count: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const agg = await prisma.payment.aggregate({
      where: { gymId: gym.id, status: 'COMPLETED', paidAt: { gte: d, lt: end } },
      _sum: { amount: true }, _count: true,
    })
    revenueMonths.push({
      month: d.toLocaleString('default', { month: 'short' }),
      revenue: agg._sum.amount || 0,
      count: agg._count,
    })
  }

  // ── Member growth last 6 months ────────────────────────────────────────
  const memberGrowth: { month: string; new: number; total: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const newCount = await prisma.member.count({ where: { gymId: gym.id, createdAt: { gte: d, lt: end } } })
    const total = await prisma.member.count({ where: { gymId: gym.id, createdAt: { lt: end } } })
    memberGrowth.push({ month: d.toLocaleString('default', { month: 'short' }), new: newCount, total })
  }

  // ── Class breakdown (counts active enrollments, not members — a fighter
  // training two disciplines counts once per class) ───────────────────────
  const activeEnrollments = await prisma.classEnrollment.findMany({
    where: { class: { gymId: gym.id }, status: { in: ['ACTIVE', 'FROZEN'] } },
    select: { class: { select: { name: true } } },
  })
  const planCounts: Record<string, number> = {}
  for (const e of activeEnrollments) {
    const name = e.class.name
    planCounts[name] = (planCounts[name] || 0) + 1
  }
  // Kept in the same { membershipType, _count.membershipType } shape the dashboard already reads
  const membershipTypes = Object.entries(planCounts).map(([name, count]) => ({
    membershipType: name, _count: { membershipType: count },
  }))

  // ── Status breakdown (by enrollment status) ────────────────────────────
  const statusGroups = await prisma.classEnrollment.groupBy({
    by: ['status'], where: { class: { gymId: gym.id } },
    _count: { status: true },
  })
  const statusBreakdown = statusGroups.map(g => ({ membershipStatus: g.status, _count: { membershipStatus: g._count.status } }))

  // ── Check-ins per day last 14 days ─────────────────────────────────────
  const checkInTrend: { day: string; visits: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0)
    const end = new Date(d); end.setDate(end.getDate() + 1)
    const count = await prisma.classAttendance.count({
      where: { class: { gymId: gym.id }, date: { gte: d, lt: end }, status: 'ATTENDED' },
    })
    checkInTrend.push({ day: d.toLocaleDateString('default', { weekday:'short', month:'short', day:'numeric' }), visits: count })
  }

  // ── Top classes by active enrollment ───────────────────────────────────
  const topClasses = await prisma.gymClass.findMany({
    where: { gymId: gym.id },
    include: { _count: { select: { enrollments: { where: { status: { in: ['ACTIVE','FROZEN'] } } } } } },
    orderBy: { enrollments: { _count: 'desc' } },
    take: 5,
  })

  // ── KPI summary ───────────────────────────────────────────────────────
  const totalMembers = await prisma.member.count({ where: { gymId: gym.id } })
  const activeMembers = await prisma.member.count({ where: { gymId: gym.id, enrollments: { some: { status: 'ACTIVE' } } } })
  const expiredMembers = await prisma.member.count({ where: { gymId: gym.id, enrollments: { some: { status: 'EXPIRED' } } } })
  const frozenMembers = await prisma.member.count({ where: { gymId: gym.id, enrollments: { some: { status: 'FROZEN' } } } })

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const revenueThisMonth = await prisma.payment.aggregate({
    where: { gymId: gym.id, status: 'COMPLETED', paidAt: { gte: thisMonthStart } },
    _sum: { amount: true },
  })
  const revenueLastMonth = await prisma.payment.aggregate({
    where: { gymId: gym.id, status: 'COMPLETED', paidAt: { gte: lastMonthStart, lt: thisMonthStart } },
    _sum: { amount: true },
  })
  const newThisMonth = await prisma.member.count({ where: { gymId: gym.id, createdAt: { gte: thisMonthStart } } })

  const totalRevenue = await prisma.payment.aggregate({
    where: { gymId: gym.id, status: 'COMPLETED' }, _sum: { amount: true },
  })

  // leads conversion
  const totalLeads = await prisma.lead.count({ where: { gymId: gym.id } })
  const convertedLeads = await prisma.lead.count({ where: { gymId: gym.id, status: 'CONVERTED' } })

  // attendance rate: attended marks this month / active members
  const checkInsThisMonth = await prisma.classAttendance.count({
    where: { class: { gymId: gym.id }, date: { gte: thisMonthStart }, status: 'ATTENDED' },
  })

  return NextResponse.json({
    kpi: {
      totalMembers, activeMembers, expiredMembers, frozenMembers,
      revenueThisMonth: revenueThisMonth._sum.amount || 0,
      revenueLastMonth: revenueLastMonth._sum.amount || 0,
      newThisMonth, totalRevenue: totalRevenue._sum.amount || 0,
      totalLeads, convertedLeads,
      conversionRate: totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0,
      checkInsThisMonth,
      avgCheckInsPerDay: Math.round(checkInsThisMonth / Math.max(1, now.getDate())),
    },
    revenueMonths, memberGrowth, membershipTypes, statusBreakdown,
    checkInTrend, topClasses: topClasses.map(c => ({ name: c.name, bookings: c._count.enrollments, category: c.category })),
  })
}
