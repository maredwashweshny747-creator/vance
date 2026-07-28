import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionAndGym, isAdmin } from '@/lib/getGym'
export async function GET() {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  return NextResponse.json(result.gym)
}
export async function PATCH(req: NextRequest) {
  const result = await getSessionAndGym()
  if ('error' in result) return result.error
  if (!isAdmin(result.session)) return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  const { gym } = result
  const body = await req.json()
  const allowed = ['name','address','phone','email','currency','timezone','whatsappMessageTemplate']
  const data = Object.fromEntries(Object.entries(body).filter(([k]) => allowed.includes(k)))
  const updated = await prisma.gym.update({ where: { id: gym.id }, data })
  return NextResponse.json(updated)
}