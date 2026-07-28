import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym, isAdmin } from '@/lib/getGym'
import { generateFighterId } from '@/lib/enrollment'

function calcEndDate(start: Date, durationDays: number): Date {
  const d = new Date(start)
  d.setDate(d.getDate() + (durationDays || 30))
  return d
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())
  return lines.slice(1).map(line => {
    const vals: string[] = []
    let cur = '', inQ = false
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ }
      else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = '' }
      else cur += ch
    }
    vals.push(cur.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = (vals[i] || '').replace(/^"|"$/g, '') })
    return row
  })
}

function toCSV(rows: Record<string, any>[], headers: string[]): string {
  const escape = (v: any) => {
    const s = v === null || v === undefined ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(',')]
  for (const row of rows) lines.push(headers.map(h => escape(row[h])).join(','))
  return lines.join('\n')
}

// GET — export data
export async function GET(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  const { gym } = result
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'members'

  if (type === 'members') {
    const members = await prisma.member.findMany({
      where: { gymId: gym.id },
      include: { branch: { select: { name: true } }, enrollments: { include: { class: true } } },
      orderBy: { createdAt: 'desc' },
    })
    const headers = ['id','firstName','lastName','email','phone','membershipPlans','membershipStatus','notes','branch','createdAt']
    const rows = members.map(m => {
      const overallStatus = m.enrollments.some(e => e.status === 'ACTIVE') ? 'ACTIVE'
        : m.enrollments.some(e => e.status === 'FROZEN') ? 'FROZEN'
        : m.enrollments.some(e => e.status === 'EXPIRED') ? 'EXPIRED'
        : m.enrollments.length > 0 ? 'CANCELED' : 'NO_PLAN'
      return {
        id: m.id, firstName: m.firstName, lastName: m.lastName,
        email: m.email, phone: m.phone || '',
        membershipPlans: m.enrollments.map(e => e.class.name).join('; '),
        membershipStatus: overallStatus,
        notes: m.notes || '', branch: (m as any).branch?.name || '',
        createdAt: new Date(m.createdAt).toISOString().split('T')[0],
      }
    })
    const csv = toCSV(rows, headers)
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="fighters_${gym.slug}_${new Date().toISOString().split('T')[0]}.csv"` },
    })
  }

  if (type === 'payments') {
    const payments = await prisma.payment.findMany({
      where: { gymId: gym.id },
      include: { member: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    })
    const headers = ['id','memberName','memberEmail','amount','currency','type','status','method','description','paidAt','createdAt']
    const rows = payments.map(p => ({
      id: p.id,
      memberName: p.member ? `${p.member.firstName} ${p.member.lastName}` : 'N/A',
      memberEmail: p.member?.email || '',
      amount: p.amount, currency: p.currency,
      type: p.type, status: p.status, method: p.method || '',
      description: p.description || '',
      paidAt: p.paidAt ? new Date(p.paidAt).toISOString().split('T')[0] : '',
      createdAt: new Date(p.createdAt).toISOString().split('T')[0],
    }))
    const csv = toCSV(rows, headers)
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="payments_${gym.slug}_${new Date().toISOString().split('T')[0]}.csv"` },
    })
  }

  if (type === 'leads') {
    const leads = await prisma.lead.findMany({ where: { gymId: gym.id }, orderBy: { createdAt: 'desc' } })
    const headers = ['id','firstName','lastName','email','phone','source','status','assignedTo','notes','followUpAt','createdAt']
    const rows = leads.map(l => ({
      id: l.id, firstName: l.firstName, lastName: l.lastName,
      email: l.email || '', phone: l.phone || '',
      source: l.source, status: l.status, assignedTo: l.assignedTo || '',
      notes: l.notes || '',
      followUpAt: l.followUpAt ? new Date(l.followUpAt).toISOString().split('T')[0] : '',
      createdAt: new Date(l.createdAt).toISOString().split('T')[0],
    }))
    const csv = toCSV(rows, headers)
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="leads_${gym.slug}_${new Date().toISOString().split('T')[0]}.csv"` },
    })
  }

  if (type === 'template') {
    // Return blank import template
    const csv = 'firstName,lastName,email,phone,class,startDate,notes\nJohn,Doe,john@example.com,+1555000001,Kickboxing Adults,2024-01-01,VIP fighter'
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="vance_import_template.csv"' },
    })
  }

  return NextResponse.json({ error: 'Unknown export type' }, { status: 400 })
}

// POST — import members from CSV
export async function POST(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  if (!isAdmin(result.session)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { gym, user } = result
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const text = await file.text()
    const rows = parseCSV(text)
    if (rows.length === 0) return NextResponse.json({ error: 'CSV is empty or has no data rows' }, { status: 400 })

    const results = { imported: 0, skipped: 0, errors: [] as string[] }
    const classes = await prisma.gymClass.findMany({ where: { gymId: gym.id, status: 'APPROVED' } })
    const defaultClass = classes.find(c => c.isActive) || classes[0] || null

    for (const row of rows) {
      const firstName = row['firstname'] || row['first_name'] || row['first name'] || ''
      const lastName  = row['lastname']  || row['last_name']  || row['last name']  || ''
      const email     = row['email'] || ''

      if (!firstName || !lastName || !email) {
        results.skipped++
        results.errors.push(`Row skipped — missing firstName, lastName, or email: ${JSON.stringify(row)}`)
        continue
      }

      // Check duplicate
      const existing = await prisma.member.findFirst({ where: { gymId: gym.id, email: email.trim().toLowerCase() } })
      if (existing) { results.skipped++; results.errors.push(`Skipped duplicate email: ${email}`); continue }

      const className = (row['class'] || row['membershipplan'] || row['membership_plan'] || row['plan'] || '').trim().toLowerCase()
      const matchedClass = classes.find(c => c.name.toLowerCase() === className) || defaultClass
      if (!matchedClass) { results.skipped++; results.errors.push(`No classes exist yet — create one in Classes first (row: ${email})`); continue }

      const startDateRaw = row['startdate'] || row['start_date'] || row['startDate'] || ''
      const startDate    = startDateRaw ? new Date(startDateRaw) : new Date()
      if (isNaN(startDate.getTime())) { results.errors.push(`Invalid start date for ${email}, using today`); }

      const endDate = calcEndDate(isNaN(startDate.getTime()) ? new Date() : startDate, matchedClass.durationDays)

      try {
        const fighterId = await generateFighterId(gym.id)
        const member = await prisma.member.create({
          data: {
            gymId: gym.id,
            fighterId,
            firstName: firstName.trim(),
            lastName:  lastName.trim(),
            email:     email.trim().toLowerCase(),
            phone:     (row['phone'] || row['mobile'] || '').trim() || null,
            notes:            row['notes'] || null,
            createdById: user.id,
          },
        })
        await prisma.classEnrollment.create({
          data: {
            memberId: member.id, classId: matchedClass.id, status: 'ACTIVE',
            startDate: isNaN(startDate.getTime()) ? new Date() : startDate, endDate,
            addedById: user.id, lastAction: 'CREATED', lastActionById: user.id, lastActionAt: new Date(),
          },
        })
        results.imported++
      } catch (err: any) {
        results.skipped++
        results.errors.push(`Failed to import ${email}: ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Imported ${results.imported} fighters. ${results.skipped > 0 ? `${results.skipped} skipped.` : ''}`,
      ...results,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 })
  }
}
