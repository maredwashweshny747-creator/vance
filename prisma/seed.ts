import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d }
function daysFromNow(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d }
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)] }

async function main() {
  console.log('🥊 Seeding Vance...')

  // ── Owner user ────────────────────────────────────────────────
  const hash = await bcrypt.hash('demo123456', 12)
  const user = await prisma.user.upsert({
    where: { email: 'demo@vancefc.app' },
    update: { password: hash },
    create: { email: 'demo@vancefc.app', name: 'Alex Johnson', password: hash, role: 'ADMIN' },
  })
  console.log('✓ Admin user created')

  // ── Gym (club) ──────────────────────────────────────────────────
  let gym = await prisma.gym.findUnique({ where: { ownerId: user.id } })
  if (!gym) {
    gym = await prisma.gym.create({
      data: {
        name: 'Ironclad Fight Club', slug: 'ironclad-fc',
        ownerId: user.id,
        address: '123 Fight St, New York, NY 10001',
        phone: '+1 (555) 123-4567', email: 'contact@ironcladfc.com',
        currency: 'USD', timezone: 'America/New_York', plan: 'PROFESSIONAL',
      },
    })
  }
  console.log('✓ Club created:', gym.name)

  // ── Membership Plans (session-based) ───────────────────────────
  const planDefs = [
    { name: 'Drop-In',   sessionsPerWeek: 1, price: 15,  durationDays: 7,  description: 'Single-week trial pass' },
    { name: 'Contender', sessionsPerWeek: 3, price: 59,  durationDays: 30, description: 'Great for building a habit' },
    { name: 'Fighter',   sessionsPerWeek: 5, price: 99,  durationDays: 30, description: 'For the serious competitor' },
    { name: 'Champion',  sessionsPerWeek: 0, price: 149, durationDays: 30, description: 'Unlimited sessions, every discipline' },
  ]
  const plans: Record<string, any> = {}
  for (const p of planDefs) {
    plans[p.name] = await prisma.membershipPlan.upsert({
      where: { gymId_name: { gymId: gym.id, name: p.name } },
      update: {},
      create: { gymId: gym.id, ...p },
    })
  }
  console.log('✓ Membership plans created:', Object.keys(plans).join(', '))

  // ── Coaches (logged-in, paid per session) ──────────────────────
  const coachDefs = [
    { firstName: 'Sarah', lastName: 'Mitchell', email: 'sarah@vancefc.app', specialties: 'BJJ, Wrestling, MMA',      sessionRate: 32 },
    { firstName: 'Mike',  lastName: 'Torres',   email: 'mike@vancefc.app',  specialties: 'Muay Thai, Kickboxing',    sessionRate: 28 },
    { firstName: 'Dana',  lastName: 'Lee',      email: 'dana@vancefc.app',  specialties: 'Boxing, Conditioning',     sessionRate: 30 },
  ]
  const coaches: any[] = []
  for (const c of coachDefs) {
    const coachHash = await bcrypt.hash('demo123456', 12)
    const cUser = await prisma.user.upsert({
      where: { email: c.email },
      update: {},
      create: { email: c.email, name: `${c.firstName} ${c.lastName}`, password: coachHash, role: 'COACH', staffGymId: gym.id },
    })
    const coach = await prisma.coach.upsert({
      where: { gymId_email: { gymId: gym.id, email: c.email } },
      update: {},
      create: { gymId: gym.id, userId: cUser.id, firstName: c.firstName, lastName: c.lastName, email: c.email, specialties: c.specialties, sessionRate: c.sessionRate, bio: `Coach at ${gym.name}, specializing in ${c.specialties}.` },
    })
    coaches.push(coach)
  }
  console.log('✓ Coaches created:', coaches.map(c => c.firstName).join(', '))

  // ── Receptionist demo account ───────────────────────────────────
  const receptionistHash = await bcrypt.hash('demo123456', 12)
  await prisma.user.upsert({
    where: { email: 'front-desk@vancefc.app' },
    update: {},
    create: { email: 'front-desk@vancefc.app', name: 'Jordan Blake', password: receptionistHash, role: 'RECEPTIONIST', staffGymId: gym.id },
  })
  console.log('✓ Receptionist account created')

  // ── Branches ─────────────────────────────────────────────────────
  const branchDefs = [
    { name: 'Downtown Ring',  address: '456 Main St, New York, NY',    phone: '+1 (555) 234-5678', email: 'downtown@ironcladfc.com', manager: 'Jordan Blake' },
    { name: 'Eastside Gym',   address: '789 East Ave, Brooklyn, NY',   phone: '+1 (555) 345-6789', email: 'eastside@ironcladfc.com', manager: 'Sarah Mitchell' },
  ]
  const branches: any[] = []
  for (const b of branchDefs) {
    const existing = await prisma.branch.findFirst({ where: { gymId: gym.id, name: b.name } })
    branches.push(existing || await prisma.branch.create({ data: { gymId: gym.id, ...b } }))
  }
  console.log('✓ Branches created')

  // ── Members ──────────────────────────────────────────────────────
  const existingMemberCount = await prisma.member.count({ where: { gymId: gym.id } })
  if (existingMemberCount === 0) {
    const firstNames = ['James','Maria','Omar','Chloe','Liam','Fatima','Noah','Sofia','Ethan','Layla','Marcus','Zara','Diego','Priya','Kai','Amara','Tyler','Nadia','Jordan','Elena']
    const lastNames = ['Rivera','Chen','Okafor','Nguyen','Silva','Hassan','Brown','Petrov','Kim','Ahmed','Cole','Batista','Reyes','Sharma','Wong','Diallo','Foster','Novak','Lee','Costa']
    const planWeights = ['Drop-In','Contender','Contender','Contender','Fighter','Fighter','Champion']

    for (let i = 0; i < 42; i++) {
      const first = firstNames[i % firstNames.length]
      const last = lastNames[(i * 3) % lastNames.length]
      const plan = plans[pick(planWeights)]
      const start = daysAgo(rand(1, 300))
      const end = new Date(start); end.setDate(end.getDate() + plan.durationDays)
      const now = new Date()
      let status = 'ACTIVE'
      if (end < now) status = pick(['EXPIRED','EXPIRED','ACTIVE'])
      if (Math.random() < 0.06) status = 'FROZEN'
      if (Math.random() < 0.04) status = 'CANCELED'

      const member = await prisma.member.create({
        data: {
          gymId: gym.id,
          firstName: first, lastName: last,
          email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
          phone: `+1555${String(1000000 + i).slice(-7)}`,
          membershipPlanId: plan.id,
          membershipStatus: status,
          startDate: start, endDate: status === 'ACTIVE' || status === 'FROZEN' ? end : end,
          branchId: Math.random() < 0.7 ? pick(branches).id : null,
          goals: pick(['Lose weight and build endurance', 'Compete in amateur bouts', 'Learn self-defense', 'Build strength and confidence', 'Stay in fighting shape']),
          freezeStartedAt: status === 'FROZEN' ? daysAgo(rand(1,10)) : null,
          totalFreezeWeeks: status === 'FROZEN' ? rand(5, 20) : 0,
        },
      })

      // Check-ins
      const visits = status === 'ACTIVE' ? rand(4, 24) : rand(0, 8)
      for (let v = 0; v < visits; v++) {
        await prisma.checkIn.create({ data: { memberId: member.id, checkedIn: daysAgo(rand(0, 45)), method: Math.random() < 0.4 ? 'QR' : 'MANUAL' } })
      }

      // Payment for signup
      await prisma.payment.create({
        data: { gymId: gym.id, memberId: member.id, amount: plan.price, currency: 'USD', type: 'MEMBERSHIP', status: 'COMPLETED', method: pick(['CARD','CASH']), description: `New membership — ${member.firstName} ${member.lastName} (${plan.name})`, paidAt: start },
      })
    }
    console.log('✓ 42 members created')
  }

  // ── Classes & private sessions ──────────────────────────────────
  const existingClassCount = await prisma.gymClass.count({ where: { gymId: gym.id } })
  if (existingClassCount === 0) {
    const classDefs = [
      { name: 'Boxing Fundamentals',      category: 'BOXING',       type: 'GROUP',   duration: 60, capacity: 20, color: '#ffc700', coach: coaches[2], daysOut: 1,  hour: 7  },
      { name: 'Muay Thai Conditioning',   category: 'MUAY_THAI',    type: 'GROUP',   duration: 60, capacity: 18, color: '#e0161c', coach: coaches[1], daysOut: 1,  hour: 18 },
      { name: 'BJJ Fundamentals',         category: 'BJJ',          type: 'GROUP',   duration: 75, capacity: 16, color: '#ffda47', coach: coaches[0], daysOut: 2,  hour: 19 },
      { name: 'Advanced Wrestling',       category: 'WRESTLING',    type: 'GROUP',   duration: 60, capacity: 14, color: '#8f0e12', coach: coaches[0], daysOut: 2,  hour: 7  },
      { name: 'MMA Sparring Night',       category: 'SPARRING',     type: 'GROUP',   duration: 90, capacity: 12, color: '#e0161c', coach: coaches[0], daysOut: 3,  hour: 20 },
      { name: 'Kickboxing Cardio',        category: 'KICKBOXING',   type: 'GROUP',   duration: 45, capacity: 22, color: '#ffc700', coach: coaches[1], daysOut: 3,  hour: 18 },
      { name: 'Strength & Conditioning',  category: 'CONDITIONING', type: 'GROUP',   duration: 50, capacity: 20, color: '#71717a', coach: coaches[2], daysOut: 4,  hour: 6  },
      { name: 'Private Boxing — 1:1',     category: 'BOXING',       type: 'PRIVATE', duration: 45, capacity: 1,  color: '#ffc700', coach: coaches[2], daysOut: 2,  hour: 10 },
      { name: 'Private Muay Thai — 1:1',  category: 'MUAY_THAI',    type: 'PRIVATE', duration: 45, capacity: 1,  color: '#e0161c', coach: coaches[1], daysOut: 4,  hour: 11 },
    ]
    for (const c of classDefs) {
      const start = daysFromNow(c.daysOut); start.setHours(c.hour, 0, 0, 0)
      const end = new Date(start); end.setMinutes(end.getMinutes() + c.duration)
      await prisma.gymClass.create({
        data: {
          gymId: gym.id, name: c.name, category: c.category, type: c.type,
          duration: c.duration, capacity: c.capacity, color: c.color,
          coachId: c.coach.id, branchId: pick(branches).id,
          status: 'APPROVED', startTime: start, endTime: end,
        },
      })
    }
    // One coach-submitted class still awaiting admin approval — demonstrates the approval workflow
    const pendingStart = daysFromNow(5); pendingStart.setHours(17, 0, 0, 0)
    const pendingEnd = new Date(pendingStart); pendingEnd.setMinutes(pendingEnd.getMinutes() + 60)
    await prisma.gymClass.create({
      data: {
        gymId: gym.id, name: 'Late-Night Heavy Bag Session', category: 'BOXING', type: 'GROUP',
        duration: 60, capacity: 15, color: '#ffc700', coachId: coaches[2].id, branchId: branches[0].id,
        status: 'PENDING', startTime: pendingStart, endTime: pendingEnd,
        description: 'Submitted by Dana — awaiting your approval to go live.',
      },
    })
    console.log('✓ Classes created (including one pending approval)')
  }

  // ── Coach payroll (per-session, last 2 months + current) ────────
  const now = new Date()
  for (const coach of coaches) {
    for (let back = 2; back >= 1; back--) {
      const d = new Date(now.getFullYear(), now.getMonth() - back, 1)
      const month = d.getMonth() + 1, year = d.getFullYear()
      const sessionCount = rand(8, 20)
      const total = Math.round(sessionCount * coach.sessionRate * 100) / 100
      await prisma.coachPayrollRun.upsert({
        where: { coachId_month_year: { coachId: coach.id, month, year } },
        update: {},
        create: { gymId: gym.id, coachId: coach.id, month, year, sessionCount, sessionRate: coach.sessionRate, bonus: 0, deductions: 0, total, status: 'PAID', paidAt: new Date(year, month, 3) },
      })
    }
  }
  console.log('✓ Coach payroll history seeded')

  // ── Staff (salaried front-of-house / management, non-coach) ─────
  const staffDefs = [
    { firstName: 'Jordan', lastName: 'Blake', email: 'jordan.staff@ironcladfc.com', role: 'MANAGER', salary: 3400 },
    { firstName: 'Kim',    lastName: 'Adams', email: 'kim.staff@ironcladfc.com',    role: 'STAFF',   salary: 2600 },
  ]
  const staffMembers: any[] = []
  for (const s of staffDefs) {
    const existing = await prisma.staff.findFirst({ where: { gymId: gym.id, email: s.email } })
    staffMembers.push(existing || await prisma.staff.create({ data: { gymId: gym.id, ...s, salaryType: 'MONTHLY', branchId: branches[0].id } }))
  }
  for (const s of staffMembers) {
    for (let back = 2; back >= 1; back--) {
      const d = new Date(now.getFullYear(), now.getMonth() - back, 1)
      const month = d.getMonth() + 1, year = d.getFullYear()
      const bonus = Math.random() < 0.3 ? rand(50, 200) : 0
      await prisma.payrollRun.upsert({
        where: { staffId_month_year: { staffId: s.id, month, year } },
        update: {},
        create: { gymId: gym.id, staffId: s.id, month, year, baseSalary: s.salary, commission: 0, bonus, deductions: 0, total: s.salary + bonus, status: 'PAID', paidAt: new Date(year, month, 3) },
      })
    }
  }
  console.log('✓ Staff & payroll history seeded')

  // ── Inventory (retail store) ─────────────────────────────────────
  const inventoryDefs = [
    { name: 'Whey Protein (2lb)',        category: 'SUPPLEMENT',  costPrice: 18, sellPrice: 34, stock: 40 },
    { name: 'Pre-Workout',               category: 'SUPPLEMENT',  costPrice: 14, sellPrice: 29, stock: 25 },
    { name: 'Electrolyte Drink',         category: 'DRINK',       costPrice: 1.2, sellPrice: 4, stock: 120 },
    { name: 'Sports Water (24pk)',       category: 'DRINK',       costPrice: 6, sellPrice: 12, stock: 30 },
    { name: 'Ironclad FC T-Shirt',       category: 'MERCHANDISE', costPrice: 7, sellPrice: 22, stock: 60 },
    { name: 'Ironclad FC Hoodie',        category: 'MERCHANDISE', costPrice: 16, sellPrice: 48, stock: 35 },
    { name: 'Hand Wraps (5-Pack)',       category: 'GEAR',        costPrice: 10, sellPrice: 24, stock: 3 },
    { name: 'Sparring Gloves (16oz)',    category: 'GEAR',        costPrice: 22, sellPrice: 55, stock: 15 },
    { name: 'Mouthguard',                category: 'OTHER',       costPrice: 3, sellPrice: 9, stock: 50 },
  ]
  for (const i of inventoryDefs) {
    const existing = await prisma.inventoryItem.findFirst({ where: { gymId: gym.id, name: i.name } })
    if (!existing) await prisma.inventoryItem.create({ data: { gymId: gym.id, ...i, lowStockAt: 5 } })
  }
  console.log('✓ Inventory seeded')

  // ── Announcements ─────────────────────────────────────────────────
  const annDefs = [
    { title: 'Summer Sparring Series', content: 'Sign up for our 6-week sparring series — all skill levels welcome. Ask front desk for the schedule.' },
    { title: 'New Heavy Bags Installed', content: 'Three new heavy bags are up in the main hall. Wraps required at all times.' },
    { title: 'Holiday Hours', content: 'We\'ll be on a modified schedule during the holidays — check the app for updated class times.' },
  ]
  for (const a of annDefs) {
    const existing = await prisma.announcement.findFirst({ where: { gymId: gym.id, title: a.title } })
    if (!existing) await prisma.announcement.create({ data: { gymId: gym.id, ...a } })
  }
  console.log('✓ Announcements seeded')

  // ── Leads ──────────────────────────────────────────────────────────
  const existingLeadCount = await prisma.lead.count({ where: { gymId: gym.id } })
  if (existingLeadCount === 0) {
    const leadNames = [['Ryan','Cooper'],['Isabella','Moreno'],['Yusuf','Karimi'],['Grace','Thompson'],['Malik','Johnson'],['Elif','Yildiz'],['Connor','Reilly'],['Amina','Bello']]
    const statuses = ['NEW','CONTACTED','TRIAL','NEGOTIATING','CONVERTED','CONVERTED']
    for (const [first, last] of leadNames) {
      const status = pick(statuses)
      await prisma.lead.create({
        data: {
          gymId: gym.id, firstName: first, lastName: last,
          email: `${first.toLowerCase()}${last.toLowerCase()}@example.com`,
          phone: `+1555${rand(1000000,9999999)}`,
          source: pick(['WALK_IN','INSTAGRAM','WHATSAPP','WEBSITE','REFERRAL']),
          status, assignedTo: 'Jordan Blake',
          followUpAt: status === 'NEW' || status === 'CONTACTED' ? daysFromNow(rand(1,5)) : null,
          convertedAt: status === 'CONVERTED' ? daysAgo(rand(1,20)) : null,
          notes: pick(['Interested in boxing classes', 'Wants a trial week', 'Referred by a current member', 'Asked about private coaching rates']),
        },
      })
    }
    console.log('✓ Leads seeded')
  }

  console.log('')
  console.log('🥊 Vance seed complete!')
  console.log('')
  console.log('Demo logins (all use password: demo123456):')
  console.log('  Admin:        demo@vancefc.app')
  console.log('  Receptionist: front-desk@vancefc.app')
  console.log('  Coach:        sarah@vancefc.app  (also mike@vancefc.app, dana@vancefc.app)')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })
