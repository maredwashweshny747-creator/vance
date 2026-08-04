import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym, isAdmin } from '@/lib/getGym'

// Counts sessions a coach has actually delivered (attended marks logged against their
// approved classes) in a given month/year — one ATTENDED mark = one session taught.
// Split by class type since group and private (1:1) sessions are paid at different rates.
async function countSessions(gymId: string, coachId: string, month: number, year: number, classType: 'GROUP' | 'PRIVATE') {
  const start = new Date(year, month - 1, 1)
  const end   = new Date(year, month, 1)
  return prisma.classAttendance.count({
    where: {
      status: 'ATTENDED',
      date: { gte: start, lt: end },
      class: { gymId, coachId, status: 'APPROVED', type: classType === 'PRIVATE' ? 'PRIVATE' : { not: 'PRIVATE' } },
    },
  })
}

// Total fighter attendance records ever logged against classes this coach teaches —
// but attributed to whoever actually covered the session, not just the class's
// normally-assigned coach (a cover coach's sessions count for them, not the absent
// assigned coach).
async function countPlayersAttended(gymId: string, coachId: string) {
  const overrides = await prisma.coachAttendance.findMany({
    where: { class: { gymId }, assignedCoachId: { not: null } },
    select: { coachId: true, classId: true, date: true, assignedCoachId: true },
  })
  // key -> the coach who actually gets credit, only recorded when it differs from the assigned coach
  const coveredAway = new Map<string, string>()
  for (const o of overrides) {
    if (o.assignedCoachId && o.assignedCoachId !== o.coachId) {
      coveredAway.set(`${o.classId}|${o.date.toISOString()}`, o.coachId)
    }
  }

  // This coach's own classes, minus any sessions someone else covered for them.
  const ownAttendance = await prisma.classAttendance.findMany({
    where: { class: { gymId, coachId } },
    select: { classId: true, date: true },
  })
  let count = ownAttendance.filter(a => {
    const coveringCoach = coveredAway.get(`${a.classId}|${a.date.toISOString()}`)
    return !coveringCoach || coveringCoach === coachId
  }).length

  // Sessions on other coaches' classes that this coach covered.
  const coveredKeys = Array.from(coveredAway.entries()).filter(([, cId]) => cId === coachId).map(([k]) => k)
  for (const key of coveredKeys) {
    const [classId, dateIso] = key.split('|')
    const cls = await prisma.gymClass.findUnique({ where: { id: classId }, select: { coachId: true } })
    if (cls?.coachId === coachId) continue // already counted in ownAttendance above
    count += await prisma.classAttendance.count({ where: { classId, date: new Date(dateIso) } })
  }
  return count
}

