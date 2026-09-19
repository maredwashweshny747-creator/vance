import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym, isAdmin } from '@/lib/getGym'

// GET — exports everything belonging to this gym as one JSON file: fighters (with
// their enrollments, attendance, feedback), coaches (with their attendance, payroll,
// workout plans), classes (with offers), payments, leads, branches, inventory/shop
// sales, staff, staff payroll, and the gym's own settings. Importing this file back
// (POST) recreates all of it under a new gym with the same relationships intact.
export async function GET() {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  if (!isAdmin(result.session)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { gym } = result

  const [
    members, coaches, classes, offers, classEnrollments, classAttendance, coachAttendance,
    payments, leads, leadInteractions, branches, inventoryItems, storeSales,
    announcements, fighterFeedback, staff, payrollRuns, coachPayrollRuns, workoutPlans,
  ] = await Promise.all([
    prisma.member.findMany({ where: { gymId: gym.id } }),
    prisma.coach.findMany({ where: { gymId: gym.id } }),
    prisma.gymClass.findMany({ where: { gymId: gym.id } }),
    prisma.classOffer.findMany({ where: { class: { gymId: gym.id } } }),
    prisma.classEnrollment.findMany({ where: { member: { gymId: gym.id } } }),
    prisma.classAttendance.findMany({ where: { class: { gymId: gym.id } } }),
    prisma.coachAttendance.findMany({ where: { class: { gymId: gym.id } } }),
    prisma.payment.findMany({ where: { gymId: gym.id } }),
    prisma.lead.findMany({ where: { gymId: gym.id } }),
    prisma.leadInteraction.findMany({ where: { lead: { gymId: gym.id } } }),
    prisma.branch.findMany({ where: { gymId: gym.id } }),
    prisma.inventoryItem.findMany({ where: { gymId: gym.id } }),
    prisma.storeSale.findMany({ where: { gymId: gym.id } }),
    prisma.announcement.findMany({ where: { gymId: gym.id } }),
    prisma.fighterFeedback.findMany({ where: { gymId: gym.id } }),
    prisma.staff.findMany({ where: { gymId: gym.id } }),
    prisma.payrollRun.findMany({ where: { gymId: gym.id } }),
    prisma.coachPayrollRun.findMany({ where: { gymId: gym.id } }),
    prisma.workoutPlan.findMany({ where: { gymId: gym.id }, include: { exercises: true } }),
  ])

  const backup = {
    formatVersion: 1, exportedAt: new Date().toISOString(),
    gym: {
      name: gym.name, address: gym.address, phone: gym.phone, email: gym.email,
      website: gym.website, timezone: gym.timezone, currency: gym.currency,
      whatsappMessageTemplate: gym.whatsappMessageTemplate,
      fighterIdPrefix: gym.fighterIdPrefix, fighterIdSeq: gym.fighterIdSeq,
    },
    members, coaches, classes, offers, classEnrollments, classAttendance, coachAttendance,
    payments, leads, leadInteractions, branches, inventoryItems, storeSales,
    announcements, fighterFeedback, staff, payrollRuns, coachPayrollRuns, workoutPlans,
  }

  return NextResponse.json(backup, {
    headers: { 'Content-Disposition': `attachment; filename="vance-backup-${gym.slug}-${new Date().toISOString().split('T')[0]}.json"` },
  })
}

// POST — restores a backup file into a BRAND NEW gym owned by the calling admin.
// Every record gets a fresh ID; a map from old ID -> new ID is built as each table is
// inserted (parents before children) so every foreign key is correctly re-pointed.
// Refuses to run if this admin already owns a gym — restoring can't merge into an
// existing one, only create a new one.
export async function POST(req: NextRequest) {
  // getSessionAndGym() 404s when the admin has no gym yet — which is the expected
  // starting state for a restore — so resolve the session directly instead.
  const { getServerSession } = await import('next-auth')
  const { authOptions } = await import('@/lib/auth')
  const rawSession = await getServerSession(authOptions)
  if (!rawSession?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sessionUser = rawSession.user as any
  if (sessionUser.role !== 'ADMIN') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const existingGym = await prisma.gym.findUnique({ where: { ownerId: sessionUser.id } })
  if (existingGym) {
    return NextResponse.json({ error: 'This admin account already owns a gym — restoring a backup creates a brand-new gym, it cannot merge into an existing one. Create a fresh admin account to restore into.' }, { status: 409 })
  }

  const body = await req.json().catch(() => null)
  if (!body || body.formatVersion !== 1) return NextResponse.json({ error: 'Invalid or unrecognized backup file' }, { status: 400 })

  const idMap = new Map<string, string>() // old id -> new id, across every table
  const newId = (oldId: string) => idMap.get(oldId)
  const remap = (oldId: string | null | undefined) => (oldId ? idMap.get(oldId) ?? null : null)

  try {
    const result = await prisma.$transaction(
  async (tx) => {
      // Generate a unique slug from the gym name.
      const baseSlug = String(body.gym?.name || 'restored-gym').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'restored-gym'
      let slug = baseSlug, n = 0
      while (await tx.gym.findUnique({ where: { slug } })) { n++; slug = `${baseSlug}-${n}` }

      const gym = await tx.gym.create({
        data: {
          name: body.gym?.name || 'Restored Gym', slug, ownerId: sessionUser.id,
          address: body.gym?.address || null, phone: body.gym?.phone || null, email: body.gym?.email || null,
          website: body.gym?.website || null, timezone: body.gym?.timezone || 'UTC', currency: body.gym?.currency || 'EGP',
          whatsappMessageTemplate: body.gym?.whatsappMessageTemplate || null,
          fighterIdPrefix: body.gym?.fighterIdPrefix || '20006', fighterIdSeq: body.gym?.fighterIdSeq || 0,
        },
      })

      // Coaches first (classes reference them). userId is intentionally dropped —
      // restoring doesn't recreate login accounts, only the coach profile/history.
      for (const c of body.coaches || []) {
        const created = await tx.coach.create({ data: {
          gymId: gym.id, firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone,
          photo: c.photo, specialties: c.specialties, bio: c.bio, sessionRate: c.sessionRate,
          privateSessionRate: c.privateSessionRate, isActive: c.isActive,
        } })
        idMap.set(c.id, created.id)
      }

      // Branches (classes/members may reference them)
      for (const b of body.branches || []) {
        const created = await tx.branch.create({ data: {
          gymId: gym.id, name: b.name, address: b.address, phone: b.phone, email: b.email, manager: b.manager,
          sports: b.sports || [], isActive: b.isActive,
        } })
        idMap.set(b.id, created.id)
      }

      // Classes
      for (const c of body.classes || []) {
        const created = await tx.gymClass.create({ data: {
          gymId: gym.id, name: c.name, description: c.description, category: c.category, type: c.type,
          daysOfWeek: c.daysOfWeek || [], isOneTime: c.isOneTime, sessionDate: c.sessionDate,
          startTimeOfDay: c.startTimeOfDay, duration: c.duration, capacity: c.capacity, price: c.price,
          durationDays: c.durationDays, location: c.location, color: c.color, status: c.status,
          rejectionNote: c.rejectionNote, isActive: c.isActive,
          coachId: remap(c.coachId), branchId: remap(c.branchId),
        } })
        idMap.set(c.id, created.id)
      }

      // Class offers (belong to a class)
      for (const o of body.offers || []) {
        const classId = newId(o.classId)
        if (!classId) continue
        const created = await tx.classOffer.create({ data: {
          classId, months: o.months, sessions: o.sessions, price: o.price, label: o.label, isActive: o.isActive,
        } })
        idMap.set(o.id, created.id)
      }

      // Members (fighters)
      for (const m of body.members || []) {
        const created = await tx.member.create({ data: {
          gymId: gym.id, fighterId: m.fighterId, firstName: m.firstName, lastName: m.lastName,
          email: m.email, phone: m.phone, parentPhone: m.parentPhone, photo: m.photo, birthYear: m.birthYear,
          branchId: remap(m.branchId), notes: m.notes,
        } })
        idMap.set(m.id, created.id)
      }
      // Keep the fighter-ID counter consistent with the highest imported sequence.
      const maxSeq = (body.members || []).length
      await tx.gym.update({ where: { id: gym.id }, data: { fighterIdSeq: Math.max(body.gym?.fighterIdSeq || 0, maxSeq) } })

      // Class enrollments (belong to a member + class)
      for (const e of body.classEnrollments || []) {
        const memberId = newId(e.memberId), classId = newId(e.classId)
        if (!memberId || !classId) continue
        const created = await tx.classEnrollment.create({ data: {
          memberId, classId, status: e.status, startDate: e.startDate, endDate: e.endDate,
          sessionCount: e.sessionCount, totalSessions: e.totalSessions, lastAction: e.lastAction, lastActionAt: e.lastActionAt,
        } })
        idMap.set(e.id, created.id)
      }

      // Fighter attendance (belongs to an enrollment + class + member)
      for (const a of body.classAttendance || []) {
        const enrollmentId = newId(a.enrollmentId), classId = newId(a.classId), memberId = newId(a.memberId)
        if (!enrollmentId || !classId || !memberId) continue
        await tx.classAttendance.create({ data: {
          enrollmentId, classId, memberId, date: a.date, status: a.status, method: a.method, reason: a.reason, markedAt: a.markedAt,
        } })
      }

      // Coach attendance (belongs to a class; coach may be null if it was covered by
      // someone no longer in the system, but usually resolves via the coach map)
      for (const a of body.coachAttendance || []) {
        const classId = newId(a.classId)
        const coachId = newId(a.coachId)
        if (!classId || !coachId) continue
        await tx.coachAttendance.create({ data: {
          coachId, classId, date: a.date, status: a.status, method: a.method,
          assignedCoachId: remap(a.assignedCoachId), markedAt: a.markedAt,
        } })
      }

      // Payments (belong to a member/class/enrollment, all optional)
      for (const p of body.payments || []) {
        await tx.payment.create({ data: {
          gymId: gym.id, memberId: remap(p.memberId), classId: remap(p.classId), enrollmentId: remap(p.enrollmentId),
          amount: p.amount, originalAmount: p.originalAmount, discountType: p.discountType, discountValue: p.discountValue,
          currency: p.currency, type: p.type, status: p.status, method: p.method, proofPhoto: p.proofPhoto,
          description: p.description, branchId: remap(p.branchId), paidAt: p.paidAt,
        } })
      }

      // Leads
      for (const l of body.leads || []) {
        const created = await tx.lead.create({ data: {
          gymId: gym.id, firstName: l.firstName, lastName: l.lastName, email: l.email, phone: l.phone,
          source: l.source, status: l.status, assignedTo: l.assignedTo, notes: l.notes, followUpAt: l.followUpAt,
        } })
        idMap.set(l.id, created.id)
      }
      for (const li of body.leadInteractions || []) {
        const leadId = newId(li.leadId)
        if (!leadId) continue
        await tx.leadInteraction.create({ data: { leadId, type: li.type, note: li.notes, createdAt: li.createdAt } })
      }

      // Inventory + store sales
      for (const item of body.inventoryItems || []) {
        const created = await tx.inventoryItem.create({ data: {
          gymId: gym.id, name: item.name, sku: item.sku, category: item.category, costPrice: item.costPrice,
          sellPrice: item.sellPrice, stock: item.stock, lowStockAt: item.lowStockAt, barcode: item.barcode,
          description: item.description, isActive: item.isActive,
        } })
        idMap.set(item.id, created.id)
      }
      for (const sale of body.storeSales || []) {
        const itemId = newId(sale.itemId)
        if (!itemId) continue
        await tx.storeSale.create({ data: { gymId: gym.id, itemId, memberId: remap(sale.memberId), quantity: sale.quantity, unitPrice: sale.unitPrice, total: sale.total, method: sale.method, soldAt: sale.soldAt } })
      }

      // Announcements + fighter feedback
      for (const a of body.announcements || []) {
        await tx.announcement.create({ data: { gymId: gym.id, title: a.title, content: a.content, isActive: a.isActive } })
      }
      for (const f of body.fighterFeedback || []) {
        const memberId = newId(f.memberId)
        if (!memberId) continue
        await tx.fighterFeedback.create({ data: { gymId: gym.id, memberId, message: f.message, isRead: f.isRead, createdAt: f.createdAt } })
      }

      // Staff (front-desk payroll records) + payroll runs
      for (const s of body.staff || []) {
        const created = await tx.staff.create({ data: {
          gymId: gym.id, firstName: s.firstName, lastName: s.lastName, email: s.email, phone: s.phone,
          role: s.role, salary: s.salary, salaryType: s.salaryType, isActive: s.isActive, branchId: remap(s.branchId), joinDate: s.joinDate,
        } })
        idMap.set(s.id, created.id)
      }
      for (const p of body.payrollRuns || []) {
        const staffId = newId(p.staffId)
        if (!staffId) continue
        await tx.payrollRun.create({ data: { gymId: gym.id, staffId, month: p.month, year: p.year, baseSalary: p.baseSalary, commission: p.commission, bonus: p.bonus, deductions: p.deductions, total: p.total, status: p.status, paidAt: p.paidAt, notes: p.notes } })
      }
      for (const p of body.coachPayrollRuns || []) {
        const coachId = newId(p.coachId)
        if (!coachId) continue
        await tx.coachPayrollRun.create({ data: {
          gymId: gym.id, coachId, month: p.month, year: p.year, sessionCount: p.sessionCount, sessionRate: p.sessionRate,
          privateSessionCount: p.privateSessionCount, privateSessionRate: p.privateSessionRate, bonus: p.bonus,
          deductions: p.deductions, total: p.total, status: p.status, paidAt: p.paidAt, notes: p.notes,
        } })
      }

      // Workout plans (belong to a gym + a member, optionally a coach)
      for (const w of body.workoutPlans || []) {
        const memberId = newId(w.memberId)
        if (!memberId) continue
        const createdPlan = await tx.workoutPlan.create({ data: {
          gymId: gym.id, memberId, coachId: remap(w.coachId), title: w.title, description: w.description,
          goal: w.goal, weeks: w.weeks, isActive: w.isActive,
        } })
        for (const ex of w.exercises || []) {
          await tx.planExercise.create({ data: { planId: createdPlan.id, day: ex.day, name: ex.name, sets: ex.sets, reps: ex.reps, rest: ex.rest, notes: ex.notes } })
        }
      }

         return gym
  },
  {
    maxWait: 10000,
    timeout: 120000,
  }
)

    return NextResponse.json({ success: true, gymSlug: result.slug, gymName: result.name })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err?.message || 'Restore failed' }, { status: 500 })
  }
}
