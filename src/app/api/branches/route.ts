import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym, isAdmin } from '@/lib/getGym'

export async function GET(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (id) {
    // Single branch with full real stats
    const branch = await prisma.branch.findFirst({ where: { id, gymId: gym.id } })
    if (!branch) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const [members, activeMembers, expiredMembers, classes] = await Promise.all([
      prisma.member.count({ where: { gymId: gym.id, branchId: id } }),
      prisma.member.count({ where: { gymId: gym.id, branchId: id, enrollments: { some: { status: 'ACTIVE' } } } }),
      prisma.member.count({ where: { gymId: gym.id, branchId: id, enrollments: { some: { status: 'EXPIRED' } } } }),
      prisma.gymClass.count({ where: { gymId: gym.id, branchId: id } }),
    ])

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const revenue = await prisma.payment.aggregate({
      where: { gymId: gym.id, branchId: id, status: 'COMPLETED', paidAt: { gte: monthStart } },
      _sum: { amount: true },
    })
    const totalRevenue = await prisma.payment.aggregate({
      where: { gymId: gym.id, branchId: id, status: 'COMPLETED' },
      _sum: { amount: true },
    })

    const recentMembers = await prisma.member.findMany({
      where: { gymId: gym.id, branchId: id },
      include: { enrollments: { include: { class: true }, orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' }, take: 5,
    })

    const revenueMonths = []
    for (let i = 5; i >= 0; i--) {
      const d   = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      const agg = await prisma.payment.aggregate({
        where: { gymId: gym.id, branchId: id, status: 'COMPLETED', paidAt: { gte: d, lt: end } },
        _sum: { amount: true },
      })
      revenueMonths.push({ month: d.toLocaleString('default', { month: 'short' }), revenue: agg._sum.amount || 0 })
    }

    return NextResponse.json({
      branch, stats: {
        members, activeMembers, expiredMembers, classes,
        revenueThisMonth: revenue._sum.amount || 0,
        totalRevenue: totalRevenue._sum.amount || 0,
      },
      recentMembers, revenueMonths,
    })
  }

  // All branches with summary stats
  const branches = await prisma.branch.findMany({ where: { gymId: gym.id }, orderBy: { createdAt: 'asc' } })

  const branchesWithStats = await Promise.all(branches.map(async b => {
    const [members, activeMembers, classes] = await Promise.all([
      prisma.member.count({ where: { gymId: gym.id, branchId: b.id } }),
      prisma.member.count({ where: { gymId: gym.id, branchId: b.id, enrollments: { some: { status: 'ACTIVE' } } } }),
      prisma.gymClass.count({ where: { gymId: gym.id, branchId: b.id } }),
    ])
    const rev = await prisma.payment.aggregate({
      where: { gymId: gym.id, branchId: b.id, status: 'COMPLETED' },
      _sum: { amount: true },
    })
    return { ...b, stats: { members, activeMembers, classes, totalRevenue: rev._sum.amount || 0 } }
  }))

  // Network totals
  const totalMembers  = await prisma.member.count({ where: { gymId: gym.id, enrollments: { some: { status: 'ACTIVE' } } } })
  const totalRevenue  = await prisma.payment.aggregate({ where: { gymId: gym.id, status: 'COMPLETED' }, _sum: { amount: true } })
  const unassigned    = await prisma.member.count({ where: { gymId: gym.id, branchId: null } })

  return NextResponse.json({
    branches: branchesWithStats,
    network: { totalMembers, totalRevenue: totalRevenue._sum.amount || 0, unassigned },
  })
}

export async function POST(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  if (!isAdmin(result.session)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { gym } = result
  const body = await req.json()
  const branch = await prisma.branch.create({
    data: {
      gymId:   gym.id,
      name:    body.name,
      address: body.address || null,
      phone:   body.phone   || null,
      email:   body.email   || null,
      manager: body.manager || null,
      sports:  Array.isArray(body.sports) ? body.sports : [],
    },
  })
  return NextResponse.json(branch)
}

export async function PATCH(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  if (!isAdmin(result.session)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { gym } = result
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const body = await req.json()
  const upd: any = {}
  if (body.name     !== undefined) upd.name     = body.name
  if (body.address  !== undefined) upd.address  = body.address
  if (body.phone    !== undefined) upd.phone    = body.phone
  if (body.email    !== undefined) upd.email    = body.email
  if (body.manager  !== undefined) upd.manager  = body.manager
  if (body.sports   !== undefined) upd.sports   = Array.isArray(body.sports) ? body.sports : []
  if (body.isActive !== undefined) upd.isActive = body.isActive
  await prisma.branch.updateMany({ where: { id, gymId: gym.id }, data: upd })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  if (!isAdmin(result.session)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { gym } = result
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  // Unassign everything from this branch before deleting
  await prisma.member.updateMany({ where: { gymId: gym.id, branchId: id }, data: { branchId: null } })
  await prisma.gymClass.updateMany({ where: { gymId: gym.id, branchId: id }, data: { branchId: null } })
  await prisma.payment.updateMany({ where: { gymId: gym.id, branchId: id }, data: { branchId: null } })
  await prisma.staff.updateMany({ where: { gymId: gym.id, branchId: id }, data: { branchId: null } })
  await prisma.branch.deleteMany({ where: { id, gymId: gym.id } })
  return NextResponse.json({ success: true })
}