export async function GET(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  if (!isAdmin(result.session)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { gym } = result
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')

  if (type === 'payroll') {
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
    const year  = parseInt(searchParams.get('year')  || String(new Date().getFullYear()))
    const runs = await prisma.payrollRun.findMany({
      where: { gymId: gym.id, month, year },
      include: { staff: true },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(runs)
  }

  if (type === 'coaches') {
    const coaches = await prisma.coach.findMany({ where: { gymId: gym.id }, orderBy: { firstName: 'asc' } })
    return NextResponse.json(coaches)
  }

  if (type === 'coachPayroll') {
    const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1))
    const year  = parseInt(searchParams.get('year')  || String(new Date().getFullYear()))
    const coaches = await prisma.coach.findMany({ where: { gymId: gym.id, isActive: true }, orderBy: { firstName: 'asc' } })
    const existingRuns = await prisma.coachPayrollRun.findMany({ where: { gymId: gym.id, month, year } })

    const rows = await Promise.all(coaches.map(async coach => {
      const liveSessionCount = await countSessions(gym.id, coach.id, month, year, 'GROUP')
      const livePrivateSessionCount = await countSessions(gym.id, coach.id, month, year, 'PRIVATE')
      const totalPlayersAttended = await countPlayersAttended(gym.id, coach.id)
      const run = existingRuns.find(r => r.coachId === coach.id)
      const liveTotal = Math.round((liveSessionCount * coach.sessionRate + livePrivateSessionCount * coach.privateSessionRate) * 100) / 100
      return {
        coachId: coach.id,
        firstName: coach.firstName,
        lastName: coach.lastName,
        sessionRate: coach.sessionRate,
        privateSessionRate: coach.privateSessionRate,
        sessionCount: run ? run.sessionCount : liveSessionCount,
        privateSessionCount: run ? run.privateSessionCount : livePrivateSessionCount,
        liveSessionCount,
        livePrivateSessionCount,
        totalPlayersAttended,
        runId: run?.id || null,
        bonus: run?.bonus || 0,
        deductions: run?.deductions || 0,
        total: run ? run.total : liveTotal,
        status: run?.status || 'DRAFT',
        paidAt: run?.paidAt || null,
        notes: run?.notes || '',
      }
    }))
    return NextResponse.json(rows)
  }

  const staff = await prisma.staff.findMany({ where: { gymId: gym.id }, orderBy: { firstName: 'asc' } })
  return NextResponse.json(staff)
}

export async function POST(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  if (!isAdmin(result.session)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { gym } = result
  const body = await req.json()

  if (body._type === 'staff') {
    try {
      const staff = await prisma.staff.create({
        data: {
          gymId:      gym.id,
          firstName:  body.firstName,
          lastName:   body.lastName,
          email:      body.email,
          phone:      body.phone      || null,
          role:       body.role       || 'STAFF',
          salary:     Number(body.salary) || 0,
          salaryType: body.salaryType || 'MONTHLY',
        },
      })
      return NextResponse.json(staff)
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || 'Failed to add staff' }, { status: 500 })
    }
  }

  if (body._type === 'payroll') {
    try {
      const baseSalary  = Number(body.baseSalary)  || 0
      const commission  = Number(body.commission)  || 0
      const bonus       = Number(body.bonus)       || 0
      const deductions  = Number(body.deductions)  || 0
      const total       = baseSalary + commission + bonus - deductions

      const run = await prisma.payrollRun.create({
        data: {
          gymId:      gym.id,
          staffId:    body.staffId,
          month:      Number(body.month),
          year:       Number(body.year),
          baseSalary,
          commission,
          bonus,
          deductions,
          total,
          status:     'PENDING',
          notes:      body.notes || null,
        },
      })
      return NextResponse.json(run)
    } catch (err: any) {
      if (err.code === 'P2002') return NextResponse.json({ error: 'Payroll already exists for this staff member this month' }, { status: 409 })
      return NextResponse.json({ error: err?.message || 'Failed to create payroll' }, { status: 500 })
    }
  }

  // Generate (or refresh) a coach's payroll entry for a given month based on sessions taught
  if (body._type === 'coachPayroll') {
    try {
      const month = Number(body.month)
      const year  = Number(body.year)
      const coach = await prisma.coach.findFirst({ where: { id: body.coachId, gymId: gym.id } })
      if (!coach) return NextResponse.json({ error: 'Coach not found' }, { status: 404 })

      const sessionCount = await countSessions(gym.id, coach.id, month, year, 'GROUP')
      const privateSessionCount = await countSessions(gym.id, coach.id, month, year, 'PRIVATE')
      const bonus        = Number(body.bonus)       || 0
      const deductions    = Number(body.deductions)  || 0
      const total         = Math.round((sessionCount * coach.sessionRate + privateSessionCount * coach.privateSessionRate + bonus - deductions) * 100) / 100

      const run = await prisma.coachPayrollRun.upsert({
        where: { coachId_month_year: { coachId: coach.id, month, year } },
        update: { sessionCount, sessionRate: coach.sessionRate, privateSessionCount, privateSessionRate: coach.privateSessionRate, bonus, deductions, total, notes: body.notes || null },
        create: {
          gymId: gym.id, coachId: coach.id, month, year,
          sessionCount, sessionRate: coach.sessionRate, privateSessionCount, privateSessionRate: coach.privateSessionRate, bonus, deductions, total,
          status: 'PENDING', notes: body.notes || null,
        },
      })
      return NextResponse.json(run)
    } catch (err: any) {
      return NextResponse.json({ error: err?.message || 'Failed to generate coach payroll' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}

export async function PATCH(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  if (!isAdmin(result.session)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { gym } = result
  const id   = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  const body = await req.json()

  if (body._type === 'markPaid') {
    await prisma.payrollRun.updateMany({ where: { id, gymId: gym.id }, data: { status: 'PAID', paidAt: new Date() } })
    return NextResponse.json({ success: true })
  }

  if (body._type === 'markCoachPaid') {
    await prisma.coachPayrollRun.updateMany({ where: { id, gymId: gym.id }, data: { status: 'PAID', paidAt: new Date() } })
    return NextResponse.json({ success: true })
  }

  const updateData: any = {}
  if (body.firstName  !== undefined) updateData.firstName  = body.firstName
  if (body.lastName   !== undefined) updateData.lastName   = body.lastName
  if (body.email      !== undefined) updateData.email      = body.email
  if (body.role       !== undefined) updateData.role       = body.role
  if (body.salary     !== undefined) updateData.salary     = Number(body.salary)
  if (body.salaryType !== undefined) updateData.salaryType = body.salaryType
  if (body.isActive   !== undefined) updateData.isActive   = body.isActive

  await prisma.staff.updateMany({ where: { id, gymId: gym.id }, data: updateData })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  if (!isAdmin(result.session)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { gym } = result
  const id = new URL(req.url).searchParams.get('id')
  const type = new URL(req.url).searchParams.get('type')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  if (type === 'payroll') await prisma.payrollRun.deleteMany({ where: { id, gymId: gym.id } })
  else if (type === 'coachPayroll') await prisma.coachPayrollRun.deleteMany({ where: { id, gymId: gym.id } })
  else await prisma.staff.deleteMany({ where: { id, gymId: gym.id } })
  return NextResponse.json({ success: true })
}
