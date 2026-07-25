import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym, isAdmin } from '@/lib/getGym'

// GET: list all receptionist + coach accounts for this gym
export async function GET() {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  if (!isAdmin(result.session)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { gym } = result
  const accounts = await prisma.user.findMany({
    where: { staffGymId: gym.id, role: { in: ['RECEPTIONIST', 'COACH'] } },
    select: { id: true, name: true, email: true, role: true, createdAt: true, coach: true },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(accounts)
}

// POST: create a receptionist or coach account
export async function POST(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  if (!isAdmin(result.session)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { gym } = result
  const { name, email, password, role, sessionRate, specialties } = await req.json()
  if (!name || !email || !password) return NextResponse.json({ error: 'All fields required' }, { status: 400 })
  if (password.length < 8) return NextResponse.json({ error: 'Password must be 8+ characters' }, { status: 400 })
  const accountRole = role === 'COACH' ? 'COACH' : 'RECEPTIONIST'
  const cleanEmail = email.toLowerCase().trim()
  const exists = await prisma.user.findUnique({ where: { email: cleanEmail } })
  if (exists) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
  const hashed = await bcrypt.hash(password, 12)

  try {
    if (accountRole === 'COACH') {
      const [firstName, ...rest] = String(name).trim().split(' ')
      const lastName = rest.join(' ') || firstName
      const { user, coach } = await prisma.$transaction(async tx => {
        const user = await tx.user.create({
          data: { name, email: cleanEmail, password: hashed, role: 'COACH', staffGymId: gym.id },
        })
        const coach = await tx.coach.create({
          data: {
            gymId: gym.id, userId: user.id, firstName, lastName, email: cleanEmail,
            sessionRate: Number(sessionRate) || 0,
            specialties: specialties || null,
          },
        })
        return { user, coach }
      })
      return NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role, coach })
    }

    const account = await prisma.user.create({
      data: { name, email: cleanEmail, password: hashed, role: 'RECEPTIONIST', staffGymId: gym.id },
    })
    return NextResponse.json({ id: account.id, name: account.name, email: account.email, role: account.role })
  } catch (err: any) {
    if (err.code === 'P2002') return NextResponse.json({ error: 'Email already in use' }, { status: 409 })
    return NextResponse.json({ error: err?.message || 'Failed to create account' }, { status: 500 })
  }
}

// DELETE: remove a receptionist or coach account
export async function DELETE(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  if (!isAdmin(result.session)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { gym } = result
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })
  // Ensure the account belongs to this gym
  const account = await prisma.user.findFirst({ where: { id, staffGymId: gym.id, role: { in: ['RECEPTIONIST', 'COACH'] } } })
  if (!account) return NextResponse.json({ error: 'Account not found' }, { status: 404 })
  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
