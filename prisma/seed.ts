import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d }
function daysFromNow(n: number) { const d = new Date(); d.setDate(d.getDate() + n); return d }
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function pick<T>(a: T[]): T { return a[Math.floor(Math.random() * a.length)] }
const DOW = ['SUN','MON','TUE','WED','THU','FRI','SAT']

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

  // ── Receptionist demo account ───────────────────────────────────
  const receptionistHash = await bcrypt.hash('demo123456', 12)
  const receptionist = await prisma.user.upsert({
    where: { email: 'front-desk@vancefc.app' },
    update: {},
    create: { email: 'front-desk@vancefc.app', name: 'Jordan Blake', password: receptionistHash, role: 'RECEPTIONIST', staffGymId: gym.id },
  })
  console.log('✓ Receptionist account created')

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

  // ── Branches (each with the disciplines/sports they offer) ──────
  const branchDefs = [
    { name: 'Downtown Ring',  address: '456 Main St, New York, NY',    phone: '+1 (555) 234-5678', email: 'downtown@ironcladfc.com', manager: 'Jordan Blake',
      sports: ['MMA_ADULTS','BOXING_ADULTS','KICKBOXING_ADULTS','BJJ_ADULTS','CONDITIONING'] },
    { name: 'Eastside Gym',   address: '789 East Ave, Brooklyn, NY',   phone: '+1 (555) 345-6789', email: 'eastside@ironcladfc.com', manager: 'Sarah Mitchell',
      sports: ['KICKBOXING_KIDS','MMA_KIDS','BOXING_KIDS','WRESTLING_ADULTS','SPARRING'] },
  ]
  const branches: any[] = []
  for (const b of branchDefs) {
    const existing = await prisma.branch.findFirst({ where: { gymId: gym.id, name: b.name } })
    branches.push(existing || await prisma.branch.create({ data: { gymId: gym.id, ...b } }))
  }
  console.log('✓ Branches created (with sports offered)')

  // ── Classes (these ARE the subscribable plans — each has a weekly schedule) ──
  const classDefs = [
    { name: 'Kickboxing Adults',  category: 'KICKBOXING_ADULTS', type: 'GROUP', daysOfWeek: ['MON','WED','SAT'], startTimeOfDay: '18:00', duration: 60, capacity: 20, price: 59,  durationDays: 30, color: '#ffc700', coach: coaches[1] },
    { name: 'MMA Adults',         category: 'MMA_ADULTS',        type: 'GROUP', daysOfWeek: ['TUE','THU','SAT'], startTimeOfDay: '19:00', duration: 75, capacity: 16, price: 69,  durationDays: 30, color: '#e0161c', coach: coaches[0] },
    { name: 'BJJ Adults',         category: 'BJJ_ADULTS',        type: 'GROUP', daysOfWeek: ['MON','WED','FRI'], startTimeOfDay: '19:30', duration: 75, capacity: 16, price: 65,  durationDays: 30, color: '#ffda47', coach: coaches[0] },
    { name: 'Boxing Adults',      category: 'BOXING_ADULTS',     type: 'GROUP', daysOfWeek: ['MON','TUE','WED','THU','FRI'], startTimeOfDay: '07:00', duration: 60, capacity: 20, price: 99, durationDays: 30, color: '#8f0e12', coach: coaches[2] },
    { name: 'Kids Kickboxing',    category: 'KICKBOXING_KIDS',   type: 'GROUP', daysOfWeek: ['TUE','THU'],       startTimeOfDay: '16:00', duration: 45, capacity: 14, price: 45,  durationDays: 30, color: '#71717a', coach: coaches[1] },
    { name: 'Kids MMA Basics',    category: 'MMA_KIDS',          type: 'GROUP', daysOfWeek: ['WED','FRI'],       startTimeOfDay: '16:00', duration: 45, capacity: 14, price: 45,  durationDays: 30, color: '#71717a', coach: coaches[0] },
    { name: 'Drop-In Boxing',     category: 'BOXING_ADULTS',     type: 'GROUP', daysOfWeek: ['SAT'],             startTimeOfDay: '10:00', duration: 60, capacity: 20, price: 15,  durationDays: 7,  color: '#ffc700', coach: coaches[2] },
    { name: 'Private Boxing — 1:1',     category: 'BOXING_ADULTS',     type: 'PRIVATE', daysOfWeek: ['TUE','THU'], startTimeOfDay: '10:00', duration: 45, capacity: 1, price: 220, durationDays: 30, color: '#ffc700', coach: coaches[2] },
    { name: 'Private Muay Thai — 1:1',  category: 'KICKBOXING_ADULTS', type: 'PRIVATE', daysOfWeek: ['MON','WED'], startTimeOfDay: '11:00', duration: 45, capacity: 1, price: 220, durationDays: 30, color: '#e0161c', coach: coaches[1] },
  ]
  const classes: Record<string, any> = {}
  for (const c of classDefs) {
    const { coach, ...data } = c
    const existing = await prisma.gymClass.findFirst({ where: { gymId: gym.id, name: c.name } })
    classes[c.name] = existing || await prisma.gymClass.create({
      data: { gymId: gym.id, ...data, coachId: coach.id, branchId: pick(branches).id, status: 'APPROVED', createdById: user.id },
    })
  }
  // One coach-submitted class still awaiting admin approval — demonstrates the approval workflow
  const pendingExisting = await prisma.gymClass.findFirst({ where: { gymId: gym.id, name: 'Late-Night Heavy Bag Session' } })
  if (!pendingExisting) {
    await prisma.gymClass.create({
      data: {
        gymId: gym.id, name: 'Late-Night Heavy Bag Session', category: 'BOXING_ADULTS', type: 'GROUP',
        daysOfWeek: ['FRI'], startTimeOfDay: '20:00', duration: 60, capacity: 15, price: 59, durationDays: 30,
        color: '#ffc700', coachId: coaches[2].id, branchId: branches[0].id,
        status: 'PENDING', createdById: coaches[2].userId,
        description: 'Submitted by Dana — awaiting your approval to go live.',
      },
    })
  }
  console.log('✓ Classes created (including one pending approval)')

  // ── Members (fighters), enrolled directly into classes ───────────
  const existingMemberCount = await prisma.member.count({ where: { gymId: gym.id } })
  if (existingMemberCount === 0) {
    const firstNames = ['James','Maria','Omar','Chloe','Liam','Fatima','Noah','Sofia','Ethan','Layla','Marcus','Zara','Diego','Priya','Kai','Amara','Tyler','Nadia','Jordan','Elena']
    const lastNames = ['Rivera','Chen','Okafor','Nguyen','Silva','Hassan','Brown','Petrov','Kim','Ahmed','Cole','Batista','Reyes','Sharma','Wong','Diallo','Foster','Novak','Lee','Costa']
    const singleClassNames = ['Kickboxing Adults','MMA Adults','BJJ Adults','Boxing Adults','Kids Kickboxing','Drop-In Boxing']
    const addedByPool = [user.id, receptionist.id]

    for (let i = 0; i < 42; i++) {
      const first = firstNames[i % firstNames.length]
      const last = lastNames[(i * 3) % lastNames.length]
      const addedBy = pick(addedByPool)
      const createdAt = daysAgo(rand(1, 60)) // keep within a cycle or two so session math stays sane

      const member = await prisma.member.create({
        data: {
          gymId: gym.id,
          firstName: first, lastName: last,
          email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
          phone: `+1555${String(1000000 + i).slice(-7)}`,
          branchId: Math.random() < 0.7 ? pick(branches).id : null,
          goals: pick(['Lose weight and build endurance', 'Compete in amateur bouts', 'Learn self-defense', 'Build strength and confidence', 'Stay in fighting shape']),
          createdById: addedBy,
          createdAt,
        },
      })

      // Most fighters sign into one class; ~20% train two disciplines at once
      const classNamesForMember = Math.random() < 0.2
        ? [pick(['MMA Adults','Boxing Adults']), 'Kickboxing Adults']
        : [pick(singleClassNames)]

      for (const className of Array.from(new Set(classNamesForMember))) {
        const cls = classes[className]
        const start = createdAt
        const end = new Date(start); end.setDate(end.getDate() + cls.durationDays)
        const now = new Date()
        let status = 'ACTIVE'
        if (end < now) status = pick(['EXPIRED','EXPIRED','ACTIVE'])
        if (Math.random() < 0.06) status = 'FROZEN'
        if (Math.random() < 0.04) status = 'CANCELED'

        const enrollment = await prisma.classEnrollment.create({
          data: {
            memberId: member.id, classId: cls.id, status,
            startDate: start, endDate: end,
            freezeStartedAt: status === 'FROZEN' ? daysAgo(rand(1,10)) : null,
            totalFreezeDaysLeft: status === 'FROZEN' ? rand(5, 20) : 0,
            addedById: addedBy, lastAction: 'CREATED', lastActionById: addedBy, lastActionAt: start,
          },
        })

        // Attendance marks on the class's actual scheduled days since enrollment
        if (status === 'ACTIVE' || status === 'EXPIRED') {
          let cursor = new Date(start)
          const today = new Date()
          while (cursor <= today && cursor <= end) {
            const dayCode = DOW[cursor.getDay()]
            if (cls.daysOfWeek.includes(dayCode)) {
              const roll = Math.random()
              if (roll < 0.75) {
                await prisma.classAttendance.create({ data: { classId: cls.id, enrollmentId: enrollment.id, memberId: member.id, date: new Date(cursor), status: 'ATTENDED', method: Math.random() < 0.4 ? 'QR' : 'MANUAL', markedById: addedBy } })
              } else if (roll < 0.85) {
                await prisma.classAttendance.create({ data: { classId: cls.id, enrollmentId: enrollment.id, memberId: member.id, date: new Date(cursor), status: 'EXCUSED', reason: pick(['Sick', 'Family emergency', 'Traveling for work']), method: 'ROSTER', markedById: addedBy } })
              }
              // else: left unmarked (shows as Absent in summaries)
            }
            cursor.setDate(cursor.getDate() + 1)
          }
        }

        await prisma.payment.create({
          data: { gymId: gym.id, memberId: member.id, amount: cls.price, currency: 'USD', type: 'MEMBERSHIP', status: 'COMPLETED', method: pick(['CARD','CASH']), description: `New enrollment — ${member.firstName} ${member.lastName} (${cls.name})`, paidAt: start },
        })
      }
    }
    console.log('✓ 42 fighters created & enrolled, with attendance history')
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
