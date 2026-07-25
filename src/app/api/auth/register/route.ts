import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { slugify } from '@/lib/utils'

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, clubName } = await req.json()
    if (!name || !email || !password || !clubName) return NextResponse.json({ error: 'All fields required' }, { status: 400 })
    if (password.length < 8) return NextResponse.json({ error: 'Password too short' }, { status: 400 })
    const exists = await prisma.user.findUnique({ where: { email } })
    if (exists) return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    const hashed = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({ data: { name, email, password: hashed, role: 'ADMIN' } })
    let slug = slugify(clubName)
    const slugExists = await prisma.gym.findUnique({ where: { slug } })
    if (slugExists) slug = `${slug}-${Date.now()}`
    await prisma.gym.create({ data: { name: clubName, slug, ownerId: user.id, plan: 'STARTER' } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 })
  }
}
