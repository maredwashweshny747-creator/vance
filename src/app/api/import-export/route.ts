import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym, isAdmin } from '@/lib/getGym'

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
      include: { branch: { select: { name: true } }, membershipPlan: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
    const headers = ['id','firstName','lastName','email','phone','membershipPlan','membershipStatus','startDate','endDate','goals','healthConditions','emergencyContact','emergencyPhone','notes','branch','createdAt']
    const rows = members.map(m => ({
      id: m.id, firstName: m.firstName, lastName: m.lastName,
      email: m.email, phone: m.phone || '',
      membershipPlan: m.membershipPlan?.name || '', membershipStatus: m.membershipStatus,
      startDate: m.startDate ? new Date(m.startDate).toISOString().split('T')[0] : '',
      endDate: m.endDate ? new Date(m.endDate).toISOString().split('T')[0] : '',
      goals: m.goals || '', healthConditions: m.healthConditions || '',
      emergencyContact: m.emergencyContact || '', emergencyPhone: m.emergencyPhone || '',
      notes: m.notes || '', branch: (m as any).branch?.name || '',
      createdAt: new Date(m.createdAt).toISOString().split('T')[0],
    }))
    const csv = toCSV(rows, headers)
    return new NextResponse(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="members_${gym.slug}_${new Date().toISOString().split('T')[0]}.csv"` },
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
    const csv = 'firstName,lastName,email,phone,membershipPlan,startDate,goals,healthConditions,emergencyContact,emergencyPhone,notes\nJohn,Doe,john@example.com,+1555000001,Contender,2024-01-01,Build muscle,None,Jane Doe,+1555000002,VIP member'
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
  const { gym } = result

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })

    const text = await file.text()
    const rows = parseCSV(text)
    if (rows.length === 0) return NextResponse.json({ error: 'CSV is empty or has no data rows' }, { status: 400 })

    const results = { imported: 0, skipped: 0, errors: [] as string[] }
    const plans = await prisma.membershipPlan.findMany({ where: { gymId: gym.id } })
    const defaultPlan = plans.find(p => p.isActive) || plans[0] || null

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

      const planName = (row['membershipplan'] || row['membership_plan'] || row['membershipPlan'] || row['plan'] || '').trim().toLowerCase()
      const matchedPlan = plans.find(p => p.name.toLowerCase() === planName) || defaultPlan
      if (!matchedPlan) { results.skipped++; results.errors.push(`No membership plans exist yet — create one in Settings first (row: ${email})`); continue }

      const startDateRaw = row['startdate'] || row['start_date'] || row['startDate'] || ''
      const startDate    = startDateRaw ? new Date(startDateRaw) : new Date()
      if (isNaN(startDate.getTime())) { results.errors.push(`Invalid start date for ${email}, using today`); }

      const endDate = calcEndDate(isNaN(startDate.getTime()) ? new Date() : startDate, matchedPlan.durationDays)

      try {
        await prisma.member.create({
          data: {
            gymId: gym.id,
            firstName: firstName.trim(),
            lastName:  lastName.trim(),
            email:     email.trim().toLowerCase(),
            phone:     (row['phone'] || row['mobile'] || '').trim() || null,
            membershipPlanId: matchedPlan.id,
            membershipStatus: 'ACTIVE',
            startDate: isNaN(startDate.getTime()) ? new Date() : startDate,
            endDate,
            goals:            row['goals'] || null,
            healthConditions: row['healthconditions'] || row['health_conditions'] || row['healthConditions'] || null,
            emergencyContact: row['emergencycontact'] || row['emergency_contact'] || row['emergencyContact'] || null,
            emergencyPhone:   row['emergencyphone']   || row['emergency_phone']   || row['emergencyPhone']   || null,
            notes:            row['notes'] || null,
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
      message: `Imported ${results.imported} members. ${results.skipped > 0 ? `${results.skipped} skipped.` : ''}`,
      ...results,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Import failed' }, { status: 500 })
  }
}
