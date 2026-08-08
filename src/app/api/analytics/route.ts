import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym } from '@/lib/getGym'

export async function GET() {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result

  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const fourteenDaysAgo = new Date(); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13); fourteenDaysAgo.setHours(0, 0, 0, 0)
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)

  const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`
  const dayKey = (d: Date) => d.toISOString().slice(0, 10)

  // Each of these used to be a 6- or 14-iteration loop of individual queries (revenue,
  // member growth, and check-in trend combined were ~32 sequential DB round-trips on
  // every dashboard load). Fetch each dataset once, bucket it in JS instead.
  const [
    paymentsForRevenue, allMemberCreatedAts, attendanceForTrend,
    activeEnrollments, statusGroups, topClasses,
    totalMembers, activeMembers, expiredMembers,
    revenueThisMonth, revenueLastMonth, newThisMonth, totalRevenue,
    totalLeads, convertedLeads, checkInsThisMonth,
  ] = await Promise.all([
    prisma.payment.findMany({ where: { gymId: gym.id, status: 'COMPLETED', paidAt: { gte: sixMonthsAgo } }, select: { paidAt: true, amount: true } }),
    prisma.member.findMany({ where: { gymId: gym.id }, select: { createdAt: true } }),
    prisma.classAttendance.findMany({ where: { class: { gymId: gym.id }, date: { gte: fourteenDaysAgo }, status: 'ATTENDED' }, select: { date: true } }),
    prisma.classEnrollment.findMany({ where: { class: { gymId: gym.id }, status: 'ACTIVE' }, select: { class: { select: { name: true } } } }),
    prisma.classEnrollment.groupBy({ by: ['status'], where: { class: { gymId: gym.id } }, _count: { status: true } }),
    prisma.gymClass.findMany({ where: { gymId: gym.id }, include: { _count: { select: { enrollments: { where: { status: 'ACTIVE' } } } } }, orderBy: { enrollments: { _count: 'desc' } }, take: 5 }),
    prisma.member.count({ where: { gymId: gym.id } }),
    prisma.member.count({ where: { gymId: gym.id, enrollments: { some: { status: 'ACTIVE' } } } }),
    prisma.member.count({ where: { gymId: gym.id, enrollments: { some: { status: 'EXPIRED' } } } }),
    prisma.payment.aggregate({ where: { gymId: gym.id, status: 'COMPLETED', paidAt: { gte: thisMonthStart } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { gymId: gym.id, status: 'COMPLETED', paidAt: { gte: lastMonthStart, lt: thisMonthStart } }, _sum: { amount: true } }),
    prisma.member.count({ where: { gymId: gym.id, createdAt: { gte: thisMonthStart } } }),
    prisma.payment.aggregate({ where: { gymId: gym.id, status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.lead.count({ where: { gymId: gym.id } }),
    prisma.lead.count({ where: { gymId: gym.id, status: 'CONVERTED' } }),
    prisma.classAttendance.count({ where: { class: { gymId: gym.id }, date: { gte: thisMonthStart }, status: 'ATTENDED' } }),
  ])

  // ── Revenue last 6 months ──────────────────────────────────────────────
  const revenueMonths: { month: string; revenue: number; count: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = monthKey(d)
    const inMonth = paymentsForRevenue.filter(p => p.paidAt && monthKey(new Date(p.paidAt)) === key)
    revenueMonths.push({ month: d.toLocaleString('default', { month: 'short' }), revenue: inMonth.reduce((s, p) => s + p.amount, 0), count: inMonth.length })
  }

  // ── Member growth last 6 months ────────────────────────────────────────
  const memberGrowth: { month: string; new: number; total: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const key = monthKey(d)
    memberGrowth.push({
      month: d.toLocaleString('default', { month: 'short' }),
      new: allMemberCreatedAts.filter(m => monthKey(new Date(m.createdAt)) === key).length,
      total: allMemberCreatedAts.filter(m => new Date(m.createdAt) < end).length,
    })
  }

  // ── Class breakdown (counts active enrollments, not members — a fighter
  // training two disciplines counts once per class) ───────────────────────
  const planCounts: Record<string, number> = {}
  for (const e of activeEnrollments) planCounts[e.class.name] = (planCounts[e.class.name] || 0) + 1
  const membershipTypes = Object.entries(planCounts).map(([name, count]) => ({ membershipType: name, _count: { membershipType: count } }))

  const statusBreakdown = statusGroups.map(g => ({ membershipStatus: g.status, _count: { membershipStatus: g._count.status } }))

  // ── Check-ins per day last 14 days ─────────────────────────────────────
  const checkInTrend: { day: string; visits: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
    const key = dayKey(d)
    checkInTrend.push({
      day: d.toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' }),
      visits: attendanceForTrend.filter(a => dayKey(new Date(a.date)) === key).length,
    })
  }

  return NextResponse.json({
    kpi: {
      totalMembers, activeMembers, expiredMembers,
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
