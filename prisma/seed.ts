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
        address: '15 Al Haram St, Giza, Egypt',
        phone: '+20 100 123 4567', email: 'contact@ironcladfc.com',
        currency: 'EGP', timezone: 'Africa/Cairo', plan: 'PROFESSIONAL',
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
    { firstName: 'Sarah', lastName: 'Mitchell', email: 'sarah@vancefc.app', specialties: 'BJJ, Wrestling, MMA',      sessionRate: 450 },
    { firstName: 'Mike',  lastName: 'Torres',   email: 'mike@vancefc.app',  specialties: 'Muay Thai, Kickboxing',    sessionRate: 400 },
    { firstName: 'Dana',  lastName: 'Lee',      email: 'dana@vancefc.app',  specialties: 'Boxing, Conditioning',     sessionRate: 420 },
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
    { name: 'Kickboxing Adults',  category: 'KICKBOXING_ADULTS', type: 'GROUP', daysOfWeek: ['MON','WED','SAT'], startTimeOfDay: '18:00', duration: 60, capacity: 20, price: 1200, durationDays: 30, color: '#ffc700', coach: coaches[1] },
    { name: 'MMA Adults',         category: 'MMA_ADULTS',        type: 'GROUP', daysOfWeek: ['TUE','THU','SAT'], startTimeOfDay: '19:00', duration: 75, capacity: 16, price: 1400, durationDays: 30, color: '#e0161c', coach: coaches[0] },
    { name: 'BJJ Adults',         category: 'BJJ_ADULTS',        type: 'GROUP', daysOfWeek: ['MON','WED','FRI'], startTimeOfDay: '19:30', duration: 75, capacity: 16, price: 1300, durationDays: 30, color: '#ffda47', coach: coaches[0] },
    { name: 'Boxing Adults',      category: 'BOXING_ADULTS',     type: 'GROUP', daysOfWeek: ['MON','TUE','WED','THU','FRI'], startTimeOfDay: '07:00', duration: 60, capacity: 20, price: 1800, durationDays: 30, color: '#8f0e12', coach: coaches[2] },
    { name: 'Kids Kickboxing',    category: 'KICKBOXING_KIDS',   type: 'GROUP', daysOfWeek: ['TUE','THU'],       startTimeOfDay: '16:00', duration: 45, capacity: 14, price: 900, durationDays: 30, color: '#71717a', coach: coaches[1] },
    { name: 'Kids MMA Basics',    category: 'MMA_KIDS',          type: 'GROUP', daysOfWeek: ['WED','FRI'],       startTimeOfDay: '16:00', duration: 45, capacity: 14, price: 900, durationDays: 30, color: '#71717a', coach: coaches[0] },
    { name: 'Drop-In Boxing',     category: 'BOXING_ADULTS',     type: 'GROUP', daysOfWeek: ['SAT'],             startTimeOfDay: '10:00', duration: 60, capacity: 20, price: 300, durationDays: 7,  color: '#ffc700', coach: coaches[2] },
    { name: 'Private Boxing — 1:1',     category: 'BOXING_ADULTS',     type: 'PRIVATE', daysOfWeek: ['TUE','THU'], startTimeOfDay: '10:00', duration: 45, capacity: 1, price: 3500, durationDays: 30, color: '#ffc700', coach: coaches[2] },
    { name: 'Private Muay Thai — 1:1',  category: 'KICKBOXING_ADULTS', type: 'PRIVATE', daysOfWeek: ['MON','WED'], startTimeOfDay: '11:00', duration: 45, capacity: 1, price: 3500, durationDays: 30, color: '#e0161c', coach: coaches[1] },
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
        daysOfWeek: ['FRI'], startTimeOfDay: '20:00', duration: 60, capacity: 15, price: 1200, durationDays: 30,
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

    const egyptPrefixes = ['010','011','012','015']
    const usedPhones = new Set<string>()
    const nextEgyptPhone = (seed: number): string => {
      // Deterministic-but-unique 11-digit Egyptian mobile number matching ^01[0125]\d{8}$
      let phone = ''
      let n = seed
      do {
        const prefix = egyptPrefixes[n % egyptPrefixes.length]
        const rest = String(10000000 + (n * 7919) % 90000000).slice(0, 8)
        phone = `${prefix}${rest}`
        n++
      } while (usedPhones.has(phone))
      usedPhones.add(phone)
      return phone
    }

    for (let i = 0; i < 42; i++) {
      const first = firstNames[i % firstNames.length]
      const last = lastNames[(i * 3) % lastNames.length]
      const addedBy = pick(addedByPool)
      const createdAt = daysAgo(rand(1, 60)) // keep within a cycle or two so session math stays sane
      const isMinor = Math.random() < 0.3 // kids classes -> a parent phone on file

      const member = await prisma.member.create({
        data: {
          gymId: gym.id,
          fighterId: `${gym.fighterIdPrefix}${String(i + 1).padStart(4, '0')}`,
          firstName: first, lastName: last,
          email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@example.com`,
          phone: nextEgyptPhone(i),
          parentPhone: isMinor ? nextEgyptPhone(1000 + i) : null,
          birthYear: rand(1985, 2008),
          branchId: Math.random() < 0.7 ? pick(branches).id : null,
          createdById: addedBy,
          createdAt,
        },
      })

      // Most fighters sign into one class; ~20% train two disciplines at once;
      // ~15% also pick up a private 1:1 package (session-count based, not weekly).
      const classNamesForMember = Math.random() < 0.2
        ? [pick(['MMA Adults','Boxing Adults']), 'Kickboxing Adults']
        : [pick(singleClassNames)]
      const privateClassName = Math.random() < 0.15 ? pick(['Private Boxing — 1:1', 'Private Muay Thai — 1:1']) : null

      for (const className of Array.from(new Set(classNamesForMember))) {
        const cls = classes[className]
        const start = createdAt
        const end = new Date(start); end.setDate(end.getDate() + cls.durationDays)
        const now = new Date()
        let status = 'ACTIVE'
        if (end < now) status = pick(['EXPIRED','EXPIRED','ACTIVE'])
        if (Math.random() < 0.04) status = 'CANCELED'
        const wasRenewed = status === 'ACTIVE' && Math.random() < 0.15 // demonstrates a renewed subscription

        const enrollment = await prisma.classEnrollment.create({
          data: {
            memberId: member.id, classId: cls.id, status,
            startDate: start, endDate: end,
            addedById: addedBy, lastAction: wasRenewed ? 'RENEWED' : 'CREATED',
            lastActionById: wasRenewed ? pick(addedByPool) : addedBy,
            lastActionAt: wasRenewed ? daysAgo(rand(0, 10)) : start,
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

        // Occasional discount + a mix of payment statuses, so Payments filtering has something to show
        const discountRoll = Math.random()
        const discountType = discountRoll < 0.15 ? 'PERCENTAGE' : discountRoll < 0.25 ? 'FIXED' : 'NONE'
        const discountValue = discountType === 'PERCENTAGE' ? pick([10, 15, 20]) : discountType === 'FIXED' ? pick([100, 150, 200]) : 0
        const discountAmount = discountType === 'PERCENTAGE' ? cls.price * (discountValue / 100) : discountValue
        const amount = Math.max(0, Math.round((cls.price - discountAmount) * 100) / 100)
        const paymentStatus = Math.random() < 0.08 ? 'PENDING' : Math.random() < 0.03 ? 'FAILED' : 'COMPLETED'

        await prisma.payment.create({
          data: {
            gymId: gym.id, memberId: member.id, classId: cls.id, enrollmentId: enrollment.id,
            amount, originalAmount: cls.price, discountType, discountValue, currency: 'EGP', type: 'MEMBERSHIP',
            status: paymentStatus, method: pick(['CARD','CASH','INSTAPAY','VODAFONE_CASH']),
            description: `${wasRenewed ? 'Renewal' : 'New enrollment'} — ${member.firstName} ${member.lastName} (${cls.name})`,
            paidAt: paymentStatus === 'COMPLETED' ? start : null,
          },
        })
      }

      // Private 1:1 session package — priced per session, not a weekly plan
      if (privateClassName) {
        const cls = classes[privateClassName]
        const sessionCount = pick([4, 8, 10, 12])
        const start = createdAt
        const end = new Date(start); end.setFullYear(end.getFullYear() + 10) // private packages expire by session count, not date
        const privateEnrollment = await prisma.classEnrollment.create({
          data: {
            memberId: member.id, classId: cls.id, status: 'ACTIVE', startDate: start, endDate: end,
            sessionCount, addedById: addedBy, lastAction: 'CREATED', lastActionById: addedBy, lastActionAt: start,
          },
        })
        const amount = cls.price * sessionCount
        await prisma.payment.create({
          data: {
            gymId: gym.id, memberId: member.id, classId: cls.id, enrollmentId: privateEnrollment.id,
            amount, originalAmount: amount, discountType: 'NONE', discountValue: 0, currency: 'EGP', type: 'MEMBERSHIP',
            status: 'COMPLETED', method: pick(['CARD','CASH']),
            description: `New enrollment — ${member.firstName} ${member.lastName} (${cls.name}, ${sessionCount} sessions)`,
            paidAt: start,
          },
        })
      }
    }
    console.log('✓ 42 fighters created & enrolled, with attendance history')

    // Keep the atomic Fighter ID counter in sync with the batch above, so the
    // next fighter created through the app continues the sequence with no gaps.
    await prisma.gym.update({ where: { id: gym.id }, data: { fighterIdSeq: 42 } })
  }

  // ── Coach attendance (recorded by admin/reception only — coaches never self-check-in) ──
  const existingCoachAttendance = await prisma.coachAttendance.count({ where: { class: { gymId: gym.id } } })
  if (existingCoachAttendance === 0) {
    const markers = [user.id, receptionist.id]
    for (const coach of coaches) {
      const coachClasses = await prisma.gymClass.findMany({ where: { gymId: gym.id, coachId: coach.id, status: 'APPROVED' } })
      for (const cls of coachClasses) {
        let cursor = daysAgo(21)
        const today = new Date()
        while (cursor <= today) {
          const dayCode = DOW[cursor.getDay()]
          if (cls.daysOfWeek.includes(dayCode) && Math.random() < 0.9) {
            await prisma.coachAttendance.create({
              data: { coachId: coach.id, classId: cls.id, date: new Date(cursor), status: 'ATTENDED', method: pick(['MANUAL','QR']), markedById: pick(markers) },
            }).catch(() => {}) // ignore the rare unique-constraint hit if a date/class pair repeats across coach classes
          }
          cursor.setDate(cursor.getDate() + 1)
        }
      }
    }
    console.log('✓ Coach attendance history seeded')
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
    { firstName: 'Jordan', lastName: 'Blake', email: 'jordan.staff@ironcladfc.com', role: 'MANAGER', salary: 14000 },
    { firstName: 'Kim',    lastName: 'Adams', email: 'kim.staff@ironcladfc.com',    role: 'STAFF',   salary: 9000 },
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
    { name: 'Whey Protein (2lb)',        category: 'SUPPLEMENT',  costPrice: 550, sellPrice: 950, stock: 40 },
    { name: 'Pre-Workout',               category: 'SUPPLEMENT',  costPrice: 400, sellPrice: 750, stock: 25 },
    { name: 'Electrolyte Drink',         category: 'DRINK',       costPrice: 25, sellPrice: 60, stock: 120 },
    { name: 'Sports Water (24pk)',       category: 'DRINK',       costPrice: 150, sellPrice: 280, stock: 30 },
    { name: 'Ironclad FC T-Shirt',       category: 'MERCHANDISE', costPrice: 180, sellPrice: 400, stock: 60 },
    { name: 'Ironclad FC Hoodie',        category: 'MERCHANDISE', costPrice: 380, sellPrice: 750, stock: 35 },
    { name: 'Hand Wraps (5-Pack)',       category: 'GEAR',        costPrice: 220, sellPrice: 420, stock: 3 },
    { name: 'Sparring Gloves (16oz)',    category: 'GEAR',        costPrice: 650, sellPrice: 1200, stock: 15 },
    { name: 'Mouthguard',                category: 'OTHER',       costPrice: 60, sellPrice: 150, stock: 50 },
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
